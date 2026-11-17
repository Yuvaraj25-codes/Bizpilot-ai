import {
  FunctionDeclaration,
  GoogleGenAI,
  Type,
  type Content,
} from '@google/genai';
import type {
  AiActionReceipt,
  ChatMessage,
  DailyAiBrief,
  Expense,
  ExpenseCategory,
  Invoice,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  WorkspaceData,
} from '../shared/types.js';
import { computeAnalytics } from './analytics.js';
import {
  createExpense,
  createInvoice,
  createOrder,
  getWorkspace,
  restockProductByIdentifier,
} from './store.js';

export interface ExecutedToolAction {
  tool: 'recordExpense' | 'createOrder' | 'createInvoice' | 'restockProduct';
  args: Record<string, any>;
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured in the server environment. Please configure your API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildContextSnapshot(workspace: WorkspaceData): string {
  const analytics30 = computeAnalytics(workspace, '30d');
  const analyticsToday = computeAnalytics(workspace, 'today');

  return JSON.stringify({
    businessName: workspace.settings.businessName,
    currency: workspace.settings.currency,
    today: {
      revenue: analyticsToday.todayBenchmark.todayRevenue,
      cogs: analyticsToday.todayBenchmark.todayCogs,
      operatingExpenses: analyticsToday.todayBenchmark.todayExpenses,
      netProfit: analyticsToday.todayBenchmark.todayNetProfit,
      sevenDayDailyAvgRevenue: Number(
        analyticsToday.todayBenchmark.sevenDayAvgRevenue.toFixed(2)
      ),
      ordersToday: analyticsToday.orderCount,
    },
    last30Days: {
      revenue: analytics30.revenue,
      cogs: analytics30.cogs,
      grossProfit: analytics30.grossProfit,
      grossMarginPct: Number(analytics30.grossMarginPct.toFixed(1)),
      operatingExpenses: analytics30.operatingExpenses,
      netProfit: analytics30.netProfit,
      completedOrders: analytics30.completedOrderCount,
      avgOrderValue: Number(analytics30.avgOrderValue.toFixed(2)),
    },
    inventory: {
      totalSkus: analytics30.inventory.totalSkus,
      totalUnits: analytics30.inventory.totalUnits,
      retailValuation: analytics30.inventory.retailValuation,
      costValuation: analytics30.inventory.costValuation,
      lowStockSkus: analytics30.inventory.lowStockItems.map((p) => ({
        sku: p.sku,
        name: p.name,
        stockQty: p.stockQty,
        threshold: p.lowStockThreshold,
      })),
      outOfStockSkus: analytics30.inventory.outOfStockItems.map((p) => ({
        sku: p.sku,
        name: p.name,
      })),
    },
    catalog: workspace.products.map((p) => ({
      sku: p.sku,
      name: p.name,
      category: p.category,
      retailPrice: p.retailPrice,
      costPrice: p.costPrice,
      stockQty: p.stockQty,
    })),
    topSellingProducts30d: analytics30.topProducts,
    recentOrders: workspace.orders.slice(0, 6).map((o) => ({
      orderNumber: o.orderNumber,
      customer: o.customerName,
      status: o.status,
      totalAmount: o.totalAmount,
      createdAt: o.createdAt,
    })),
    expenseCategories30d: analytics30.expenseBreakdown,
  });
}

export async function generateDailyBusinessBrief(
  workspaceId: string,
  workspaceOverride?: WorkspaceData
): Promise<DailyAiBrief> {
  const workspace = workspaceOverride ?? getWorkspace(workspaceId);
  const ai = getClient();
  const snapshot = buildContextSnapshot(workspace);

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Analyze this live business snapshot and produce a crisp daily performance brief:\n\n${snapshot}`,
    config: {
      systemInstruction:
        'You are BizPilot AI, an executive operations & finance analyst. ' +
        'Be concrete, quantitative, and cite exact product names, SKUs, and figures from the snapshot. ' +
        'Keep each field concise (1-3 crisp sentences max).',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headline: {
            type: Type.STRING,
            description: 'Short 6-10 word headline capturing today performance.',
          },
          executiveSummary: {
            type: Type.STRING,
            description:
              'Concise summary of today revenue, COGS, operating expenses, net profit vs 7-day average.',
          },
          winsHighlight: {
            type: Type.STRING,
            description:
              'Top performing SKUs, strong margin drivers, or notable completed orders.',
          },
          riskAlert: {
            type: Type.STRING,
            description:
              'Specific low-stock or out-of-stock SKUs, margin pressure, or expense spikes.',
          },
          recommendedAction: {
            type: Type.STRING,
            description:
              'Single highest-leverage operational or restocking action to take today.',
          },
          healthStatus: {
            type: Type.STRING,
            description: 'One of: Strong, Steady, Attention Needed.',
          },
        },
        required: [
          'headline',
          'executiveSummary',
          'winsHighlight',
          'riskAlert',
          'recommendedAction',
          'healthStatus',
        ],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim()) as Omit<
    DailyAiBrief,
    'generatedAt'
  >;

  const validStatuses = ['Strong', 'Steady', 'Attention Needed'] as const;
  const normalizedStatus = validStatuses.includes(parsed.healthStatus as any)
    ? parsed.healthStatus
    : 'Steady';

  return {
    headline: parsed.headline || 'Daily Operations Brief Ready',
    executiveSummary:
      parsed.executiveSummary || 'Live metrics analyzed across orders and ledger.',
    winsHighlight: parsed.winsHighlight || 'Catalog sales remain active.',
    riskAlert: parsed.riskAlert || 'Review low-stock thresholds.',
    recommendedAction:
      parsed.recommendedAction || 'Restock critical SKUs before peak demand.',
    healthStatus: normalizedStatus,
    generatedAt: new Date().toISOString(),
  };
}

const pilotTools: FunctionDeclaration[] = [
  {
    name: 'recordExpense',
    description:
      'Record a new business operating expense in the finance ledger.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'Short description of the expense, e.g., "Meta Ad Spend".',
        },
        category: {
          type: Type.STRING,
          description:
            'Must be one of: Payroll, Marketing, Logistics, Software, Utilities, Inventory Restock, Other',
        },
        amount: {
          type: Type.NUMBER,
          description: 'Positive dollar amount of the expense.',
        },
        notes: {
          type: Type.STRING,
          description: 'Optional notes.',
        },
      },
      required: ['title', 'category', 'amount'],
    },
  },
  {
    name: 'createOrder',
    description:
      'Create a new customer order and deduct inventory stock if status is completed.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        customerName: {
          type: Type.STRING,
          description: 'Customer or company name.',
        },
        customerPhone: {
          type: Type.STRING,
          description: 'Customer phone number (default "+1 (555) 010-0000" if omitted).',
        },
        status: {
          type: Type.STRING,
          description: 'Either "completed" or "pending". Defaults to "completed".',
        },
        items: {
          type: Type.ARRAY,
          description: 'Line items to order.',
          items: {
            type: Type.OBJECT,
            properties: {
              skuOrName: {
                type: Type.STRING,
                description: 'Product SKU or product name from catalog.',
              },
              quantity: {
                type: Type.INTEGER,
                description: 'Quantity to order (>= 1).',
              },
            },
            required: ['skuOrName', 'quantity'],
          },
        },
      },
      required: ['customerName', 'items'],
    },
  },
  {
    name: 'createInvoice',
    description: 'Create and store a customer invoice with line items and tax.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        customerName: {
          type: Type.STRING,
          description: 'Customer or client company name.',
        },
        customerEmail: {
          type: Type.STRING,
          description: 'Customer email address if provided.',
        },
        taxRate: {
          type: Type.NUMBER,
          description: 'Tax rate percentage (e.g. 8.5). Defaults to 8.5.',
        },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              quantity: { type: Type.INTEGER },
              unitPrice: { type: Type.NUMBER },
            },
            required: ['description', 'quantity', 'unitPrice'],
          },
        },
      },
      required: ['customerName', 'items'],
    },
  },
  {
    name: 'restockProduct',
    description: 'Add stock units to an existing product by SKU or product name.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        skuOrName: {
          type: Type.STRING,
          description: 'SKU or partial product name.',
        },
        addQuantity: {
          type: Type.INTEGER,
          description: 'Positive number of units to add.',
        },
      },
      required: ['skuOrName', 'addQuantity'],
    },
  },
];

function cloneWorkspace(ws: WorkspaceData): WorkspaceData {
  return JSON.parse(JSON.stringify(ws)) as WorkspaceData;
}

function applyToolInMemory(
  ws: WorkspaceData,
  toolName: string,
  args: Record<string, any>
): {
  summary: string;
  toolResult: Record<string, unknown>;
  executedAction: ExecutedToolAction;
} {
  if (toolName === 'recordExpense') {
    const validCats: ExpenseCategory[] = [
      'Payroll',
      'Marketing',
      'Logistics',
      'Software',
      'Utilities',
      'Inventory Restock',
      'Other',
    ];
    const category = validCats.includes(args.category)
      ? (args.category as ExpenseCategory)
      : 'Other';
    const amount = Number(args.amount || 0);
    if (amount <= 0) throw new Error('Expense amount must be positive.');
    const expense: Expense = {
      id: `exp-${Date.now()}`,
      title: String(args.title || 'Operating Expense').trim(),
      category,
      amount: Number(amount.toFixed(2)),
      date: new Date().toISOString(),
      notes: args.notes ? String(args.notes).trim() : '',
    };
    ws.expenses.unshift(expense);
    return {
      summary: `Recorded ${expense.category} expense "${expense.title}" ($${expense.amount.toFixed(2)})`,
      toolResult: { success: true, expense },
      executedAction: {
        tool: 'recordExpense',
        args: {
          title: expense.title,
          category: expense.category,
          amount: expense.amount,
          date: expense.date,
          notes: expense.notes,
        },
      },
    };
  }

  if (toolName === 'createOrder') {
    const rawItems = Array.isArray(args.items) ? args.items : [];
    if (!rawItems.length) throw new Error('Order requires at least one item.');
    const status: OrderStatus = args.status === 'pending' ? 'pending' : 'completed';
    const resolvedItems: OrderItem[] = [];
    const resolvedForClient: { productId: string; quantity: number }[] = [];

    for (const line of rawItems) {
      const qty = Math.floor(Number(line.quantity));
      if (qty <= 0) throw new Error('Item quantity must be at least 1.');
      const q = String(line.skuOrName || '').trim().toLowerCase();
      const prod = ws.products.find(
        (p) => p.sku.toLowerCase() === q || p.name.toLowerCase().includes(q)
      );
      if (!prod) throw new Error(`Product "${line.skuOrName}" was not found.`);
      if (status === 'completed' && prod.stockQty < qty) {
        throw new Error(
          `Insufficient stock for ${prod.name} (${prod.stockQty} available, ${qty} requested).`
        );
      }
      if (status === 'completed') {
        prod.stockQty -= qty;
      }
      resolvedItems.push({
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        quantity: qty,
        unitPrice: prod.retailPrice,
        unitCost: prod.costPrice,
      });
      resolvedForClient.push({ productId: prod.id, quantity: qty });
    }

    const orderSeq = 2085 + ws.orders.length;
    const order: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: `ORD-${orderSeq}`,
      customerName: String(args.customerName || 'Walk-in Customer').trim(),
      customerPhone: String(args.customerPhone || '+1 (555) 010-0000').trim(),
      status,
      items: resolvedItems,
      totalAmount: resolvedItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
      totalCost: resolvedItems.reduce((s, i) => s + i.quantity * i.unitCost, 0),
      createdAt: new Date().toISOString(),
    };
    ws.orders.unshift(order);

    const taxRate = 8.5;
    const taxAmount = Number(((order.totalAmount * taxRate) / 100).toFixed(2));
    const invoice: Invoice = {
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
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    };
    ws.invoices.unshift(invoice);

    return {
      summary: `Created ${order.status} order ${order.orderNumber} for ${order.customerName} ($${order.totalAmount.toFixed(2)})`,
      toolResult: { success: true, order, invoice },
      executedAction: {
        tool: 'createOrder',
        args: {
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          status: order.status,
          items: resolvedForClient,
          autoCreateInvoice: true,
        },
      },
    };
  }

  if (toolName === 'createInvoice') {
    const rawItems = Array.isArray(args.items) ? args.items : [];
    if (!rawItems.length) throw new Error('Invoice requires at least one item.');
    const items = rawItems.map((i: any) => ({
      description: String(i.description || 'Item').trim(),
      quantity: Math.max(1, Math.floor(Number(i.quantity || 1))),
      unitPrice: Math.max(0, Number(i.unitPrice || 0)),
    }));
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const taxRate = args.taxRate !== undefined ? Math.max(0, Number(args.taxRate)) : 8.5;
    const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
    const totalAmount = Number((subtotal + taxAmount).toFixed(2));
    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-${2090 + ws.invoices.length}`,
      customerName: String(args.customerName || 'Client').trim(),
      customerPhone: '+1 (555) 000-0000',
      customerEmail: args.customerEmail ? String(args.customerEmail).trim() : '',
      items,
      subtotal: Number(subtotal.toFixed(2)),
      taxRate,
      taxAmount,
      totalAmount,
      status: 'sent',
      issuedAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    };
    ws.invoices.unshift(invoice);

