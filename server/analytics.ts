import type {
  AnalyticsSummary,
  DateRangeKey,
  ExpenseCategory,
  ExpenseCategoryStat,
  Order,
  TopProductStat,
  TrajectoryPoint,
  WorkspaceData,
} from '../shared/types.js';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getRangeStart(range: DateRangeKey, now: Date): Date {
  const today = startOfDay(now);
  switch (range) {
    case 'today':
      return today;
    case '7d':
      return new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
    case 'year':
      return new Date(now.getFullYear(), 0, 1);
  }
}

export function computeAnalytics(
  workspace: WorkspaceData,
  range: DateRangeKey = '30d'
): AnalyticsSummary {
  const now = new Date();
  const rangeStart = getRangeStart(range, now);
  const todayStart = startOfDay(now);
  const sevenDayStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

  const ordersInRange = workspace.orders.filter(
    (o) => new Date(o.createdAt) >= rangeStart && o.status !== 'cancelled'
  );
  const completedInRange = ordersInRange.filter((o) => o.status === 'completed');

  const expensesInRange = workspace.expenses.filter(
    (e) => new Date(e.date) >= rangeStart
  );

  const revenue = completedInRange.reduce((sum, o) => sum + o.totalAmount, 0);
  const cogs = completedInRange.reduce((sum, o) => sum + o.totalCost, 0);
  const grossProfit = revenue - cogs;
  const operatingExpenses = expensesInRange.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = grossProfit - operatingExpenses;
  const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const avgOrderValue =
    completedInRange.length > 0 ? revenue / completedInRange.length : 0;

  // Today vs 7-day benchmark
  const todayOrders = workspace.orders.filter(
    (o) => o.status === 'completed' && new Date(o.createdAt) >= todayStart
  );
  const todayExpensesList = workspace.expenses.filter(
    (e) => new Date(e.date) >= todayStart
  );
  const todayRevenue = todayOrders.reduce((s, o) => s + o.totalAmount, 0);
  const todayCogs = todayOrders.reduce((s, o) => s + o.totalCost, 0);
  const todayExpenses = todayExpensesList.reduce((s, e) => s + e.amount, 0);
  const todayNetProfit = todayRevenue - todayCogs - todayExpenses;

  const sevenDayOrders = workspace.orders.filter(
    (o) => o.status === 'completed' && new Date(o.createdAt) >= sevenDayStart
  );
  const sevenDayAvgRevenue =
    sevenDayOrders.reduce((s, o) => s + o.totalAmount, 0) / 7;

  // Build trajectory buckets
  const trajectory = buildTrajectory(
    completedInRange,
    expensesInRange,
    range,
    now
  );

  // Top products
  const productMap = new Map<string, TopProductStat>();
  for (const order of completedInRange) {
    for (const item of order.items) {
      const existing = productMap.get(item.productId) ?? {
        productId: item.productId,
        sku: item.sku,
        name: item.productName,
        unitsSold: 0,
        revenue: 0,
        profit: 0,
      };
      existing.unitsSold += item.quantity;
      existing.revenue += item.quantity * item.unitPrice;
      existing.profit += item.quantity * (item.unitPrice - item.unitCost);
      productMap.set(item.productId, existing);
    }
  }
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Recent orders
  const recentOrders = [...workspace.orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  // Inventory health
  let totalUnits = 0;
  let retailValuation = 0;
  let costValuation = 0;
  let healthyCount = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  const lowStockItems = [];
  const outOfStockItems = [];

  for (const p of workspace.products) {
    totalUnits += p.stockQty;
    retailValuation += p.stockQty * p.retailPrice;
    costValuation += p.stockQty * p.costPrice;
    if (p.stockQty <= 0) {
      outOfStockCount += 1;
      outOfStockItems.push(p);
    } else if (p.stockQty <= p.lowStockThreshold) {
      lowStockCount += 1;
      lowStockItems.push(p);
    } else {
      healthyCount += 1;
    }
  }

  // Expense category breakdown
  const catMap = new Map<ExpenseCategory, number>();
  for (const exp of expensesInRange) {
    catMap.set(exp.category, (catMap.get(exp.category) ?? 0) + exp.amount);
  }
  const expenseBreakdown: ExpenseCategoryStat[] = Array.from(catMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      sharePct: operatingExpenses > 0 ? (amount / operatingExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    range,
    revenue,
    cogs,
    grossProfit,
    operatingExpenses,
    netProfit,
    grossMarginPct,
    orderCount: ordersInRange.length,
    completedOrderCount: completedInRange.length,
    avgOrderValue,
    trajectory,
    topProducts,
    recentOrders,
    inventory: {
      totalSkus: workspace.products.length,
      totalUnits,
      retailValuation,
      costValuation,
      healthyCount,
      lowStockCount,
      outOfStockCount,
      lowStockItems,
      outOfStockItems,
    },
    expenseBreakdown,
    todayBenchmark: {
      todayRevenue,
      todayCogs,
      todayExpenses,
      todayNetProfit,
      sevenDayAvgRevenue,
    },
  };
}

function buildTrajectory(
  orders: Order[],
  expenses: { date: string; amount: number }[],
  range: DateRangeKey,
  now: Date
): TrajectoryPoint[] {
  if (range === 'today') {
    const blocks = [
      { label: '00:00', startH: 0, endH: 4 },
      { label: '04:00', startH: 4, endH: 8 },
      { label: '08:00', startH: 8, endH: 12 },
      { label: '12:00', startH: 12, endH: 16 },
      { label: '16:00', startH: 16, endH: 20 },
      { label: '20:00', startH: 20, endH: 24 },
    ];
    return blocks.map((b) => {
      const bucketOrders = orders.filter((o) => {
        const h = new Date(o.createdAt).getHours();
        return h >= b.startH && h < b.endH;
      });
      const bucketExp = expenses.filter((e) => {
        const h = new Date(e.date).getHours();
        return h >= b.startH && h < b.endH;
      });
      const rev = bucketOrders.reduce((s, o) => s + o.totalAmount, 0);
      const cost = bucketOrders.reduce((s, o) => s + o.totalCost, 0);
      const exp = bucketExp.reduce((s, e) => s + e.amount, 0);
      return {
        label: b.label,
        revenue: rev,
        profit: rev - cost - exp,
        expenses: exp,
      };
    });
  }

  if (range === '7d' || range === '30d') {
    const days = range === '7d' ? 7 : 10;
    const stepDays = range === '7d' ? 1 : 3;
    const points: TrajectoryPoint[] = [];
    const today = startOfDay(now);

    for (let i = days - 1; i >= 0; i--) {
      const endMs = today.getTime() - i * stepDays * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000;
      const startMs = endMs - stepDays * 24 * 60 * 60 * 1000;
      const bucketDate = new Date(startMs);
      const label = bucketDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      const bucketOrders = orders.filter((o) => {
        const t = new Date(o.createdAt).getTime();
        return t >= startMs && t < endMs;
      });
      const bucketExp = expenses.filter((e) => {
        const t = new Date(e.date).getTime();
        return t >= startMs && t < endMs;
      });

      const rev = bucketOrders.reduce((s, o) => s + o.totalAmount, 0);
      const cost = bucketOrders.reduce((s, o) => s + o.totalCost, 0);
      const exp = bucketExp.reduce((s, e) => s + e.amount, 0);
      points.push({
        label,
        revenue: rev,
        profit: rev - cost - exp,
        expenses: exp,
      });
    }
    return points;
  }

  // 'year' -> monthly buckets up to current month
  const months: TrajectoryPoint[] = [];
  const currentMonth = now.getMonth();
  for (let m = 0; m <= currentMonth; m++) {
    const label = new Date(now.getFullYear(), m, 1).toLocaleDateString('en-US', {
      month: 'short',
    });
    const bucketOrders = orders.filter((o) => {
      const d = new Date(o.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === m;
    });
    const bucketExp = expenses.filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === m;
    });
    const rev = bucketOrders.reduce((s, o) => s + o.totalAmount, 0);
    const cost = bucketOrders.reduce((s, o) => s + o.totalCost, 0);
    const exp = bucketExp.reduce((s, e) => s + e.amount, 0);
    months.push({
      label,
      revenue: rev,
      profit: rev - cost - exp,
      expenses: exp,
    });
  }
  return months;
}
