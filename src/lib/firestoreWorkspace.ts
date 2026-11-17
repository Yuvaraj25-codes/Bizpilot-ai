import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
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
} from '../../shared/types.ts';
import { db, handleFirestoreError, OperationType } from './firebase.ts';

function sanitizeId(raw: string, fallbackPrefix = 'item'): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned || `${fallbackPrefix}-${Date.now()}`;
}

function sanitizeSku(raw: string): string {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '-')
    .slice(0, 48);
  return cleaned || `SKU-${Date.now()}`;
}

function tsToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export async function ensureUserWorkspaceInFirestore(
  uid: string,
  email: string,
  displayName: string,
  seedWorkspace: WorkspaceData
): Promise<void> {
  const userDocPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return;
    }

    const batch = writeBatch(db);
    batch.set(userRef, {
      ownerId: uid,
      businessName: (seedWorkspace.settings.businessName || 'BizPilot Hardware & Ops').slice(0, 120),
      currency: seedWorkspace.settings.currency || 'USD',
      publicMode: Boolean(seedWorkspace.settings.publicMode),
      telemetryAlerts: Boolean(seedWorkspace.settings.telemetryAlerts),
      lowStockDefault: Math.max(0, Math.floor(seedWorkspace.settings.lowStockDefault || 10)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const profileRef = doc(db, 'users', uid, 'private', 'profile');
    batch.set(profileRef, {
      ownerId: uid,
      email: (email || 'user@bizpilot.ai').slice(0, 254),
      displayName: (displayName || 'Workspace Owner').slice(0, 120),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    for (const p of seedWorkspace.products) {
      const pRef = doc(db, 'users', uid, 'products', sanitizeId(p.id, 'prod'));
      batch.set(pRef, {
        ownerId: uid,
        sku: sanitizeSku(p.sku),
        name: p.name.slice(0, 140),
        category: p.category.slice(0, 64),
        costPrice: Math.max(0, Number(p.costPrice)),
        retailPrice: Math.max(0, Number(p.retailPrice)),
        stockQty: Math.max(0, Math.floor(p.stockQty)),
        lowStockThreshold: Math.max(0, Math.floor(p.lowStockThreshold)),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const o of seedWorkspace.orders) {
      const oRef = doc(db, 'users', uid, 'orders', sanitizeId(o.id, 'ord'));
      batch.set(oRef, {
        ownerId: uid,
        orderNumber: sanitizeId(o.orderNumber, 'ORD').slice(0, 32),
        customerName: o.customerName.slice(0, 120),
        customerPhone: (o.customerPhone || '').slice(0, 40),
        status: o.status,
        items: o.items.slice(0, 25),
        totalAmount: Math.max(0, Number(o.totalAmount)),
        totalCost: Math.max(0, Number(o.totalCost)),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const e of seedWorkspace.expenses) {
      const eRef = doc(db, 'users', uid, 'expenses', sanitizeId(e.id, 'exp'));
      batch.set(eRef, {
        ownerId: uid,
        title: e.title.slice(0, 140),
        category: e.category,
        amount: Math.max(0.01, Number(e.amount)),
        date: e.date.slice(0, 40),
        notes: (e.notes || '').slice(0, 300),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const inv of seedWorkspace.invoices) {
      const iRef = doc(db, 'users', uid, 'invoices', sanitizeId(inv.id, 'inv'));
      batch.set(iRef, {
        ownerId: uid,
        invoiceNumber: sanitizeId(inv.invoiceNumber, 'INV').slice(0, 32),
        orderId: (inv.orderId || '').slice(0, 128),
        customerName: inv.customerName.slice(0, 120),
        customerPhone: (inv.customerPhone || '').slice(0, 40),
        customerEmail: (inv.customerEmail || '').slice(0, 254),
        items: inv.items.slice(0, 25),
        subtotal: Math.max(0, Number(inv.subtotal)),
        taxRate: Math.max(0, Number(inv.taxRate)),
        taxAmount: Math.max(0, Number(inv.taxAmount)),
        totalAmount: Math.max(0, Number(inv.totalAmount)),
        status: inv.status,
        issuedAt: inv.issuedAt.slice(0, 40),
        dueDate: inv.dueDate.slice(0, 40),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userDocPath);
  }
}

export function subscribeUserWorkspace(
  uid: string,
  onWorkspace: (ws: WorkspaceData) => void,
  onError: (err: Error) => void
): () => void {
  let settings: WorkspaceSettings = {
    businessName: 'BizPilot Hardware & Ops',
    currency: 'USD',
    publicMode: false,
    telemetryAlerts: true,
    lowStockDefault: 10,
    cloudSyncEnabled: true,
    syncCode: uid.slice(0, 10).toUpperCase(),
    lastSyncedAt: new Date().toISOString(),
  };
  let products: Product[] = [];
  let orders: Order[] = [];
  let expenses: Expense[] = [];
  let invoices: Invoice[] = [];
  let hasWorkspaceDoc = false;

  const emit = () => {
    if (!hasWorkspaceDoc) return;
    onWorkspace({
      id: uid,
      products,
      orders,
      expenses,
      invoices,
      settings: {
        ...settings,
        cloudSyncEnabled: true,
        lastSyncedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const unsubUser = onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      hasWorkspaceDoc = true;
      settings = {
        businessName: String(d.businessName || 'BizPilot Hardware & Ops'),
        currency: d.currency || 'USD',
        publicMode: Boolean(d.publicMode),
        telemetryAlerts: Boolean(d.telemetryAlerts),
        lowStockDefault: Number(d.lowStockDefault ?? 10),
        cloudSyncEnabled: true,
        syncCode: uid.slice(0, 10).toUpperCase(),
        lastSyncedAt: tsToIso(d.updatedAt),
      };
      emit();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `users/${uid}`);
      } catch (e: any) {
        onError(e);
      }
    }
  );

  const unsubProducts = onSnapshot(
    query(collection(db, 'users', uid, 'products'), where('ownerId', '==', uid)),
    (snap) => {
      products = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          sku: String(d.sku),
          name: String(d.name),
          category: String(d.category),
          costPrice: Number(d.costPrice),
          retailPrice: Number(d.retailPrice),
          stockQty: Number(d.stockQty),
          lowStockThreshold: Number(d.lowStockThreshold),
          updatedAt: tsToIso(d.updatedAt),
        };
      });
      emit();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `users/${uid}/products`);
      } catch (e: any) {
        onError(e);
      }
    }
  );

  const unsubOrders = onSnapshot(
    query(collection(db, 'users', uid, 'orders'), where('ownerId', '==', uid)),
    (snap) => {
      orders = snap.docs
        .map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            orderNumber: String(d.orderNumber),
            customerName: String(d.customerName),
            customerPhone: String(d.customerPhone || ''),
            status: d.status as OrderStatus,
            items: (d.items || []) as OrderItem[],
            totalAmount: Number(d.totalAmount),
            totalCost: Number(d.totalCost),
            createdAt: tsToIso(d.createdAt),
          };
        })
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      emit();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `users/${uid}/orders`);
      } catch (e: any) {
        onError(e);
      }
    }
  );

  const unsubExpenses = onSnapshot(
    query(collection(db, 'users', uid, 'expenses'), where('ownerId', '==', uid)),
    (snap) => {
      expenses = snap.docs
        .map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            title: String(d.title),
            category: d.category as ExpenseCategory,
            amount: Number(d.amount),
            date: String(d.date),
            notes: String(d.notes || ''),
          };
        })
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      emit();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `users/${uid}/expenses`);
      } catch (e: any) {
        onError(e);
      }
    }
  );

  const unsubInvoices = onSnapshot(
    query(collection(db, 'users', uid, 'invoices'), where('ownerId', '==', uid)),
    (snap) => {
      invoices = snap.docs
        .map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            invoiceNumber: String(d.invoiceNumber),
            orderId: d.orderId ? String(d.orderId) : undefined,
            customerName: String(d.customerName),
            customerPhone: String(d.customerPhone || ''),
            customerEmail: String(d.customerEmail || ''),
            items: (d.items || []) as Invoice['items'],
            subtotal: Number(d.subtotal),
            taxRate: Number(d.taxRate),
            taxAmount: Number(d.taxAmount),
            totalAmount: Number(d.totalAmount),
            status: d.status as InvoiceStatus,
            issuedAt: String(d.issuedAt),
            dueDate: String(d.dueDate),
          };
        })
        .sort(
          (a, b) =>
            new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()
        );
      emit();
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, `users/${uid}/invoices`);
      } catch (e: any) {
        onError(e);
      }
    }
  );

  return () => {
    unsubUser();
    unsubProducts();
    unsubOrders();
    unsubExpenses();
    unsubInvoices();
  };
}