    return {
      summary: `Issued invoice ${invoice.invoiceNumber} for ${invoice.customerName} ($${invoice.totalAmount.toFixed(2)})`,
      toolResult: { success: true, invoice },
      executedAction: {
        tool: 'createInvoice',
        args: {
          customerName: invoice.customerName,
          customerPhone: invoice.customerPhone,
          customerEmail: invoice.customerEmail,
          taxRate: invoice.taxRate,
          dueDate: invoice.dueDate,
          status: invoice.status,
          items,
        },
      },
    };
  }

  if (toolName === 'restockProduct') {
    const q = String(args.skuOrName || '').trim().toLowerCase();
    const addQuantity = Math.floor(Number(args.addQuantity || 0));
    if (addQuantity <= 0) throw new Error('Restock quantity must be positive.');
    const prod = ws.products.find(
      (p) =>
        p.sku.toLowerCase() === q ||
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase() === q
    );
    if (!prod) throw new Error(`Product "${args.skuOrName}" not found.`);
    prod.stockQty += addQuantity;
    prod.updatedAt = new Date().toISOString();

    return {
      summary: `Restocked ${prod.name} (+${addQuantity} -> ${prod.stockQty} units)`,
      toolResult: { success: true, product: prod },
      executedAction: {
        tool: 'restockProduct',
        args: {
          productId: prod.id,
          addQuantity,
        },
      },
    };
  }

  throw new Error(`Unknown tool: ${toolName}`);
}

