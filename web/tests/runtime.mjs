// Next normally aliases this marker in its server build. Tests exercise those same server modules.
import { registerHooks } from 'node:module';
import { AsyncLocalStorage } from 'node:async_hooks';
globalThis.AsyncLocalStorage = AsyncLocalStorage;
// The bot's one Workers runtime module (bot/admin.ts) gets a small stand-in.
const STUB = new URL('./stubs/cloudflare-workers.mjs', import.meta.url).href;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'cloudflare:workers') return { url: STUB, shortCircuit: true };
  return nextResolve(specifier === 'server-only' ? 'next/dist/compiled/server-only/empty.js' : specifier, context);
} });
