export class ProviderError extends Error {
  constructor(message, code, cause) {
    super(message);
    this.name = 'ProviderError';
    this.code = code || 'PROVIDER_ERROR';
    if (cause) this.cause = cause;
  }
}

/**
 * Base interface for audio pipeline providers.
 * Implementations must expose:
 *  - name (string)
 *  - supports(task) => boolean
 *  - execute(payload, options) => { success, data?, error?, meta? }
 */
export default class BaseProvider {
  constructor(name, tasks = []) {
    this.name = name;
    this.tasks = new Set(tasks);
  }

  supports(task) {
    return this.tasks.has(task);
  }

  async execute(_payload, _options = {}) {
    throw new ProviderError('execute() not implemented', 'NOT_IMPLEMENTED');
  }
}
