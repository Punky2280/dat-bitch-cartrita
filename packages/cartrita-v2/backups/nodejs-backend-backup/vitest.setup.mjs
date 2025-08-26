// Vitest setup: minimize external service initialization
process.env.LIGHTWEIGHT_TEST = '1';
process.env.USE_COMPOSITE_REGISTRY = '1';
process.env.REGISTRY_PHASE_MAX = '0';
process.env.MINIMAL_REGISTRY = '1';
process.env.REGISTRY_EMBED = '0'; // disable embeddings during unit tests

// Stub OpenAI API if accidentally invoked
import Module from 'module';
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'openai') {
    return {
      OpenAI: class {
        embeddings = {
          create: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
        };
      },
    };
  }
  return originalLoad(request, parent, isMain);
};
