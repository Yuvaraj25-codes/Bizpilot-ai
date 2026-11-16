import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  PackageCheck,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import type {
  AnalyticsSummary,
  DateRangeKey,
  Order,
  SectionFilter,
  WorkspaceData,
} from '../../shared/types.ts';
import { formatMoney, formatShortDate, maskPhone } from '../lib/formatters.ts';
import { TrajectoryChart } from './TrajectoryChart.tsx';

interface DashboardViewProps {
  workspace: WorkspaceData;
  analytics: AnalyticsSummary;
  dateRange: DateRangeKey;
  onDateRangeChange: (r: DateRangeKey) => void;
  sectionFilter: SectionFilter;
  onSectionFilterChange: (s: SectionFilter) => void;
  onQuickRestock: (productId: string) => Promise<void>;
  onNavigateTab: (
    tab: 'dashboard' | 'inventory' | 'sales' | 'finance' | 'pilot' | 'settings'
  ) => void;
  onSelectOrder: (order: Order) => void;
  restockingId: string | null;
}

const DATE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: 'year', label: 'This Year' },
];

const SECTION_OPTIONS: { key: SectionFilter; label: string }[] = [
  { key: 'all', label: 'All Summaries' },
  { key: 'sales', label: 'Sales' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'expenses', label: 'Expenses' },
];

