/** Workers binding types as globals, for cloudflare-env.d.ts (`npm run cf-typegen`).
 *  They come from the module build of @cloudflare/workers-types because the full runtime
 *  types (wrangler's default) redeclare fetch, Response and DOM Element, and the browser code
 *  in this app needs the DOM versions. Add a line here when wrangler.jsonc gains a binding type. */

type D1Database = import('@cloudflare/workers-types').D1Database;
type R2Bucket = import('@cloudflare/workers-types').R2Bucket;
type Fetcher = import('@cloudflare/workers-types').Fetcher;
type ImagesBinding = import('@cloudflare/workers-types').ImagesBinding;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the class type is loose on purpose
type DurableObjectNamespace<T = unknown> = import('@cloudflare/workers-types').DurableObjectNamespace;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Service<T = unknown> = import('@cloudflare/workers-types').Fetcher;
type ExportedHandler<Env = unknown> = import('@cloudflare/workers-types').ExportedHandler<Env>;
type ExecutionContext = import('@cloudflare/workers-types').ExecutionContext;
type IncomingRequestCfProperties = import('@cloudflare/workers-types').IncomingRequestCfProperties;
