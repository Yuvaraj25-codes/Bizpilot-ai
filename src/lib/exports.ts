import { jsPDF } from 'jspdf';
import type {
  AnalyticsSummary,
  CurrencyCode,
  Invoice,
  WorkspaceData,
} from '../../shared/types.ts';
import { formatMoney, formatShortDate } from './formatters.ts';

export function sanitizeFilename(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ].join('\n');

  const blob = new Blob([csvLines], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFilename(filename)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportInvoicePdf(
  invoice: Invoice,
  businessName: string,
  currency: CurrencyCode
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(16, 24, 40);
  doc.rect(0, 0, pageWidth, 110, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(businessName, 40, 48);

  doc.setTextColor(6, 182, 212);
  doc.setFontSize(11);
  doc.text(`INVOICE ${invoice.invoiceNumber}`, 40, 72);

  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Status: ${invoice.status.toUpperCase()}`, pageWidth - 40, 48, {
    align: 'right',
  });
  doc.text(`Issued: ${formatShortDate(invoice.issuedAt)}`, pageWidth - 40, 66, {
    align: 'right',
  });
  doc.text(`Due: ${formatShortDate(invoice.dueDate)}`, pageWidth - 40, 84, {
    align: 'right',
  });

  // Bill To
  let y = 145;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('BILL TO', 40, y);

  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(invoice.customerName, 40, y);
  if (invoice.customerPhone) {
    y += 16;
    doc.text(invoice.customerPhone, 40, y);
  }
  if (invoice.customerEmail) {
    y += 16;
    doc.text(invoice.customerEmail, 40, y);
  }

  // Table header
  y += 34;
  doc.setFillColor(241, 245, 249);
  doc.rect(40, y - 14, pageWidth - 80, 24, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('Description', 48, y);
  doc.text('Qty', pageWidth - 200, y, { align: 'right' });
  doc.text('Unit Price', pageWidth - 125, y, { align: 'right' });
  doc.text('Amount', pageWidth - 48, y, { align: 'right' });

  y += 24;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);

  for (const item of invoice.items) {
    if (y > 740) {
      doc.addPage();
      y = 50;
    }
    const lineTotal = item.quantity * item.unitPrice;
    doc.text(item.description.slice(0, 56), 48, y);
    doc.text(String(item.quantity), pageWidth - 200, y, { align: 'right' });
    doc.text(formatMoney(item.unitPrice, currency), pageWidth - 125, y, {
      align: 'right',
    });
    doc.text(formatMoney(lineTotal, currency), pageWidth - 48, y, {
      align: 'right',
    });
    y += 22;
  }

  // Totals
  y += 16;
  doc.setDrawColor(203, 213, 225);
  doc.line(pageWidth - 240, y, pageWidth - 40, y);
  y += 22;

  doc.text('Subtotal', pageWidth - 150, y);
  doc.text(formatMoney(invoice.subtotal, currency), pageWidth - 48, y, {
    align: 'right',
  });
  y += 18;

  doc.text(`Tax (${invoice.taxRate}%)`, pageWidth - 150, y);
  doc.text(formatMoney(invoice.taxAmount, currency), pageWidth - 48, y, {
    align: 'right',
  });
  y += 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(59, 130, 246);
  doc.text('Total Due', pageWidth - 150, y);
  doc.text(formatMoney(invoice.totalAmount, currency), pageWidth - 48, y, {
    align: 'right',
  });

  doc.save(`${sanitizeFilename(invoice.invoiceNumber)}_${sanitizeFilename(invoice.customerName)}.pdf`);
}

export function exportPnlPdf(
  analytics: AnalyticsSummary,
  workspace: WorkspaceData
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const currency = workspace.settings.currency;

  doc.setFillColor(16, 24, 40);
  doc.rect(0, 0, pageWidth, 100, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text(`${workspace.settings.businessName}`, 40, 44);
  doc.setTextColor(6, 182, 212);
  doc.setFontSize(11);
  doc.text(
    `Profit and Loss Report (${analytics.range.toUpperCase()}) · Generated ${formatShortDate(new Date().toISOString())}`,
    40,
    68
  );

  let y = 140;
  const addRow = (label: string, value: string, bold = false) => {
    if (y > 760) {
      doc.addPage();
      y = 50;
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 12 : 11);
    doc.setTextColor(15, 23, 42);
    doc.text(label, 48, y);
    doc.text(value, pageWidth - 48, y, { align: 'right' });
    y += 24;
  };

  addRow('Total Sales Revenue (Completed Orders)', formatMoney(analytics.revenue, currency), true);
  addRow('Cost of Goods Sold (COGS)', `-${formatMoney(analytics.cogs, currency)}`);
  addRow('Gross Profit', formatMoney(analytics.grossProfit, currency), true);
  addRow('Gross Margin %', `${analytics.grossMarginPct.toFixed(1)}%`);

  y += 12;
  doc.setDrawColor(203, 213, 225);
  doc.line(48, y, pageWidth - 48, y);
  y += 24;

  doc.setFont('helvetica', 'bold');
  doc.text('Operating Expenses Breakdown', 48, y);
  y += 22;

  for (const cat of analytics.expenseBreakdown) {
    addRow(`${cat.category} (${cat.sharePct.toFixed(1)}%)`, formatMoney(cat.amount, currency));
  }

  addRow('Total Operating Expenses', `-${formatMoney(analytics.operatingExpenses, currency)}`, true);

  y += 10;
  doc.line(48, y, pageWidth - 48, y);
  y += 26;

  addRow('Net Profit', formatMoney(analytics.netProfit, currency), true);
  addRow(
    'Inventory Retail Valuation',
    formatMoney(analytics.inventory.retailValuation, currency)
  );
  addRow(
    'Inventory Cost Valuation',
    formatMoney(analytics.inventory.costValuation, currency)
  );

  doc.save(`${sanitizeFilename('Profit_Loss_Report_' + analytics.range)}.pdf`);
}
