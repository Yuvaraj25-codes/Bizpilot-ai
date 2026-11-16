import fs from 'fs';
import path from 'path';
import type {
  Expense,
  ExpenseCategory,
  Invoice,
  InvoiceStatus,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  WorkspaceData,
  WorkspaceSettings,
} from '../shared/types.js';

const DATA_DIR = path.resolve(process.cwd(), '.data', 'workspaces');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function sanitizeWorkspaceId(id?: string): string {
  const cleaned = (id || 'public-demo').replace(/[^a-zA-Z0-9_-]/g, '');
  return cleaned || 'public-demo';
}

function daysAgoIso(days: number, hour = 10, minute = 0): string {
  const now = new Date();
  const d = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - days,
    hour,
    minute,
    0
  );
  return d.toISOString();
}

function todayHoursAgoIso(hoursAgo: number): string {
  const now = new Date();
  const target = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (target < startOfToday) {
    return new Date(startOfToday.getTime() + 15 * 60 * 1000).toISOString();
  }
  return target.toISOString();
}

export function createSeedWorkspace(id: string): WorkspaceData {
  const products: Product[] = [
    {
      id: 'prod-1',
      sku: 'BP-KEY-01',
      name: 'Vortex 75% Mechanical Keyboard',
      category: 'Peripherals',
      costPrice: 68,
      retailPrice: 149,
      stockQty: 34,
      lowStockThreshold: 10,
      updatedAt: daysAgoIso(2),
    },
    {
      id: 'prod-2',
      sku: 'BP-MON-04',
      name: 'Lumix 27" 4K IPS Studio Monitor',
      category: 'Displays',
      costPrice: 245,
      retailPrice: 449,
      stockQty: 6,
      lowStockThreshold: 8,
      updatedAt: daysAgoIso(1),
    },
    {
      id: 'prod-3',
      sku: 'BP-DOC-09',
      name: 'ThunderDock Pro Thunderbolt 4 Hub',
      category: 'Connectivity',
      costPrice: 82,
      retailPrice: 189,
      stockQty: 22,
      lowStockThreshold: 8,
      updatedAt: daysAgoIso(3),
    },
    {
      id: 'prod-4',
      sku: 'BP-AUD-12',
      name: 'Aether Studio ANC Headset',
      category: 'Audio',
      costPrice: 95,
      retailPrice: 229,
      stockQty: 4,
      lowStockThreshold: 10,
      updatedAt: daysAgoIso(1),
    },
    {
      id: 'prod-5',
      sku: 'BP-ERG-03',
      name: 'AeroLift Dual Monitor Arm',
      category: 'Ergonomics',
      costPrice: 42,
      retailPrice: 119,
      stockQty: 0,
      lowStockThreshold: 6,
      updatedAt: daysAgoIso(4),
    },
    {
      id: 'prod-6',
      sku: 'BP-CAM-07',
      name: 'OpticStream 4K Desk Webcam',
      category: 'Video',
      costPrice: 54,
      retailPrice: 139,
      stockQty: 19,
      lowStockThreshold: 8,
      updatedAt: daysAgoIso(2),
    },
    {
      id: 'prod-7',
      sku: 'BP-PWR-15',
      name: 'GaN 140W Multi-Port Desk Charger',
      category: 'Power',
      costPrice: 31,
      retailPrice: 79,
      stockQty: 5,
      lowStockThreshold: 12,
      updatedAt: daysAgoIso(1),
    },
  ];

  const byId = new Map(products.map((p) => [p.id, p]));
  const makeItem = (productId: string, quantity: number): OrderItem => {
    const p = byId.get(productId)!;
    return {
      productId: p.id,
      sku: p.sku,
      productName: p.name,
      quantity,
      unitPrice: p.retailPrice,
      unitCost: p.costPrice,
    };
  };

  const buildOrder = (
    id: string,
    orderNumber: string,
    customerName: string,
    customerPhone: string,
    status: OrderStatus,
    items: OrderItem[],
    createdAt: string
  ): Order => ({
    id,
    orderNumber,
    customerName,
    customerPhone,
    status,
    items,
    totalAmount: items.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
    totalCost: items.reduce((s, i) => s + i.quantity * i.unitCost, 0),
    createdAt,
  });

  const orders: Order[] = [
    buildOrder(
      'ord-101',
      'ORD-2084',
      'Northstar Design Studio',
      '+1 (415) 890-2314',
      'completed',
      [makeItem('prod-2', 2), makeItem('prod-3', 2)],
      todayHoursAgoIso(1)
    ),
    buildOrder(
      'ord-102',
      'ORD-2083',
      'Elena Rostova',
      '+1 (212) 641-9902',
      'completed',
      [makeItem('prod-1', 2), makeItem('prod-6', 1)],
      todayHoursAgoIso(3)
    ),
    buildOrder(
      'ord-103',
      'ORD-2082',
      'Kestrel Robotics Lab',
      '+1 (650) 412-7731',
      'pending',
      [makeItem('prod-4', 3), makeItem('prod-7', 4)],
      todayHoursAgoIso(0.5)
    ),
    buildOrder(
      'ord-104',
      'ORD-2081',
      'Marcus Vance',
      '+1 (312) 554-8120',
      'completed',
      [makeItem('prod-2', 1), makeItem('prod-1', 1)],
      daysAgoIso(1, 14, 20)
    ),
    buildOrder(
      'ord-105',
      'ORD-2080',
      'Horizon Media Group',
      '+1 (512) 778-3044',
      'completed',
      [makeItem('prod-4', 4), makeItem('prod-6', 3)],
      daysAgoIso(2, 11, 10)
    ),
    buildOrder(
      'ord-106',
      'ORD-2079',
      'Atlas FinTech Ops',
      '+1 (646) 290-4511',
      'completed',
      [makeItem('prod-3', 3), makeItem('prod-7', 5)],
      daysAgoIso(4, 16, 45)
    ),
    buildOrder(
      'ord-107',
      'ORD-2078',
      'Sora Creative Collective',
      '+1 (206) 934-1189',
      'completed',
      [makeItem('prod-2', 3), makeItem('prod-1', 3)],
      daysAgoIso(6, 13, 15)
    ),
    buildOrder(
      'ord-108',
      'ORD-2077',
      'Brightline Architecture',
      '+1 (303) 618-7422',
      'completed',
      [makeItem('prod-2', 4), makeItem('prod-3', 4)],
      daysAgoIso(12, 10, 30)
    ),
    buildOrder(
      'ord-109',
      'ORD-2076',
      'Apex Cloud Systems',
      '+1 (408) 701-5590',
      'completed',
      [makeItem('prod-1', 6), makeItem('prod-4', 2)],
      daysAgoIso(19, 15, 0)
    ),
    buildOrder(
      'ord-110',
      'ORD-2075',
      'Cobalt Ventures',
      '+1 (617) 842-3319',
      'completed',
      [makeItem('prod-2', 5), makeItem('prod-6', 5)],
      daysAgoIso(27, 12, 0)
    ),
    buildOrder(
      'ord-111',
      'ORD-2074',
      'Meridian Digital',
      '+1 (415) 391-8022',
      'completed',
      [makeItem('prod-3', 6), makeItem('prod-1', 4)],
      daysAgoIso(48, 11, 0)
    ),
  ];

  const expenses: Expense[] = [
    {
      id: 'exp-1',
      title: 'Meta & Search Performance Ads',
      category: 'Marketing',
      amount: 340,
      date: todayHoursAgoIso(2),
      notes: 'Q4 workstation hardware campaign',
    },
    {
      id: 'exp-2',
      title: 'Express Courier & Fulfillment Batch',
      category: 'Logistics',
      amount: 165,
      date: daysAgoIso(1, 9, 30),
      notes: 'Same-day metro deliveries',
    },
    {
      id: 'exp-3',
      title: 'Cloud ERP & Telemetry Subscriptions',
      category: 'Software',
      amount: 189,
      date: daysAgoIso(3, 10, 0),
      notes: 'Monthly SaaS stack',
    },
    {
      id: 'exp-4',
      title: 'Part-Time Warehouse Fulfillment Payroll',
      category: 'Payroll',
      amount: 1450,
      date: daysAgoIso(5, 17, 0),
      notes: 'Bi-weekly operations crew',
    },
    {
      id: 'exp-5',
      title: 'Warehouse Climate & Fiber Internet',
      category: 'Utilities',
      amount: 260,
      date: daysAgoIso(11, 8, 45),
      notes: 'Facility utilities',
    },
    {
      id: 'exp-6',
      title: 'Packaging & Anti-Static Sleeves',
      category: 'Inventory Restock',
      amount: 420,
      date: daysAgoIso(18, 14, 0),
      notes: 'Bulk protective cartons',
    },
    {
      id: 'exp-7',
      title: 'Trade Expo Booth & Collateral',
      category: 'Marketing',
      amount: 950,
      date: daysAgoIso(45, 12, 0),
      notes: 'Regional B2B showcase',
    },
  ];

  const invoices: Invoice[] = [
    {
      id: 'inv-1',
      invoiceNumber: 'INV-2084',
      orderId: 'ord-101',
      customerName: 'Northstar Design Studio',
      customerPhone: '+1 (415) 890-2314',
      customerEmail: 'ap@northstardesign.io',
      items: orders[0].items.map((i) => ({
        description: `${i.productName} (${i.sku})`,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      subtotal: 1276,
      taxRate: 8.5,
      taxAmount: 108.46,
      totalAmount: 1384.46,
      status: 'paid',
      issuedAt: orders[0].createdAt,
      dueDate: daysAgoIso(-14),
    },
    {
      id: 'inv-2',
      invoiceNumber: 'INV-2082',
      orderId: 'ord-103',
      customerName: 'Kestrel Robotics Lab',
      customerPhone: '+1 (650) 412-7731',
      customerEmail: 'procurement@kestrelrobotics.ai',
      items: orders[2].items.map((i) => ({
        description: `${i.productName} (${i.sku})`,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      subtotal: 1003,
      taxRate: 8.5,
      taxAmount: 85.26,
      totalAmount: 1088.26,
      status: 'sent',
      issuedAt: orders[2].createdAt,
      dueDate: daysAgoIso(-15),
    },
    {
      id: 'inv-3',
      invoiceNumber: 'INV-2079',
      orderId: 'ord-106',
      customerName: 'Atlas FinTech Ops',
      customerPhone: '+1 (646) 290-4511',
      customerEmail: 'finance@atlasfintech.com',
      items: orders[5].items.map((i) => ({
        description: `${i.productName} (${i.sku})`,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      subtotal: 962,
      taxRate: 8.5,
      taxAmount: 81.77,
      totalAmount: 1043.77,
      status: 'paid',
      issuedAt: orders[5].createdAt,
      dueDate: daysAgoIso(-10),
    },
  ];

  const settings: WorkspaceSettings = {
    businessName: 'BizPilot Hardware & Ops',
    currency: 'USD',
    publicMode: false,
    telemetryAlerts: true,
    lowStockDefault: 10,
    cloudSyncEnabled: false,
    syncCode: id.toUpperCase(),
    lastSyncedAt: new Date().toISOString(),
  };

  return {
    id,
    products,
    orders,
    expenses,
    invoices,
    settings,
    updatedAt: new Date().toISOString(),
  };
}

function getFilePath(workspaceId: string): string {
  ensureDataDir();
  return path.join(DATA_DIR, `${sanitizeWorkspaceId(workspaceId)}.json`);
}

export function getWorkspace(workspaceId?: string): WorkspaceData {
  const id = sanitizeWorkspaceId(workspaceId);
  const filePath = getFilePath(id);
  if (!fs.existsSync(filePath)) {
    const seed = createSeedWorkspace(id);
    saveWorkspace(seed);
    return seed;
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as WorkspaceData;
}

export function saveWorkspace(workspace: WorkspaceData): WorkspaceData {
  const id = sanitizeWorkspaceId(workspace.id);
  const updated: WorkspaceData = {
    ...workspace,
    id,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(getFilePath(id), JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

export function resetWorkspace(workspaceId?: string): WorkspaceData {
  const id = sanitizeWorkspaceId(workspaceId);
  const seed = createSeedWorkspace(id);
  return saveWorkspace(seed);
}

export function upsertProduct(
  workspaceId: string,
  input: Omit<Product, 'id' | 'updatedAt'> & { id?: string }
): { workspace: WorkspaceData; product: Product } {
  const ws = getWorkspace(workspaceId);
  if (input.costPrice < 0 || input.retailPrice < 0 || input.stockQty < 0) {
    throw new Error('Prices and stock quantity must be non-negative.');
  }
  if (!input.name.trim() || !input.sku.trim()) {
    throw new Error('Product name and SKU are required.');
  }

  const now = new Date().toISOString();
  let saved: Product;

  if (input.id) {
    const idx = ws.products.findIndex((p) => p.id === input.id);
    if (idx === -1) throw new Error('Product not found.');
    saved = {
      ...ws.products[idx],
      ...input,
      id: input.id,
      updatedAt: now,
    };
    ws.products[idx] = saved;
  } else {
    const duplicateSku = ws.products.some(
      (p) => p.sku.toLowerCase() === input.sku.trim().toLowerCase()
    );
    if (duplicateSku) {
      throw new Error(`SKU "${input.sku.trim()}" already exists.`);
    }
    saved = {
      id: `prod-${Date.now()}`,
      sku: input.sku.trim().toUpperCase(),
      name: input.name.trim(),
      category: input.category.trim() || 'General',
      costPrice: Number(input.costPrice),
      retailPrice: Number(input.retailPrice),
      stockQty: Math.floor(Number(input.stockQty)),
      lowStockThreshold: Math.max(0, Math.floor(Number(input.lowStockThreshold))),
      updatedAt: now,
    };
    ws.products.unshift(saved);
  }

  return { workspace: saveWorkspace(ws), product: saved };
}

export function deleteProduct(workspaceId: string, productId: string): WorkspaceData {
  const ws = getWorkspace(workspaceId);
  ws.products = ws.products.filter((p) => p.id !== productId);
  return saveWorkspace(ws);
}

export function restockProductByIdentifier(
  workspaceId: string,
  skuOrName: string,
  addQty: number
): { workspace: WorkspaceData; product: Product } {
  if (addQty <= 0) throw new Error('Restock quantity must be positive.');
  const ws = getWorkspace(workspaceId);
  const query = skuOrName.trim().toLowerCase();
  const idx = ws.products.findIndex(
    (p) =>
      p.sku.toLowerCase() === query ||
      p.name.toLowerCase().includes(query) ||
      p.id.toLowerCase() === query
  );
  if (idx === -1) {
    throw new Error(`Product "${skuOrName}" not found in inventory.`);
  }
  ws.products[idx] = {
    ...ws.products[idx],
    stockQty: ws.products[idx].stockQty + Math.floor(addQty),
    updatedAt: new Date().toISOString(),
  };
  return { workspace: saveWorkspace(ws), product: ws.products[idx] };
}

export function createOrder(
  workspaceId: string,
  input: {
    customerName: string;
    customerPhone: string;
    status?: OrderStatus;
    items: { productId?: string; skuOrName?: string; quantity: number }[];
    autoCreateInvoice?: boolean;
  }
): { workspace: WorkspaceData; order: Order; invoice?: Invoice } {
  const ws = getWorkspace(workspaceId);
  if (!input.customerName.trim()) {
    throw new Error('Customer name is required.');
  }
  if (!input.items || input.items.length === 0) {
    throw new Error('Order must include at least one item.');
  }

  const status: OrderStatus = input.status ?? 'completed';
  const resolvedItems: OrderItem[] = [];

  for (const line of input.items) {
    const qty = Math.floor(Number(line.quantity));
    if (qty <= 0) throw new Error('Item quantity must be at least 1.');

    const prod = ws.products.find((p) => {
      if (line.productId && p.id === line.productId) return true;
      if (line.skuOrName) {
        const q = line.skuOrName.trim().toLowerCase();
        return p.sku.toLowerCase() === q || p.name.toLowerCase().includes(q);
      }
      return false;
    });

    if (!prod) {
      throw new Error(
        `Product "${line.skuOrName || line.productId}" was not found.`
      );
    }

    if (status === 'completed' && prod.stockQty < qty) {
      throw new Error(
        `Insufficient stock for ${prod.name} (${prod.stockQty} available, ${qty} requested).`
      );
    }

    resolvedItems.push({
      productId: prod.id,
      sku: prod.sku,
      productName: prod.name,
      quantity: qty,
      unitPrice: prod.retailPrice,
      unitCost: prod.costPrice,
    });
  }

  // Deduct stock if order is completed immediately
  if (status === 'completed') {
    const now = new Date().toISOString();
    for (const item of resolvedItems) {
      const prod = ws.products.find((p) => p.id === item.productId)!;
      prod.stockQty -= item.quantity;
      prod.updatedAt = now;
    }
  }

  const orderSeq = 2085 + ws.orders.length;
  const order: Order = {
    id: `ord-${Date.now()}`,
    orderNumber: `ORD-${orderSeq}`,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim() || '+1 (555) 000-0000',
    status,
    items: resolvedItems,
    totalAmount: resolvedItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
    totalCost: resolvedItems.reduce((s, i) => s + i.quantity * i.unitCost, 0),
    createdAt: new Date().toISOString(),
  };

  ws.orders.unshift(order);

  let createdInvoice: Invoice | undefined;
  if (input.autoCreateInvoice) {
    const taxRate = 8.5;
    const taxAmount = Number(((order.totalAmount * taxRate) / 100).toFixed(2));
    createdInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-${orderSeq}`,
      orderId: order.id,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: '',
      items: order.items.map((i) => ({
        description: `${i.productName} (${i.sku})`,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      subtotal: order.totalAmount,
      taxRate,
      taxAmount,
      totalAmount: Number((order.totalAmount + taxAmount).toFixed(2)),
      status: status === 'completed' ? 'paid' : 'sent',
      issuedAt: order.createdAt,
      dueDate: daysAgoIso(-14),
    };
    ws.invoices.unshift(createdInvoice);
  }

  return { workspace: saveWorkspace(ws), order, invoice: createdInvoice };
}

export function updateOrderStatus(
  workspaceId: string,
  orderId: string,
  nextStatus: OrderStatus
): WorkspaceData {
  const ws = getWorkspace(workspaceId);
  const order = ws.orders.find((o) => o.id === orderId);
  if (!order) throw new Error('Order not found.');

  const prevStatus = order.status;
  if (prevStatus === nextStatus) return ws;

  const now = new Date().toISOString();

  // Deduct stock when transitioning into completed
  if (prevStatus !== 'completed' && nextStatus === 'completed') {
    for (const item of order.items) {
      const prod = ws.products.find((p) => p.id === item.productId);
      if (!prod) continue;
      if (prod.stockQty < item.quantity) {
        throw new Error(
          `Cannot complete order: insufficient stock for ${prod.name} (${prod.stockQty} left).`
        );
      }
    }
    for (const item of order.items) {
      const prod = ws.products.find((p) => p.id === item.productId);
      if (prod) {
        prod.stockQty -= item.quantity;
        prod.updatedAt = now;
      }
    }
  }

  // Restore stock when transitioning out of completed
  if (prevStatus === 'completed' && nextStatus !== 'completed') {
    for (const item of order.items) {
      const prod = ws.products.find((p) => p.id === item.productId);
      if (prod) {
        prod.stockQty += item.quantity;
        prod.updatedAt = now;
      }
    }
  }

  order.status = nextStatus;
  return saveWorkspace(ws);
}

export function createExpense(
  workspaceId: string,
  input: {
    title: string;
    category: ExpenseCategory;
    amount: number;
    date?: string;
    notes?: string;
  }
): { workspace: WorkspaceData; expense: Expense } {
  const ws = getWorkspace(workspaceId);
  if (!input.title.trim()) throw new Error('Expense title is required.');
  if (Number(input.amount) <= 0) {
    throw new Error('Expense amount must be greater than 0.');
  }

  const expense: Expense = {
    id: `exp-${Date.now()}`,
    title: input.title.trim(),
    category: input.category || 'Other',
    amount: Number(Number(input.amount).toFixed(2)),
    date: input.date || new Date().toISOString(),
    notes: input.notes?.trim() || '',
  };

  ws.expenses.unshift(expense);
  return { workspace: saveWorkspace(ws), expense };
}

export function deleteExpense(workspaceId: string, expenseId: string): WorkspaceData {
  const ws = getWorkspace(workspaceId);
  ws.expenses = ws.expenses.filter((e) => e.id !== expenseId);
  return saveWorkspace(ws);
}

export function createInvoice(
  workspaceId: string,
  input: {
    orderId?: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    taxRate?: number;
    dueDate?: string;
    status?: InvoiceStatus;
    items: { description: string; quantity: number; unitPrice: number }[];
  }
): { workspace: WorkspaceData; invoice: Invoice } {
  const ws = getWorkspace(workspaceId);
  if (!input.customerName.trim()) {
    throw new Error('Customer name is required for invoice.');
  }
  if (!input.items || input.items.length === 0) {
    throw new Error('Invoice must contain at least one line item.');
  }

  for (const item of input.items) {
    if (!item.description.trim() || item.quantity <= 0 || item.unitPrice < 0) {
      throw new Error('All invoice items require valid description, quantity, and price.');
    }
  }

  const subtotal = input.items.reduce(
    (s, i) => s + Number(i.quantity) * Number(i.unitPrice),
    0
  );
  const taxRate = Math.max(0, Number(input.taxRate ?? 8.5));
  const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
  const totalAmount = Number((subtotal + taxAmount).toFixed(2));

  const invoice: Invoice = {
    id: `inv-${Date.now()}`,
    invoiceNumber: `INV-${2090 + ws.invoices.length}`,
    orderId: input.orderId,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone?.trim() || '+1 (555) 000-0000',
    customerEmail: input.customerEmail?.trim() || '',
    items: input.items.map((i) => ({
      description: i.description.trim(),
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
    })),
    subtotal: Number(subtotal.toFixed(2)),
    taxRate,
    taxAmount,
    totalAmount,
    status: input.status ?? 'sent',
    issuedAt: new Date().toISOString(),
    dueDate: input.dueDate || daysAgoIso(-14),
  };

  ws.invoices.unshift(invoice);
  return { workspace: saveWorkspace(ws), invoice };
}

export function updateInvoiceStatus(
  workspaceId: string,
  invoiceId: string,
  status: InvoiceStatus
): WorkspaceData {
  const ws = getWorkspace(workspaceId);
  const inv = ws.invoices.find((i) => i.id === invoiceId);
  if (!inv) throw new Error('Invoice not found.');
  inv.status = status;
  return saveWorkspace(ws);
}

export function updateSettings(
  workspaceId: string,
  patch: Partial<WorkspaceSettings>
): WorkspaceData {
  const ws = getWorkspace(workspaceId);
  ws.settings = {
    ...ws.settings,
    ...patch,
    lastSyncedAt: patch.cloudSyncEnabled
      ? new Date().toISOString()
      : ws.settings.lastSyncedAt,
  };
  return saveWorkspace(ws);
}

export function syncWorkspaceToCode(
  sourceWorkspaceId: string,
  targetSyncCode: string,
  direction: 'push' | 'pull'
): WorkspaceData {
  const targetId = sanitizeWorkspaceId(targetSyncCode.toLowerCase());
  if (direction === 'pull') {
    const pulled = getWorkspace(targetId);
    pulled.settings.cloudSyncEnabled = true;
    pulled.settings.syncCode = targetId.toUpperCase();
    pulled.settings.lastSyncedAt = new Date().toISOString();
    return saveWorkspace(pulled);
  }
  const source = getWorkspace(sourceWorkspaceId);
  const synced: WorkspaceData = {
    ...source,
    id: targetId,
    settings: {
      ...source.settings,
      cloudSyncEnabled: true,
      syncCode: targetId.toUpperCase(),
      lastSyncedAt: new Date().toISOString(),
    },
  };
  return saveWorkspace(synced);
}