export function DashboardView({
  workspace,
  analytics,
  dateRange,
  onDateRangeChange,
  sectionFilter,
  onSectionFilterChange,
  onQuickRestock,
  onNavigateTab,
  onSelectOrder,
  restockingId,
}: DashboardViewProps) {
  const { currency, publicMode } = workspace.settings;
  const showSales = sectionFilter === 'all' || sectionFilter === 'sales';
  const showInventory = sectionFilter === 'all' || sectionFilter === 'inventory';
  const showExpenses = sectionFilter === 'all' || sectionFilter === 'expenses';

  const { healthyCount, lowStockCount, outOfStockCount, totalSkus } =
    analytics.inventory;
  const healthyPct = totalSkus > 0 ? (healthyCount / totalSkus) * 100 : 0;
  const lowPct = totalSkus > 0 ? (lowStockCount / totalSkus) * 100 : 0;
  const outPct = totalSkus > 0 ? (outOfStockCount / totalSkus) * 100 : 0;

  const alertProducts = [
    ...analytics.inventory.outOfStockItems,
    ...analytics.inventory.lowStockItems,
  ];

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-[#162033] border border-white/[0.08] rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-1.5 bg-[#101828] p-1 rounded-lg border border-white/[0.06]">
          {DATE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onDateRangeChange(opt.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                dateRange === opt.key
                  ? 'bg-[#3B82F6] text-white'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-[#101828] p-1 rounded-lg border border-white/[0.06]">
          {SECTION_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onSectionFilterChange(opt.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sectionFilter === opt.key
                  ? 'bg-[#06B6D4]/20 text-[#22D3EE] border border-[#06B6D4]/40'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.05] border border-transparent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. SALES SUMMARY */}
      {showSales && (
        <section className="space-y-4" aria-label="Sales Summary">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">
                Sales Summary
              </h2>
              <p className="text-xs text-slate-400">
                Completed order revenue, trajectory, and top-performing SKUs
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('sales')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3B82F6] hover:text-[#22D3EE] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Manage Orders</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-[#162033] border border-white/[0.08] rounded-xl p-5">
              <p className="text-xs text-slate-400">Completed Revenue</p>
              <p className="mt-2 text-2xl font-semibold text-white font-mono tabular-nums">
                {formatMoney(analytics.revenue, currency, false)}
              </p>
              <p className="mt-1.5 text-xs text-slate-400 font-mono tabular-nums">
                {analytics.completedOrderCount} completed · {analytics.orderCount} active orders
              </p>
            </div>

            <div className="bg-[#162033] border border-white/[0.08] rounded-xl p-5">
              <p className="text-xs text-slate-400">
                Net Profit {publicMode && '· Masked'}
              </p>
              <p
                className={`mt-2 text-2xl font-semibold font-mono tabular-nums ${
                  publicMode
                    ? 'text-slate-300'
                    : analytics.netProfit >= 0
                    ? 'text-[#06B6D4]'
                    : 'text-rose-400'
                }`}
              >
                {formatMoney(analytics.netProfit, currency, publicMode)}
              </p>
              <p className="mt-1.5 text-xs text-slate-400 font-mono tabular-nums">
                {publicMode
                  ? 'Privacy Shield active'
                  : `Gross margin ${analytics.grossMarginPct.toFixed(1)}%`}
              </p>
            </div>

            <div className="bg-[#162033] border border-white/[0.08] rounded-xl p-5">
              <p className="text-xs text-slate-400">Average Order Value</p>
              <p className="mt-2 text-2xl font-semibold text-white font-mono tabular-nums">
                {formatMoney(analytics.avgOrderValue, currency, false)}
              </p>
              <p className="mt-1.5 text-xs text-slate-400 font-mono tabular-nums">
                Across {analytics.completedOrderCount} fulfilled orders
              </p>
            </div>

            <div className="bg-[#162033] border border-white/[0.08] rounded-xl p-5">
              <p className="text-xs text-slate-400">Today vs 7-Day Avg</p>
              <p className="mt-2 text-2xl font-semibold text-white font-mono tabular-nums">
                {formatMoney(
                  analytics.todayBenchmark.todayRevenue,
                  currency,
                  false
                )}
              </p>
              <p className="mt-1.5 text-xs text-slate-400 font-mono tabular-nums">
                7d daily avg:{' '}
                {formatMoney(
                  analytics.todayBenchmark.sevenDayAvgRevenue,
                  currency,
                  false
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 bg-[#162033] border border-white/[0.08] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#3B82F6]" />
                  <span>Revenue & Profit Trajectory</span>
                </h3>
                <span className="text-xs text-slate-400">
                  Interactive hover points
                </span>
              </div>
              <TrajectoryChart
                points={analytics.trajectory}
                currency={currency}
                publicMode={publicMode}
              />
            </div>

            <div className="bg-[#162033] border border-white/[0.08] rounded-xl p-5 flex flex-col">
              <h3 className="text-sm font-semibold text-white mb-4">
                Top-Selling Products
              </h3>
              {analytics.topProducts.length === 0 ? (
                <p className="text-xs text-slate-400 my-auto">
                  No completed product sales in this date window.
                </p>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {analytics.topProducts.map((prod) => (
                    <div
                      key={prod.productId}
                      className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-100 truncate">
                          {prod.name}
                        </p>
                        <p className="text-xs text-slate-400 font-mono tabular-nums">
                          {prod.sku} · {prod.unitsSold} units
                        </p>
                      </div>
                      <div className="text-right shrink-0 font-mono tabular-nums">
                        <p className="text-sm font-semibold text-white">
                          {formatMoney(prod.revenue, currency, false)}
                        </p>
                        <p className="text-xs text-[#06B6D4]">
                          {publicMode
                            ? 'Profit •••'
                            : `+${formatMoney(prod.profit, currency, false)}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#162033] border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Recent Orders</h3>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                Latest {analytics.recentOrders.length} orders
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] text-xs text-slate-400">
                    <th className="py-3 px-5 font-medium">Order</th>
                    <th className="py-3 px-4 font-medium">Customer</th>
                    <th className="py-3 px-4 font-medium">Phone</th>
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-5 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-sm">
                  {analytics.recentOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3 px-5 font-mono text-xs font-medium">
                        <button
                          type="button"
                          onClick={() => onSelectOrder(order)}
                          className="text-[#3B82F6] hover:text-[#22D3EE] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] rounded cursor-pointer"
                        >
                          {order.orderNumber}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-slate-100">
                        {order.customerName}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-400 tabular-nums">
                        {maskPhone(order.customerPhone, publicMode)}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 font-mono tabular-nums">
                        {formatShortDate(order.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <span
                          className={`inline-flex items-center gap-1.5 font-medium ${
                            order.status === 'completed'
                              ? 'text-emerald-400'
                              : order.status === 'pending'
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {order.status === 'completed' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : order.status === 'pending' ? (
                            <Clock className="w-3.5 h-3.5" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                          <span className="capitalize">{order.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-5 text-right font-mono tabular-nums font-medium text-white">
                        {formatMoney(order.totalAmount, currency, false)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* 2. INVENTORY SUMMARY */}
      {showInventory && (
        <section className="space-y-4" aria-label="Inventory Summary">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">
                Inventory Summary
              </h2>
              <p className="text-xs text-slate-400">
                Catalog retail & cost valuation, stock health distribution, and restock alerts
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('inventory')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3B82F6] hover:text-[#22D3EE] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Open Catalog</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-[#162033] border border-white/[0.08] rounded-xl p-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400">Retail Valuation</p>
                  <p className="mt-1 text-xl font-semibold text-white font-mono tabular-nums">
                    {formatMoney(
                      analytics.inventory.retailValuation,
                      currency,
                      false
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">
                    Cost Valuation {publicMode && '· Masked'}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-[#06B6D4] font-mono tabular-nums">
                    {formatMoney(
                      analytics.inventory.costValuation,
                      currency,
                      publicMode
                    )}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.08]">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-300 font-medium">
                    Stock Health Distribution
                  </span>
                  <span className="text-slate-400 font-mono tabular-nums">
                    {analytics.inventory.totalUnits} units · {totalSkus} SKUs
                  </span>
                </div>
                <div className="h-2.5 w-full bg-[#101828] rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${healthyPct}%` }}
                    className="bg-emerald-500 h-full"
                    title={`Healthy: ${healthyCount}`}
                  />
                  <div
                    style={{ width: `${lowPct}%` }}
                    className="bg-amber-500 h-full"
                    title={`Low Stock: ${lowStockCount}`}
                  />
                  <div
                    style={{ width: `${outPct}%` }}
                    className="bg-rose-500 h-full"
                    title={`Out of Stock: ${outOfStockCount}`}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
                  <span className="text-emerald-400">
                    Healthy: {healthyCount}
                  </span>
                  <span className="text-amber-400">
                    Low Stock: {lowStockCount}
                  </span>
                  <span className="text-rose-400">
                    Out of Stock: {outOfStockCount}
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-[#162033] border border-white/[0.08] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Low-Stock & Out-of-Stock Alerts</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  {alertProducts.length} action items
                </span>
              </div>

              {alertProducts.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-center text-slate-400">
                  <PackageCheck className="w-7 h-7 text-emerald-400 mb-2" />
                  <p className="text-sm text-slate-200 font-medium">
                    All SKUs are above threshold
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Inventory levels are currently healthy across your catalog.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {alertProducts.map((item) => {
                    const isOut = item.stockQty <= 0;
                    return (
                      <div
                        key={item.id}
                        className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">
                              {item.name}
                            </span>
                            <span
                              className={`text-xs font-medium ${
                                isOut ? 'text-rose-400' : 'text-amber-400'
                              }`}
                            >
                              {isOut ? 'Out of Stock' : 'Low Stock'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
                            {item.sku} · {item.stockQty} left (threshold{' '}
                            {item.lowStockThreshold})
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={restockingId === item.id}
                          onClick={() => onQuickRestock(item.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#101828] hover:bg-[#3B82F6] text-slate-200 hover:text-white border border-white/[0.1] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${
                              restockingId === item.id ? 'animate-spin' : ''
                            }`}
                          />
                          <span>+10 Restock</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 3. EXPENSE SUMMARY */}
      {showExpenses && (
        <section className="space-y-4" aria-label="Expense Summary">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">
                Expense & Cost Summary
              </h2>
              <p className="text-xs text-slate-400">
                Operating expenses, cost of goods sold, and category spend distribution
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('finance')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3B82F6] hover:text-[#22D3EE] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Finance Ledger</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-[#162033] border border-white/[0.08] rounded-xl p-5 space-y-4">
              <div>
                <p className="text-xs text-slate-400">Operating Expenses</p>
                <p className="mt-1 text-2xl font-semibold text-white font-mono tabular-nums">
                  {formatMoney(analytics.operatingExpenses, currency, false)}
                </p>
              </div>
              <div className="pt-4 border-t border-white/[0.08] grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400">
                    COGS {publicMode && '· Masked'}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-200 font-mono tabular-nums">
                    {formatMoney(analytics.cogs, currency, publicMode)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">
                    Gross Profit {publicMode && '· Masked'}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[#06B6D4] font-mono tabular-nums">
                    {formatMoney(analytics.grossProfit, currency, publicMode)}
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-[#162033] border border-white/[0.08] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">
                  Category Breakdown
                </h3>
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  {analytics.expenseBreakdown.length} active categories
                </span>
              </div>

              {analytics.expenseBreakdown.length === 0 ? (
                <p className="text-xs text-slate-400 py-6">
                  No operating expenses recorded in this period.
                </p>
              ) : (
                <div className="space-y-3.5">
                  {analytics.expenseBreakdown.map((cat) => (
                    <div key={cat.category} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-200 font-medium">
                          {cat.category}
                        </span>
                        <span className="font-mono tabular-nums text-slate-300">
                          {formatMoney(cat.amount, currency, false)}{' '}
                          <span className="text-slate-400">
                            ({cat.sharePct.toFixed(1)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-2 w-full bg-[#101828] rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, cat.sharePct)}%` }}
                          className="h-full bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
