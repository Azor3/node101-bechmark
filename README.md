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

## Installation

```bash
git clone https://github.com/node101-io/node101-benchmark.git
cd node101-benchmark
npm install
```

---

## Running

```bash
node server.js
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Usage

1. **Select a chain** from the sidebar dropdown.
2. **Enter an RPC endpoint** (or use the default).
3. If the endpoint requires authentication, add headers under **Extra Headers** as a JSON object:
   ```json
   { "project_id": "your-blockfrost-key" }
   ```
4. Set **Duration** (seconds), **Target RPS**, and **Max Concurrency**.
5. Click **Start Benchmark**.
6. Monitor the **Live** tab for real-time charts and KPI cards.
7. Switch to the **Methods** tab for per-method breakdown.
8. After the run completes, click **Export Report** to download an HTML report.

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

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/chains` | Returns all chain configs and their methods |
| `POST` | `/api/benchmark/start` | Starts a new benchmark session |
| `POST` | `/api/benchmark/stop/:sessionId` | Stops a running session |
| `GET` | `/api/benchmark/stream/:sessionId` | SSE stream of live metrics |

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
├── server.js        # Express backend — chain configs, benchmark engine, SSE
├── public/
│   └── index.html   # Single-page frontend — UI, Chart.js graphs, SSE client
└── package.json
```

---

## License

MIT
