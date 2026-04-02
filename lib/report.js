// ============================================================
// SERVER-SIDE HTML REPORT GENERATOR
// Offline-capable: Chart.js bundle is embedded inline.
// ============================================================

const CHART_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';

function chartScript(bundle) {
  if (bundle) return `<script>${bundle}<\/script>`;
  return `<script src="${CHART_CDN}"><\/script>`;
}

// Shared dark-theme CSS
const BASE_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0d1117; color: #e6edf3; font-family: 'Segoe UI', system-ui, sans-serif; font-size: 14px; }
.container { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
h1 { font-size: 24px; font-weight: 700; }
h2 { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #8b949e; margin-bottom: 16px; }
.header { border-bottom: 1px solid #30363d; padding-bottom: 24px; margin-bottom: 32px; }
.header-meta { display: flex; flex-wrap: wrap; gap: 24px; margin-top: 12px; font-size: 13px; color: #8b949e; }
.header-meta span { color: #e6edf3; font-weight: 500; }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 32px; }
.kpi { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; }
.kpi-label { font-size: 11px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
.kpi-value { font-size: 28px; font-weight: 700; line-height: 1; }
.kpi-unit { font-size: 12px; color: #8b949e; margin-top: 4px; }
.section { margin-bottom: 36px; }
.chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; }
.chart-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; }
.chart-card.full { grid-column: 1 / -1; }
.chart-title { font-size: 11px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; font-weight: 600; }
.chart-wrap { position: relative; height: 220px; }
.table-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; overflow: hidden; margin-bottom: 24px; }
table { width: 100%; border-collapse: collapse; }
th { background: #21262d; padding: 9px 12px; text-align: left; font-size: 11px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #30363d; white-space: nowrap; }
th.num { text-align: right; }
td { padding: 9px 12px; border-bottom: 1px solid #21262d; font-size: 13px; vertical-align: middle; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(255,255,255,0.02); }
.chain-pill { display: inline-flex; align-items: center; gap: 8px; background: #161b22; border: 1px solid #30363d; border-radius: 20px; padding: 4px 14px 4px 10px; font-weight: 600; font-size: 15px; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
.footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #30363d; font-size: 12px; color: #8b949e; }
.summary-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 32px; }
.summary-box { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 12px 16px; flex: 1; min-width: 160px; }
.summary-box-label { font-size: 11px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
.summary-box-value { font-size: 13px; font-weight: 500; font-family: monospace; word-break: break-all; }
.fail-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; font-size: 12px; }
.fail-bar-fill { height: 8px; border-radius: 4px; min-width: 2px; transition: width 0.3s; }
@media (max-width: 700px) { .chart-grid { grid-template-columns: 1fr; } .kpi-grid { grid-template-columns: repeat(2,1fr); } }
`;

const CHART_DEFAULTS = `
const CD = {
  responsive: true, maintainAspectRatio: false,
  animation: { duration: 0 },
  plugins: {
    legend: { labels: { color: '#8b949e', font: { size: 11 }, boxWidth: 12 } },
    tooltip: {
      mode: 'index', intersect: false,
      backgroundColor: '#161b22', borderColor: '#30363d', borderWidth: 1,
      titleColor: '#e6edf3', bodyColor: '#8b949e', padding: 10,
    }
  },
  scales: {
    x: { ticks: { color: '#8b949e', font: { size: 10 }, maxTicksLimit: 10 }, grid: { color: '#21262d' } },
    y: { ticks: { color: '#8b949e', font: { size: 10 } }, grid: { color: '#21262d' }, beginAtZero: true },
  },
};
function merge(a, b) { return JSON.parse(JSON.stringify(Object.assign({}, a, b, { plugins: Object.assign({}, a.plugins, b.plugins || {}), scales: Object.assign({}, a.scales, b.scales || {}) }))); }
`;

function tooltipAfterBody(tsVarName) {
  return `
    afterBody(items) {
      const idx = items[0].dataIndex;
      const p = ${tsVarName}[idx];
      if (!p) return [];
      const lines = [];
      if (p.requestCount !== undefined) {
        lines.push('Requests: ' + p.requestCount);
        lines.push('Success:  ' + p.successCount);
        lines.push('Failed:   ' + p.failCount);
      }
      if (p.failReasons) {
        const r = Object.entries(p.failReasons).filter(([,v]) => v > 0);
        if (r.length) { lines.push(''); lines.push('Fail reasons:'); r.forEach(([k,v]) => lines.push('  ' + k + ': ' + v)); }
      }
      if (p.latency && p.latency.avg) {
        lines.push('');
        lines.push('avg: ' + p.latency.avg + 'ms  p95: ' + p.latency.p95 + 'ms  p99: ' + p.latency.p99 + 'ms');
      }
      if (p.messagesSent !== undefined) {
        lines.push('Sent: ' + p.messagesSent + '  Recv: ' + p.messagesReceived);
        if (p.timeouts) lines.push('Timeouts: ' + p.timeouts);
      }
      return lines;
    }`;
}

// ── Fail reasons breakdown HTML ────────────────────────────
function failBreakdownSection(failBreakdown, totalErrors) {
  if (!failBreakdown || totalErrors === 0) return '';
  const entries = Object.entries(failBreakdown).filter(([, v]) => v > 0);
  if (!entries.length) return '';
  const labels = { networkError: 'Network Error', latency: 'Latency Threshold', statusCode: 'Status Code', jsonRpcError: 'JSON-RPC Error', httpError: 'HTTP Error' };
  const colors = { networkError: '#f85149', latency: '#d29922', statusCode: '#e3b341', jsonRpcError: '#bc8cff', httpError: '#ff7b72' };

  const rows = entries.map(([k, v]) => {
    const pct = totalErrors ? Math.round((v / totalErrors) * 100) : 0;
    const color = colors[k] || '#8b949e';
    return `
    <tr>
      <td style="font-family:monospace;">${labels[k] || k}</td>
      <td style="text-align:right;color:${color};">${v.toLocaleString()}</td>
      <td style="text-align:right;color:#8b949e;">${pct}%</td>
      <td style="min-width:120px;">
        <div class="fail-bar-fill" style="width:${pct}%;background:${color};height:8px;border-radius:4px;min-width:2px;"></div>
      </td>
    </tr>`;
  }).join('');

  return `
  <div class="section">
    <h2>Fail Reason Breakdown</h2>
    <div class="table-card">
      <div style="overflow-x:auto;">
        <table>
          <thead><tr><th>Reason</th><th class="num">Count</th><th class="num">% of Failures</th><th>Distribution</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>`;
}

// ============================================================
// BENCHMARK REPORT
// ============================================================

export function buildBenchmarkReport(s, chartJsBundle = null) {
  const chainColor = s.chainColor || '#58a6ff';
  const ts = new Date(s.timestamp);
  const successTotal = (s.totalRequests || 0) - (s.totalErrors || 0);
  const successRate = s.totalRequests ? (100 - parseFloat(s.errorRate)).toFixed(1) : '0.0';
  const errRateColor = parseFloat(s.errorRate) > 5 ? '#f85149' : parseFloat(s.errorRate) > 1 ? '#d29922' : '#3fb950';

  // Method table
  const catColors = { light: '#3fb950', medium: '#d29922', heavy: '#f85149' };
  const palette = ['#58a6ff','#3fb950','#d29922','#f85149','#bc8cff','#00d4aa','#ff7b72','#ffa657','#79c0ff','#56d364'];
  const methods = Object.keys(s.methodBreakdown || {});

  const methodRows = methods.map(name => {
    const m = s.methodBreakdown[name];
    if (!m.requests) return '';
    const cat = m.category || 'unknown';
    const catColor = catColors[cat] || '#8b949e';
    const errPct = parseFloat(m.errorRate);
    const errColor = errPct > 5 ? '#f85149' : errPct > 1 ? '#d29922' : '#3fb950';
    const frEntries = Object.entries(m.failReasons || {}).filter(([,v]) => v > 0).map(([k,v]) => `${k}:${v}`).join(' ');
    return `<tr>
      <td style="font-family:monospace;font-size:11px;">${name}</td>
      <td><span class="badge" style="background:${catColor}22;color:${catColor};">${cat}</span></td>
      <td style="text-align:right;">${m.requests.toLocaleString()}</td>
      <td style="text-align:right;color:#3fb950;">${(m.requests - m.errors).toLocaleString()}</td>
      <td style="text-align:right;color:#3fb950;">${(100 - errPct).toFixed(1)}%</td>
      <td style="text-align:right;color:${m.errors > 0 ? '#f85149' : '#8b949e'};">${m.errors.toLocaleString()}</td>
      <td style="text-align:right;color:${errColor};">${m.errorRate}%</td>
      <td style="text-align:right;color:#3fb950;">${m.p50}</td>
      <td style="text-align:right;color:#d29922;">${m.p95}</td>
      <td style="text-align:right;color:#f85149;">${m.p99}</td>
      <td style="text-align:right;">${m.avg}</td>
      <td style="text-align:right;color:#8b949e;">${m.min}</td>
      <td style="text-align:right;color:#8b949e;">${m.max}</td>
      <td style="font-size:11px;color:#8b949e;font-family:monospace;">${frEntries || '—'}</td>
    </tr>`;
  }).join('');

  const timeSeries = s.timeSeries || [];
  const tsLabels = timeSeries.map(p => `${p.elapsed}s`);
  const tsRPS    = timeSeries.map(p => p.rps || 0);
  const tsP50    = timeSeries.map(p => p.latency?.p50 || 0);
  const tsP95    = timeSeries.map(p => p.latency?.p95 || 0);
  const tsP99    = timeSeries.map(p => p.latency?.p99 || 0);
  const tsErr    = timeSeries.map(p => parseFloat(p.errorRate) || 0);

  const pieLabels = JSON.stringify(methods);
  const pieData   = JSON.stringify(methods.map(n => s.methodBreakdown[n]?.requests || 0));
  const pieColors = JSON.stringify(methods.map((_, i) => palette[i % palette.length]));
  const barP50    = JSON.stringify(methods.map(n => s.methodBreakdown[n]?.p50 || 0));
  const barP95    = JSON.stringify(methods.map(n => s.methodBreakdown[n]?.p95 || 0));
  const barP99    = JSON.stringify(methods.map(n => s.methodBreakdown[n]?.p99 || 0));

  const thresholdInfo = s.config?.thresholds
    ? Object.entries(s.config.thresholds).filter(([,v]) => v !== null && v !== undefined)
        .map(([k,v]) => `${k}: ${v}`).join(' | ')
    : 'None';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Benchmark Report — ${s.chainName} — ${ts.toLocaleString()}</title>
${chartScript(chartJsBundle)}
<style>${BASE_CSS}</style>
</head>
<body>
<div class="container">

  <div class="header">
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      <h1>Benchmark Report</h1>
      <div class="chain-pill">
        <span class="dot" style="background:${chainColor};"></span>
        ${s.chainName}
      </div>
    </div>
    <div class="header-meta">
      <div>Date <span>${ts.toLocaleString()}</span></div>
      <div>Duration <span>${s.duration}s</span></div>
      <div>Target RPS <span>${s.config?.targetRPS || '—'}</span></div>
      <div>Max Concurrency <span>${s.config?.concurrency || '—'}</span></div>
      <div>Fail Thresholds <span>${thresholdInfo}</span></div>
    </div>
  </div>

  <div class="section">
    <h2>Configuration</h2>
    <div class="summary-row">
      <div class="summary-box"><div class="summary-box-label">Endpoint</div><div class="summary-box-value">${s.endpoint}</div></div>
      <div class="summary-box"><div class="summary-box-label">Chain</div><div class="summary-box-value">${s.chainName} (${s.chainId})</div></div>
      <div class="summary-box"><div class="summary-box-label">Duration</div><div class="summary-box-value">${s.duration} seconds</div></div>
      <div class="summary-box"><div class="summary-box-label">Target RPS</div><div class="summary-box-value">${s.config?.targetRPS || '—'}</div></div>
      <div class="summary-box"><div class="summary-box-label">Max Concurrency</div><div class="summary-box-value">${s.config?.concurrency || '—'}</div></div>
    </div>
  </div>

  <div class="section">
    <h2>Summary Metrics</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Avg RPS</div><div class="kpi-value" style="color:#58a6ff;">${s.avgRPS}</div><div class="kpi-unit">req / sec</div></div>
      <div class="kpi"><div class="kpi-label">Total Requests</div><div class="kpi-value" style="color:#58a6ff;">${(s.totalRequests || 0).toLocaleString()}</div><div class="kpi-unit">total</div></div>
      <div class="kpi"><div class="kpi-label">Successful</div><div class="kpi-value" style="color:#3fb950;">${successTotal.toLocaleString()}</div><div class="kpi-unit">${successRate}% success</div></div>
      <div class="kpi"><div class="kpi-label">Errors</div><div class="kpi-value" style="color:${errRateColor};">${(s.totalErrors || 0).toLocaleString()}</div><div class="kpi-unit">${s.errorRate}% error rate</div></div>
      <div class="kpi"><div class="kpi-label">p50 Latency</div><div class="kpi-value" style="color:#3fb950;">${s.latency?.p50 ?? '—'}</div><div class="kpi-unit">ms (median)</div></div>
      <div class="kpi"><div class="kpi-label">p95 Latency</div><div class="kpi-value" style="color:#d29922;">${s.latency?.p95 ?? '—'}</div><div class="kpi-unit">ms</div></div>
      <div class="kpi"><div class="kpi-label">p99 Latency</div><div class="kpi-value" style="color:#f85149;">${s.latency?.p99 ?? '—'}</div><div class="kpi-unit">ms (tail)</div></div>
      <div class="kpi"><div class="kpi-label">Avg Latency</div><div class="kpi-value">${s.latency?.avg ?? '—'}</div><div class="kpi-unit">ms</div></div>
      <div class="kpi"><div class="kpi-label">Min Latency</div><div class="kpi-value" style="color:#3fb950;">${s.latency?.min ?? '—'}</div><div class="kpi-unit">ms</div></div>
      <div class="kpi"><div class="kpi-label">Max Latency</div><div class="kpi-value" style="color:#f85149;">${s.latency?.max ?? '—'}</div><div class="kpi-unit">ms</div></div>
    </div>
  </div>

  ${failBreakdownSection(s.failBreakdown, s.totalErrors)}

  <div class="section">
    <h2>Time Series</h2>
    <div class="chart-grid">
      <div class="chart-card">
        <div class="chart-title">Requests Per Second</div>
        <div class="chart-wrap"><canvas id="rpsChart"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Latency Percentiles (ms)</div>
        <div class="chart-wrap"><canvas id="latencyChart"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Error Rate (%)</div>
        <div class="chart-wrap"><canvas id="errorChart"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Method Distribution</div>
        <div class="chart-wrap"><canvas id="pieChart"></canvas></div>
      </div>
    </div>
    <div class="chart-grid">
      <div class="chart-card full">
        <div class="chart-title">Latency by Method — p50 / p95 / p99</div>
        <div class="chart-wrap" style="height:280px;"><canvas id="methodLatencyChart"></canvas></div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Method Breakdown</h2>
    <div class="table-card">
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>Method</th><th>Category</th>
              <th class="num">Requests</th><th class="num">Success</th><th class="num">Success%</th>
              <th class="num">Errors</th><th class="num">Err%</th>
              <th class="num">p50</th><th class="num">p95</th><th class="num">p99</th>
              <th class="num">avg</th><th class="num">min</th><th class="num">max</th>
              <th>Fail Reasons</th>
            </tr>
          </thead>
          <tbody>${methodRows}</tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="footer">node101-benchmark · Generated ${ts.toLocaleString()}</div>
</div>

<script>
${CHART_DEFAULTS}
const TS = ${JSON.stringify(timeSeries)};
const tsLabels = ${JSON.stringify(tsLabels)};

const tooltipPlugin = {
  tooltip: Object.assign({}, CD.plugins.tooltip, {
    callbacks: {
      ${tooltipAfterBody('TS')}
    }
  })
};

// RPS chart
new Chart(document.getElementById('rpsChart'), {
  type: 'line',
  data: {
    labels: tsLabels,
    datasets: [{ label: 'RPS', data: ${JSON.stringify(tsRPS)}, borderColor: '#58a6ff', backgroundColor: 'rgba(88,166,255,0.08)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.5 }]
  },
  options: merge(CD, { plugins: tooltipPlugin })
});

// Latency chart
new Chart(document.getElementById('latencyChart'), {
  type: 'line',
  data: {
    labels: tsLabels,
    datasets: [
      { label: 'p50', data: ${JSON.stringify(tsP50)}, borderColor: '#3fb950', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
      { label: 'p95', data: ${JSON.stringify(tsP95)}, borderColor: '#d29922', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
      { label: 'p99', data: ${JSON.stringify(tsP99)}, borderColor: '#f85149', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
    ]
  },
  options: merge(CD, { plugins: tooltipPlugin })
});

// Error chart
new Chart(document.getElementById('errorChart'), {
  type: 'line',
  data: {
    labels: tsLabels,
    datasets: [{ label: 'Error %', data: ${JSON.stringify(tsErr)}, borderColor: '#f85149', backgroundColor: 'rgba(248,81,73,0.08)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.5 }]
  },
  options: merge(CD, { plugins: tooltipPlugin })
});

// Method pie
new Chart(document.getElementById('pieChart'), {
  type: 'doughnut',
  data: { labels: ${pieLabels}, datasets: [{ data: ${pieData}, backgroundColor: ${pieColors}, borderWidth: 0 }] },
  options: { responsive: true, maintainAspectRatio: false, animation: { duration: 0 }, plugins: { legend: { position: 'right', labels: { color: '#8b949e', font: { size: 11 } } } } }
});

// Method latency bar
new Chart(document.getElementById('methodLatencyChart'), {
  type: 'bar',
  data: {
    labels: ${pieLabels},
    datasets: [
      { label: 'p50', data: ${barP50}, backgroundColor: 'rgba(63,185,80,0.7)', borderRadius: 3 },
      { label: 'p95', data: ${barP95}, backgroundColor: 'rgba(210,153,34,0.7)', borderRadius: 3 },
      { label: 'p99', data: ${barP99}, backgroundColor: 'rgba(248,81,73,0.7)', borderRadius: 3 },
    ]
  },
  options: merge(CD, { scales: { x: { ticks: { color: '#8b949e', font: { size: 10 } }, grid: { color: '#21262d' } }, y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' }, beginAtZero: true } } })
});
<\/script>
</body>
</html>`;
}

// ============================================================
// WEBSOCKET REPORT
// ============================================================

export function buildWebSocketReport(s, chartJsBundle = null) {
  const ts = new Date(s.timestamp);
  const timeSeries = s.timeSeries || [];
  const tsLabels = timeSeries.map(p => `${p.elapsed}s`);

  const successRate = s.messagesSent > 0
    ? ((s.messagesReceived / s.messagesSent) * 100).toFixed(1)
    : '0.0';

  const connSuccessRate = s.connectionAttempts > 0
    ? ((s.connectionSuccesses / s.connectionAttempts) * 100).toFixed(1)
    : '0.0';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WebSocket Report — ${s.endpoint} — ${ts.toLocaleString()}</title>
${chartScript(chartJsBundle)}
<style>${BASE_CSS}</style>
</head>
<body>
<div class="container">

  <div class="header">
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      <h1>WebSocket Benchmark Report</h1>
      <div class="chain-pill"><span class="dot" style="background:#4da2ff;"></span>WebSocket</div>
    </div>
    <div class="header-meta">
      <div>Date <span>${ts.toLocaleString()}</span></div>
      <div>Mode <span>${s.wsMode || 'jsonrpc'}</span></div>
      <div>Duration <span>${s.duration}s</span></div>
      <div>Connections <span>${s.connections}</span></div>
      <div>Rate/Conn <span>${s.config?.ratePerConn || '—'} msg/s</span></div>
    </div>
  </div>

  <div class="section">
    <h2>Configuration</h2>
    <div class="summary-row">
      <div class="summary-box"><div class="summary-box-label">Endpoint</div><div class="summary-box-value">${s.endpoint}</div></div>
      <div class="summary-box"><div class="summary-box-label">Mode</div><div class="summary-box-value">${s.wsMode}</div></div>
      <div class="summary-box"><div class="summary-box-label">Connections</div><div class="summary-box-value">${s.connections}</div></div>
      <div class="summary-box"><div class="summary-box-label">Duration</div><div class="summary-box-value">${s.duration}s</div></div>
    </div>
  </div>

  <div class="section">
    <h2>Connection Metrics</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Connection Attempts</div><div class="kpi-value" style="color:#58a6ff;">${s.connectionAttempts}</div></div>
      <div class="kpi"><div class="kpi-label">Successful</div><div class="kpi-value" style="color:#3fb950;">${s.connectionSuccesses}</div><div class="kpi-unit">${connSuccessRate}%</div></div>
      <div class="kpi"><div class="kpi-label">Failed</div><div class="kpi-value" style="color:${s.connectionFailures > 0 ? '#f85149' : '#8b949e'};">${s.connectionFailures}</div></div>
      <div class="kpi"><div class="kpi-label">Disconnects</div><div class="kpi-value" style="color:#d29922;">${s.disconnects}</div></div>
      <div class="kpi"><div class="kpi-label">Reconnects</div><div class="kpi-value">${s.reconnects}</div></div>
    </div>
  </div>

  <div class="section">
    <h2>Message Metrics</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-label">Messages Sent</div><div class="kpi-value" style="color:#58a6ff;">${(s.messagesSent || 0).toLocaleString()}</div></div>
      <div class="kpi"><div class="kpi-label">Messages Received</div><div class="kpi-value" style="color:#3fb950;">${(s.messagesReceived || 0).toLocaleString()}</div><div class="kpi-unit">${successRate}% delivery</div></div>
      <div class="kpi"><div class="kpi-label">Avg Throughput</div><div class="kpi-value" style="color:#58a6ff;">${s.avgThroughput}</div><div class="kpi-unit">msg/s received</div></div>
      <div class="kpi"><div class="kpi-label">Timeouts</div><div class="kpi-value" style="color:${s.timeouts > 0 ? '#f85149' : '#8b949e'};">${s.timeouts}</div></div>
      <div class="kpi"><div class="kpi-label">Validation Fails</div><div class="kpi-value" style="color:${s.validationFails > 0 ? '#d29922' : '#8b949e'};">${s.validationFails}</div></div>
      <div class="kpi"><div class="kpi-label">p50 Latency</div><div class="kpi-value" style="color:#3fb950;">${s.latency?.p50 ?? '—'}</div><div class="kpi-unit">ms roundtrip</div></div>
      <div class="kpi"><div class="kpi-label">p95 Latency</div><div class="kpi-value" style="color:#d29922;">${s.latency?.p95 ?? '—'}</div><div class="kpi-unit">ms</div></div>
      <div class="kpi"><div class="kpi-label">p99 Latency</div><div class="kpi-value" style="color:#f85149;">${s.latency?.p99 ?? '—'}</div><div class="kpi-unit">ms</div></div>
    </div>
  </div>

  <div class="section">
    <h2>Time Series</h2>
    <div class="chart-grid">
      <div class="chart-card">
        <div class="chart-title">Messages / second</div>
        <div class="chart-wrap"><canvas id="msgChart"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Roundtrip Latency (ms)</div>
        <div class="chart-wrap"><canvas id="latChart"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Errors &amp; Timeouts</div>
        <div class="chart-wrap"><canvas id="errChart"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Active Connections</div>
        <div class="chart-wrap"><canvas id="connChart"></canvas></div>
      </div>
    </div>
  </div>

  <div class="footer">node101-benchmark · WebSocket Report · Generated ${ts.toLocaleString()}</div>
</div>

<script>
${CHART_DEFAULTS}
const TS = ${JSON.stringify(timeSeries)};
const tsLabels = ${JSON.stringify(tsLabels)};
const tooltipPlugin = {
  tooltip: Object.assign({}, CD.plugins.tooltip, {
    callbacks: { ${tooltipAfterBody('TS')} }
  })
};

new Chart(document.getElementById('msgChart'), {
  type: 'line',
  data: {
    labels: tsLabels,
    datasets: [
      { label: 'Sent', data: TS.map(p => p.messagesSent), borderColor: '#58a6ff', backgroundColor: 'rgba(88,166,255,0.08)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
      { label: 'Received', data: TS.map(p => p.messagesReceived), borderColor: '#3fb950', backgroundColor: 'rgba(63,185,80,0.08)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
    ]
  },
  options: merge(CD, { plugins: tooltipPlugin })
});

new Chart(document.getElementById('latChart'), {
  type: 'line',
  data: {
    labels: tsLabels,
    datasets: [
      { label: 'p50', data: TS.map(p => p.latency?.p50 || 0), borderColor: '#3fb950', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
      { label: 'p95', data: TS.map(p => p.latency?.p95 || 0), borderColor: '#d29922', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
      { label: 'p99', data: TS.map(p => p.latency?.p99 || 0), borderColor: '#f85149', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
    ]
  },
  options: merge(CD, { plugins: tooltipPlugin })
});

new Chart(document.getElementById('errChart'), {
  type: 'bar',
  data: {
    labels: tsLabels,
    datasets: [
      { label: 'Errors', data: TS.map(p => p.errors || 0), backgroundColor: 'rgba(248,81,73,0.7)', borderRadius: 2 },
      { label: 'Timeouts', data: TS.map(p => p.timeouts || 0), backgroundColor: 'rgba(210,153,34,0.7)', borderRadius: 2 },
    ]
  },
  options: merge(CD, { plugins: tooltipPlugin })
});

new Chart(document.getElementById('connChart'), {
  type: 'line',
  data: {
    labels: tsLabels,
    datasets: [{ label: 'Connections', data: TS.map(p => p.connections || 0), borderColor: '#bc8cff', backgroundColor: 'rgba(188,140,255,0.08)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.5 }]
  },
  options: merge(CD, { plugins: tooltipPlugin })
});
<\/script>
</body>
</html>`;
}
