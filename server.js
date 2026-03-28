import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// CHAIN DEFINITIONS
// ============================================================

const EVM_METHODS = [
  {
    name: 'eth_blockNumber',
    category: 'light',
    weight: 25,
    build: () => ({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
    isSyncCheck: true,
    parseSyncBlock: (result) => parseInt(result, 16),
  },
  {
    name: 'eth_getBalance',
    category: 'light',
    weight: 20,
    build: (ctx) => ({
      jsonrpc: '2.0', method: 'eth_getBalance',
      params: [ctx.address, 'latest'], id: 1,
    }),
  },
  {
    name: 'eth_getBlockByNumber',
    category: 'medium',
    weight: 20,
    build: (ctx) => ({
      jsonrpc: '2.0', method: 'eth_getBlockByNumber',
      params: [ctx.latestBlock || 'latest', false], id: 1,
    }),
  },
  {
    name: 'eth_call',
    category: 'medium',
    weight: 15,
    build: () => ({
      jsonrpc: '2.0', method: 'eth_call',
      params: [{ to: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', data: '0x18160ddd' }, 'latest'],
      id: 1,
    }),
  },
  {
    name: 'eth_getTransactionCount',
    category: 'light',
    weight: 10,
    build: (ctx) => ({
      jsonrpc: '2.0', method: 'eth_getTransactionCount',
      params: [ctx.address, 'latest'], id: 1,
    }),
  },
  {
    name: 'eth_getLogs',
    category: 'heavy',
    weight: 10,
    build: (ctx) => ({
      jsonrpc: '2.0', method: 'eth_getLogs',
      params: [{
        fromBlock: ctx.latestBlock || 'latest',
        toBlock: ctx.latestBlock || 'latest',
        address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      }], id: 1,
    }),
  },
];

export const CHAINS = {
  ethereum: {
    id: 'ethereum', name: 'Ethereum', color: '#627EEA', type: 'evm',
    defaultEndpoint: 'https://eth.llamarpc.com',
    seedAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    methods: EVM_METHODS,
    blockTime: 12,
  },
  monad: {
    id: 'monad', name: 'Monad', color: '#836EF9', type: 'evm',
    defaultEndpoint: 'https://testnet-rpc.monad.xyz',
    seedAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    methods: EVM_METHODS,
    blockTime: 1,
  },
  base: {
    id: 'base', name: 'Base', color: '#0052FF', type: 'evm',
    defaultEndpoint: 'https://mainnet.base.org',
    seedAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    methods: EVM_METHODS,
    blockTime: 2,
  },
  arbitrum: {
    id: 'arbitrum', name: 'Arbitrum', color: '#28A0F0', type: 'evm',
    defaultEndpoint: 'https://arb1.arbitrum.io/rpc',
    seedAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    methods: EVM_METHODS,
    blockTime: 0.25,
  },
  avalanche: {
    id: 'avalanche', name: 'Avalanche', color: '#E84142', type: 'evm',
    defaultEndpoint: 'https://api.avax.network/ext/bc/C/rpc',
    seedAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    methods: EVM_METHODS,
    blockTime: 2,
  },
  bitcoin: {
    id: 'bitcoin', name: 'Bitcoin', color: '#F7931A', type: 'bitcoin',
    defaultEndpoint: 'http://user:pass@localhost:8332',
    blockTime: 600,
    methods: [
      {
        name: 'getblockcount',
        category: 'light',
        weight: 30,
        build: () => ({ jsonrpc: '1.0', method: 'getblockcount', params: [], id: 1 }),
        isSyncCheck: true,
        parseSyncBlock: (r) => r,
      },
      {
        name: 'getblockchaininfo',
        category: 'medium',
        weight: 25,
        build: () => ({ jsonrpc: '1.0', method: 'getblockchaininfo', params: [], id: 1 }),
      },
      {
        name: 'getrawmempool',
        category: 'heavy',
        weight: 20,
        build: () => ({ jsonrpc: '1.0', method: 'getrawmempool', params: [false], id: 1 }),
      },
      {
        name: 'getblockhash',
        category: 'light',
        weight: 15,
        build: (ctx) => ({ jsonrpc: '1.0', method: 'getblockhash', params: [ctx.latestBlock || 800000], id: 1 }),
      },
      {
        name: 'getnetworkinfo',
        category: 'light',
        weight: 10,
        build: () => ({ jsonrpc: '1.0', method: 'getnetworkinfo', params: [], id: 1 }),
      },
    ],
  },
  sui: {
    id: 'sui', name: 'Sui', color: '#4DA2FF', type: 'sui',
    defaultEndpoint: 'https://fullnode.mainnet.sui.io',
    blockTime: 0.5,
    methods: [
      {
        name: 'sui_getLatestCheckpointSequenceNumber',
        category: 'light',
        weight: 30,
        build: () => ({ jsonrpc: '2.0', method: 'sui_getLatestCheckpointSequenceNumber', params: [], id: 1 }),
        isSyncCheck: true,
        parseSyncBlock: (r) => parseInt(r),
      },
      {
        name: 'sui_getObject',
        category: 'medium',
        weight: 25,
        build: () => ({
          jsonrpc: '2.0', method: 'sui_getObject',
          params: ['0x0000000000000000000000000000000000000000000000000000000000000002',
            { showType: true, showOwner: true, showContent: false }], id: 1,
        }),
      },
      {
        name: 'sui_getTotalTransactionBlocks',
        category: 'light',
        weight: 20,
        build: () => ({ jsonrpc: '2.0', method: 'sui_getTotalTransactionBlocks', params: [], id: 1 }),
      },
      {
        name: 'suix_getBalance',
        category: 'light',
        weight: 15,
        build: () => ({
          jsonrpc: '2.0', method: 'suix_getBalance',
          params: ['0x94f1a597b4e8f709a396f7f6b1482bdcd65a673d111e49286c527fab7c2d0961', '0x2::sui::SUI'],
          id: 1,
        }),
      },
      {
        name: 'sui_getCheckpoint',
        category: 'medium',
        weight: 10,
        build: (ctx) => ({
          jsonrpc: '2.0', method: 'sui_getCheckpoint',
          params: [String(ctx.latestBlock || '1')], id: 1,
        }),
      },
    ],
  },
  aptos: {
    id: 'aptos', name: 'Aptos', color: '#00D4AA', type: 'aptos',
    defaultEndpoint: 'https://fullnode.mainnet.aptoslabs.com',
    blockTime: 1,
    methods: [
      {
        name: 'GET /v1/blocks/by_height/{height}',
        category: 'medium',
        weight: 25,
        build: (ctx) => ({ path: `/v1/blocks/by_height/${ctx.latestBlock || 1}`, method: 'GET' }),
        isSyncCheck: true,
      },
      {
        name: 'GET /v1/accounts/0x1/resources',
        category: 'medium',
        weight: 25,
        build: () => ({ path: '/v1/accounts/0x1/resources', method: 'GET' }),
      },
      {
        name: 'GET /v1/ledger/info',
        category: 'light',
        weight: 25,
        build: () => ({ path: '/', method: 'GET' }),
      },
      {
        name: 'GET /v1/accounts/0x1',
        category: 'light',
        weight: 15,
        build: () => ({ path: '/v1/accounts/0x1', method: 'GET' }),
      },
      {
        name: 'GET /v1/transactions',
        category: 'heavy',
        weight: 10,
        build: () => ({ path: '/v1/transactions?limit=25', method: 'GET' }),
      },
    ],
  },
  ton: {
    id: 'ton', name: 'TON', color: '#0088CC', type: 'ton',
    defaultEndpoint: 'https://toncenter.com/api/v2',
    blockTime: 5,
    methods: [
      {
        name: 'getMasterchainInfo',
        category: 'light',
        weight: 30,
        build: () => ({ jsonrpc: '2.0', method: 'getMasterchainInfo', params: {}, id: 1 }),
        isSyncCheck: true,
        parseSyncBlock: (r) => r?.last?.seqno,
      },
      {
        name: 'getConsensusBlock',
        category: 'light',
        weight: 25,
        build: () => ({ jsonrpc: '2.0', method: 'getConsensusBlock', params: {}, id: 1 }),
      },
      {
        name: 'getAddressInformation',
        category: 'medium',
        weight: 25,
        build: () => ({
          jsonrpc: '2.0', method: 'getAddressInformation',
          params: { address: 'EQCjk1hh952vWaE9bRguFkAt3zdwWein2a0A3cWX2TIi-TWF' }, id: 1,
        }),
      },
      {
        name: 'getBlockHeader',
        category: 'medium',
        weight: 20,
        build: (ctx) => ({
          jsonrpc: '2.0', method: 'getBlockHeader',
          params: { workchain: -1, shard: '-9223372036854775808', seqno: ctx.latestBlock || 1 },
          id: 1,
        }),
      },
    ],
  },
  tron: {
    id: 'tron', name: 'TRON', color: '#EF0027', type: 'tron',
    defaultEndpoint: 'https://api.trongrid.io',
    blockTime: 3,
    methods: [
      {
        name: 'wallet/getnowblock',
        category: 'light',
        weight: 35,
        build: () => ({ path: '/wallet/getnowblock', method: 'POST', body: {} }),
        isSyncCheck: true,
      },
      {
        name: 'wallet/getblockbynum',
        category: 'medium',
        weight: 25,
        build: (ctx) => ({ path: '/wallet/getblockbynum', method: 'POST', body: { num: ctx.latestBlock || 1 } }),
      },
      {
        name: 'wallet/getaccount',
        category: 'medium',
        weight: 20,
        build: () => ({
          path: '/wallet/getaccount', method: 'POST',
          body: { address: 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7', visible: true },
        }),
      },
      {
        name: 'wallet/getchainparameters',
        category: 'light',
        weight: 20,
        build: () => ({ path: '/wallet/getchainparameters', method: 'GET' }),
      },
    ],
  },
  cardano: {
    id: 'cardano', name: 'Cardano', color: '#0033AD', type: 'cardano',
    defaultEndpoint: 'https://cardano-mainnet.blockfrost.io/api/v0',
    extraHeaders: { 'project_id': 'YOUR_BLOCKFROST_KEY' },
    blockTime: 20,
    methods: [
      {
        name: 'GET /blocks/latest',
        category: 'light',
        weight: 35,
        build: () => ({ path: '/blocks/latest', method: 'GET' }),
        isSyncCheck: true,
      },
      {
        name: 'GET /epochs/latest',
        category: 'light',
        weight: 25,
        build: () => ({ path: '/epochs/latest', method: 'GET' }),
      },
      {
        name: 'GET /genesis',
        category: 'light',
        weight: 20,
        build: () => ({ path: '/genesis', method: 'GET' }),
      },
      {
        name: 'GET /addresses/{addr}/utxos',
        category: 'heavy',
        weight: 20,
        build: () => ({
          path: '/addresses/addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgse35a3x/utxos',
          method: 'GET',
        }),
      },
    ],
  },
  ripple: {
    id: 'ripple', name: 'Ripple (XRP)', color: '#00AAE4', type: 'xrp',
    defaultEndpoint: 'https://xrplcluster.com',
    blockTime: 4,
    methods: [
      {
        name: 'server_info',
        category: 'light',
        weight: 30,
        build: () => ({ jsonrpc: '2.0', method: 'server_info', params: [{}], id: 1 }),
        isSyncCheck: true,
        parseSyncBlock: (r) => r?.info?.validated_ledger?.seq,
      },
      {
        name: 'ledger',
        category: 'medium',
        weight: 25,
        build: () => ({
          jsonrpc: '2.0', method: 'ledger',
          params: [{ ledger_index: 'validated', transactions: false, expand: false }], id: 1,
        }),
      },
      {
        name: 'account_info',
        category: 'medium',
        weight: 25,
        build: () => ({
          jsonrpc: '2.0', method: 'account_info',
          params: [{ account: 'r9cZA1mLK5R5Am25ArfXFmqgNwjZgnfk59', ledger_index: 'validated' }],
          id: 1,
        }),
      },
      {
        name: 'ledger_closed',
        category: 'light',
        weight: 20,
        build: () => ({ jsonrpc: '2.0', method: 'ledger_closed', params: [], id: 1 }),
      },
    ],
  },
};

// ============================================================
// REQUEST EXECUTION
// ============================================================

async function executeRequest(endpoint, chain, method, ctx, extraHeaders = {}) {
  const type = chain.type;
  const start = performance.now();

  try {
    let res, latency;

    if (type === 'evm' || type === 'bitcoin' || type === 'sui' || type === 'xrp' || type === 'ton') {
      const body = method.build(ctx);
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      latency = performance.now() - start;
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
      return { ok: true, latency, method: method.name, result: json.result };

    } else if (type === 'aptos' || type === 'cardano') {
      const spec = method.build(ctx);
      const r = await fetch(`${endpoint}${spec.path}`, {
        method: spec.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        signal: AbortSignal.timeout(10000),
      });
      latency = performance.now() - start;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      return { ok: true, latency, method: method.name, result: json };

    } else if (type === 'tron') {
      const spec = method.build(ctx);
      const r = await fetch(`${endpoint}${spec.path}`, {
        method: spec.method || 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: spec.method !== 'GET' ? JSON.stringify(spec.body || {}) : undefined,
        signal: AbortSignal.timeout(10000),
      });
      latency = performance.now() - start;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      if (json.Error) throw new Error(json.Error);
      return { ok: true, latency, method: method.name, result: json };
    }

    throw new Error(`Unknown chain type: ${type}`);
  } catch (err) {
    const latency = performance.now() - start;
    return { ok: false, latency, method: method.name, error: err.message };
  }
}

// Seed context: fetch latest block number and a known address
async function seedContext(endpoint, chain, extraHeaders = {}) {
  const ctx = { address: chain.seedAddress || '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', latestBlock: null };

  try {
    const syncMethod = chain.methods.find(m => m.isSyncCheck);
    if (!syncMethod) return ctx;

    const result = await executeRequest(endpoint, chain, syncMethod, ctx, extraHeaders);
    if (result.ok && syncMethod.parseSyncBlock) {
      ctx.latestBlock = syncMethod.parseSyncBlock(result.result);
    }
  } catch (_) { /* continue with defaults */ }

  return ctx;
}

// ============================================================
// STATS
// ============================================================

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[idx]);
}

function computeStats(samples) {
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

// ============================================================
// BENCHMARK ENGINE
// ============================================================

class BenchmarkEngine {
  constructor(config) {
    this.endpoint = config.endpoint;
    this.chainId = config.chainId;
    this.chain = CHAINS[config.chainId];
    this.targetRPS = config.targetRPS || 10;
    this.duration = config.duration || 30;
    this.concurrency = config.concurrency || 20;
    this.extraHeaders = config.extraHeaders || {};
    this.running = false;
    this.listeners = new Set();

    // Runtime state
    this.allResults = [];
    this.secondWindow = [];
    this.timeSeries = [];
    this.inFlight = 0;
    this.startTime = null;
    this.ctx = {};
    this.tickerHandle = null;
    this.reportHandle = null;
    this.methodStats = {};

    for (const m of this.chain.methods) {
      this.methodStats[m.name] = { requests: 0, errors: 0, latencies: [] };
    }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event, data) {
    for (const fn of this.listeners) fn(event, data);
  }

  pickMethod() {
    const methods = this.chain.methods;
    const totalWeight = methods.reduce((s, m) => s + m.weight, 0);
    let r = Math.random() * totalWeight;
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
    const result = await executeRequest(this.endpoint, this.chain, method, this.ctx, this.extraHeaders);
    this.inFlight--;

    const elapsed = (Date.now() - this.startTime) / 1000;
    result.elapsed = elapsed;
    this.allResults.push(result);
    this.secondWindow.push(result);

    const ms = this.methodStats[result.method];
    if (ms) {
      ms.requests++;
      if (!result.ok) ms.errors++;
      ms.latencies.push(result.latency);
    }
  }

  buildReport(windowResults) {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const latencies = windowResults.map(r => r.latency);
    const errors = windowResults.filter(r => !r.ok).length;
    const stats = computeStats(latencies);

    const methodBreakdown = {};
    for (const [name, ms] of Object.entries(this.methodStats)) {
      methodBreakdown[name] = {
        requests: ms.requests,
        errors: ms.errors,
        errorRate: ms.requests ? ((ms.errors / ms.requests) * 100).toFixed(1) : '0.0',
        ...computeStats(ms.latencies),
      };
    }

    return {
      elapsed: Math.round(elapsed),
      rps: windowResults.length,
      totalRequests: this.allResults.length,
      totalErrors: this.allResults.filter(r => !r.ok).length,
      errorRate: windowResults.length ? ((errors / windowResults.length) * 100).toFixed(1) : '0.0',
      latency: stats,
      methodBreakdown,
      syncLag: this.syncLag,
      inFlight: this.inFlight,
    };
  }

  async detectSyncLag() {
    const syncMethod = this.chain.methods.find(m => m.isSyncCheck);
    if (!syncMethod) return null;

    try {
      const result = await executeRequest(this.endpoint, this.chain, syncMethod, this.ctx, this.extraHeaders);
      if (!result.ok) return null;

      if (syncMethod.parseSyncBlock) {
        const blockNum = syncMethod.parseSyncBlock(result.result);
        if (blockNum && this.ctx.latestBlock) {
          const lag = blockNum - this.ctx.latestBlock;
          this.ctx.latestBlock = blockNum;
          return lag;
        }
        if (blockNum) this.ctx.latestBlock = blockNum;
      }
    } catch (_) { }
    return null;
  }

  async start() {
    this.running = true;
    this.startTime = Date.now();
    this.syncLag = null;

    this.emit('status', { status: 'seeding', message: 'Fetching seed data...' });
    this.ctx = await seedContext(this.endpoint, this.chain, this.extraHeaders);
    this.emit('status', { status: 'running', message: 'Benchmark running...', ctx: this.ctx });

    const intervalMs = Math.max(1, Math.round(1000 / this.targetRPS));

    this.tickerHandle = setInterval(() => {
      if (!this.running) return;
      this.fireRequest();
    }, intervalMs);

    // Report every second
    this.reportHandle = setInterval(async () => {
      const window = this.secondWindow.splice(0);
      const report = this.buildReport(window);
      this.timeSeries.push({ elapsed: report.elapsed, rps: report.rps, latency: { ...report.latency }, errorRate: report.errorRate, inFlight: report.inFlight });
      this.emit('progress', report);

      // Sync lag check every 5 seconds
      if (Math.round(report.elapsed) % 5 === 0) {
        this.syncLag = await this.detectSyncLag();
      }
    }, 1000);

    // Auto-stop after duration
    setTimeout(() => this.stop(), this.duration * 1000 + 500);
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this.tickerHandle);
    clearInterval(this.reportHandle);

    // Wait for in-flight to settle (max 3s)
    const waitStart = Date.now();
    while (this.inFlight > 0 && Date.now() - waitStart < 3000) {
      await new Promise(r => setTimeout(r, 50));
    }

    const allLatencies = this.allResults.map(r => r.latency);
    const finalStats = computeStats(allLatencies);
    const totalErrors = this.allResults.filter(r => !r.ok).length;

    const methodBreakdown = {};
    for (const [name, ms] of Object.entries(this.methodStats)) {
      methodBreakdown[name] = {
        requests: ms.requests,
        errors: ms.errors,
        errorRate: ms.requests ? ((ms.errors / ms.requests) * 100).toFixed(1) : '0.0',
        ...computeStats(ms.latencies),
      };
    }

    const duration = (Date.now() - this.startTime) / 1000;
    const summary = {
      chainId: this.chainId,
      chainName: this.chain.name,
      endpoint: this.endpoint,
      duration: Math.round(duration),
      totalRequests: this.allResults.length,
      totalErrors,
      avgRPS: Math.round(this.allResults.length / duration),
      errorRate: this.allResults.length ? ((totalErrors / this.allResults.length) * 100).toFixed(1) : '0.0',
      latency: finalStats,
      methodBreakdown,
      timeSeries: this.timeSeries,
      config: {
        targetRPS: this.targetRPS,
        duration: this.duration,
        concurrency: this.concurrency,
      },
      timestamp: new Date().toISOString(),
    };

    this.emit('done', summary);
  }
}

// ============================================================
// ACTIVE SESSIONS & SSE
// ============================================================

const sessions = new Map(); // id -> { engine, clients: Set }

function broadcast(sessionId, event, data) {
  const session = sessions.get(sessionId);
  if (!session) return;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of session.clients) {
    client.write(msg);
  }
}

// ============================================================
// API ROUTES
// ============================================================

app.get('/api/chains', (req, res) => {
  const list = Object.values(CHAINS).map(c => ({
    id: c.id,
    name: c.name,
    color: c.color,
    type: c.type,
    defaultEndpoint: c.defaultEndpoint,
    blockTime: c.blockTime,
    methods: c.methods.map(m => ({ name: m.name, category: m.category, weight: m.weight })),
  }));
  res.json(list);
});

app.post('/api/benchmark/start', async (req, res) => {
  const { chainId, endpoint, targetRPS, duration, concurrency, extraHeaders } = req.body;

  if (!chainId || !CHAINS[chainId]) return res.status(400).json({ error: 'Invalid chain' });
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });

  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const engine = new BenchmarkEngine({ chainId, endpoint, targetRPS, duration, concurrency, extraHeaders });

  sessions.set(sessionId, { engine, clients: new Set() });

  engine.subscribe((event, data) => broadcast(sessionId, event, data));
  engine.start().catch(err => broadcast(sessionId, 'error', { message: err.message }));

  res.json({ sessionId });
});

app.post('/api/benchmark/stop/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  session.engine.stop();
  res.json({ ok: true });
});

app.get('/api/benchmark/stream/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  session.clients.add(res);
  req.on('close', () => {
    session.clients.delete(res);
  });
});

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  node101-benchmark running at http://localhost:${PORT}\n`);
});
