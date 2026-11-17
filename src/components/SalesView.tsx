import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import type {
  CurrencyCode,
  Order,
  OrderStatus,
  Product,
} from '../../shared/types.ts';
import { downloadCsv } from '../lib/exports.ts';
import {
  formatDateTime,
  formatMoney,
  maskPhone,
} from '../lib/formatters.ts';

interface SalesViewProps {
  orders: Order[];
  products: Product[];
  currency: CurrencyCode;
  publicMode: boolean;
  onCreateOrder: (payload: {
    customerName: string;
    customerPhone: string;
    status: OrderStatus;
    items: { productId: string; quantity: number }[];
    autoCreateInvoice: boolean;
  }) => Promise<void>;
  onUpdateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  onSelectOrder: (order: Order) => void;
  createOrderTrigger: number;
}

export function SalesView({
  orders,
  products,
  currency,
  publicMode,
  onCreateOrder,
  onUpdateOrderStatus,
  onSelectOrder,
  createOrderTrigger,
}: SalesViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [lastTrigger, setLastTrigger] = useState(createOrderTrigger);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('completed');
  const [autoInvoice, setAutoInvoice] = useState(true);
  const [lines, setLines] = useState<{ productId: string; quantity: number }[]>(
    () =>
      products.length > 0 ? [{ productId: products[0].id, quantity: 1 }] : []
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  if (createOrderTrigger !== lastTrigger) {
    setLastTrigger(createOrderTrigger);
    setCustomerName('');
    setCustomerPhone('');
    setOrderStatus('completed');
    setAutoInvoice(true);
    setLines(
      products.length > 0 ? [{ productId: products[0].id, quantity: 1 }] : []
    );
    setFormError(null);
    setModalOpen(true);
  }

  const openModal = () => {
    setCustomerName('');
    setCustomerPhone('');
    setOrderStatus('completed');
    setAutoInvoice(true);
    setLines(
      products.length > 0 ? [{ productId: products[0].id, quantity: 1 }] : []
    );
    setFormError(null);
    setModalOpen(true);
  };

  const addLine = () => {
    if (products.length === 0) return;
    setLines((prev) => [...prev, { productId: products[0].id, quantity: 1 }]);
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const productById = new Map(products.map((p) => [p.id, p]));
  const computedTotal = lines.reduce((sum, l) => {
    const p = productById.get(l.productId);
    return sum + (p ? p.retailPrice * Math.max(0, l.quantity) : 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!customerName.trim()) {
      setFormError('Customer name is required.');
      return;
    }
    if (lines.length === 0) {
      setFormError('Add at least one product line item.');
      return;
    }
    for (const l of lines) {
      if (!l.productId || l.quantity <= 0) {
        setFormError('Every line item requires a valid product and quantity >= 1.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await onCreateOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || '+1 (555) 019-2834',
        status: orderStatus,
        items: lines,
        autoCreateInvoice: autoInvoice,
      });
      setModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'Could not create order.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, nextStatus: OrderStatus) => {
    setStatusError(null);
    setStatusBusyId(id);
    try {
      await onUpdateOrderStatus(id, nextStatus);
    } catch (err: any) {
      setStatusError(err?.message || 'Failed to update order status');
    } finally {
      setStatusBusyId(null);
    }
  };

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    return true;
  });

  const handleExportCsv = () => {
    downloadCsv(
      'bizpilot_orders',
      ['Order Number', 'Customer', 'Phone', 'Status', 'Total', 'Date'],
      filtered.map((o) => [
        o.orderNumber,
        o.customerName,
        maskPhone(o.customerPhone, publicMode),
        o.status,
        o.totalAmount,
        o.createdAt,
      ])
    );
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#162033] border border-white/[0.08] rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order # or customer..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#3B82F6]"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#101828] p-1 rounded-lg border border-white/[0.06]">
            {(['all', 'completed', 'pending', 'cancelled'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === s
                    ? 'bg-[#3B82F6] text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {s}
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
            onClick={openModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Order</span>
          </button>
        </div>
      </div>

      {/* Inline Status Error */}
      {statusError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between gap-3">
          <span>{statusError}</span>
          <button
            type="button"
            onClick={() => setStatusError(null)}
            className="text-rose-200 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-[#162033] border border-white/[0.08] rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-14 px-6 flex flex-col items-center justify-center text-center">
            <ShoppingCart className="w-8 h-8 text-slate-500 mb-3" />
            <p className="text-sm font-medium text-slate-200">
              No orders match this filter
            </p>
            <button
              type="button"
              onClick={openModal}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg cursor-pointer"
            >
              Create First Order
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-xs text-slate-400">
                  <th className="py-3.5 px-5 font-medium">Order</th>
                  <th className="py-3.5 px-4 font-medium">Customer</th>
                  <th className="py-3.5 px-4 font-medium">Items</th>
                  <th className="py-3.5 px-4 font-medium">Date</th>
                  <th className="py-3.5 px-4 font-medium">Status</th>
                  <th className="py-3.5 px-4 font-medium text-right">Total</th>
                  <th className="py-3.5 px-5 font-medium text-right">
                    Fulfillment
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-sm">
                {filtered.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3.5 px-5 font-mono text-xs font-medium whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectOrder(order)}
                        className="text-[#22D3EE] hover:text-[#3B82F6] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] rounded cursor-pointer"
                      >
                        {order.orderNumber}
                      </button>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="text-white font-medium">
                        {order.customerName}
                      </p>
                      <p className="text-xs text-slate-400 font-mono tabular-nums">
                        {maskPhone(order.customerPhone, publicMode)}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-300">
                      {order.items
                        .map((i) => `${i.quantity}x ${i.productName}`)
                        .join(', ')}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400 font-mono tabular-nums whitespace-nowrap">
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-xs whitespace-nowrap">
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
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-white">
                      {formatMoney(order.totalAmount, currency, false)}
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      {order.status === 'cancelled' ? (
                        <span className="text-xs text-slate-500 font-mono">
                          Locked
                        </span>
                      ) : (
                        <select
                          aria-label={`Change status for ${order.orderNumber}`}
                          value={order.status}
                          disabled={statusBusyId === order.id}
                          onChange={(e) =>
                            handleStatusChange(
                              order.id,
                              e.target.value as OrderStatus
                            )
                          }
                          className="px-2.5 py-1 text-xs bg-[#101828] border border-white/[0.1] rounded-md text-slate-200 focus:outline-none focus:border-[#3B82F6] cursor-pointer disabled:opacity-50"
                        >
                          <option value="completed">Completed</option>
                          <option value="pending">Pending</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl bg-[#162033] border border-white/[0.12] rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-[#101828] border-b border-white/[0.08] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">
                  Create Sales Order
                </h3>
                <p className="text-xs text-slate-400">
                  Completed orders automatically deduct inventory stock
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
            >
              {formError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Customer / Company
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Apex Cloud Systems"
                    className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+1 (415) 555-0148"
                    className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white font-mono focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    Line Items
                  </label>
                  <button
                    type="button"
                    onClick={addLine}
                    className="text-xs font-medium text-[#3B82F6] hover:text-[#22D3EE] cursor-pointer"
                  >
                    + Add Line Item
                  </button>
                </div>

                {lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2.5 bg-[#101828] p-2.5 rounded-lg border border-white/[0.06]"
                  >
                    <select
                      value={line.productId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === idx ? { ...l, productId: val } : l
                          )
                        );
                      }}
                      className="flex-1 px-2.5 py-1.5 text-xs bg-[#162033] border border-white/[0.1] rounded-md text-white focus:outline-none focus:border-[#3B82F6]"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} — {p.name} ({p.stockQty} in stock ·{' '}
                          {formatMoney(p.retailPrice, currency)})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => {
                        const qty = Math.max(1, Number(e.target.value));
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === idx ? { ...l, quantity: qty } : l
                          )
                        );
                      }}
                      className="w-20 px-2.5 py-1.5 text-xs bg-[#162033] border border-white/[0.1] rounded-md text-white font-mono text-right focus:outline-none focus:border-[#3B82F6]"
                    />

                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Initial Status
                  </label>
                  <select
                    value={orderStatus}
                    onChange={(e) =>
                      setOrderStatus(e.target.value as OrderStatus)
                    }
                    className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#3B82F6]"
                  >
                    <option value="completed">
                      Completed (Deduct Stock Now)
                    </option>
                    <option value="pending">Pending (Reserve Later)</option>
                  </select>
                </div>

                <label className="flex items-center gap-2.5 text-xs text-slate-300 pt-5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoInvoice}
                    onChange={(e) => setAutoInvoice(e.target.checked)}
                    className="rounded border-white/20 bg-[#101828] text-[#3B82F6]"
                  />
                  <span>Auto-generate linked invoice</span>
                </label>
              </div>

              <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Order Subtotal</p>
                  <p className="text-lg font-semibold text-white font-mono tabular-nums">
                    {formatMoney(computedTotal, currency, false)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-lg border border-white/[0.1] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Confirm Order'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