export async function saveSettingsInFirestore(
  uid: string,
  patch: Partial<WorkspaceSettings>
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const allowedPatch: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (patch.businessName !== undefined) {
      allowedPatch.businessName = patch.businessName.trim().slice(0, 120) || 'BizPilot Hardware & Ops';
    }
    if (patch.currency !== undefined) {
      allowedPatch.currency = patch.currency;
    }
    if (patch.publicMode !== undefined) {
      allowedPatch.publicMode = Boolean(patch.publicMode);
    }
    if (patch.telemetryAlerts !== undefined) {
      allowedPatch.telemetryAlerts = Boolean(patch.telemetryAlerts);
    }
    if (patch.lowStockDefault !== undefined) {
      allowedPatch.lowStockDefault = Math.max(0, Math.floor(patch.lowStockDefault));
    }
    await updateDoc(doc(db, 'users', uid), allowedPatch);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function upsertProductInFirestore(
  uid: string,
  input: Omit<Product, 'id' | 'updatedAt'> & { id?: string }
): Promise<void> {
  const skuClean = sanitizeSku(input.sku);
  if (!input.name.trim()) throw new Error('Product name is required.');
  if (input.costPrice < 0 || input.retailPrice < 0 || input.stockQty < 0) {
    throw new Error('Prices and stock quantity must be non-negative.');
  }

  const productId = input.id ? sanitizeId(input.id, 'prod') : `prod-${Date.now()}`;
  const path = `users/${uid}/products/${productId}`;
  const ref = doc(db, 'users', uid, 'products', productId);

  try {
    if (input.id) {
      await updateDoc(ref, {
        sku: skuClean,
        name: input.name.trim().slice(0, 140),
        category: (input.category.trim() || 'General').slice(0, 64),
        costPrice: Number(input.costPrice),
        retailPrice: Number(input.retailPrice),
        stockQty: Math.floor(Number(input.stockQty)),
        lowStockThreshold: Math.max(0, Math.floor(Number(input.lowStockThreshold))),
        updatedAt: serverTimestamp(),
      });
    } else {
      const batch = writeBatch(db);
      batch.set(ref, {
        ownerId: uid,
        sku: skuClean,
        name: input.name.trim().slice(0, 140),
        category: (input.category.trim() || 'General').slice(0, 64),
        costPrice: Number(input.costPrice),
        retailPrice: Number(input.retailPrice),
        stockQty: Math.floor(Number(input.stockQty)),
        lowStockThreshold: Math.max(0, Math.floor(Number(input.lowStockThreshold))),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, input.id ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteProductInFirestore(
  uid: string,
  productId: string
): Promise<void> {
  const path = `users/${uid}/products/${productId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'products', productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function restockProductInFirestore(
  uid: string,
  product: Product,
  addQty: number
): Promise<void> {
  if (addQty <= 0) throw new Error('Restock quantity must be positive.');
  const path = `users/${uid}/products/${product.id}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'products', product.id), {
      stockQty: product.stockQty + Math.floor(addQty),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createOrderInFirestore(
  uid: string,
  workspace: WorkspaceData,
  input: {
    customerName: string;
    customerPhone: string;
    status: OrderStatus;
    items: { productId: string; quantity: number }[];
    autoCreateInvoice: boolean;
  }
): Promise<void> {
  if (!input.customerName.trim()) throw new Error('Customer name is required.');
  if (!input.items.length) throw new Error('Order requires at least one item.');
  if (input.items.length > 25) {
    throw new Error('Maximum 25 line items allowed per order.');
  }

  const productMap = new Map(workspace.products.map((p) => [p.id, p]));
  const resolvedItems: OrderItem[] = [];
  const stockAdjustments = new Map<string, number>();

  for (const line of input.items) {
    const qty = Math.floor(Number(line.quantity));
    if (qty <= 0) throw new Error('Item quantity must be at least 1.');
    const prod = productMap.get(line.productId);
    if (!prod) throw new Error('Selected product not found.');

    const nextDeduction = (stockAdjustments.get(prod.id) ?? 0) + qty;
    if (input.status === 'completed' && prod.stockQty < nextDeduction) {
      throw new Error(
        `Insufficient stock for ${prod.name} (${prod.stockQty} available, ${nextDeduction} requested).`
      );
    }
    stockAdjustments.set(prod.id, nextDeduction);

    resolvedItems.push({
      productId: prod.id,
      sku: prod.sku,
      productName: prod.name,
      quantity: qty,
      unitPrice: prod.retailPrice,
      unitCost: prod.costPrice,
    });
  }

  const orderSeq = 2085 + workspace.orders.length;
  const orderId = `ord-${Date.now()}`;
  const orderNumber = `ORD-${orderSeq}`;
  const totalAmount = resolvedItems.reduce(
    (s, i) => s + i.quantity * i.unitPrice,
    0
  );
  const totalCost = resolvedItems.reduce(
    (s, i) => s + i.quantity * i.unitCost,
    0
  );

  const path = `users/${uid}/orders/${orderId}`;
  try {
    const batch = writeBatch(db);
    if (input.status === 'completed') {
      for (const [prodId, deduct] of stockAdjustments.entries()) {
        const prod = productMap.get(prodId)!;
        batch.update(doc(db, 'users', uid, 'products', prodId), {
          stockQty: prod.stockQty - deduct,
          updatedAt: serverTimestamp(),
        });
      }
    }

    batch.set(doc(db, 'users', uid, 'orders', orderId), {
      ownerId: uid,
      orderNumber,
      customerName: input.customerName.trim().slice(0, 120),
      customerPhone: (input.customerPhone.trim() || '+1 (555) 000-0000').slice(0, 40),
      status: input.status,
      items: resolvedItems,
      totalAmount: Number(totalAmount.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (input.autoCreateInvoice) {
      const invId = `inv-${Date.now()}`;
      const taxRate = 8.5;
      const taxAmount = Number(((totalAmount * taxRate) / 100).toFixed(2));
      const dueDate = new Date(
        Date.now() + 14 * 24 * 60 * 60 * 1000
      ).toISOString();
      batch.set(doc(db, 'users', uid, 'invoices', invId), {
        ownerId: uid,
        invoiceNumber: `INV-${orderSeq}`,
        orderId,
        customerName: input.customerName.trim().slice(0, 120),
        customerPhone: (input.customerPhone.trim() || '+1 (555) 000-0000').slice(0, 40),
        customerEmail: '',
        items: resolvedItems.map((i) => ({
          description: `${i.productName} (${i.sku})`,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        subtotal: Number(totalAmount.toFixed(2)),
        taxRate,
        taxAmount,
        totalAmount: Number((totalAmount + taxAmount).toFixed(2)),
        status: input.status === 'completed' ? 'paid' : 'sent',
        issuedAt: new Date().toISOString().slice(0, 40),
        dueDate: dueDate.slice(0, 40),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateOrderStatusInFirestore(
  uid: string,
  workspace: WorkspaceData,
  orderId: string,
  nextStatus: OrderStatus
): Promise<void> {
  const order = workspace.orders.find((o) => o.id === orderId);
  if (!order) throw new Error('Order not found.');
  if (order.status === nextStatus) return;
  if (order.status === 'cancelled') {
    throw new Error('Cancelled orders are locked and cannot be reopened.');
  }

  const productMap = new Map(workspace.products.map((p) => [p.id, p]));
  const path = `users/${uid}/orders/${orderId}`;

  try {
    const batch = writeBatch(db);
    if (order.status !== 'completed' && nextStatus === 'completed') {
      for (const item of order.items) {
        const prod = productMap.get(item.productId);
        if (!prod) continue;
        if (prod.stockQty < item.quantity) {
          throw new Error(
            `Cannot complete order: insufficient stock for ${prod.name} (${prod.stockQty} left).`
          );
        }
        batch.update(doc(db, 'users', uid, 'products', prod.id), {
          stockQty: prod.stockQty - item.quantity,
          updatedAt: serverTimestamp(),
        });
      }
    } else if (order.status === 'completed' && nextStatus !== 'completed') {
      for (const item of order.items) {
        const prod = productMap.get(item.productId);
        if (prod) {
          batch.update(doc(db, 'users', uid, 'products', prod.id), {
            stockQty: prod.stockQty + item.quantity,
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    batch.update(doc(db, 'users', uid, 'orders', orderId), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createExpenseInFirestore(
  uid: string,
  input: {
    title: string;
    category: ExpenseCategory;
    amount: number;
    date: string;
    notes?: string;
  }
): Promise<void> {
  if (!input.title.trim()) throw new Error('Expense title is required.');
  if (Number(input.amount) <= 0) throw new Error('Amount must be positive.');

  const expId = `exp-${Date.now()}`;
  const path = `users/${uid}/expenses/${expId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid, 'expenses', expId), {
      ownerId: uid,
      title: input.title.trim().slice(0, 140),
      category: input.category,
      amount: Number(Number(input.amount).toFixed(2)),
      date: (input.date || new Date().toISOString()).slice(0, 40),
      notes: (input.notes || '').trim().slice(0, 300),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteExpenseInFirestore(
  uid: string,
  expenseId: string
): Promise<void> {
  const path = `users/${uid}/expenses/${expenseId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'expenses', expenseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createInvoiceInFirestore(
  uid: string,
  workspace: WorkspaceData,
  input: {
    orderId?: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    taxRate: number;
    dueDate: string;
    status: InvoiceStatus;
    items: { description: string; quantity: number; unitPrice: number }[];
  }
): Promise<void> {
  if (!input.customerName.trim()) throw new Error('Customer name is required.');
  if (!input.items.length || input.items.length > 25) {
    throw new Error('Invoice must contain 1 to 25 line items.');
  }

  const subtotal = input.items.reduce(
    (s, i) => s + Number(i.quantity) * Number(i.unitPrice),
    0
  );
  const taxRate = Math.max(0, Number(input.taxRate ?? 8.5));
  const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
  const totalAmount = Number((subtotal + taxAmount).toFixed(2));
  const invId = `inv-${Date.now()}`;
  const path = `users/${uid}/invoices/${invId}`;

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid, 'invoices', invId), {
      ownerId: uid,
      invoiceNumber: `INV-${2090 + workspace.invoices.length}`,
      orderId: (input.orderId || '').slice(0, 128),
      customerName: input.customerName.trim().slice(0, 120),
      customerPhone: (input.customerPhone.trim() || '+1 (555) 000-0000').slice(0, 40),
      customerEmail: (input.customerEmail || '').trim().slice(0, 254),
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
      issuedAt: new Date().toISOString().slice(0, 40),
      dueDate: (input.dueDate || new Date().toISOString()).slice(0, 40),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateInvoiceStatusInFirestore(
  uid: string,
  invoiceId: string,
  status: InvoiceStatus
): Promise<void> {
  const path = `users/${uid}/invoices/${invoiceId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'invoices', invoiceId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function resetFirestoreWorkspace(
  uid: string,
  email: string,
  displayName: string,
  seedWorkspace: WorkspaceData
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const subcollections = ['products', 'orders', 'expenses', 'invoices'] as const;
    const batch = writeBatch(db);

    for (const sub of subcollections) {
      const snap = await getDocs(
        query(collection(db, 'users', uid, sub), where('ownerId', '==', uid))
      );
      for (const d of snap.docs) {
        batch.delete(d.ref);
      }
    }
    batch.delete(doc(db, 'users', uid, 'private', 'profile'));
    batch.delete(doc(db, 'users', uid));
    await batch.commit();

    await ensureUserWorkspaceInFirestore(uid, email, displayName, seedWorkspace);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
