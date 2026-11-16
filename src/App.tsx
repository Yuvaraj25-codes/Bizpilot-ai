import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import {
  BarChart3,
  Bot,
  Eye,
  EyeOff,
  Landmark,
  Menu,
  Package,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  AnalyticsSummary,
  ChatMessage,
  DailyAiBrief,
  DateRangeKey,
  ExpenseCategory,
  InvoiceStatus,
  Order,
  OrderStatus,
  Product,
  SectionFilter,
  WorkspaceData,
  WorkspaceSettings,
} from '../shared/types.ts';
import {
  api,
  getActiveWorkspaceId,
  setActiveWorkspaceId,
} from './lib/api.ts';
import { DashboardView } from './components/DashboardView.tsx';
import { InventoryView } from './components/InventoryView.tsx';
import { SalesView } from './components/SalesView.tsx';
import { FinanceView } from './components/FinanceView.tsx';
import { AiPilotView } from './components/AiPilotView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { DailyAiSummaryModal } from './components/DailyAiSummaryModal.tsx';
import {
  CommandPalette,
  type NavTab,
} from './components/CommandPalette.tsx';
import { OrderDetailsModal } from './components/OrderDetailsModal.tsx';

const NAV_ITEMS: { id: NavTab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'sales', label: 'Sales & Orders', icon: ShoppingCart },
  { id: 'finance', label: 'Finance & Invoices', icon: Landmark },
  { id: 'pilot', label: 'AI Pilot', icon: Bot },
];

