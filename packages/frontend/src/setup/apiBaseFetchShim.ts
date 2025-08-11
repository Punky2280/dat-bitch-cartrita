import { API_BASE_URL } from '../config/constants';

const ORIGINAL_FETCH: typeof fetch = window.fetch.bind(window);

function needsRewrite(input: RequestInfo | URL): boolean {
  return typeof input === 'string' && input.startsWith('/api/');
}

if (!(window as any).__API_BASE_SHIM_INSTALLED__) {
  (window as any).__API_BASE_SHIM_INSTALLED__ = true;
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (needsRewrite(input)) {
      const url = `${API_BASE_URL}${input}`;
      return ORIGINAL_FETCH(url, init);
    }
    return ORIGINAL_FETCH(input, init);
  }) as any;
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[apiBaseFetchShim] /api/* ->', API_BASE_URL);
  }
}

export {};
