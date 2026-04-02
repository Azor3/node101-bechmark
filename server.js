import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { CHAINS } from './lib/chains.js';
import { BenchmarkEngine, WebSocketEngine } from './lib/engine.js';
import { TestQueue } from './lib/queue.js';
import { sendReportEmail, getMailConfig } from './lib/mailer.js';
import { buildBenchmarkReport, buildWebSocketReport } from './lib/report.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Load Chart.js bundle for offline reports ──────────────
let CHARTJS_BUNDLE = null;
try {
  CHARTJS_BUNDLE = fs.readFileSync(
    path.join(__dirname, 'node_modules/chart.js/dist/chart.umd.min.js'), 'utf8',
  );
  console.log('[report] Chart.js bundle loaded — reports will be offline-capable.');
} catch {
  console.log('[report] Chart.js bundle not found — reports will use CDN fallback.');
}

// ── Session store ─────────────────────────────────────────
// status: 'running' | 'completed' | 'stopped'
const sessions = new Map();

function createSession(engine) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  sessions.set(id, { engine, clients: new Set(), status: 'running', result: null, reportHtml: null });
  return id;
}

function broadcast(sessionId, event, data) {
  const session = sessions.get(sessionId);
  if (!session) return;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of session.clients) client.write(msg);
}

// ── Queue ─────────────────────────────────────────────────
const cooldownMs = parseInt(process.env.QUEUE_COOLDOWN_SECONDS || '300') * 1000;
const queue = new TestQueue({ cooldownMs });

// Queue status SSE clients
const queueClients = new Set();
function broadcastQueue() {
  const msg = `event: queue\ndata: ${JSON.stringify(queue.status())}\n\n`;
  for (const c of queueClients) c.write(msg);
}
queue.onUpdate(() => broadcastQueue());

// When queue is ready to start next test
queue.onNext((item) => {
  console.log(`[queue] Starting queued test: ${item.id} (${item.config.chainName || item.config.chainId})`);
  _startSession(item.config).catch(err =>
    console.error('[queue] Failed to start queued test:', err.message),
  );
});

// ── Session start (shared by direct API + queue) ──────────
async function _startSession(config) {
  const { type = 'benchmark' } = config;
  let engine;

  if (type === 'websocket') {
    engine = new WebSocketEngine(config);
  } else {
    // 'benchmark' or 'rest'
    let chain;
    if (type === 'rest') {
      chain = {
        id: 'custom-rest', name: 'Custom REST', color: '#00d4aa', type: 'rest',
        methods: (config.endpoints || []).map(e => ({
          name: e.name || `${e.method} ${e.path}`,
          category: e.category || 'medium',
          weight: e.weight || 1,
          build: () => ({ httpMethod: e.method || 'GET', path: e.path || '/', body: e.body || null, headers: e.headers || {}, queryParams: e.queryParams || {} }),
        })),
      };
    } else {
      chain = CHAINS[config.chainId];
      if (!chain) throw new Error(`Unknown chainId: ${config.chainId}`);
    }
    engine = new BenchmarkEngine({
      ...config,
      chain,
      chainId: chain.id,
    });
  }

  const sessionId = createSession(engine);
  queue.markRunning(sessionId);

  engine.subscribe((event, data) => {
    broadcast(sessionId, event, data);

    if (event === 'done') {
      const session = sessions.get(sessionId);
      if (session) {
        session.status = 'completed';
        session.result = data;
        const reportFn = data.type === 'websocket' ? buildWebSocketReport : buildBenchmarkReport;
        session.reportHtml = reportFn(data, CHARTJS_BUNDLE);
      }

      queue.markDone();

      // Send email (fire-and-forget)
      // Priority: UI-provided emailTo → env MAIL_TO
      const shouldMail = config.sendEmail !== false && (config.emailTo || getMailConfig().enabled);
      if (shouldMail) {
        const html = sessions.get(sessionId)?.reportHtml || '';
        sendReportEmail(data, html, config.emailTo || null).catch(err =>
          console.error('[mailer] Unhandled error:', err.message),
        );
      }
    }
  });

  engine.start().catch(err => broadcast(sessionId, 'error', { message: err.message }));
  return sessionId;
}

// ============================================================
// API ROUTES
// ============================================================

// ── Chains ────────────────────────────────────────────────
app.get('/api/chains', (_req, res) => {
  const list = Object.values(CHAINS).map(c => ({
    id: c.id, name: c.name, color: c.color, type: c.type,
    defaultEndpoint: c.defaultEndpoint, blockTime: c.blockTime,
    extraHeaders: c.extraHeaders,
    methods: c.methods.map(m => ({ name: m.name, category: m.category, weight: m.weight })),
  }));
  res.json(list);
});

