import { WebSocket } from 'ws';

// ============================================================
// STATS HELPERS
// ============================================================

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[idx]);
}

export function computeStats(samples) {
  if (!samples.length) return { p50: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    avg: Math.round(avg),
    min: Math.round(sorted[0]),
    max: Math.round(sorted[sorted.length - 1]),
  };
}

const EMPTY_FAIL_REASONS = () => ({ networkError: 0, latency: 0, statusCode: 0, jsonRpcError: 0, httpError: 0 });

// ============================================================
// REQUEST EXECUTION  (supports chain types + REST)
// ============================================================

export async function executeRequest(endpoint, chain, method, ctx, extraHeaders = {}, thresholds = null) {
  const type = chain.type;
  const start = performance.now();
  let statusCode = null;

  try {
    if (type === 'evm' || type === 'bitcoin' || type === 'sui' || type === 'xrp' || type === 'ton') {
      const body = method.build(ctx);
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      statusCode = r.status;
      const latency = performance.now() - start;
      const json = await r.json();

      const failReasons = [];
      if (json.error) failReasons.push('jsonRpcError');
      if (thresholds?.maxLatencyMs && latency > thresholds.maxLatencyMs) failReasons.push('latency');
      if (statusCode && thresholds?.failOnStatusCodes?.includes(statusCode)) failReasons.push('statusCode');

      // Respect failOnJsonRpcError = false
      const effectiveFail = thresholds?.failOnJsonRpcError === false
        ? failReasons.filter(r => r !== 'jsonRpcError')
        : failReasons;

      return {
        ok: effectiveFail.length === 0,
        latency, method: method.name, result: json.result,
        statusCode, failReasons: effectiveFail,
      };

    } else if (type === 'aptos' || type === 'cardano') {
      const spec = method.build(ctx);
      const r = await fetch(`${endpoint}${spec.path}`, {
        method: spec.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        signal: AbortSignal.timeout(10000),
      });
      statusCode = r.status;
      const latency = performance.now() - start;

      const failReasons = [];
      if (!r.ok) failReasons.push('httpError');
      if (thresholds?.maxLatencyMs && latency > thresholds.maxLatencyMs) failReasons.push('latency');
      if (thresholds?.failOnStatusCodes?.includes(statusCode)) failReasons.push('statusCode');

      const json = r.ok ? await r.json() : null;
      return { ok: failReasons.length === 0, latency, method: method.name, result: json, statusCode, failReasons };

    } else if (type === 'tron') {
      const spec = method.build(ctx);
      const r = await fetch(`${endpoint}${spec.path}`, {
        method: spec.method || 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: spec.method !== 'GET' ? JSON.stringify(spec.body || {}) : undefined,
        signal: AbortSignal.timeout(10000),
      });
      statusCode = r.status;
      const latency = performance.now() - start;
      const json = await r.json();

      const failReasons = [];
      if (!r.ok) failReasons.push('httpError');
      if (json.Error) failReasons.push('jsonRpcError');
      if (thresholds?.maxLatencyMs && latency > thresholds.maxLatencyMs) failReasons.push('latency');
      if (thresholds?.failOnStatusCodes?.includes(statusCode)) failReasons.push('statusCode');

      return { ok: failReasons.length === 0, latency, method: method.name, result: json, statusCode, failReasons };

    } else if (type === 'rest') {
      const spec = method.build(ctx);
      let url = `${endpoint}${spec.path || ''}`;
      if (spec.queryParams && Object.keys(spec.queryParams).length) {
        const qs = new URLSearchParams(spec.queryParams).toString();
        url += (url.includes('?') ? '&' : '?') + qs;
      }
      const fetchHeaders = { ...extraHeaders, ...spec.headers };
      const fetchOpts = {
        method: spec.httpMethod || 'GET',
        headers: fetchHeaders,
        signal: AbortSignal.timeout(10000),
      };
      if (spec.body && (spec.httpMethod || 'GET') !== 'GET') {
        fetchHeaders['Content-Type'] = 'application/json';
        fetchOpts.body = JSON.stringify(spec.body);
      }
      const r = await fetch(url, fetchOpts);
      statusCode = r.status;
      const latency = performance.now() - start;

      const failReasons = [];
      if (!r.ok && !(thresholds?.allowedStatusCodes?.includes(statusCode))) failReasons.push('httpError');
      if (thresholds?.maxLatencyMs && latency > thresholds.maxLatencyMs) failReasons.push('latency');
      if (thresholds?.failOnStatusCodes?.includes(statusCode)) failReasons.push('statusCode');

      let result = null;
      try {
        const ct = r.headers.get('content-type') || '';
        result = ct.includes('json') ? await r.json() : await r.text();
      } catch { /* ignore parse errors */ }

      return { ok: failReasons.length === 0, latency, method: method.name, result, statusCode, failReasons };
    }

    throw new Error(`Unknown chain type: ${type}`);
  } catch (err) {
    const latency = performance.now() - start;
    return { ok: false, latency, method: method.name, error: err.message, statusCode, failReasons: ['networkError'] };
  }
}

