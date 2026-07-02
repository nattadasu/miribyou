/**
 * Generic Node HTTP entrypoint — used by the Dockerfile, so this is what
 * runs on Hugging Face Spaces, and equally on Railway/Render/Fly.io/a bare
 * VPS/anywhere else that can run `docker run` or plain `node`/`tsx`.
 *
 * Same shared Hono instance as every other target (see src/app.ts); the
 * only Node-specific bit is binding it to a real TCP port via
 * @hono/node-server and mapping `env` to `process.env`.
 */
import { serve } from "@hono/node-server";

import { app, createFetchHandler } from "./app";

const handler = createFetchHandler(app, { logRequests: true });
const port = Number(process.env.PORT ?? 7860);

serve(
  {
    fetch: (request) => handler.fetch(request, process.env, {}),
    port,
    hostname: "0.0.0.0",
  },
  (info) => {
    console.log(
      `miribyou (node runtime) listening on http://0.0.0.0:${info.port}`,
    );
  },
);