const TAB_TITLES: Record<NavTab, string> = {
  dashboard: 'Dashboard',
  inventory: 'Inventory Catalog',
  sales: 'Sales & Orders',
  finance: 'Finance & Invoices',
  pilot: 'AI Pilot',
  settings: 'Workspace Settings',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState<DateRangeKey>('30d');
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all');
  const [restockingId, setRestockingId] = useState<string | null>(null);
  const [createOrderTrigger, setCreateOrderTrigger] = useState(0);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [inventorySearch, setInventorySearch] = useState<{
    query: string;
    nonce: number;
  } | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Daily AI Brief Modal state
  const [briefModalOpen, setBriefModalOpen] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [briefData, setBriefData] = useState<DailyAiBrief | null>(null);

  // AI Pilot Chat state
  const [pilotMessages, setPilotMessages] = useState<ChatMessage[]>([]);
  const [pilotSending, setPilotSending] = useState(false);

  const loadWorkspace = useCallback(async (range: DateRangeKey) => {
    try {
      setLoadError(null);
      const res = await api.fetchWorkspace(range);
      setWorkspace(res.workspace);
      setAnalytics(res.analytics);
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to connect to BizPilot server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspace(dateRange);
  }, [dateRange, loadWorkspace]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const applyResponse = (res: {
    workspace: WorkspaceData;
    analytics: AnalyticsSummary;
  }) => {
    setWorkspace(res.workspace);
    setAnalytics(res.analytics);
  };

  const handleTogglePublicMode = async () => {
    if (!workspace) return;
    const next = !workspace.settings.publicMode;
    const res = await api.updateSettings({ publicMode: next }, dateRange);
    applyResponse(res);
  };

  const handleQuickRestock = async (productId: string) => {
    setRestockingId(productId);
    try {
      const res = await api.restockProduct(productId, 10, dateRange);
      applyResponse(res);
    } finally {
      setRestockingId(null);
    }
  };

  const handleTriggerDailyBrief = async () => {
    setBriefModalOpen(true);
    if (briefLoading) return;
    setBriefLoading(true);
    setBriefError(null);
    try {
      const res = await api.generateDailyBrief();
      setBriefData(res.brief);
    } catch (err: any) {
      setBriefError(err?.message || 'Failed to generate Daily AI Brief.');
    } finally {
      setBriefLoading(false);
    }
  };

  const handleSendPilotMessage = async (text: string) => {
    if (pilotSending) return;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [...pilotMessages, userMsg];
    setPilotMessages(nextHistory);
    setPilotSending(true);

    try {
      const res = await api.sendPilotMessage(text, pilotMessages, dateRange);
      applyResponse({ workspace: res.workspace, analytics: res.analytics });
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        actionsTaken: res.actionsTaken,
        timestamp: new Date().toISOString(),
      };
      setPilotMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err?.message || 'Unable to reach AI Pilot.'}`,
        timestamp: new Date().toISOString(),
      };
      setPilotMessages((prev) => [...prev, errMsg]);
    } finally {
      setPilotSending(false);
    }
  };

  const handleCloudSync = async (
    syncCode: string,
    direction: 'push' | 'pull'
  ) => {
    const cleanId = syncCode.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const res = await api.syncWorkspace(syncCode, direction, dateRange);
    if (cleanId) {
      setActiveWorkspaceId(cleanId);
    }
    applyResponse(res);
  };

  const handleResetSession = async () => {
    const res = await api.resetWorkspace(dateRange);
    setBriefData(null);
    setPilotMessages([]);
    applyResponse(res);
  };

  const navigateTo = (tab: NavTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const lowAndOutCount = analytics
    ? analytics.inventory.lowStockCount + analytics.inventory.outOfStockCount
    : 0;

  const selectedOrder =
    workspace && selectedOrderId
      ? workspace.orders.find(
          (o) => o.id === selectedOrderId || o.orderNumber === selectedOrderId
        ) ?? null
      : null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#101828] text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-[#0d1422] border-r border-white/[0.08] sticky top-0 h-screen">
        <div className="px-6 py-5 border-b border-white/[0.08] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#06B6D4] flex items-center justify-center text-white font-display font-bold text-sm shrink-0">
            BP
          </div>
          <span className="text-lg font-display font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            BizPilot AI
          </span>
        </div>

        <div className="px-3 pt-4 pb-1">
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#101828] hover:bg-[#162033] border border-white/[0.08] text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-[#06B6D4] shrink-0" />
              <span className="truncate">Quick Command</span>
            </span>
            <kbd className="font-mono text-[11px] text-slate-400 shrink-0">
              Ctrl+K
            </kbd>
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#3B82F6]/15 text-white border border-[#3B82F6]/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-[#06B6D4]' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </span>
                {item.id === 'inventory' &&
                  workspace?.settings.telemetryAlerts &&
                  lowAndOutCount > 0 && (
                    <span className="text-xs font-mono tabular-nums text-amber-400">
                      {lowAndOutCount}
                    </span>
                  )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/[0.08] space-y-2">
          <button
            type="button"
            onClick={() => navigateTo('settings')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-[#3B82F6]/15 text-white border border-[#3B82F6]/30'
                : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>

          <div className="px-3.5 py-2 text-xs text-slate-500 font-mono truncate">
            Workspace: {getActiveWorkspaceId().toUpperCase()}
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-[#0d1422] border-r border-white/[0.1] h-full flex flex-col z-10">
            <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
              <span className="text-base font-display font-bold text-white">
                BizPilot AI
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
                      activeTab === item.id
                        ? 'bg-[#3B82F6]/15 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => navigateTo('settings')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-[#3B82F6]/15 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-[#101828]/95 backdrop-blur-md border-b border-white/[0.08] px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.06] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                {workspace?.settings.businessName || 'BizPilot AI'}
              </span>
              <span className="text-slate-600 hidden sm:inline">/</span>
              <h1 className="text-base font-semibold text-white truncate">
                {TAB_TITLES[activeTab]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleTogglePublicMode}
              disabled={!workspace}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                workspace?.settings.publicMode
                  ? 'bg-[#06B6D4]/15 text-[#22D3EE] border-[#06B6D4]/40'
                  : 'bg-[#162033] text-slate-300 hover:text-white border-white/[0.1]'
              }`}
              title="Mask sensitive profits, costs, and customer phone numbers in public"
            >
              {workspace?.settings.publicMode ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {workspace?.settings.publicMode
                  ? 'Privacy Shield: On'
                  : 'Privacy Shield: Off'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('sales');
                setCreateOrderTrigger((c) => c + 1);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Order</span>
            </button>
          </div>
        </header>

        {/* Viewport Body */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1440px] w-full mx-auto pb-24">
          {loading ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-14 bg-[#162033] rounded-xl border border-white/[0.06]" />
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-28 bg-[#162033] rounded-xl border border-white/[0.06]"
                  />
                ))}
              </div>
              <div className="h-72 bg-[#162033] rounded-xl border border-white/[0.06]" />
            </div>
          ) : loadError || !workspace || !analytics ? (
            <div className="bg-[#162033] border border-rose-500/30 rounded-xl p-8 text-center max-w-md mx-auto mt-12">
              <p className="text-sm font-semibold text-white">
                Workspace Load Error
              </p>
              <p className="text-xs text-slate-400 mt-2">{loadError}</p>
              <button
                type="button"
                onClick={() => loadWorkspace(dateRange)}
                className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] rounded-lg cursor-pointer"
              >
                Retry Connection
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  workspace={workspace}
                  analytics={analytics}
                  dateRange={dateRange}
                  onDateRangeChange={setDateRange}
                  sectionFilter={sectionFilter}
                  onSectionFilterChange={setSectionFilter}
                  onQuickRestock={handleQuickRestock}
                  onNavigateTab={navigateTo}
                  onSelectOrder={(order: Order) => setSelectedOrderId(order.id)}
                  restockingId={restockingId}
                />
              )}

              {activeTab === 'inventory' && (
                <InventoryView
                  products={workspace.products}
                  currency={workspace.settings.currency}
                  publicMode={workspace.settings.publicMode}
                  defaultThreshold={workspace.settings.lowStockDefault}
                  externalSearch={inventorySearch}
                  onCreateProduct={async (p: Omit<Product, 'id' | 'updatedAt'>) =>
                    applyResponse(await api.createProduct(p, dateRange))
                  }
                  onUpdateProduct={async (id, p) =>
                    applyResponse(await api.updateProduct(id, p, dateRange))
                  }
                  onDeleteProduct={async (id) =>
                    applyResponse(await api.deleteProduct(id, dateRange))
                  }
                  onQuickRestock={handleQuickRestock}
                  restockingId={restockingId}
                />
              )}

              {activeTab === 'sales' && (
                <SalesView
                  orders={workspace.orders}
                  products={workspace.products}
                  currency={workspace.settings.currency}
                  publicMode={workspace.settings.publicMode}
                  createOrderTrigger={createOrderTrigger}
                  onCreateOrder={async (payload: {
                    customerName: string;
                    customerPhone: string;
                    status: OrderStatus;
                    items: { productId: string; quantity: number }[];
                    autoCreateInvoice: boolean;
                  }) => applyResponse(await api.createOrder(payload, dateRange))}
                  onUpdateOrderStatus={async (id, status) =>
                    applyResponse(
                      await api.updateOrderStatus(id, status, dateRange)
                    )
                  }
                  onSelectOrder={(order: Order) => setSelectedOrderId(order.id)}
                />
              )}

              {activeTab === 'finance' && (
                <FinanceView
                  workspace={workspace}
                  analytics={analytics}
                  onCreateExpense={async (payload: {
                    title: string;
                    category: ExpenseCategory;
                    amount: number;
                    date: string;
                    notes?: string;
                  }) =>
                    applyResponse(await api.createExpense(payload, dateRange))
                  }
                  onDeleteExpense={async (id) =>
                    applyResponse(await api.deleteExpense(id, dateRange))
                  }
                  onCreateInvoice={async (payload: {
                    customerName: string;
                    customerPhone: string;
                    customerEmail: string;
                    taxRate: number;
                    dueDate: string;
                    status: InvoiceStatus;
                    items: {
                      description: string;
                      quantity: number;
                      unitPrice: number;
                    }[];
                  }) =>
                    applyResponse(await api.createInvoice(payload, dateRange))
                  }
                  onUpdateInvoiceStatus={async (id, status) =>
                    applyResponse(
                      await api.updateInvoiceStatus(id, status, dateRange)
                    )
                  }
                />
              )}

              {activeTab === 'pilot' && (
                <AiPilotView
                  messages={pilotMessages}
                  onSendMessage={handleSendPilotMessage}
                  sending={pilotSending}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  workspace={workspace}
                  onSaveSettings={async (patch: Partial<WorkspaceSettings>) =>
                    applyResponse(await api.updateSettings(patch, dateRange))
                  }
                  onResetSession={handleResetSession}
                  onCloudSync={handleCloudSync}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Glowing AI Floating Action Button */}
      {activeTab !== 'pilot' && (
        <button
          type="button"
          onClick={handleTriggerDailyBrief}
          aria-label="Generate Daily AI Business Summary"
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2.5 px-5 py-3.5 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#06B6D4] text-white text-sm font-semibold ai-fab-glow hover:scale-[1.03] active:scale-[0.98] transition-transform whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Brief</span>
        </button>
      )}

      {/* Daily AI Business Summary Modal */}
      {workspace && analytics && (
        <DailyAiSummaryModal
          isOpen={briefModalOpen}
          onClose={() => setBriefModalOpen(false)}
          brief={briefData}
          loading={briefLoading}
          error={briefError}
          onRegenerate={handleTriggerDailyBrief}
          onOpenPilot={() => navigateTo('pilot')}
          todayBenchmark={analytics.todayBenchmark}
          currency={workspace.settings.currency}
          publicMode={workspace.settings.publicMode}
        />
      )}

      {/* Global Command Palette (Ctrl+K) */}
      {workspace && (
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          products={workspace.products}
          currency={workspace.settings.currency}
          publicMode={workspace.settings.publicMode}
          onNavigateTab={navigateTo}
          onCreateNewOrder={() => {
            setActiveTab('sales');
            setCreateOrderTrigger((c) => c + 1);
          }}
          onSelectProduct={(product) => {
            setInventorySearch({ query: product.name, nonce: Date.now() });
            setActiveTab('inventory');
          }}
          onTriggerDailyBrief={handleTriggerDailyBrief}
          onTogglePrivacyShield={handleTogglePublicMode}
        />
      )}

      {/* Order Details Modal */}
      <AnimatePresence>
        {workspace && selectedOrder && (
          <OrderDetailsModal
            key={selectedOrder.id}
            order={selectedOrder}
            linkedInvoice={workspace.invoices.find(
              (inv) =>
                inv.orderId === selectedOrder.id ||
                inv.invoiceNumber ===
                  selectedOrder.orderNumber.replace('ORD-', 'INV-')
            )}
            businessName={workspace.settings.businessName}
            currency={workspace.settings.currency}
            publicMode={workspace.settings.publicMode}
            onClose={() => setSelectedOrderId(null)}
            onUpdateStatus={async (id, status) =>
              applyResponse(await api.updateOrderStatus(id, status, dateRange))
            }
            onGenerateInvoice={async (order) => {
              const res = await api.createInvoice(
                {
                  orderId: order.id,
                  customerName: order.customerName,
                  customerPhone: order.customerPhone,
                  customerEmail: '',
                  taxRate: 8.5,
                  dueDate: new Date(
                    Date.now() + 14 * 24 * 60 * 60 * 1000
                  ).toISOString(),
                  status: order.status === 'completed' ? 'paid' : 'sent',
                  items: order.items.map((item) => ({
                    description: `${item.productName} (${item.sku})`,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                  })),
                },
                dateRange
              );
              applyResponse(res);
            }}
          />
        )}
      </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
