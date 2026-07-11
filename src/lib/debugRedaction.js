const SENSITIVE_KEY = /password|sessiontoken|betfairsessiontoken|appkey|apikey|openaikey|openaiapikey|featherlessapikey|authorization|bearer|token|secret|cookie|refresh.?token|access.?token/i;
const REDACTED = '[REDACTED]';

function redactString(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.length < 2000000) {
    try { return JSON.stringify(deepRedact(JSON.parse(trimmed))); } catch (_) {}
  }
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, REDACTED)
    .replace(/(password|sessionToken|betfairSessionToken|appKey|apiKey|openAiApiKey|featherlessApiKey|authorization|refreshToken|accessToken|secret|cookie)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]');
}

export function deepRedact(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) { const result=value.map(item => deepRedact(item, seen)); seen.delete(value); return result; }
  const result=Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? REDACTED : deepRedact(item, seen)]));
  seen.delete(value);
  return result;
}

export function containsCredentialMaterial(value) {
  const text = JSON.stringify(value);
  return /Bearer\s+(?!\[REDACTED\])|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(text);
}

export { REDACTED };