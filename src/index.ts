/**
 * Cloudflare Workers entrypoint. Referenced by wrangler.jsonc's `main`.
 *
 * All actual routes/logic live in ./app — this file only adapts the shared
 * Hono instance to the Workers module-worker export shape.
 */
import { app, createFetchHandler } from "./app";

export default createFetchHandler(app);
