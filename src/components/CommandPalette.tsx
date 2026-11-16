import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bot,
  Eye,
  EyeOff,
  Landmark,
  Package,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  X,
} from 'lucide-react';
import type { CurrencyCode, Product } from '../../shared/types.ts';
import { formatMoney } from '../lib/formatters.ts';

export type NavTab =
  | 'dashboard'
  | 'inventory'
  | 'sales'
  | 'finance'
  | 'pilot'
  | 'settings';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  currency: CurrencyCode;
  publicMode: boolean;
  onNavigateTab: (tab: NavTab) => void;
  onCreateNewOrder: () => void;
  onSelectProduct: (product: Product) => void;
  onTriggerDailyBrief: () => void;
  onTogglePrivacyShield: () => void;
}

interface PaletteItem {
  id: string;
  group: 'Actions' | 'Navigation' | 'Products';
  title: string;
  subtitle: string;
  meta?: string;
  icon: typeof Search;
  onSelect: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  products,
  currency,
  publicMode,
  onNavigateTab,
  onCreateNewOrder,
  onSelectProduct,
  onTriggerDailyBrief,
  onTogglePrivacyShield,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();

    const actionItems: PaletteItem[] = [
      {
        id: 'action-new-order',
        group: 'Actions',
        title: 'Create New Order',
        subtitle: 'Open Sales & Orders and start a new customer order',
        meta: 'Action',
        icon: Plus,
        onSelect: () => {
          onClose();
          onCreateNewOrder();
        },
      },
      {
        id: 'action-daily-brief',
        group: 'Actions',
        title: 'Generate Daily AI Brief',
        subtitle: 'Synthesize today revenue, profit, and stock alerts',
        meta: 'Gemini AI',
        icon: Sparkles,
        onSelect: () => {
          onClose();
          onTriggerDailyBrief();
        },
      },
      {
        id: 'action-privacy-shield',
        group: 'Actions',
        title: publicMode
          ? 'Disable Privacy Shield'
          : 'Enable Privacy Shield',
        subtitle: 'Toggle masking for profits, costs, and phone numbers',
        meta: publicMode ? 'Currently On' : 'Currently Off',
        icon: publicMode ? Eye : EyeOff,
        onSelect: () => {
          onClose();
          onTogglePrivacyShield();
        },
      },
    ];

    const navItems: PaletteItem[] = [
      {
        id: 'nav-dashboard',
        group: 'Navigation',
        title: 'Dashboard',
        subtitle: 'Sales trajectory, inventory health, and expense summaries',
        meta: 'Tab',
        icon: BarChart3,
        onSelect: () => {
          onClose();
          onNavigateTab('dashboard');
        },
      },
      {
        id: 'nav-inventory',
        group: 'Navigation',
        title: 'Inventory Catalog',
        subtitle: 'Manage SKUs, pricing, thresholds, and stock levels',
        meta: 'Tab',
        icon: Package,
        onSelect: () => {
          onClose();
          onNavigateTab('inventory');
        },
      },
      {
        id: 'nav-sales',
        group: 'Navigation',
        title: 'Sales & Orders',
        subtitle: 'Create orders, track fulfillment, and export CSV',
        meta: 'Tab',
        icon: ShoppingCart,
        onSelect: () => {
          onClose();
          onNavigateTab('sales');
        },
      },
      {
        id: 'nav-finance',
        group: 'Navigation',
        title: 'Finance & Invoices',
        subtitle: 'Operating expense ledger, P&L report, and PDF invoices',
        meta: 'Tab',
        icon: Landmark,
        onSelect: () => {
          onClose();
          onNavigateTab('finance');
        },
      },
      {
        id: 'nav-pilot',
        group: 'Navigation',
        title: 'AI Pilot',
        subtitle: 'Ask profit/stock questions or execute ledger actions',
        meta: 'Tab',
        icon: Bot,
        onSelect: () => {
          onClose();
          onNavigateTab('pilot');
        },
      },
      {
        id: 'nav-settings',
        group: 'Navigation',
        title: 'Workspace Settings',
        subtitle: 'Currency, cloud sync key, and session reset',
        meta: 'Tab',
        icon: Settings,
        onSelect: () => {
          onClose();
          onNavigateTab('settings');
        },
      },
    ];

    const productItems: PaletteItem[] = products.map((p) => ({
      id: `prod-${p.id}`,
      group: 'Products',
      title: p.name,
      subtitle: `${p.sku} · ${p.category} · ${p.stockQty} in stock`,
      meta: formatMoney(p.retailPrice, currency, false),
      icon: Package,
      onSelect: () => {
        onClose();
        onSelectProduct(p);
      },
    }));

    const all = [...actionItems, ...navItems, ...productItems];
    if (!q) {
      return [...actionItems, ...navItems, ...productItems.slice(0, 5)];
    }

    return all.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q)
    );
  }, [
    query,
    products,
    currency,
    publicMode,
    onClose,
    onCreateNewOrder,
    onTriggerDailyBrief,
    onTogglePrivacyShield,
    onNavigateTab,
    onSelectProduct,
  ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const activeEl = listRef.current?.querySelector(
      `[data-palette-idx="${activeIndex}"]`
    ) as HTMLElement | null;
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) =>
        items.length === 0 ? 0 : (prev + 1) % items.length
      );
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        items.length === 0 ? 0 : (prev - 1 + items.length) % items.length
      );
      return;
    }
    if (e.key === 'Enter' && items[activeIndex]) {
      e.preventDefault();
      items[activeIndex].onSelect();
    }
  };

  let lastGroup: string | null = null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Global Command Palette"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-xl bg-[#162033] border border-white/[0.14] rounded-2xl overflow-hidden shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-[#101828] border-b border-white/[0.08]">
          <Search className="w-4 h-4 text-[#06B6D4] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to a tab, create an order, or search products by name..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close command palette"
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[55vh] overflow-y-auto p-2 space-y-1"
        >
          {items.length === 0 ? (
            <div className="py-10 px-4 text-center text-xs text-slate-400">
              No matching tabs, actions, or products found for &ldquo;{query}
              &rdquo;.
            </div>
          ) : (
            items.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === activeIndex;
              const showGroupHeader = item.group !== lastGroup;
              lastGroup = item.group;

              return (
                <div key={item.id}>
                  {showGroupHeader && (
                    <div className="px-3 pt-2.5 pb-1 text-[11px] font-medium text-slate-400">
                      {item.group}
                    </div>
                  )}
                  <button
                    type="button"
                    data-palette-idx={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={item.onSelect}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#3B82F6]/20 border border-[#3B82F6]/40 text-white'
                        : 'border border-transparent text-slate-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-[#3B82F6] text-white'
                            : 'bg-[#101828] border border-white/[0.08] text-[#06B6D4]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.meta && (
                        <span className="text-xs font-mono tabular-nums text-slate-400">
                          {item.meta}
                        </span>
                      )}
                      {isSelected && (
                        <ArrowRight className="w-3.5 h-3.5 text-[#22D3EE]" />
                      )}
                    </div>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="px-4 py-2.5 bg-[#101828] border-t border-white/[0.08] flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>↑↓ Navigate · Enter Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
