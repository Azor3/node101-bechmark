# node101-benchmark

A blockchain RPC load testing and benchmarking tool that measures the performance and reliability of RPC endpoints across multiple networks. Simulates realistic load patterns and tracks detailed metrics including latency percentiles, throughput, error rates, and sync lag — with real-time visualization and HTML report export.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green) ![Express](https://img.shields.io/badge/Express-4.18-blue) ![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## Features

- Real-time RPS, latency (p50/p95/p99), error rate, and in-flight request metrics
- Weighted method mix per chain (light / medium / heavy categories)
- Sync lag detection using block height polling
- Server-Sent Events (SSE) streaming — no polling, no WebSockets
- Per-method breakdown table
- Test history stored locally (last 20 runs)
- One-click HTML report export with charts and tables

---

## Supported Chains

| Chain | Protocol | Default Endpoint |
|-------|----------|-----------------|
| Ethereum | EVM JSON-RPC | `https://ethereum-rpc.publicnode.com` |
| Monad | EVM JSON-RPC | `https://testnet-rpc.monad.xyz` |
| Base | EVM JSON-RPC | `https://mainnet.base.org` |
| Arbitrum | EVM JSON-RPC | `https://arb1.arbitrum.io/rpc` |
| Avalanche | EVM JSON-RPC | `https://api.avax.network/ext/bc/C/rpc` |
| Bitcoin | Bitcoin RPC | `https://bitcoin-mainnet.public.blastapi.io` |
| Sui | Sui JSON-RPC | `https://fullnode.mainnet.sui.io` |
| Aptos | REST API | `https://fullnode.mainnet.aptoslabs.com` |
| TON | TON JSON-RPC | `https://toncenter.com/api/v2/jsonRPC` |
| TRON | TRON REST | `https://api.trongrid.io` |
| Cardano | Blockfrost REST | `https://cardano-mainnet.blockfrost.io/api/v0` |
| XRP | XRP JSON-RPC | `https://xrplcluster.com` |

---

## Requirements

- Node.js v18 or higher
- npm

---

## What's New in v2

| Feature | Details |
|---------|---------|
| **Browser-independent** | Test engine is fully server-side. Closing the tab never stops a test. Reconnect button appears on reload. |
| **Test queue** | Add multiple tests to a sequential queue. Configurable cooldown between runs (default 5 min). |
| **Email reports** | HTML report auto-emailed on completion. SMTP config via `.env`. |
| **Fail thresholds** | Per-test: max latency, HTTP status codes, JSON-RPC errors, max error rate. Fail reason breakdown in reports & UI. |
| **Method weight editor** | Edit per-method weights in the sidebar before starting a test. |
| **REST support** | Benchmark any HTTP API — define endpoints with method, path, body, headers, and weight. |
| **WebSocket testing** | JSON-RPC or raw WS — tracks connection time, message roundtrip latency, reconnects, timeouts. |
| **Offline reports** | Exported HTML reports bundle Chart.js inline — open without internet. |
| **Rich tooltips** | Hover on any chart point to see request counts, success/fail split, latency percentiles, fail reasons. |
| **Server-side reports** | Reports are generated server-side and downloadable via API, enabling email attachments. |

---

## Installation

```bash
git clone https://github.com/node101-io/node101-benchmark.git
cd node101-benchmark
npm install
```

---

## Configuration

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

```env
PORT=3000

# Email (optional — leave SMTP_HOST empty to disable)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
MAIL_TO=recipient@example.com

# Queue cooldown between sequential tests (seconds, default 300)
QUEUE_COOLDOWN_SECONDS=300
```

## Running

```bash
node server.js
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Usage

### Chain Benchmark (default)
1. Select **Chain** test type.
2. Pick a blockchain and enter an RPC endpoint.
3. Optionally edit per-method weights in the **Method Mix** section.
4. Set thresholds under **Fail Thresholds** (collapsible).
5. Click **▶ Start** to run immediately, or **⏱ Queue** to add to the queue.

### Custom REST
1. Select **REST** test type.
2. Enter the base URL.
3. Add endpoints (method, path, weight, optional body/headers).
4. Click Start or Queue.

### WebSocket
1. Select **WebSocket** test type.
2. Enter a `wss://` endpoint.
3. Choose mode (JSON-RPC or Raw), connection count, and rate per connection.
4. Add messages/methods with weights.
5. Click Start or Queue.

### Queue / Sequential Tests
- **⏱ Queue** adds a test to the sequential queue.
- Tests run one at a time with a configurable cooldown (default 5 min).
- View and manage the queue under the **Queue** tab.
- Example: queue 30 min Ethereum → 30 min Ripple → runs automatically end-to-end.

### Reports
- Click **⬇ Download Report** after completion — the HTML file is fully self-contained (Chart.js bundled, no internet required).
- If email is configured, the report is also emailed automatically.
- Reports include: time-series charts with rich hover tooltips, fail reason breakdown, method-level stats.

---

## Configuration Reference

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| Duration | 5 – 300 s | 60 | Total test duration in seconds |
| Target RPS | 1 – 1000 | 100 | Desired requests per second |
| Max Concurrency | 1 – 200 | 30 | Max simultaneous in-flight requests |

---

## Adding a New Chain

All chain definitions live in `server.js`, in the `CHAINS` object near the top of the file.

### Step 1 — Add a chain entry

```js
CHAINS.mychain = {
  name: 'My Chain',
  type: 'evm',          // see Protocol Types below
  defaultEndpoint: 'https://rpc.mychain.io',
  blockTime: 2,         // expected seconds per block
  methods: [],          // filled in Step 2
};
```

**Protocol Types**

| `type` | Used for |
|--------|----------|
| `evm` | Ethereum-compatible JSON-RPC |
| `bitcoin` | Bitcoin JSON-RPC 1.0 |
| `sui` | Sui JSON-RPC |
| `aptos` | Aptos REST API |
| `ton` | TON JSON-RPC |
| `tron` | TRON HTTP API |
| `cardano` | Blockfrost REST API |
| `xrp` | XRP Ledger JSON-RPC |

If your chain uses standard EVM JSON-RPC, set `type: 'evm'` and you're done with the protocol layer.

---

### Step 2 — Define methods

Each method in the `methods` array describes one RPC call the benchmarker can fire.

```js
methods: [
  {
    name: 'getBlockNumber',   // display name
    category: 'light',        // 'light' | 'medium' | 'heavy'
    weight: 5,                // relative probability (higher = more frequent)
    isSyncCheck: true,        // true if this method returns block height
    build() {
      // Return the request body. For EVM:
      return { method: 'eth_blockNumber', params: [], id: 1, jsonrpc: '2.0' };
    },
    parseSyncBlock(result) {
      // Parse raw RPC result into a block number integer.
      return parseInt(result, 16);
    },
  },
  {
    name: 'getBalance',
    category: 'medium',
    weight: 3,
    build() {
      return {
        method: 'eth_getBalance',
        params: ['0x0000000000000000000000000000000000000000', 'latest'],
        id: 1,
        jsonrpc: '2.0',
      };
    },
  },
],
```

**Field reference**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Label shown in the UI and reports |
| `category` | Yes | `light`, `medium`, or `heavy` — used for visual grouping |
| `weight` | Yes | Integer; probability relative to other weights in the same chain |
| `build()` | Yes | Returns the request payload sent to the endpoint |
| `isSyncCheck` | No | Mark one method per chain as the sync-check method |
| `parseSyncBlock(result)` | Required if `isSyncCheck: true` | Parses the response result into an integer block number |

---

### Step 3 — (Optional) Add authentication headers

If the endpoint requires a static API key or custom header, add `extraHeaders`:

```js
CHAINS.mychain = {
  // ...
  extraHeaders: { 'x-api-key': 'default-or-placeholder-key' },
};
```

Users can override this at runtime via the **Extra Headers** field in the UI.

---

### Step 4 — (Optional) Non-EVM protocol

If your chain uses a custom protocol, add a case to the `executeRequest` function in `server.js`:

```js
case 'mychain': {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(method.build()),
    signal: AbortSignal.timeout(10000),
  });
  const json = await response.json();
  return { success: true, result: json.result };
}
```

Return `{ success: true, result }` on success or `{ success: false, error }` on failure.

---

## Fail Thresholds

Configure in the sidebar (collapsible). Applied per-request:

| Field | Type | Description |
|-------|------|-------------|
| `maxLatencyMs` | number | Requests exceeding this latency count as `latency` failures |
| `failOnStatusCodes` | `[500,502,...]` | HTTP status codes that count as failures |
| `failOnJsonRpcError` | bool (default `true`) | Count JSON-RPC `error` responses as failures |
| `maxErrorRatePercent` | number | Alarm threshold (logged, shown in report) |

Fail reasons are tracked per-second and per-method: `networkError`, `latency`, `statusCode`, `jsonRpcError`, `httpError`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/chains` | All chain configs |
| `POST` | `/api/benchmark/start` | Start immediately (returns 409 if busy) |
| `POST` | `/api/benchmark/stop/:id` | Stop a session |
| `GET` | `/api/benchmark/stream/:id` | SSE stream of live metrics |
| `GET` | `/api/sessions` | List all sessions (running + completed) |
| `GET` | `/api/sessions/:id` | Get session result |
| `GET` | `/api/sessions/:id/report` | Download offline HTML report |
| `POST` | `/api/queue/add` | Add test to queue |
| `GET` | `/api/queue` | Queue status |
| `DELETE` | `/api/queue/:id` | Remove item from queue |
| `DELETE` | `/api/queue` | Clear queue |
| `GET` | `/api/queue/stream` | SSE stream of queue updates |

### POST `/api/benchmark/start` body

```json
{
  "chainId": "ethereum",
  "endpoint": "https://rpc.example.com",
  "extraHeaders": {},
  "duration": 60,
  "targetRps": 100,
  "maxConcurrency": 30
}
```

### SSE event shape

```json
{
  "type": "stats",
  "data": {
    "rps": 97,
    "avgLatency": 143,
    "p50": 120,
    "p95": 310,
    "p99": 580,
    "errorRate": 0.02,
    "totalRequests": 5820,
    "inFlight": 12,
    "syncLag": 0,
    "methodStats": { ... }
  }
}
```

---

## Project Structure

```
node101-benchmark/
├── server.js              # Express routes, session store, queue integration
├── lib/
│   ├── chains.js          # Chain definitions (EVM, Bitcoin, Sui, Aptos, TON, TRON, Cardano, XRP)
│   ├── engine.js          # BenchmarkEngine (JSON-RPC/REST) + WebSocketEngine
│   ├── queue.js           # TestQueue — sequential execution with cooldown
│   ├── mailer.js          # SMTP email sender (nodemailer)
│   └── report.js          # Server-side HTML report generator (offline-capable)
├── public/
│   └── index.html         # Single-page frontend
├── .env.example           # Environment variable template
└── package.json
```

---

## License

MIT