// ============================================================
// SEED CONTEXT
// ============================================================

export async function seedContext(endpoint, chain, extraHeaders = {}) {
  const ctx = { address: chain.seedAddress || '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', latestBlock: null };
  try {
    const syncMethod = chain.methods?.find(m => m.isSyncCheck);
    if (!syncMethod) return ctx;
    const result = await executeRequest(endpoint, chain, syncMethod, ctx, extraHeaders);
    if (result.ok && syncMethod.parseSyncBlock) {
      ctx.latestBlock = syncMethod.parseSyncBlock(result.result);
    }
  } catch { /* continue with defaults */ }
  return ctx;
}

// ============================================================
// BENCHMARK ENGINE
// ============================================================

export class BenchmarkEngine {
  constructor(config) {
    this.endpoint = config.endpoint;
    this.chain = config.chain;
    this.chainId = config.chainId || config.chain?.id || 'custom';
    this.targetRPS = config.targetRPS || 10;
    this.duration = config.duration || 30;
    this.concurrency = config.concurrency || 20;
    this.extraHeaders = config.extraHeaders || {};
    this.thresholds = config.thresholds || null;
    this.methodWeights = config.methodWeights || null;

    this.running = false;
    this.listeners = new Set();
    this.allResults = [];
    this.secondWindow = [];
    this.timeSeries = [];
    this.inFlight = 0;
    this.startTime = null;
    this.tickerHandle = null;
    this.reportHandle = null;
    this.syncLag = null;
    this.failBreakdown = EMPTY_FAIL_REASONS();

    this.methodStats = {};
    for (const m of this._methods()) {
      this.methodStats[m.name] = {
        requests: 0, errors: 0, latencies: [], failReasons: EMPTY_FAIL_REASONS(),
      };
    }
  }

