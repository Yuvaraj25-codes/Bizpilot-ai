import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit3,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { CurrencyCode, Product } from '../../shared/types.ts';
import { downloadCsv } from '../lib/exports.ts';
import { formatMoney } from '../lib/formatters.ts';

interface InventoryViewProps {
  products: Product[];
  currency: CurrencyCode;
  publicMode: boolean;
  defaultThreshold: number;
  externalSearch?: { query: string; nonce: number } | null;
  onCreateProduct: (p: Omit<Product, 'id' | 'updatedAt'>) => Promise<void>;
  onUpdateProduct: (
    id: string,
    p: Omit<Product, 'id' | 'updatedAt'>
  ) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onQuickRestock: (id: string) => Promise<void>;
  restockingId: string | null;
}

type StockFilter = 'all' | 'healthy' | 'low' | 'out';

export function InventoryView({
  products,
  currency,
  publicMode,
  defaultThreshold,
  externalSearch,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
  onQuickRestock,
  restockingId,
}: InventoryViewProps) {
  const [search, setSearch] = useState(externalSearch?.query ?? '');
  const [lastSearchNonce, setLastSearchNonce] = useState(
    externalSearch?.nonce ?? 0
  );
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  if (externalSearch && externalSearch.nonce !== lastSearchNonce) {
    setLastSearchNonce(externalSearch.nonce);
    setSearch(externalSearch.query);
    setStockFilter('all');
  }

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Peripherals');
  const [costPrice, setCostPrice] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(defaultThreshold)
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreateModal = () => {
    setEditing(null);
    setSku('');
    setName('');
    setCategory('Peripherals');
    setCostPrice('');
    setRetailPrice('');
    setStockQty('15');
    setLowStockThreshold(String(defaultThreshold));
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditing(p);
    setSku(p.sku);
    setName(p.name);
    setCategory(p.category);
    setCostPrice(String(p.costPrice));
    setRetailPrice(String(p.retailPrice));
    setStockQty(String(p.stockQty));
    setLowStockThreshold(String(p.lowStockThreshold));
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsedCost = Number(costPrice);
    const parsedRetail = Number(retailPrice);
    const parsedStock = Number(stockQty);
    const parsedThreshold = Number(lowStockThreshold);

    if (!sku.trim() || !name.trim()) {
      setFormError('SKU and product name are required.');
      return;
    }
    if (
      Number.isNaN(parsedCost) ||
      parsedCost < 0 ||
      Number.isNaN(parsedRetail) ||
      parsedRetail < 0 ||
      Number.isNaN(parsedStock) ||
      parsedStock < 0 ||
      Number.isNaN(parsedThreshold) ||
      parsedThreshold < 0
    ) {
      setFormError('Prices, stock quantity, and threshold must be non-negative numbers.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        category: category.trim() || 'General',
        costPrice: parsedCost,
        retailPrice: parsedRetail,
        stockQty: Math.floor(parsedStock),
        lowStockThreshold: Math.floor(parsedThreshold),
      };
      if (editing) {
        await onUpdateProduct(editing.id, payload);
      } else {
        await onCreateProduct(payload);
      }
      setModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (stockFilter === 'out') return p.stockQty <= 0;
    if (stockFilter === 'low')
      return p.stockQty > 0 && p.stockQty <= p.lowStockThreshold;
    if (stockFilter === 'healthy') return p.stockQty > p.lowStockThreshold;
    return true;
  });

  const handleExportCsv = () => {
    downloadCsv(
      'bizpilot_inventory_catalog',
      [
        'SKU',
        'Name',
        'Category',
        'Retail Price',
        'Cost Price',
        'Stock Qty',
        'Low Stock Threshold',
      ],
      filtered.map((p) => [
        p.sku,
        p.name,
        p.category,
        p.retailPrice,
        publicMode ? 'MASKED' : p.costPrice,
        p.stockQty,
        p.lowStockThreshold,
      ])
    );
  };

  return (
    <div className="space-y-5">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#162033] border border-white/[0.08] rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU, name, or category..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#3B82F6]"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#101828] p-1 rounded-lg border border-white/[0.06]">
            {(
              [
                ['all', 'All'],
                ['healthy', 'Healthy'],
                ['low', 'Low Stock'],
                ['out', 'Out of Stock'],
              ] as [StockFilter, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setStockFilter(k)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  stockFilter === k
                    ? 'bg-[#3B82F6] text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-[#101828] hover:bg-white/[0.06] border border-white/[0.1] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-[#162033] border border-white/[0.08] rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-14 px-6 flex flex-col items-center justify-center text-center">
            <Package className="w-8 h-8 text-slate-500 mb-3" />
            <p className="text-sm font-medium text-slate-200">
              No matching products found
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Adjust your search filter or add a new SKU to the catalog.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg transition-colors cursor-pointer"
            >
              Add First Product
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-xs text-slate-400">
                  <th className="py-3.5 px-5 font-medium">SKU</th>
                  <th className="py-3.5 px-4 font-medium">Product</th>
                  <th className="py-3.5 px-4 font-medium">Category</th>
                  <th className="py-3.5 px-4 font-medium text-right">
                    Cost {publicMode && '· Masked'}
                  </th>
                  <th className="py-3.5 px-4 font-medium text-right">Retail</th>
                  <th className="py-3.5 px-4 font-medium text-right">Stock</th>
                  <th className="py-3.5 px-4 font-medium">Status</th>
                  <th className="py-3.5 px-5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-sm">
                {filtered.map((p) => {
                  const isOut = p.stockQty <= 0;
                  const isLow = p.stockQty > 0 && p.stockQty <= p.lowStockThreshold;
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3.5 px-5 font-mono text-xs text-[#22D3EE] whitespace-nowrap">
                        {p.sku}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-white">
                        {p.name}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {p.category}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-300">
                        {formatMoney(p.costPrice, currency, publicMode)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-white font-medium">
                        {formatMoney(p.retailPrice, currency, false)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-200">
                        {p.stockQty}
                      </td>
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1.5 text-rose-400 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Out of Stock</span>
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Low Stock</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>In Stock</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onQuickRestock(p.id)}
                            disabled={restockingId === p.id}
                            title="Add 10 units"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-[#101828] hover:bg-[#3B82F6] text-slate-300 hover:text-white border border-white/[0.08] transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${
                                restockingId === p.id ? 'animate-spin' : ''
                              }`}
                            />
                            <span>+10</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            aria-label={`Edit ${p.name}`}
                            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProduct(p.id)}
                            aria-label={`Delete ${p.name}`}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-[#162033] border border-white/[0.12] rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-[#101828] border-b border-white/[0.08] flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                {editing ? `Edit ${editing.sku}` : 'Add New Product'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    SKU Code
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="BP-KEY-02"
                    className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white font-mono focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Category
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Peripherals"
                    className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Product Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Vortex Wireless Tactile Mouse"
                  className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Cost Price
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="45"
                    className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white font-mono focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Retail Price
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={retailPrice}
                    onChange={(e) => setRetailPrice(e.target.value)}
                    placeholder="99"
                    className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white font-mono focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Stock Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    placeholder="20"
                    className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white font-mono focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Alert Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    placeholder="10"
                    className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white font-mono focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-lg border border-white/[0.1] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
