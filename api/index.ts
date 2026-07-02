/**
 * Vercel entrypoint (Node.js runtime by default). Vercel auto-detects any
 * `export default` under /api that exposes a Web-standard `fetch(request)`
 * and wires it up as a Function — no @hono/vercel adapter needed for
 * current Vercel builds.
 *
 * `env` here is `process.env`, exactly like the Docker/Node target in
 * src/server.ts — the route handlers in src/app.ts read `c.env.MAL_CLIENT_ID`
 * the same way regardless of which platform is calling them.
 */
import { app, createFetchHandler } from "../src/app";

const handler = createFetchHandler(app);

export default {
  fetch: (request: Request) => handler.fetch(request, process.env, {}),
};

// Force the Node.js runtime (not Edge): cheerio and some parsers rely on
// Node APIs that aren't available in Vercel's Edge runtime.
export const config = {
  runtime: "nodejs",
};