  _methods() {
    const methods = this.chain?.methods || [];
    if (!this.methodWeights) return methods;
    return methods.map(m => ({ ...m, weight: this.methodWeights[m.name] ?? m.weight }));
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(event, data) { for (const fn of this.listeners) fn(event, data); }

  pickMethod() {
    const methods = this._methods();
    const total = methods.reduce((s, m) => s + m.weight, 0);
    let r = Math.random() * total;
    for (const m of methods) {
      r -= m.weight;
      if (r <= 0) return m;
    }
    return methods[methods.length - 1];
  }

  async fireRequest() {
    if (this.inFlight >= this.concurrency) return;
    this.inFlight++;
    const method = this.pickMethod();
    const result = await executeRequest(
      this.endpoint, this.chain, method, this.ctx, this.extraHeaders, this.thresholds,
    );
    this.inFlight--;

    result.elapsed = (Date.now() - this.startTime) / 1000;
    this.allResults.push(result);
    this.secondWindow.push(result);

    const ms = this.methodStats[result.method];
    if (ms) {
      ms.requests++;
      if (!result.ok) {
        ms.errors++;
        for (const reason of (result.failReasons || ['networkError'])) {
          ms.failReasons[reason] = (ms.failReasons[reason] || 0) + 1;
          this.failBreakdown[reason] = (this.failBreakdown[reason] || 0) + 1;
        }
      }
      ms.latencies.push(result.latency);
    }
  }

  _buildMethodBreakdown() {
    const bd = {};
    for (const [name, ms] of Object.entries(this.methodStats)) {
      bd[name] = {
        requests: ms.requests,
        errors: ms.errors,
        errorRate: ms.requests ? ((ms.errors / ms.requests) * 100).toFixed(1) : '0.0',
        failReasons: { ...ms.failReasons },
        ...computeStats(ms.latencies),
      };
    }
    return bd;
  }

  buildProgressReport(windowResults) {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const errors = windowResults.filter(r => !r.ok);
    const windowFailReasons = EMPTY_FAIL_REASONS();
    for (const r of errors) {
      for (const reason of (r.failReasons || ['networkError'])) {
        windowFailReasons[reason] = (windowFailReasons[reason] || 0) + 1;
      }
    }

    return {
      elapsed: Math.round(elapsed),
      timestamp: Date.now(),
      rps: windowResults.length,
      requestCount: windowResults.length,
      successCount: windowResults.length - errors.length,
      failCount: errors.length,
      failReasons: windowFailReasons,
      totalRequests: this.allResults.length,
      totalErrors: this.allResults.filter(r => !r.ok).length,
      errorRate: windowResults.length ? ((errors.length / windowResults.length) * 100).toFixed(1) : '0.0',
      latency: computeStats(windowResults.map(r => r.latency)),
      methodBreakdown: this._buildMethodBreakdown(),
      syncLag: this.syncLag,
      inFlight: this.inFlight,
    };
  }

  async detectSyncLag() {
    const syncMethod = this.chain?.methods?.find(m => m.isSyncCheck);
    if (!syncMethod) return null;
    try {
      const result = await executeRequest(this.endpoint, this.chain, syncMethod, this.ctx, this.extraHeaders);
      if (!result.ok || !syncMethod.parseSyncBlock) return null;
      const blockNum = syncMethod.parseSyncBlock(result.result);
      if (blockNum && this.ctx.latestBlock) {
        const lag = blockNum - this.ctx.latestBlock;
        this.ctx.latestBlock = blockNum;
        return lag;
      }
      if (blockNum) this.ctx.latestBlock = blockNum;
    } catch { /* ignore */ }
    return null;
  }

  async start() {
    this.running = true;
    this.startTime = Date.now();
    this.ctx = {};

    this.emit('status', { status: 'seeding', message: 'Fetching seed data...' });
    this.ctx = await seedContext(this.endpoint, this.chain, this.extraHeaders);
    this.emit('status', { status: 'running', message: 'Benchmark running...', ctx: this.ctx });

    const intervalMs = Math.max(1, Math.round(1000 / this.targetRPS));
    this.tickerHandle = setInterval(() => { if (this.running) this.fireRequest(); }, intervalMs);

    this.reportHandle = setInterval(async () => {
      const window = this.secondWindow.splice(0);
      const report = this.buildProgressReport(window);
      this.timeSeries.push({
        elapsed: report.elapsed, timestamp: report.timestamp,
        rps: report.rps, requestCount: report.requestCount,
        successCount: report.successCount, failCount: report.failCount,
        failReasons: { ...report.failReasons },
        latency: { ...report.latency }, errorRate: report.errorRate, inFlight: report.inFlight,
      });
      this.emit('progress', report);
      if (Math.round(report.elapsed) % 5 === 0) this.syncLag = await this.detectSyncLag();
    }, 1000);

    this._doneTimer = setTimeout(() => this.stop(), this.duration * 1000 + 500);
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this.tickerHandle);
    clearInterval(this.reportHandle);
    clearTimeout(this._doneTimer);

    const waitStart = Date.now();
    while (this.inFlight > 0 && Date.now() - waitStart < 3000) {
      await new Promise(r => setTimeout(r, 50));
    }

    const allLatencies = this.allResults.map(r => r.latency);
    const totalErrors = this.allResults.filter(r => !r.ok).length;
    const duration = (Date.now() - this.startTime) / 1000;

    const summary = {
      type: 'benchmark',
      chainId: this.chainId,
      chainName: this.chain.name,
      chainColor: this.chain.color || '#58a6ff',
      endpoint: this.endpoint,
      duration: Math.round(duration),
      totalRequests: this.allResults.length,
      totalErrors,
      avgRPS: Math.round(this.allResults.length / duration),
      errorRate: this.allResults.length ? ((totalErrors / this.allResults.length) * 100).toFixed(1) : '0.0',
      latency: computeStats(allLatencies),
      methodBreakdown: this._buildMethodBreakdown(),
      failBreakdown: { ...this.failBreakdown },
      timeSeries: this.timeSeries,
      config: { targetRPS: this.targetRPS, duration: this.duration, concurrency: this.concurrency, thresholds: this.thresholds },
      timestamp: new Date().toISOString(),
    };

    this.emit('done', summary);
  }
}

