import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Phone,
  Printer,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import type {
  CurrencyCode,
  Invoice,
  Order,
  OrderStatus,
} from '../../shared/types.ts';
import { exportInvoicePdf } from '../lib/exports.ts';
import {
  formatDateTime,
  formatMoney,
  formatShortDate,
  maskPhone,
} from '../lib/formatters.ts';

interface OrderDetailsModalProps {
  order: Order;
  linkedInvoice?: Invoice;
  businessName: string;
  currency: CurrencyCode;
  publicMode: boolean;
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  onGenerateInvoice: (order: Order) => Promise<void>;
}

export function OrderDetailsModal({
  order,
  linkedInvoice,
  businessName,
  currency,
  publicMode,
  onClose,
  onUpdateStatus,
  onGenerateInvoice,
}: OrderDetailsModalProps) {
  const [statusBusy, setStatusBusy] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    setActionError(null);
    setPrintMode(false);
  }, [order.id]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const grossProfit = order.totalAmount - order.totalCost;
  const marginPct =
    order.totalAmount > 0 ? (grossProfit / order.totalAmount) * 100 : 0;

  const handleStatusChange = async (next: OrderStatus) => {
    setActionError(null);
    setStatusBusy(true);
    try {
      await onUpdateStatus(order.id, next);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update order status.');
    } finally {
      setStatusBusy(false);
    }
  };

  const handleGenerateInvoice = async () => {
    setActionError(null);
    setInvoiceBusy(true);
    try {
      await onGenerateInvoice(order);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to generate invoice.');
    } finally {
      setInvoiceBusy(false);
    }
  };

  const handleQuickPrint = () => {
    setPrintMode(true);
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
      }, 120);
    });
  };

  const taxRate = linkedInvoice?.taxRate ?? 0;
  const taxAmount = linkedInvoice?.taxAmount ?? 0;
  const grandTotal = linkedInvoice?.totalAmount ?? order.totalAmount;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-details-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl bg-[#162033] border border-white/[0.14] rounded-2xl overflow-hidden shadow-2xl"
      >
        {printMode ? (
          /* Print-Friendly Receipt / Invoice View */
          <div className="flex flex-col max-h-[85vh]">
            <div className="no-print px-6 py-3.5 bg-[#101828] border-b border-white/[0.08] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPrintMode(false)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Order Details</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close modal"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto bg-[#0d1422]">
              <div
                id="print-receipt-root"
                className="bg-white text-slate-900 rounded-xl p-8 space-y-6 max-w-xl mx-auto shadow-lg"
              >
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {businessName}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      {linkedInvoice
                        ? `Tax Invoice ${linkedInvoice.invoiceNumber}`
                        : `Order Receipt ${order.orderNumber}`}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-600 font-mono tabular-nums">
                    <p className="font-semibold text-slate-900 uppercase">
                      {linkedInvoice ? linkedInvoice.status : order.status}
                    </p>
                    <p className="mt-1">
                      Date: {formatShortDate(order.createdAt)}
                    </p>
                    {linkedInvoice && (
                      <p>Due: {formatShortDate(linkedInvoice.dueDate)}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-4 text-xs">
                  <div>
                    <p className="text-slate-500 font-medium">Billed To</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">
                      {order.customerName}
                    </p>
                    <p className="text-slate-600 font-mono mt-0.5">
                      {maskPhone(order.customerPhone, publicMode)}
                    </p>
                  </div>
                  <div className="text-right font-mono">
                    <p className="text-slate-500">Order Reference</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">
                      {order.orderNumber}
                    </p>
                  </div>
                </div>

                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-y border-slate-200 text-slate-500">
                      <th className="py-2.5 font-semibold">Item / SKU</th>
                      <th className="py-2.5 text-right font-semibold">Qty</th>
                      <th className="py-2.5 text-right font-semibold">
                        Unit Price
                      </th>
                      <th className="py-2.5 text-right font-semibold">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.items.map((item, idx) => (
                      <tr key={`${item.productId}-${idx}`}>
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-slate-900">
                            {item.productName}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {item.sku}
                          </p>
                        </td>
                        <td className="py-2.5 text-right font-mono tabular-nums">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 text-right font-mono tabular-nums">
                          {formatMoney(item.unitPrice, currency, false)}
                        </td>
                        <td className="py-2.5 text-right font-mono tabular-nums font-medium text-slate-900">
                          {formatMoney(
                            item.quantity * item.unitPrice,
                            currency,
                            false
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t border-slate-200 pt-4 flex flex-col items-end space-y-1.5 text-xs font-mono tabular-nums">
                  <div className="flex justify-between w-52 text-slate-600">
                    <span>Subtotal</span>
                    <span>{formatMoney(order.totalAmount, currency, false)}</span>
                  </div>
                  {linkedInvoice && (
                    <div className="flex justify-between w-52 text-slate-600">
                      <span>Tax ({taxRate}%)</span>
                      <span>{formatMoney(taxAmount, currency, false)}</span>
                    </div>
                  )}
                  <div className="flex justify-between w-52 pt-2 border-t border-slate-300 text-sm font-bold text-slate-900">
                    <span>Total</span>
                    <span>{formatMoney(grandTotal, currency, false)}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 text-center pt-2 border-t border-slate-100">
                  Thank you for your business · {businessName}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Standard Interactive Order Details View */
          <>
            <div className="px-6 py-4 bg-[#101828] border-b border-white/[0.08] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[#3B82F6]/20 border border-[#3B82F6]/40 flex items-center justify-center text-[#22D3EE] shrink-0">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h2
                      id="order-details-title"
                      className="text-base font-semibold text-white font-mono"
                    >
                      {order.orderNumber}
                    </h2>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium capitalize ${
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
                      <span>{order.status}</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
                    Placed {formatDateTime(order.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleQuickPrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#162033] hover:bg-white/[0.08] border border-white/[0.12] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[#06B6D4]" />
                  <span>Quick Print</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close order details"
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {actionError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                  {actionError}
                </div>
              )}

              {/* Customer & Status Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#101828] border border-white/[0.06]">
                <div className="space-y-1.5">
                  <p className="text-xs text-slate-400">Customer</p>
                  <p className="text-sm font-medium text-white flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />
                    <span>{order.customerName}</span>
                  </p>
                  <p className="text-xs text-slate-400 font-mono tabular-nums flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{maskPhone(order.customerPhone, publicMode)}</span>
                  </p>
                </div>

                <div className="space-y-1.5 sm:text-right">
                  <label
                    htmlFor="order-detail-status"
                    className="block text-xs text-slate-400"
                  >
                    Fulfillment Status
                  </label>
                  <select
                    id="order-detail-status"
                    value={order.status}
                    disabled={statusBusy || order.status === 'cancelled'}
                    onChange={(e) =>
                      handleStatusChange(e.target.value as OrderStatus)
                    }
                    className="px-3 py-1.5 text-xs bg-[#162033] border border-white/[0.12] rounded-lg text-white focus:outline-none focus:border-[#3B82F6] cursor-pointer disabled:opacity-50"
                  >
                    <option value="completed">Completed (Stock Deducted)</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  {order.status === 'cancelled' && (
                    <p className="text-[11px] text-slate-500">
                      Cancelled orders are locked
                    </p>
                  )}
                </div>
              </div>

              {/* Line Items */}
              <div className="border border-white/[0.08] rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#101828] text-xs text-slate-400 border-b border-white/[0.08]">
                      <th className="py-2.5 px-4 font-medium">SKU</th>
                      <th className="py-2.5 px-3 font-medium">Product</th>
                      <th className="py-2.5 px-3 font-medium text-right">Qty</th>
                      <th className="py-2.5 px-3 font-medium text-right">
                        Unit Price
                      </th>
                      <th className="py-2.5 px-4 font-medium text-right">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {order.items.map((item, idx) => (
                      <tr key={`${item.productId}-${idx}`}>
                        <td className="py-2.5 px-4 font-mono text-xs text-[#22D3EE] whitespace-nowrap">
                          {item.sku}
                        </td>
                        <td className="py-2.5 px-3 text-slate-100">
                          {item.productName}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                          {formatMoney(item.unitPrice, currency, false)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-white">
                          {formatMoney(
                            item.quantity * item.unitPrice,
                            currency,
                            false
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-[#101828] border border-white/[0.06]">
                  <p className="text-xs text-slate-400">Order Total</p>
                  <p className="mt-1 text-lg font-semibold text-white font-mono tabular-nums">
                    {formatMoney(order.totalAmount, currency, false)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#101828] border border-white/[0.06]">
                  <p className="text-xs text-slate-400">
                    COGS {publicMode && '· Masked'}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-200 font-mono tabular-nums">
                    {formatMoney(order.totalCost, currency, publicMode)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#101828] border border-white/[0.06]">
                  <p className="text-xs text-slate-400">
                    Gross Profit {publicMode && '· Masked'}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[#06B6D4] font-mono tabular-nums">
                    {formatMoney(grossProfit, currency, publicMode)}
                    {!publicMode && (
                      <span className="text-xs text-slate-400 ml-1.5">
                        ({marginPct.toFixed(1)}%)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#101828] border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              {linkedInvoice ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-slate-300 font-mono">
                    Invoice {linkedInvoice.invoiceNumber} ({linkedInvoice.status})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      exportInvoicePdf(linkedInvoice, businessName, currency)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#22D3EE] bg-[#06B6D4]/15 hover:bg-[#06B6D4]/25 border border-[#06B6D4]/30 rounded-lg transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Invoice PDF</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={invoiceBusy}
                  onClick={handleGenerateInvoice}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#162033] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  <FileText className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span>
                    {invoiceBusy
                      ? 'Generating...'
                      : 'Generate Invoice for Order'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
