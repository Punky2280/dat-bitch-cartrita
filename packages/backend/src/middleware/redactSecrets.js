// Middleware to redact likely secrets from JSON/text responses
// Patterns kept lightweight; focus on API keys & tokens.
const SECRET_PATTERNS = [
  /(sk-[A-Za-z0-9]{16,})/g, // OpenAI
  /(ghp_[A-Za-z0-9]{16,})/g, // GitHub personal token
  /(glpat-[A-Za-z0-9_-]{16,})/g, // GitLab
  /(hf_[A-Za-z0-9]{16,})/g, // HuggingFace
  /(AKIA[0-9A-Z]{12,})/g, // AWS access key
  /(AIza[0-9A-Za-z_-]{12,})/g, // Google
  /([A-Za-z0-9_\-]{24,}\.[A-Za-z0-9_\-]{6,}\.[A-Za-z0-9_\-]{20,})/g // JWT-like
];

function redact(value) {
  if (typeof value === 'string') {
    let v = value;
    for (const p of SECRET_PATTERNS) {
      v = v.replace(p, (m) => m.slice(0,4) + '***REDACTED***');
    }
    return v;
  } else if (Array.isArray(value)) {
    return value.map(redact);
  } else if (value && typeof value === 'object') {
    const out = {}; // shallow clone
    for (const k of Object.keys(value)) out[k] = redact(value[k]);
    return out;
  }
  return value;
}

export function redactSecrets(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(redact(body));
  const originalSend = res.send.bind(res);
  res.send = (body) => {
    if (typeof body === 'string') {
      let b = body;
      for (const p of SECRET_PATTERNS) b = b.replace(p, (m) => m.slice(0,4) + '***REDACTED***');
      return originalSend(b);
    }
    return originalSend(body);
  };
  next();
}

export default redactSecrets;