// ============================================================
// WEBSOCKET ENGINE
// ============================================================

export class WebSocketEngine {
  constructor(config) {
    this.endpoint = config.endpoint;
    this.wsMode = config.wsMode || 'jsonrpc';
    this.messages = config.messages || [];
    this.connections = Math.max(1, config.connections || 1);
    this.ratePerConn = Math.max(1, config.ratePerConn || 5);
    this.duration = config.duration || 30;
    this.thresholds = config.thresholds || null;

    this.running = false;
    this.listeners = new Set();
    this.startTime = null;
    this.reportHandle = null;
    this.activeWs = new Set();

    this.metrics = {
      connectionAttempts: 0, connectionSuccesses: 0, connectionFailures: 0,
      reconnects: 0, disconnects: 0, messagesSent: 0, messagesReceived: 0,
      timeouts: 0, validationFails: 0, latencies: [],
    };
    this.secondWindow = { sent: 0, received: 0, latencies: [], errors: 0 };
    this.timeSeries = [];
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(event, data) { for (const fn of this.listeners) fn(event, data); }

  pickMessage() {
    if (!this.messages.length) return { name: 'ping', params: [] };
    const total = this.messages.reduce((s, m) => s + (m.weight || 1), 0);
    let r = Math.random() * total;
    for (const m of this.messages) {
      r -= (m.weight || 1);
      if (r <= 0) return m;
    }
    return this.messages[this.messages.length - 1];
  }

  buildPayload(msg, id) {
    if (this.wsMode === 'jsonrpc') {
      return JSON.stringify({ jsonrpc: '2.0', method: msg.name, params: msg.params || [], id });
    }
    return JSON.stringify({ ...(msg.payload || {}), id });
  }

  _openConnection() {
    return new Promise((resolve) => {
      this.metrics.connectionAttempts++;
      let ws;
      try { ws = new WebSocket(this.endpoint); }
      catch { this.metrics.connectionFailures++; return resolve(); }

      const pending = new Map(); // id -> { sentAt }
      let msgId = 0;
      let ticker = null;
      let resolved = false;
      const done = () => { if (!resolved) { resolved = true; resolve(); } };

      this.activeWs.add(ws);

      ws.on('open', () => {
        this.metrics.connectionSuccesses++;
        done();
        const ms = Math.max(10, Math.round(1000 / this.ratePerConn));
        ticker = setInterval(() => {
          if (!this.running) { clearInterval(ticker); ws.close(1000); return; }
          const msg = this.pickMessage();
          const id = ++msgId;
          const timeoutMs = this.thresholds?.maxLatencyMs || 10000;
          pending.set(id, { sentAt: performance.now() });
          setTimeout(() => {
            if (pending.has(id)) { pending.delete(id); this.metrics.timeouts++; this.secondWindow.errors++; }
          }, timeoutMs);
          try { ws.send(this.buildPayload(msg, id)); this.metrics.messagesSent++; this.secondWindow.sent++; }
          catch { /* closing */ }
        }, ms);
      });

      ws.on('message', (data) => {
        this.metrics.messagesReceived++;
        this.secondWindow.received++;
        try {
          const json = JSON.parse(data.toString());
          if (json.id && pending.has(json.id)) {
            const latency = performance.now() - pending.get(json.id).sentAt;
            pending.delete(json.id);
            this.metrics.latencies.push(latency);
            this.secondWindow.latencies.push(latency);
            if (this.thresholds?.maxLatencyMs && latency > this.thresholds.maxLatencyMs) {
              this.metrics.validationFails++;
            }
          }
        } catch { /* non-JSON */ }
      });

      ws.on('error', () => { this.metrics.connectionFailures++; this.secondWindow.errors++; done(); });

      ws.on('close', () => {
        this.activeWs.delete(ws);
        this.metrics.disconnects++;
        clearInterval(ticker);
        done();
        if (this.running) {
          this.metrics.reconnects++;
          setTimeout(() => { if (this.running) this._openConnection(); }, 2000);
        }
      });
    });
  }

  async start() {
    this.running = true;
    this.startTime = Date.now();
    this.emit('status', { status: 'connecting', message: `Opening ${this.connections} WebSocket connection(s)...` });

    await Promise.all(Array.from({ length: this.connections }, () => this._openConnection()));
    this.emit('status', { status: 'running', message: `${this.metrics.connectionSuccesses}/${this.connections} connections open` });

    this.reportHandle = setInterval(() => {
      const elapsed = Math.round((Date.now() - this.startTime) / 1000);
      const win = { ...this.secondWindow };
      this.secondWindow = { sent: 0, received: 0, latencies: [], errors: 0 };
      const latencyStats = computeStats(win.latencies);
      const report = {
        elapsed, timestamp: Date.now(),
        messagesSent: win.sent, messagesReceived: win.received, errors: win.errors,
        latency: latencyStats,
        totalSent: this.metrics.messagesSent, totalReceived: this.metrics.messagesReceived,
        connections: this.metrics.connectionSuccesses, reconnects: this.metrics.reconnects,
        timeouts: this.metrics.timeouts, validationFails: this.metrics.validationFails,
      };
      this.timeSeries.push(report);
      this.emit('progress', report);
    }, 1000);

    this._doneTimer = setTimeout(() => this.stop(), this.duration * 1000 + 500);
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this.reportHandle);
    clearTimeout(this._doneTimer);

    for (const ws of this.activeWs) { try { ws.close(1000); } catch { /* ignore */ } }
    await new Promise(r => setTimeout(r, 500));

    const duration = Math.round((Date.now() - this.startTime) / 1000);
    const summary = {
      type: 'websocket',
      endpoint: this.endpoint, wsMode: this.wsMode,
      duration, connections: this.connections,
      connectionAttempts: this.metrics.connectionAttempts,
      connectionSuccesses: this.metrics.connectionSuccesses,
      connectionFailures: this.metrics.connectionFailures,
      reconnects: this.metrics.reconnects, disconnects: this.metrics.disconnects,
      messagesSent: this.metrics.messagesSent, messagesReceived: this.metrics.messagesReceived,
      timeouts: this.metrics.timeouts, validationFails: this.metrics.validationFails,
      avgThroughput: duration > 0 ? Math.round(this.metrics.messagesReceived / duration) : 0,
      latency: computeStats(this.metrics.latencies),
      timeSeries: this.timeSeries,
      config: { connections: this.connections, ratePerConn: this.ratePerConn, duration: this.duration, thresholds: this.thresholds },
      timestamp: new Date().toISOString(),
    };

    this.emit('done', summary);
  }
}
