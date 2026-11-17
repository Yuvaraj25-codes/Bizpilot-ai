import { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Plus,
  Receipt,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AnalyticsSummary,
  ExpenseCategory,
  Invoice,
  InvoiceStatus,
  WorkspaceData,
} from '../../shared/types.ts';
import {
  downloadCsv,
  exportInvoicePdf,
  exportPnlPdf,
} from '../lib/exports.ts';
import {
  formatMoney,
  formatShortDate,
  maskPhone,
} from '../lib/formatters.ts';

interface FinanceViewProps {
  workspace: WorkspaceData;
  analytics: AnalyticsSummary;
  onCreateExpense: (payload: {
    title: string;
    category: ExpenseCategory;
    amount: number;
    date: string;
    notes?: string;
  }) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  onCreateInvoice: (payload: {
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    taxRate: number;
    dueDate: string;
    status: InvoiceStatus;
    items: { description: string; quantity: number; unitPrice: number }[];
  }) => Promise<void>;
  onUpdateInvoiceStatus: (id: string, status: InvoiceStatus) => Promise<void>;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Marketing',
  'Payroll',
  'Logistics',
  'Software',
  'Utilities',
  'Inventory Restock',
  'Other',
];

export function FinanceView({
  workspace,
  analytics,
  onCreateExpense,
  onDeleteExpense,
  onCreateInvoice,
  onUpdateInvoiceStatus,
}: FinanceViewProps) {
  const { currency, publicMode, businessName } = workspace.settings;
  const [subTab, setSubTab] = useState<'ledger' | 'invoices'>('ledger');

  // Expense Modal
  const [expModalOpen, setExpModalOpen] = useState(false);
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('Marketing');
  const [expAmount, setExpAmount] = useState('');
  const [expNotes, setExpNotes] = useState('');
  const [expError, setExpError] = useState<string | null>(null);
  const [expBusy, setExpBusy] = useState(false);

  // Invoice Modal
  const [invModalOpen, setInvModalOpen] = useState(false);
  const [invCustomer, setInvCustomer] = useState('');
  const [invPhone, setInvPhone] = useState('');
  const [invEmail, setInvEmail] = useState('');
  const [invTaxRate, setInvTaxRate] = useState('8.5');
  const [invItems, setInvItems] = useState([
    { description: '', quantity: 1, unitPrice: 0 },
  ]);
  const [invError, setInvError] = useState<string | null>(null);
  const [invBusy, setInvBusy] = useState(false);

  // Preview Modal
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpError(null);
    const amt = Number(expAmount);
    if (!expTitle.trim()) {
      setExpError('Expense title is required.');
      return;
    }
    if (Number.isNaN(amt) || amt <= 0) {
      setExpError('Amount must be greater than 0.');
      return;
    }
    setExpBusy(true);
    try {
      await onCreateExpense({
        title: expTitle.trim(),
        category: expCategory,
        amount: amt,
        date: new Date().toISOString(),
        notes: expNotes.trim(),
      });
      setExpModalOpen(false);
      setExpTitle('');
      setExpAmount('');
      setExpNotes('');
    } catch (err: any) {
      setExpError(err?.message || 'Failed to record expense.');
    } finally {
      setExpBusy(false);
    }
  };

  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvError(null);
    if (!invCustomer.trim()) {
      setInvError('Customer name is required.');
      return;
    }
    const tax = Number(invTaxRate);
    if (Number.isNaN(tax) || tax < 0) {
      setInvError('Tax rate must be non-negative.');
      return;
    }
    for (const item of invItems) {
      if (!item.description.trim() || item.quantity <= 0 || item.unitPrice < 0) {
        setInvError(
          'Each line item requires a description, quantity >= 1, and non-negative price.'
        );
        return;
      }
    }

    setInvBusy(true);
    try {
      await onCreateInvoice({
        customerName: invCustomer.trim(),
        customerPhone: invPhone.trim() || '+1 (555) 000-0000',
        customerEmail: invEmail.trim(),
        taxRate: tax,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'sent',
        items: invItems,
      });
      setInvModalOpen(false);
      setInvCustomer('');
      setInvPhone('');
      setInvEmail('');
      setInvItems([{ description: '', quantity: 1, unitPrice: 0 }]);
    } catch (err: any) {
      setInvError(err?.message || 'Failed to generate invoice.');
    } finally {
      setInvBusy(false);
    }
  };

  const handleExportExpensesCsv = () => {
    downloadCsv(
      'bizpilot_expense_ledger',
      ['Date', 'Title', 'Category', 'Amount', 'Notes'],
      workspace.expenses.map((e) => [
        formatShortDate(e.date),
        e.title,
        e.category,
        e.amount,
        e.notes || '',
      ])
    );
  };

  return (
    <div className="space-y-5">
      {/* Sub-navigation + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#162033] border border-white/[0.08] rounded-xl p-4">
        <div className="flex items-center gap-1.5 bg-[#101828] p-1 rounded-lg border border-white/[0.06] self-start">
          <button
            type="button"
            onClick={() => setSubTab('ledger')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'ledger'
                ? 'bg-[#3B82F6] text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Expense Ledger & P&amp;L
          </button>
          <button
            type="button"
            onClick={() => setSubTab('invoices')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'invoices'
                ? 'bg-[#3B82F6] text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Invoices ({workspace.invoices.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {subTab === 'ledger' ? (
            <>
              <button
                type="button"
                onClick={handleExportExpensesCsv}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-[#101828] hover:bg-white/[0.06] border border-white/[0.1] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Expenses CSV</span>
              </button>
              <button
                type="button"
                onClick={() => exportPnlPdf(analytics, workspace)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#22D3EE] bg-[#101828] hover:bg-[#06B6D4]/15 border border-[#06B6D4]/30 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export P&amp;L PDF</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setExpError(null);
                  setExpModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Expense</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setInvError(null);
                setInvModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Generate Invoice</span>
            </button>
          )}
        </div>
      </div>

      {subTab === 'ledger' ? (
        <div className="space-y-5">
          {/* P&L Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-[#162033] border border-white/[0.08] rounded-xl p-5">
              <p className="text-xs text-slate-400">Revenue (30d)</p>
              <p className="mt-1.5 text-xl font-semibold text-white font-mono tabular-nums">
                {formatMoney(analytics.revenue, currency, false)}
              </p>
            </div>
            <div className="bg-[#162033] border border-white/[0.08] rounded-xl p-5">
              <p className="text-xs text-slate-400">
                COGS {publicMode && '· Masked'}
              </p>
              <p className="mt-1.5 text-xl font-semibold text-slate-200 font-mono tabular-nums">
                {formatMoney(analytics.cogs, currency, publicMode)}
              </p>
            </div>
            <div className="bg-[#162033] border border-white/[0.08] rounded-xl p-5">
              <p className="text-xs text-slate-400">Operating Expenses</p>
              <p className="mt-1.5 text-xl font-semibold text-amber-400 font-mono tabular-nums">
                {formatMoney(analytics.operatingExpenses, currency, false)}
              </p>
            </div>
            <div className="bg-[#162033] border border-white/[0.08] rounded-xl p-5">
              <p className="text-xs text-slate-400">
                Net Profit {publicMode && '· Masked'}
              </p>
              <p className="mt-1.5 text-xl font-semibold text-[#06B6D4] font-mono tabular-nums">
                {formatMoney(analytics.netProfit, currency, publicMode)}
              </p>
            </div>
          </div>

          {/* Expenses Table */}
          <div className="bg-[#162033] border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Operating Expense Ledger
              </h3>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {workspace.expenses.length} entries
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.08] text-xs text-slate-400">
                    <th className="py-3.5 px-5 font-medium">Date</th>
                    <th className="py-3.5 px-4 font-medium">Expense Title</th>
                    <th className="py-3.5 px-4 font-medium">Category</th>
                    <th className="py-3.5 px-4 font-medium">Notes</th>
                    <th className="py-3.5 px-4 font-medium text-right">
                      Amount
                    </th>
                    <th className="py-3.5 px-5 font-medium text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-sm">
                  {workspace.expenses.map((exp) => (
                    <tr
                      key={exp.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3.5 px-5 text-xs text-slate-400 font-mono tabular-nums whitespace-nowrap">
                        {formatShortDate(exp.date)}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-white">
                        {exp.title}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#22D3EE]">
                        {exp.category}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {exp.notes || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-white font-medium">
                        {formatMoney(exp.amount, currency, false)}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteExpense(exp.id)}
                          aria-label={`Delete ${exp.title}`}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Invoices Table */
        <div className="bg-[#162033] border border-white/[0.08] rounded-xl overflow-hidden">
          {workspace.invoices.length === 0 ? (
            <div className="py-14 px-6 flex flex-col items-center justify-center text-center">
              <Receipt className="w-8 h-8 text-slate-500 mb-3" />
              <p className="text-sm font-medium text-slate-200">
                No invoices issued yet
              </p>
              <button
                type="button"
                onClick={() => setInvModalOpen(true)}
                className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg cursor-pointer"
              >
                Generate First Invoice
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.08] text-xs text-slate-400">
                    <th className="py-3.5 px-5 font-medium">Invoice #</th>
                    <th className="py-3.5 px-4 font-medium">Client</th>
                    <th className="py-3.5 px-4 font-medium">Issued</th>
                    <th className="py-3.5 px-4 font-medium">Due</th>
                    <th className="py-3.5 px-4 font-medium">Status</th>
                    <th className="py-3.5 px-4 font-medium text-right">
                      Total
                    </th>
                    <th className="py-3.5 px-5 font-medium text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-sm">
                  {workspace.invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3.5 px-5 font-mono text-xs text-[#22D3EE] font-medium">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-white">
                          {inv.customerName}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">
                          {maskPhone(inv.customerPhone, publicMode)}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400 font-mono tabular-nums">
                        {formatShortDate(inv.issuedAt)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400 font-mono tabular-nums">
                        {formatShortDate(inv.dueDate)}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <select
                          aria-label={`Invoice status for ${inv.invoiceNumber}`}
                          value={inv.status}
                          disabled={inv.status === 'paid'}
                          title={
                            inv.status === 'paid'
                              ? 'Paid invoices are locked'
                              : undefined
                          }
                          onChange={(e) =>
                            onUpdateInvoiceStatus(
                              inv.id,
                              e.target.value as InvoiceStatus
                            )
                          }
                          className={`px-2 py-1 rounded-md bg-[#101828] border border-white/[0.1] font-medium capitalize cursor-pointer disabled:opacity-75 disabled:cursor-default ${
                            inv.status === 'paid'
                              ? 'text-emerald-400'
                              : inv.status === 'sent'
                              ? 'text-[#3B82F6]'
                              : 'text-slate-300'
                          }`}
                        >
                          <option value="draft">Draft</option>
                          <option value="sent">Sent</option>
                          <option value="paid">Paid</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-white">
                        {formatMoney(inv.totalAmount, currency, false)}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewInvoice(inv)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-[#101828] hover:bg-white/[0.08] text-slate-200 border border-white/[0.1] cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              exportInvoicePdf(inv, businessName, currency)
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-[#3B82F6]/20 hover:bg-[#3B82F6] text-[#22D3EE] hover:text-white border border-[#3B82F6]/30 transition-colors cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Record Expense Modal */}
      {expModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-[#162033] border border-white/[0.12] rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-[#101828] border-b border-white/[0.08] flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                Record Operating Expense
              </h3>
              <button
                type="button"
                onClick={() => setExpModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleExpenseSubmit} className="p-6 space-y-4">
              {expError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                  {expError}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Expense Title
                </label>
                <input
                  type="text"
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="Regional Freight Shipment"
                  className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Category
                  </label>
                  <select
                    value={expCategory}
                    onChange={(e) =>
                      setExpCategory(e.target.value as ExpenseCategory)
                    }
                    className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#3B82F6]"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Amount
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="250.00"
                    className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white font-mono focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  placeholder="Invoice # or vendor reference"
                  className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setExpModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 rounded-lg border border-white/[0.1] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expBusy}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {expBusy ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Invoice Modal */}
      {invModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl bg-[#162033] border border-white/[0.12] rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-[#101828] border-b border-white/[0.08] flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                Generate Custom Invoice
              </h3>
              <button
                type="button"
                onClick={() => setInvModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={handleInvoiceSubmit}
              className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
            >
              {invError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                  {invError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={invCustomer}
                    onChange={(e) => setInvCustomer(e.target.value)}
                    placeholder="Horizon Labs"
                    className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={invPhone}
                    onChange={(e) => setInvPhone(e.target.value)}
                    placeholder="+1 (415) 555-0192"
                    className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white font-mono focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={invTaxRate}
                    onChange={(e) => setInvTaxRate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white font-mono focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Client Email
                </label>
                <input
                  type="email"
                  value={invEmail}
                  onChange={(e) => setInvEmail(e.target.value)}
                  placeholder="billing@horizonlabs.io"
                  className="w-full px-3 py-2 text-sm bg-[#101828] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    Line Items
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setInvItems((p) => [
                        ...p,
                        { description: '', quantity: 1, unitPrice: 0 },
                      ])
                    }
                    className="text-xs font-medium text-[#3B82F6] hover:text-[#22D3EE] cursor-pointer"
                  >
                    + Add Item
                  </button>
                </div>

                {invItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center bg-[#101828] p-2.5 rounded-lg border border-white/[0.06]"
                  >
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) =>
                        setInvItems((p) =>
                          p.map((x, i) =>
                            i === idx ? { ...x, description: e.target.value } : x
                          )
                        )
                      }
                      placeholder="Service or product description"
                      className="col-span-6 px-2.5 py-1.5 text-xs bg-[#162033] border border-white/[0.1] rounded text-white focus:outline-none focus:border-[#3B82F6]"
                    />
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        setInvItems((p) =>
                          p.map((x, i) =>
                            i === idx
                              ? { ...x, quantity: Number(e.target.value) }
                              : x
                          )
                        )
                      }
                      placeholder="Qty"
                      className="col-span-2 px-2 py-1.5 text-xs bg-[#162033] border border-white/[0.1] rounded text-white font-mono text-right"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) =>
                        setInvItems((p) =>
                          p.map((x, i) =>
                            i === idx
                              ? { ...x, unitPrice: Number(e.target.value) }
                              : x
                          )
                        )
                      }
                      placeholder="Price"
                      className="col-span-3 px-2 py-1.5 text-xs bg-[#162033] border border-white/[0.1] rounded text-white font-mono text-right"
                    />
                    <div className="col-span-1 text-right">
                      {invItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setInvItems((p) => p.filter((_, i) => i !== idx))
                          }
                          className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setInvModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 rounded-lg border border-white/[0.1] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={invBusy}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {invBusy ? 'Generating...' : 'Issue Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {previewInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl bg-[#162033] border border-white/[0.14] rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-[#101828] border-b border-white/[0.08] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">
                  Invoice Preview · {previewInvoice.invoiceNumber}
                </h3>
                <p className="text-xs text-slate-400">
                  Issued {formatShortDate(previewInvoice.issuedAt)} · Due{' '}
                  {formatShortDate(previewInvoice.dueDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewInvoice(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 bg-[#101828]/50">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-400">From</p>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    {businessName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Bill To</p>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    {previewInvoice.customerName}
                  </p>
                  <p className="text-xs text-slate-400 font-mono">
                    {maskPhone(previewInvoice.customerPhone, publicMode)}
                  </p>
                  {previewInvoice.customerEmail && (
                    <p className="text-xs text-slate-400">
                      {previewInvoice.customerEmail}
                    </p>
                  )}
                </div>
              </div>

              <div className="border border-white/[0.08] rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#101828] text-xs text-slate-400 border-b border-white/[0.08]">
                      <th className="py-2.5 px-4 font-medium">Description</th>
                      <th className="py-2.5 px-3 font-medium text-right">
                        Qty
                      </th>
                      <th className="py-2.5 px-3 font-medium text-right">
                        Rate
                      </th>
                      <th className="py-2.5 px-4 font-medium text-right">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {previewInvoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-4 text-slate-200">
                          {item.description}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                          {formatMoney(item.unitPrice, currency, false)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-white font-medium">
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

              <div className="flex flex-col items-end space-y-1.5 text-sm font-mono tabular-nums">
                <div className="flex items-center justify-between w-56 text-slate-300">
                  <span>Subtotal</span>
                  <span>
                    {formatMoney(previewInvoice.subtotal, currency, false)}
                  </span>
                </div>
                <div className="flex items-center justify-between w-56 text-slate-300">
                  <span>Tax ({previewInvoice.taxRate}%)</span>
                  <span>
                    {formatMoney(previewInvoice.taxAmount, currency, false)}
                  </span>
                </div>
                <div className="flex items-center justify-between w-56 pt-2 border-t border-white/[0.1] text-base font-semibold text-[#06B6D4]">
                  <span>Total</span>
                  <span>
                    {formatMoney(previewInvoice.totalAmount, currency, false)}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#101828] border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span className="capitalize">
                  Status: {previewInvoice.status}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setPreviewInvoice(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 rounded-lg border border-white/[0.1] cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportInvoicePdf(previewInvoice, businessName, currency)
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
