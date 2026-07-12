const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });

export function fmtMoney(value, { sign = false } = {}) {
  const n = Number.isFinite(Number(value)) ? Number(value) : 0;
  const formatted = AUD.format(Math.abs(n));
  if (sign && n > 0) return `+${formatted}`;
  if (n < 0) return `-${formatted}`;
  return formatted;
}

export function fmtOdds(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return n.toFixed(2);
}

export function fmtPct(value, { decimals = 2 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(decimals)}%`;
}

export function fmtProb(value, { decimals = 2 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(decimals)}%`;
}

export function fmtNum(value, { decimals = 2 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(decimals);
}

export function fmtCompact(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

export function fmtAge(timestamp) {
  if (!timestamp) return '—';
  const ms = Date.now() - new Date(timestamp).getTime();
  if (ms < 0) return 'just now';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function fmtTime(timestamp) {
  if (!timestamp) return '—';
  try {
    return new Date(timestamp).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return '—'; }
}

export function plClass(value) {
  const n = Number(value);
  if (n > 0) return 'text-success';
  if (n < 0) return 'text-danger';
  return 'text-muted-foreground';
}