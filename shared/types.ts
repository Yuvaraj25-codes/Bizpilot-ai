export type DateRangeKey = 'today' | '7d' | '30d' | 'year';
export type SectionFilter = 'all' | 'sales' | 'inventory' | 'expenses';
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'INR';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  costPrice: number;
  retailPrice: number;
  stockQty: number;
  lowStockThreshold: number;
  updatedAt: string;
}

export type OrderStatus = 'pending' | 'completed' | 'cancelled';

export interface OrderItem {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
  totalCost: number;
  createdAt: string;
}

export type ExpenseCategory =
  | 'Payroll'
  | 'Marketing'
  | 'Logistics'
  | 'Software'
  | 'Utilities'
  | 'Inventory Restock'
  | 'Other';

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  notes?: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueDate: string;
}

export interface WorkspaceSettings {
  businessName: string;
  currency: CurrencyCode;
  publicMode: boolean;
  telemetryAlerts: boolean;
  lowStockDefault: number;
  cloudSyncEnabled: boolean;
  syncCode: string;
  lastSyncedAt: string | null;
}

export interface WorkspaceData {
  id: string;
  products: Product[];
  orders: Order[];
  expenses: Expense[];
  invoices: Invoice[];
  settings: WorkspaceSettings;
  updatedAt: string;
}

export interface TrajectoryPoint {
  label: string;
  revenue: number;
  profit: number;
  expenses: number;
}

export interface TopProductStat {
  productId: string;
  sku: string;
  name: string;
  unitsSold: number;
  revenue: number;
  profit: number;
}

export interface ExpenseCategoryStat {
  category: ExpenseCategory;
  amount: number;
  sharePct: number;
}

export interface AnalyticsSummary {
  range: DateRangeKey;
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  grossMarginPct: number;
  orderCount: number;
  completedOrderCount: number;
  avgOrderValue: number;
  trajectory: TrajectoryPoint[];
  topProducts: TopProductStat[];
  recentOrders: Order[];
  inventory: {
    totalSkus: number;
    totalUnits: number;
    retailValuation: number;
    costValuation: number;
    healthyCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    lowStockItems: Product[];
    outOfStockItems: Product[];
  };
  expenseBreakdown: ExpenseCategoryStat[];
  todayBenchmark: {
    todayRevenue: number;
    todayCogs: number;
    todayExpenses: number;
    todayNetProfit: number;
    sevenDayAvgRevenue: number;
  };
}

export interface DailyAiBrief {
  headline: string;
  executiveSummary: string;
  winsHighlight: string;
  riskAlert: string;
  recommendedAction: string;
  healthStatus: 'Strong' | 'Steady' | 'Attention Needed';
  generatedAt: string;
}

export interface AiActionReceipt {
  tool: string;
  summary: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actionsTaken?: AiActionReceipt[];
  timestamp: string;
}