// ── Benchmark start ───────────────────────────────────────
app.post('/api/benchmark/start', async (req, res) => {
  if (queue.status().running) {
    return res.status(409).json({
      error: 'A test is currently running.',
      currentSessionId: queue.status().currentSessionId,
      hint: 'Use POST /api/queue/add to queue the test instead.',
    });
  }

  const { type = 'benchmark', chainId, endpoint, endpoints } = req.body;

  if (type === 'benchmark' && (!chainId || !CHAINS[chainId])) {
    return res.status(400).json({ error: 'Invalid chainId' });
  }
  if (type === 'rest' && (!endpoints || !endpoints.length)) {
    return res.status(400).json({ error: 'endpoints[] required for REST benchmark' });
  }
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });

  const chainName = type === 'benchmark'
    ? CHAINS[chainId]?.name
    : type === 'rest' ? 'Custom REST' : 'WebSocket';

  try {
    const sessionId = await _startSession({ ...req.body, chainName });
    res.json({ sessionId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Stop ──────────────────────────────────────────────────
app.post('/api/benchmark/stop/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  session.engine.stop();
  session.status = 'stopped';
  res.json({ ok: true });
});

// ── SSE stream ────────────────────────────────────────────
app.get('/api/benchmark/stream/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // If already done, replay the done event immediately
  if (session.status !== 'running' && session.result) {
    res.write(`event: done\ndata: ${JSON.stringify(session.result)}\n\n`);
    res.end();
    return;
  }

  session.clients.add(res);
  req.on('close', () => session.clients.delete(res));
});

// ── Sessions list ─────────────────────────────────────────
app.get('/api/sessions', (_req, res) => {
  const list = [];
  for (const [id, s] of sessions) {
    list.push({
      id, status: s.status,
      chainName: s.result?.chainName || s.result?.type || '—',
      endpoint: s.result?.endpoint || '—',
      timestamp: s.result?.timestamp,
      duration: s.result?.duration,
      avgRPS: s.result?.avgRPS,
      errorRate: s.result?.errorRate,
      type: s.result?.type || 'benchmark',
    });
  }
  // Most recent first
  list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  res.json(list);
});

// ── Session result ────────────────────────────────────────
app.get('/api/sessions/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  res.json({ status: session.status, result: session.result });
});

// ── Report download ───────────────────────────────────────
app.get('/api/sessions/:id/report', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  if (!session.reportHtml) return res.status(404).json({ error: 'Report not ready yet' });

  const s = session.result;
  const label = (s?.chainName || s?.type || 'benchmark')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/gi, '').toLowerCase();
  const ts = new Date(s?.timestamp || Date.now()).toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `benchmark-${label}-${ts}.html`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(session.reportHtml);
});

// ── Queue ─────────────────────────────────────────────────
app.get('/api/queue', (_req, res) => res.json(queue.status()));

app.post('/api/queue/add', (req, res) => {
  const { type = 'benchmark', chainId, endpoint, endpoints } = req.body;
  if (type === 'benchmark' && (!chainId || !CHAINS[chainId])) {
    return res.status(400).json({ error: 'Invalid chainId' });
  }
  if (type === 'rest' && (!endpoints || !endpoints.length)) {
    return res.status(400).json({ error: 'endpoints[] required for REST benchmark' });
  }
  if (!endpoint && type !== 'websocket') {
    return res.status(400).json({ error: 'endpoint required' });
  }

  const chainName = type === 'benchmark'
    ? CHAINS[chainId]?.name
    : type === 'rest' ? 'Custom REST' : 'WebSocket';

  const id = queue.add({ ...req.body, chainName });
  res.json({ queued: true, id, status: queue.status() });
});

app.delete('/api/queue/:id', (req, res) => {
  const removed = queue.remove(req.params.id);
  res.json({ removed, status: queue.status() });
});

app.delete('/api/queue', (_req, res) => {
  queue.clear();
  res.json({ ok: true });
});

// ── Queue SSE ─────────────────────────────────────────────
app.get('/api/queue/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  queueClients.add(res);
  // Send current state immediately
  res.write(`event: queue\ndata: ${JSON.stringify(queue.status())}\n\n`);
  req.on('close', () => queueClients.delete(res));
});

// ── Mail config info (no secrets) ────────────────────────
app.get('/api/config/mail', (_req, res) => {
  const cfg = getMailConfig();
  res.json({ smtpReady: !!(cfg.host && cfg.user), defaultTo: cfg.to || null });
});

// ============================================================
// START
// ============================================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  const mailCfg = getMailConfig();
  console.log(`\n  node101-benchmark v2 running at http://localhost:${PORT}\n`);
  console.log(`  Mail: ${mailCfg.enabled ? `enabled → ${mailCfg.to}` : 'disabled (set SMTP_HOST, SMTP_USER, MAIL_TO to enable)'}`);
  console.log(`  Queue cooldown: ${cooldownMs / 1000}s\n`);
});
