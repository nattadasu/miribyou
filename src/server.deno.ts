/**
 * Deno entrypoint — no Docker required, Deno runs TypeScript natively.
 *
 * Run with (Deno 2.4+):
 *   deno run --allow-net --allow-env --sloppy-imports src/server.deno.ts
 *
 * Why --sloppy-imports: src/app.ts and everything it imports use
 * extensionless relative specifiers (`from "./utils"`, not `from
 * "./utils.ts"`) — that's the `moduleResolution: "Bundler"` style shared
 * with the Cloudflare/Vercel/Node targets, and it's what tsx/webpack/esbuild
 * all expect. Deno's default resolver requires the literal extension on
 * every specifier and will refuse to run the graph without this flag. This
 * file's own import below already carries the extension Deno wants; the
 * flag is only covering the pre-existing app code upstream of it. If you'd
 * rather not use the flag, add explicit `.ts` extensions throughout
 * src/**\/*.ts instead — Deno, Node, and Bun would all be happy with that,
 * only the Cloudflare/Vercel bundlers wouldn't care either way.
 */
import { app, createFetchHandler } from "./app.ts";

const handler = createFetchHandler(app, { logRequests: true });
const port = Number(Deno.env.get("PORT") ?? 7860);

Deno.serve({ port, hostname: "0.0.0.0" }, (request) =>
  handler.fetch(request, Deno.env.toObject(), {}),
);

console.log(`miribyou (deno runtime) listening on http://0.0.0.0:${port}`);
