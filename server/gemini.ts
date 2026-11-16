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
  ExpenseCategory,
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
  workspaceId: string
): Promise<DailyAiBrief> {
  const workspace = getWorkspace(workspaceId);
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

export async function runAiPilotChat(
  workspaceId: string,
  userMessage: string,
  history: ChatMessage[]
): Promise<{
  reply: string;
  actionsTaken: AiActionReceipt[];
  workspace: WorkspaceData;
}> {
  const ai = getClient();
  let currentWorkspace = getWorkspace(workspaceId);
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
  const functionCalls = firstResponse.functionCalls;

  if (functionCalls && functionCalls.length > 0) {
    const previousContent = firstResponse.candidates?.[0]?.content;
    const functionResponseParts = [];

    for (const fc of functionCalls) {
      const args = (fc.args ?? {}) as Record<string, any>;
      let toolResult: Record<string, unknown>;

      try {
        if (fc.name === 'recordExpense') {
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
        workspace: currentWorkspace,
      };
    }
  }

  return {
    reply:
      firstResponse.text?.trim() ||
      'I analyzed your workspace data. Let me know what you would like to inspect or record.',
    actionsTaken,
    workspace: currentWorkspace,
  };
}
