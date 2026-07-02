/**
 * Deno entrypoint — no Docker required, Deno runs TypeScript natively.
 *
 * Run with (Deno 2.9+):
 *   deno run --allow-net --allow-env src/server.deno.ts
 */
import { app, createFetchHandler } from "./app.ts";

const handler = createFetchHandler(app, { logRequests: true });
const port = Number(Deno.env.get("PORT") ?? 7860);

Deno.serve({ port, hostname: "0.0.0.0" }, (request) =>
  handler.fetch(request, Deno.env.toObject(), {}),
);

console.log(`miribyou (deno runtime) listening on http://0.0.0.0:${port}`);
