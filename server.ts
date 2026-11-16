import express, { type Request, type Response } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import type { DateRangeKey, OrderStatus, InvoiceStatus } from './shared/types.js';
import { computeAnalytics } from './server/analytics.js';
import {
  createExpense,
  createInvoice,
  createOrder,
  deleteExpense,
  deleteProduct,
  getWorkspace,
  resetWorkspace,
  restockProductByIdentifier,
  syncWorkspaceToCode,
  updateInvoiceStatus,
  updateOrderStatus,
  updateSettings,
  upsertProduct,
} from './server/store.js';
import { generateDailyBusinessBrief, runAiPilotChat } from './server/gemini.js';

dotenv.config();

const app = express();
app.use(express.json({ limit: '2mb' }));

function getWorkspaceId(req: Request): string {
  const headerId = req.headers['x-workspace-id'];
  if (typeof headerId === 'string' && headerId.trim()) {
    return headerId.trim();
  }
  if (typeof req.query.workspaceId === 'string' && req.query.workspaceId.trim()) {
    return req.query.workspaceId.trim();
  }
  return 'public-demo';
}

function getRange(req: Request): DateRangeKey {
  const raw = (req.query.range || req.body?.range || '30d') as string;
  if (raw === 'today' || raw === '7d' || raw === '30d' || raw === 'year') {
    return raw;
  }
  return '30d';
}

function respondWithState(
  res: Response,
  workspaceId: string,
  range: DateRangeKey,
  extra?: Record<string, unknown>
) {
  const workspace = getWorkspace(workspaceId);
  const analytics = computeAnalytics(workspace, range);
  res.json({ workspace, analytics, ...extra });
}

// Workspace & Settings
app.get('/api/workspace', (req, res) => {
  try {
    respondWithState(res, getWorkspaceId(req), getRange(req));
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load workspace' });
  }
});

app.post('/api/workspace/reset', (req, res) => {
  try {
    const id = getWorkspaceId(req);
    const workspace = resetWorkspace(id);
    const analytics = computeAnalytics(workspace, getRange(req));
    res.json({ workspace, analytics });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to reset workspace' });
  }
});

app.post('/api/workspace/settings', (req, res) => {
  try {
    const id = getWorkspaceId(req);
    const workspace = updateSettings(id, req.body || {});
    const analytics = computeAnalytics(workspace, getRange(req));
    res.json({ workspace, analytics });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update settings' });
  }
});

app.post('/api/workspace/sync', (req, res) => {
  try {
    const id = getWorkspaceId(req);
    const { targetSyncCode, direction } = req.body || {};
    if (!targetSyncCode || typeof targetSyncCode !== 'string') {
      res.status(400).json({ error: 'Sync code is required.' });
      return;
    }
    const workspace = syncWorkspaceToCode(
      id,
      targetSyncCode,
      direction === 'pull' ? 'pull' : 'push'
    );
    const analytics = computeAnalytics(workspace, getRange(req));
    res.json({ workspace, analytics });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Cloud sync failed' });
  }
});

// Products CRUD
app.post('/api/products', (req, res) => {
  try {
    const id = getWorkspaceId(req);
    const { workspace, product } = upsertProduct(id, req.body);
    const analytics = computeAnalytics(workspace, getRange(req));
    res.status(201).json({ workspace, analytics, product });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to create product' });
  }
});

app.put('/api/products/:id', (req, res) => {
  try {
    const id = getWorkspaceId(req);
    const { workspace, product } = upsertProduct(id, {
      ...req.body,
      id: req.params.id,
    });
    const analytics = computeAnalytics(workspace, getRange(req));
    res.json({ workspace, analytics, product });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update product' });
  }
});

app.post('/api/products/:id/restock', (req, res) => {
  try {
    const id = getWorkspaceId(req);
    const addQty = Number(req.body?.addQuantity ?? 10);
    const { workspace, product } = restockProductByIdentifier(
      id,
      req.params.id,
      addQty
    );
    const analytics = computeAnalytics(workspace, getRange(req));
    res.json({ workspace, analytics, product });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to restock product' });
  }
});

