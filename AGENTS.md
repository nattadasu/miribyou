# miribyou MAL Scraper as REST API

As `miribyou` is a "lightweight" implementation of Jikan.moe v4 API in TypeScript and tried its best to not dependent on any database solution but let Cloudflare caches the response, you must follow following checkups:

- [ ] Cloned [jikan-me/jikan-rest](https://github.com/jikan-me/jikan-rest) with a depth of 1 as `jikan_rest_ref/`, or if the repo already cloned, fetch and pull any changes from upstream
- [ ] Follow Jikan REST documentation to maintain structure and data parity to Jikan. Read [OpenAPI Spec](https://raw.githubusercontent.com/jikan-me/jikan-rest/master/storage/api-docs/api-docs.json)
- [ ] Ensure you have generated `wrangler types`, and all files must be formatted with prettier (current default config is OK) and linted

## Note on slight data deviation

When comparing to live Jikan data, a slight deviation to the value (specifically over int/float for any kind of statistics) may be expected. When you encountered that, ensure that the deviation is not surpassed 20% than expected value, otherwise it should be considered as passed.

Additionally, when specific data (usually on any type's search query) is not possible to be provided by regular HTML scrape but needs to be backed up by DB, e.g. Jikan has English and Native/Japanese title while MAL HTML response is impossible to fetch those, simply null it. We maintain a complete struct parity to Jikan, but we should not add or delete any keys that isn't defined by Jikan output.

---

# Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page. eg. `/workers/platform/limits`

## Commands

| Command               | Purpose                   |
| --------------------- | ------------------------- |
| `npx wrangler dev`    | Local development         |
| `npx wrangler deploy` | Deploy to Cloudflare      |
| `npx wrangler types`  | Generate TypeScript types |

Run `wrangler types` after changing bindings in wrangler.jsonc.

## Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

## Product Docs

Retrieve API references and limits from:
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

## Best Practices (conditional)

If the application uses Durable Objects or Workflows, refer to the relevant best practices:

- Durable Objects: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Workflows: https://developers.cloudflare.com/workflows/build/rules-of-workflows/
