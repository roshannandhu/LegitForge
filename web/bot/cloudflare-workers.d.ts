/** The one runtime module the bot uses (bot/admin.ts). Declared here, not from
 *  @cloudflare/workers-types: its full runtime types redeclare fetch and Response for the whole
 *  project (see CLAUDE.md, "Binding types"). Tests load tests/stubs/cloudflare-workers.mjs. */
declare module 'cloudflare:workers' {
  export abstract class WorkerEntrypoint<Env = unknown> {
    protected ctx: ExecutionContext;
    protected env: Env;
    constructor(ctx: ExecutionContext, env: Env);
  }
}