app.delete('/api/products/:id', (req, res) => {
  try {
    const id = getWorkspaceId(req);
    const workspace = deleteProduct(id, req.params.id);
    const analytics = computeAnalytics(workspace, getRange(req));
    res.json({ workspace, analytics });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to delete product' });
  }
});

// Orders
app.post('/api/orders', (req, res) => {
  try {
    const id = getWorkspaceId(req);
    const { workspace, order, invoice } = createOrder(id, req.body);
    const analytics = computeAnalytics(workspace, getRange(req));
    res.status(201).json({ workspace, analytics, order, invoice });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to create order' });
  }
});

app.patch('/api/orders/:id/status', (req, res) => {
  try {
    const id = getWorkspaceId(req);
    const status = req.body?.status as OrderStatus;
    if (!['pending', 'completed', 'cancelled'].includes(status)) {
      res.status(400).json({ error: 'Invalid order status' });
      return;
    }
    const workspace = updateOrderStatus(id, req.params.id, status);
    const analytics = computeAnalytics(workspace, getRange(req));
    res.json({ workspace, analytics });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update order status' });
  }
});

// Expenses
app.post('/api/expenses', (req, res) => {
  try {
    const id = getWorkspaceId(req);
    const { workspace, expense } = createExpense(id, req.body);
    const analytics = computeAnalytics(workspace, getRange(req));
    res.status(201).json({ workspace, analytics, expense });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to record expense' });
  }
});

app.delete('/api/expenses/:id', (req, res) => {
  try {
    const id = getWorkspaceId(req);
    const workspace = deleteExpense(id, req.params.id);
    const analytics = computeAnalytics(workspace, getRange(req));
    res.json({ workspace, analytics });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to delete expense' });
  }
});

// Invoices
app.post('/api/invoices', (req, res) => {
  try {
    const id = getWorkspaceId(req);
    const { workspace, invoice } = createInvoice(id, req.body);
    const analytics = computeAnalytics(workspace, getRange(req));
    res.status(201).json({ workspace, analytics, invoice });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to create invoice' });
  }
});

app.patch('/api/invoices/:id/status', (req, res) => {
  try {
    const id = getWorkspaceId(req);
    const status = req.body?.status as InvoiceStatus;
    if (!['draft', 'sent', 'paid'].includes(status)) {
      res.status(400).json({ error: 'Invalid invoice status' });
      return;
    }
    const workspace = updateInvoiceStatus(id, req.params.id, status);
    const analytics = computeAnalytics(workspace, getRange(req));
    res.json({ workspace, analytics });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update invoice status' });
  }
});

// Gemini AI Endpoints
const activeBriefRequests = new Set<string>();

app.post('/api/ai/daily-brief', async (req, res) => {
  const id = getWorkspaceId(req);
  if (activeBriefRequests.has(id)) {
    res.status(429).json({ error: 'Daily AI brief is already generating.' });
    return;
  }
  activeBriefRequests.add(id);

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Gemini Daily Brief request timed out after 60s.')),
        60000
      )
    );
    const brief = await Promise.race([
      generateDailyBusinessBrief(id),
      timeoutPromise,
    ]);
    res.json({ brief });
  } catch (err: any) {
    const status = err?.status || 500;
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: err?.message || 'Failed to generate Daily AI Brief.',
    });
  } finally {
    activeBriefRequests.delete(id);
  }
});

app.post('/api/ai/pilot', async (req, res) => {
  try {
    const id = getWorkspaceId(req);
    const { message, history, range } = req.body || {};
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message text is required.' });
      return;
    }
    const result = await runAiPilotChat(
      id,
      message.trim(),
      Array.isArray(history) ? history : []
    );
    const analytics = computeAnalytics(
      result.workspace,
      range === 'today' || range === '7d' || range === '30d' || range === 'year'
        ? range
        : '30d'
    );
    res.json({
      reply: result.reply,
      actionsTaken: result.actionsTaken,
      workspace: result.workspace,
      analytics,
    });
  } catch (err: any) {
    const status = err?.status || 500;
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: err?.message || 'AI Pilot request failed.',
    });
  }
});

async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BizPilot AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
