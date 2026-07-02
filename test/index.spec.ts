import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("Index Page", () => {
  it("responds with Jikan-like metadata (unit style)", async () => {
    const request = new IncomingRequest("http://example.com/v4");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    const data = (await response.json()) as any;

    expect(data.author_url).toBe("https://github.com/nattadasu");
    expect(data.version).toBe("4.4.2");
    expect(data.production_api_url).toBe("http://example.com/v4/");
    expect(data.myanimelist_heartbeat).toBeDefined();

    // The root path (/v4) should not be cached
    expect(response.headers.get("Cache-Control")).toBeNull();
    expect(response.headers.get("CDN-Cache-Control")).toBeNull();
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toBeNull();

    // Check custom X-Powered-By header
    expect(response.headers.get("X-Powered-By")).toBe("miribyou (Jikan-like)");
  });

  it("responds with Jikan-like metadata (integration style)", async () => {
    const response = await SELF.fetch("https://example.com/v4");
    const data = (await response.json()) as any;

    expect(data.author_url).toBe("https://github.com/nattadasu");
    expect(data.version).toBe("4.4.2");
    expect(data.production_api_url).toBe("https://example.com/v4/");
  });

  it("responds with Jikan-like metadata on root without prefix", async () => {
    const response = await SELF.fetch("https://example.com/");
    const data = (await response.json()) as any;
    expect(response.status).toBe(200);
    expect(data.author_url).toBe("https://github.com/nattadasu");
    expect(data.version).toBe("4.4.2");
  });
});
