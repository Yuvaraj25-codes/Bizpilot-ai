import type {
  AnalyticsSummary,
  ChatMessage,
  DailyAiBrief,
  DateRangeKey,
  ExpenseCategory,
  InvoiceStatus,
  OrderStatus,
  Product,
  WorkspaceData,
  WorkspaceSettings,
  AiActionReceipt,
} from '../../shared/types.ts';

const WORKSPACE_STORAGE_KEY = 'bizpilot_workspace_id';

export function getActiveWorkspaceId(): string {
  return localStorage.getItem(WORKSPACE_STORAGE_KEY) || 'public-demo';
}

export function setActiveWorkspaceId(id: string) {
  localStorage.setItem(WORKSPACE_STORAGE_KEY, id);
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const workspaceId = getActiveWorkspaceId();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-workspace-id': workspaceId,
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export interface WorkspaceResponse {
  workspace: WorkspaceData;
  analytics: AnalyticsSummary;
}

export const api = {
  fetchWorkspace(range: DateRangeKey) {
    return request<WorkspaceResponse>(`/api/workspace?range=${range}`);
  },
  resetWorkspace(range: DateRangeKey) {
    return request<WorkspaceResponse>(`/api/workspace/reset?range=${range}`, {
      method: 'POST',
    });
  },
  updateSettings(patch: Partial<WorkspaceSettings>, range: DateRangeKey) {
    return request<WorkspaceResponse>(`/api/workspace/settings?range=${range}`, {
      method: 'POST',
      body: JSON.stringify(patch),
    });
  },
  syncWorkspace(
    targetSyncCode: string,
    direction: 'push' | 'pull',
    range: DateRangeKey
  ) {
    return request<WorkspaceResponse>(`/api/workspace/sync?range=${range}`, {
      method: 'POST',
      body: JSON.stringify({ targetSyncCode, direction }),
    });
  },
  createProduct(
    product: Omit<Product, 'id' | 'updatedAt'>,
    range: DateRangeKey
  ) {
    return request<WorkspaceResponse>(`/api/products?range=${range}`, {
      method: 'POST',
      body: JSON.stringify(product),
    });
  },
  updateProduct(
    id: string,
    product: Omit<Product, 'id' | 'updatedAt'>,
    range: DateRangeKey
  ) {
    return request<WorkspaceResponse>(`/api/products/${id}?range=${range}`, {
      method: 'PUT',
      body: JSON.stringify(product),
    });
  },
  restockProduct(id: string, addQuantity: number, range: DateRangeKey) {
    return request<WorkspaceResponse>(
      `/api/products/${id}/restock?range=${range}`,
      {
        method: 'POST',
        body: JSON.stringify({ addQuantity }),
      }
    );
  },
  deleteProduct(id: string, range: DateRangeKey) {
    return request<WorkspaceResponse>(`/api/products/${id}?range=${range}`, {
      method: 'DELETE',
    });
  },
  createOrder(
    payload: {
      customerName: string;
      customerPhone: string;
      status: OrderStatus;
      items: { productId: string; quantity: number }[];
      autoCreateInvoice: boolean;
    },
    range: DateRangeKey
  ) {
    return request<WorkspaceResponse>(`/api/orders?range=${range}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateOrderStatus(id: string, status: OrderStatus, range: DateRangeKey) {
    return request<WorkspaceResponse>(`/api/orders/${id}/status?range=${range}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
  createExpense(
    payload: {
      title: string;
      category: ExpenseCategory;
      amount: number;
      date: string;
      notes?: string;
    },
    range: DateRangeKey
  ) {
    return request<WorkspaceResponse>(`/api/expenses?range=${range}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  deleteExpense(id: string, range: DateRangeKey) {
    return request<WorkspaceResponse>(`/api/expenses/${id}?range=${range}`, {
      method: 'DELETE',
    });
  },
  createInvoice(
    payload: {
      orderId?: string;
      customerName: string;
      customerPhone: string;
      customerEmail: string;
      taxRate: number;
      dueDate: string;
      status: InvoiceStatus;
      items: { description: string; quantity: number; unitPrice: number }[];
    },
    range: DateRangeKey
  ) {
    return request<WorkspaceResponse>(`/api/invoices?range=${range}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateInvoiceStatus(id: string, status: InvoiceStatus, range: DateRangeKey) {
    return request<WorkspaceResponse>(
      `/api/invoices/${id}/status?range=${range}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }
    );
  },
  generateDailyBrief(workspaceSnapshot?: WorkspaceData) {
    return request<{ brief: DailyAiBrief }>('/api/ai/daily-brief', {
      method: 'POST',
      body: JSON.stringify(workspaceSnapshot ? { workspaceSnapshot } : {}),
    });
  },
  sendPilotMessage(
    message: string,
    history: ChatMessage[],
    range: DateRangeKey,
    workspaceSnapshot?: WorkspaceData
  ) {
    return request<{
      reply: string;
      actionsTaken: AiActionReceipt[];
      executedActions?: {
        tool: 'recordExpense' | 'createOrder' | 'createInvoice' | 'restockProduct';
        args: Record<string, any>;
      }[];
      workspace: WorkspaceData;
      analytics: AnalyticsSummary;
    }>('/api/ai/pilot', {
      method: 'POST',
      body: JSON.stringify({
        message,
        history,
        range,
        ...(workspaceSnapshot ? { workspaceSnapshot } : {}),
      }),
    });
  },
};
