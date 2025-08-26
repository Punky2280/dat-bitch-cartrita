// Middleware to redact likely secrets from JSON/text responses
// Patterns kept lightweight; focus on API keys & tokens.
const SECRET_PATTERNS = [
  /(sk-[A-Za-z0-9]{16,})/g, // OpenAI
  /(ghp_[A-Za-z0-9]{16,})/g, // GitHub personal token
  /(glpat-[A-Za-z0-9_-]{16,})/g, // GitLab
  /(hf_[A-Za-z0-9]{16,})/g, // HuggingFace
  /(AKIA[0-9A-Z]{12,})/g, // AWS access key
  /(AIza[0-9A-Za-z_-]{12,})/g, // Google
  /([A-Za-z0-9_\-]{24,}\.[A-Za-z0-9_\-]{6,}\.[A-Za-z0-9_\-]{20,})/g, // JWT-like
];

function redact(value) {
  if (typeof value === 'string') {
    let v = value;
    for (const p of SECRET_PATTERNS) {
      v = v.replace(p, m => m.slice(0, 4) + '***REDACTED***');
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
  // Skip redaction for authentication endpoints to allow JWT tokens
  const isAuthEndpoint =
    req.path.includes('/auth/') ||
    req.path.includes('/login') ||
    req.path.includes('/register');

  if (isAuthEndpoint) {
    // Don't redact JWT tokens in auth responses, but still redact other secrets
    const authSafeRedact = value => {
      if (typeof value === 'string') {
        let v = value;
        // Apply all patterns except JWT-like pattern
        for (let i = 0; i < SECRET_PATTERNS.length - 1; i++) {
          const p = SECRET_PATTERNS[i];
          v = v.replace(p, m => m.slice(0, 4) + '***REDACTED***');
        }
        return v;
      } else if (Array.isArray(value)) {
        return value.map(authSafeRedact);
      } else if (value && typeof value === 'object') {
        const out = {};
        for (const k of Object.keys(value)) {
          // Don't redact the 'token' field in auth responses
          if (k === 'token') {
            out[k] = value[k];
          } else {
            out[k] = authSafeRedact(value[k]);
          }
        }
        return out;
      }
      return value;
    };

    const originalJson = res.json.bind(res);
    res.json = body => originalJson(authSafeRedact(body));
    const originalSend = res.send.bind(res);
    res.send = body => {
      if (typeof body === 'string') {
        let b = body;
        // Apply non-JWT patterns only
        for (let i = 0; i < SECRET_PATTERNS.length - 1; i++) {
          const p = SECRET_PATTERNS[i];
          b = b.replace(p, m => m.slice(0, 4) + '***REDACTED***');
        }
        return originalSend(b);
      }
      return originalSend(body);
    };
  } else {
    // Apply full redaction for non-auth endpoints
    const originalJson = res.json.bind(res);
    res.json = body => originalJson(redact(body));
    const originalSend = res.send.bind(res);
    res.send = body => {
      if (typeof body === 'string') {
        let b = body;
        for (const p of SECRET_PATTERNS)
          b = b.replace(p, m => m.slice(0, 4) + '***REDACTED***');
        return originalSend(b);
      }
      return originalSend(body);
    };
  }

  next();
}

export default redactSecrets;
