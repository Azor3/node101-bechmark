import nodemailer from 'nodemailer';

// ============================================================
// MAILER  — SMTP-based report delivery
// ============================================================

export function getMailConfig() {
  return {
    enabled: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.MAIL_TO),
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: process.env.MAIL_TO,
    subjectTemplate: process.env.MAIL_SUBJECT || 'Benchmark Report: {chain} — {date}',
  };
}

function buildSubject(template, summary) {
  const chain = summary.chainName || summary.endpoint || (summary.type === 'websocket' ? 'WebSocket' : 'Custom REST');
  const date = new Date(summary.timestamp).toLocaleString();
  return template.replace('{chain}', chain).replace('{date}', date);
}

function buildFilename(summary) {
  const label = (summary.chainName || summary.type || 'benchmark')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/gi, '').toLowerCase();
  const ts = new Date(summary.timestamp).toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `benchmark-${label}-${ts}.html`;
}

function buildBodyHtml(summary) {
  const isWs = summary.type === 'websocket';
  const rows = isWs
    ? [
        ['Endpoint', summary.endpoint],
        ['Duration', `${summary.duration}s`],
        ['Connections', summary.connections],
        ['Messages Sent', summary.messagesSent?.toLocaleString()],
        ['Messages Received', summary.messagesReceived?.toLocaleString()],
        ['Avg Throughput', `${summary.avgThroughput} msg/s`],
        ['p95 Latency', `${summary.latency?.p95}ms`],
        ['Timeouts', summary.timeouts],
      ]
    : [
        ['Chain', summary.chainName],
        ['Endpoint', summary.endpoint],
        ['Duration', `${summary.duration}s`],
        ['Total Requests', summary.totalRequests?.toLocaleString()],
        ['Avg RPS', summary.avgRPS],
        ['p95 Latency', `${summary.latency?.p95}ms`],
        ['p99 Latency', `${summary.latency?.p99}ms`],
        ['Error Rate', `${summary.errorRate}%`],
      ];

  const tableRows = rows.map(([k, v]) => `<tr><td style="padding:6px 12px;color:#8b949e;">${k}</td><td style="padding:6px 12px;font-weight:600;">${v ?? '—'}</td></tr>`).join('');

  return `
<!DOCTYPE html><html><body style="background:#0d1117;color:#e6edf3;font-family:system-ui,sans-serif;padding:32px;margin:0;">
  <h2 style="margin:0 0 8px;">Benchmark Complete</h2>
  <p style="color:#8b949e;margin:0 0 24px;">The full report is attached. Summary:</p>
  <table style="border-collapse:collapse;background:#161b22;border:1px solid #30363d;border-radius:8px;overflow:hidden;">${tableRows}</table>
  <p style="margin-top:24px;color:#8b949e;font-size:12px;">Sent by node101-benchmark</p>
</body></html>`;
}

// emailTo overrides env MAIL_TO when provided from the UI
export async function sendReportEmail(summary, htmlReport, emailTo = null, maxRetries = 2) {
  const cfg = getMailConfig();
  const recipient = emailTo || cfg.to;

  if (!cfg.host || !cfg.user) {
    console.log('[mailer] SMTP not configured (SMTP_HOST / SMTP_USER missing). Skipping email.');
    return { skipped: true };
  }
  if (!recipient) {
    console.log('[mailer] No recipient address. Skipping email.');
    return { skipped: true };
  }

  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const mailOptions = {
    from: cfg.from || cfg.user,
    to: recipient,
    subject: buildSubject(cfg.subjectTemplate, summary),
    html: buildBodyHtml(summary),
    attachments: [{
      filename: buildFilename(summary),
      content: htmlReport,
      contentType: 'text/html',
    }],
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const info = await transport.sendMail(mailOptions);
      console.log(`[mailer] Report sent to ${cfg.to} (msgId: ${info.messageId})`);
      return { ok: true, messageId: info.messageId };
    } catch (err) {
      console.error(`[mailer] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${err.message}`);
      if (attempt === maxRetries) {
        console.error('[mailer] All retries exhausted. Report not sent.');
        return { ok: false, error: err.message };
      }
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
}
