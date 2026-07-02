/**
 * Bun entrypoint — no Docker required, Bun runs TypeScript natively and,
 * unlike raw Node or Deno, resolves extensionless relative imports out of
 * the box (Bun's resolver is bundler-style, matching this project's
 * `moduleResolution: "Bundler"` — no extra flags needed).
 *
 * Run with:
 *   bun run src/server.bun.ts
 *
 * process.env works the same as under Node, so MAL_CLIENT_ID/PORT are read
 * the same way as every other target.
 */
import { app, createFetchHandler } from "./app";

const handler = createFetchHandler(app);
const port = Number(process.env.PORT ?? 7860);

Bun.serve({
  port,
  hostname: "0.0.0.0",
  fetch: (request) => handler.fetch(request, process.env, {}),
});

console.log(`miribyou (bun runtime) listening on http://0.0.0.0:${port}`);