export async function runAiPilotChat(
  workspaceId: string,
  userMessage: string,
  history: ChatMessage[],
  workspaceOverride?: WorkspaceData
): Promise<{
  reply: string;
  actionsTaken: AiActionReceipt[];
  executedActions: ExecutedToolAction[];
  workspace: WorkspaceData;
}> {
  const ai = getClient();
  const useSnapshot = Boolean(workspaceOverride);
  let currentWorkspace: WorkspaceData = workspaceOverride
    ? cloneWorkspace(workspaceOverride)
    : getWorkspace(workspaceId);
  const snapshot = buildContextSnapshot(currentWorkspace);

  const systemInstruction =
    'You are BizPilot AI Pilot, an intelligent business operations assistant with live access to inventory, orders, expenses, and invoices. ' +
    'Answer financial, margin, and stock questions accurately using ONLY the live workspace data provided. ' +
    'When the user asks you to record an expense, create an order, issue an invoice, or restock a product, call the appropriate tool immediately. ' +
    'Be concise, crisp, and actionable.\n\n' +
    `LIVE WORKSPACE SNAPSHOT:\n${snapshot}`;

  const recentHistory: Content[] = history.slice(-8).map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  const contents: Content[] = [
    ...recentHistory,
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const firstResponse = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents,
    config: {
      systemInstruction,
      tools: [{ functionDeclarations: pilotTools }],
    },
  });

  const actionsTaken: AiActionReceipt[] = [];
  const executedActions: ExecutedToolAction[] = [];
  const functionCalls = firstResponse.functionCalls;

  if (functionCalls && functionCalls.length > 0) {
    const previousContent = firstResponse.candidates?.[0]?.content;
    const functionResponseParts = [];

    for (const fc of functionCalls) {
      const args = (fc.args ?? {}) as Record<string, any>;
      let toolResult: Record<string, unknown>;

      try {
        if (useSnapshot) {
          const applied = applyToolInMemory(
            currentWorkspace,
            fc.name || '',
            args
          );
          actionsTaken.push({
            tool: applied.executedAction.tool,
            summary: applied.summary,
          });
          executedActions.push(applied.executedAction);
          toolResult = applied.toolResult;
        } else if (fc.name === 'recordExpense') {
          const validCats: ExpenseCategory[] = [
            'Payroll',
            'Marketing',
            'Logistics',
            'Software',
            'Utilities',
            'Inventory Restock',
            'Other',
          ];
          const category = validCats.includes(args.category)
            ? (args.category as ExpenseCategory)
            : 'Other';
          const res = createExpense(workspaceId, {
            title: String(args.title || 'Operating Expense'),
            category,
            amount: Number(args.amount || 0),
            notes: args.notes ? String(args.notes) : undefined,
          });
          currentWorkspace = res.workspace;
          const summary = `Recorded ${res.expense.category} expense "${res.expense.title}" ($${res.expense.amount.toFixed(2)})`;
          actionsTaken.push({ tool: 'recordExpense', summary });
          toolResult = { success: true, expense: res.expense };
        } else if (fc.name === 'createOrder') {
          const res = createOrder(workspaceId, {
            customerName: String(args.customerName || 'Walk-in Customer'),
            customerPhone: String(args.customerPhone || '+1 (555) 010-0000'),
            status: args.status === 'pending' ? 'pending' : 'completed',
            items: Array.isArray(args.items) ? args.items : [],
            autoCreateInvoice: true,
          });
          currentWorkspace = res.workspace;
          const summary = `Created ${res.order.status} order ${res.order.orderNumber} for ${res.order.customerName} ($${res.order.totalAmount.toFixed(2)})`;
          actionsTaken.push({ tool: 'createOrder', summary });
          toolResult = {
            success: true,
            order: res.order,
            invoice: res.invoice,
          };
        } else if (fc.name === 'createInvoice') {
          const res = createInvoice(workspaceId, {
            customerName: String(args.customerName || 'Client'),
            customerEmail: args.customerEmail ? String(args.customerEmail) : '',
            taxRate: args.taxRate !== undefined ? Number(args.taxRate) : 8.5,
            items: Array.isArray(args.items) ? args.items : [],
          });
          currentWorkspace = res.workspace;
          const summary = `Issued invoice ${res.invoice.invoiceNumber} for ${res.invoice.customerName} ($${res.invoice.totalAmount.toFixed(2)})`;
          actionsTaken.push({ tool: 'createInvoice', summary });
          toolResult = { success: true, invoice: res.invoice };
        } else if (fc.name === 'restockProduct') {
          const res = restockProductByIdentifier(
            workspaceId,
            String(args.skuOrName || ''),
            Number(args.addQuantity || 0)
          );
          currentWorkspace = res.workspace;
          const summary = `Restocked ${res.product.name} (+${args.addQuantity} -> ${res.product.stockQty} units)`;
          actionsTaken.push({ tool: 'restockProduct', summary });
          toolResult = { success: true, product: res.product };
        } else {
          toolResult = { success: false, error: `Unknown tool: ${fc.name}` };
        }
      } catch (err: any) {
        toolResult = {
          success: false,
          error: err?.message || 'Tool execution failed',
        };
      }

      functionResponseParts.push({
        functionResponse: {
          id: fc.id,
          name: fc.name,
          response: toolResult,
        },
      });
    }

    if (previousContent) {
      const followUp = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          ...contents,
          previousContent,
          {
            role: 'user',
            parts: functionResponseParts,
          },
        ],
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: pilotTools }],
        },
      });

      return {
        reply:
          followUp.text?.trim() ||
          actionsTaken.map((a) => a.summary).join(' • ') ||
          'Action completed.',
        actionsTaken,
        executedActions,
        workspace: currentWorkspace,
      };
    }
  }

  return {
    reply:
      firstResponse.text?.trim() ||
      'I analyzed your workspace data. Let me know what you would like to inspect or record.',
    actionsTaken,
    executedActions,
    workspace: currentWorkspace,
  };
}
