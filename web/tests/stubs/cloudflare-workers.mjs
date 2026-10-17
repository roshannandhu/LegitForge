// What tests need of the Workers runtime module (bot/admin.ts): an entrypoint keeps ctx and env.
export class WorkerEntrypoint {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
}
