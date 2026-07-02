# miribyou

`miribyou` is a lightweight, database-free MyAnimeList (MAL) scraper that
provides structure and data parity with the [Jikan v4 API](https://jikan.moe).

`miribyou` requires no database setup, and the API itself is **platform-agnostic**:
the entire route surface lives in a single portable [Hono](https://hono.dev) app
(`src/app.ts`), with thin per-platform adapters on top. It runs unmodified on
Cloudflare Workers, Vercel Functions, or any Docker/Node host—pick whichever fits
your rate limits, budget, or CPU-time needs. It achieves high-fidelity JSON output
by parsing MAL's HTML directly, optionally enhanced by the official MAL API.

---

<p align="center">
  <img src="https://img.shields.io/github/package-json/v/nattadasu/miribyou" alt="Version" />
  <img src="https://img.shields.io/github/license/nattadasu/miribyou" alt="License" />
  <img src="https://img.shields.io/github/stars/nattadasu/miribyou" alt="Stars" />
  <img src="https://img.shields.io/github/issues/nattadasu/miribyou" alt="Issues" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white" alt="Hono" />
  <img src="https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white" alt="Vitest" />
  <a href="https://nttds.my.id/discord">
    <img src="https://img.shields.io/badge/Join_our_Discord-5865F2?logo=discord&logoColor=white" alt="Discord" />
  </a>
</p>

<p align="center">
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/nattadasu/miribyou">
    <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare Workers" height="32" />
  </a>
  <a href="https://vercel.com/import/project?template=https://github.com/nattadasu/miribyou">
    <img src="https://vercel.com/button" alt="Deploy with Vercel" />
  </a>
  <a href="https://render.com/deploy?repo=https://github.com/nattadasu/miribyou">
    <img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" height="32" />
  </a>
  <a href="https://app.koyeb.com/deploy?type=git&repository=nattadasu%2Fmiribyou&branch=main&builder=dockerfile&name=miribyou">
    <img src="https://www.koyeb.com/static/images/deploy/button.svg" alt="Deploy on Koyeb" height="32" />
  </a>
</p>

> [!IMPORTANT]
> This project aims for parity with Jikan V4 data structures and versioning.
> All endpoints are prefixed with `/v4`.

> [!WARNING]
> Because `miribyou` does not rely on a persistent database, some advanced
> search or filtering queries may return stub/partial data. Providing a
> `MAL_CLIENT_ID` helps resolve many of these limitations.

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/nattadasu/miribyou.git
cd miribyou
npm install    # or: bun install

# Run with any of these (all work out of the box):
bun run src/server.bun.ts                            # Bun
deno run --allow-net --allow-env src/server.deno.ts  # Deno 2.9.0+
npx tsx src/server.ts                                # Node 24+ (via tsx)
```

The server starts on `http://0.0.0.0:7860` by default. Set `PORT` to change it.

---

## Architecture

```
src/app.ts           — the actual API: every route, parser call, and the Hono instance itself
src/index.ts         — Cloudflare Workers adapter
src/server.ts        — Node/Docker adapter
src/server.deno.ts   — Deno adapter
src/server.bun.ts    — Bun adapter
api/index.ts         — Vercel adapter
```

`src/app.ts` has zero platform-specific code. Each adapter is just a few lines
that hand it that platform's `(request, env, ctx)` triple.

---

## Deployment

| Target                                    | Entrypoint           | Best for                                                                                             |
| :---------------------------------------- | :------------------- | :--------------------------------------------------------------------------------------------------- |
| [Cloudflare Workers](#cloudflare-workers) | `src/index.ts`       | Free global edge, generous free tier                                                                 |
| [Vercel](#vercel)                         | `api/index.ts`       | Zero-config Git deploys                                                                              |
| [Docker/Node](#docker-any-node-host)      | `src/server.ts`      | No per-request CPU-time cap — best for `?hover=1`/heavy concurrent-fetch traffic; Docker is untested |
| [Bun](#bun)                               | `src/server.bun.ts`  | Fast startup, zero config                                                                            |
| [Deno](#deno)                             | `src/server.deno.ts` | Native TS, secure defaults                                                                           |

### Cloudflare Workers

```bash
npm install
npx wrangler login
npm run deploy
```

> [!NOTE]
> Workers' free tier enforces a per-request CPU-time budget. Endpoints that
> fan out into several concurrent MAL fetches (e.g. `?hover=1`) can hit that
> ceiling under load—use the Docker target for unlimited CPU time.

### Vercel

Link your GitHub repo to Vercel, or click the **Deploy with Vercel** button
above. The function runs on the Node.js runtime. Set `MAL_CLIENT_ID` under
Project Settings → Environment Variables if desired.

### Docker/any Node host

```bash
docker build -t miribyou .
docker run -p 7860:7860 -e MAL_CLIENT_ID=your_client_id miribyou
```

For a Hugging Face Space: create a **Docker**-SDK Space, push this repo, and
set `MAL_CLIENT_ID` as a Space secret. The `app_port` should be `7860`.

### Bun

```bash
bun install
bun run src/server.bun.ts
```

### Deno

> [!WARNING]
> Requires v2.9.0

```bash
deno install  # or: deno cache src/server.deno.ts
deno run --allow-net --allow-env src/server.deno.ts
```

---

## Development

```bash
npm install    # or: bun install
npm run dev    # hot-reloading via Wrangler (Cloudflare Workers simulator)
npm test       # Vitest test suite
```

You can also run the server directly with any runtime during development — see
[Quick Start](#quick-start).

### Official MAL API Integration (Optional)

Set `MAL_CLIENT_ID` as an environment variable or pass the
`X-MAL-CLIENT-ID` header per-request. Get a Client ID at
[MyAnimeList API Config](https://myanimelist.net/apiconfig) by creating a new
**Web** client. If redirect URL is required, set `http://localhost:8787`

---

## Client Detection

`miribyou` identifies itself with the `X-Powered-By: miribyou (Jikan-like)`
response header.

```typescript
const res = await fetch("https://api.example.com/v4/anime/1");
const isMiribyou = res.headers.get("X-Powered-By") === "miribyou (Jikan-like)";
```

---

## Caching

Successful `GET` responses (2xx) include cache headers for 1 day:

- `Cache-Control: public, max-age=86400, s-maxage=86400`
- `CDN-Cache-Control: public, max-age=86400, s-maxage=86400`
- `Vercel-CDN-Cache-Control: public, max-age=86400, s-maxage=86400`

Caching is bypassed on `/` and `/v4/` base metadata endpoints, and on any
non-GET or unsuccessful requests.

---

## API Endpoints

All endpoints are `GET` requests.

### Base

- `GET /v4/` — API metadata and heartbeat

### Anime

- `GET /v4/anime?q=query` — Search anime
- `GET /v4/anime/:id` — Basic details
- `GET /v4/anime/:id/full` — Full metadata (relations, themes, etc.)
- `GET /v4/anime/:id/characters` — Characters
- `GET /v4/anime/:id/staff` — Production staff
- `GET /v4/anime/:id/episodes` — Episodes (`?page=n`)
- `GET /v4/anime/:id/episodes/:episodeId` — Single episode
- `GET /v4/anime/:id/news` — News (`?page=n`)
- `GET /v4/anime/:id/forum` — Forum topics
- `GET /v4/anime/:id/videos` — Promotional videos and streaming links
- `GET /v4/anime/:id/videos/episodes` — Episode videos (`?page=n`)
- `GET /v4/anime/:id/pictures` — Images
- `GET /v4/anime/:id/statistics` — Score distribution and watch stats
- `GET /v4/anime/:id/moreinfo` — Additional info
- `GET /v4/anime/:id/recommendations` — User recommendations
- `GET /v4/anime/:id/userupdates` — Latest list updates
- `GET /v4/anime/:id/reviews` — Reviews (`?page=n`)
- `GET /v4/anime/:id/relations` — Related entries
- `GET /v4/anime/:id/themes` — Opening/ending themes
- `GET /v4/anime/:id/external` — External links
- `GET /v4/anime/:id/streaming` — Streaming platform links

### Manga

- `GET /v4/manga?q=query` — Search manga
- `GET /v4/manga/:id` — Basic details
- `GET /v4/manga/:id/full` — Full metadata
- `GET /v4/manga/:id/characters` — Characters
- `GET /v4/manga/:id/news` — News (`?page=n`)
- `GET /v4/manga/:id/forum` — Forum topics
- `GET /v4/manga/:id/pictures` — Images
- `GET /v4/manga/:id/statistics` — Reading stats
- `GET /v4/manga/:id/moreinfo` — Additional info
- `GET /v4/manga/:id/recommendations` — Recommendations
- `GET /v4/manga/:id/userupdates` — List updates
- `GET /v4/manga/:id/reviews` — Reviews (`?page=n`)
- `GET /v4/manga/:id/relations` — Related entries
- `GET /v4/manga/:id/external` — External links

### Characters

- `GET /v4/characters/:id` — Basic info (name, images, about, favorites)
- `GET /v4/characters/:id/full` — Full data with anime/manga/voice actor appearances
- `GET /v4/characters/:id/anime` — Anime appearances with roles
- `GET /v4/characters/:id/manga` — Manga appearances with roles
- `GET /v4/characters/:id/voices` — Voice actors
- `GET /v4/characters/:id/pictures` — Image gallery

### Seasons

- `GET /v4/seasons` — List of archived years/seasons
- `GET /v4/seasons/now` — Current season
- `GET /v4/seasons/upcoming` — Upcoming season
- `GET /v4/seasons/:year/:season` — Specific archive

### Users

- `GET /v4/users?q=query` — Search users
- `GET /v4/users/recentlyonline` — Recently online
- `GET /v4/users/userbyid/:id` — Get username by MAL ID
- `GET /v4/users/:username` — Profile
- `GET /v4/users/:username/full` — Full profile
- `GET /v4/users/:username/statistics` — Anime/manga list stats
- `GET /v4/users/:username/favorites` — Favorites
- `GET /v4/users/:username/userupdates` — Latest updates
- `GET /v4/users/:username/about` — About section (raw HTML)
- `GET /v4/users/:username/history` — History (`?type=anime|manga`)
- `GET /v4/users/:username/friends` — Friends
- `GET /v4/users/:username/animelist` — Anime list
- `GET /v4/users/:username/mangalist` — Manga list
- `GET /v4/users/:username/recommendations` — Recommendations
- `GET /v4/users/:username/reviews` — Reviews
- `GET /v4/users/:username/clubs` — Clubs
- `GET /v4/users/:username/external` — External accounts

---

## Query Parameters

### Global alias (`miribyou` Extension)

| Parameter | Alias | Type      | Default | Description             |
| :-------- | :---- | :-------- | :------ | :---------------------- |
| `page`    | `p`   | `integer` | `1`     | Pagination index number |

Accessible only when endpoint has a struct of `{ pagination, data }` where `data`
is an array of entries and `pagination` contains `last_visible_page` and
`has_next_page`.

Do aware that using `last_visible_page` may unreliable on some endpoints as MAL
does not expose it properly

### Anime Search (`/v4/anime`)

> [!NOTE]
> All paginated endpoints accept both `?page=n` and `?p=n`.

| Parameter                         | Type / Format                                   | Description                                                 |
| :-------------------------------- | :---------------------------------------------- | :---------------------------------------------------------- |
| `q`                               | `string`                                        | Search query                                                |
| `page`                            | `integer`                                       | Page number                                                 |
| `limit`                           | `integer`                                       | Results per page (default: `25`)                            |
| `type`                            | `TV`, `OVA`, `Movie`, `Special`, `ONA`, `Music` | Media type filter                                           |
| `score`, `min_score`, `max_score` | `number`                                        | Score filter                                                |
| `status`                          | `airing`, `complete`, `upcoming`                | Airing status filter                                        |
| `rating`                          | `g`, `pg`, `pg13`, `r17`, `r`, `rx`             | Age rating filter                                           |
| `sfw`                             | `boolean`                                       | Filter out NSFW/adult entries                               |
| `genres`, `genres_exclude`        | `string`                                        | Comma-separated genre IDs                                   |
| `order_by`                        | `string`                                        | Sort field (`mal_id`, `title`, `start_date`, `score`, etc.) |
| `sort`                            | `desc`, `asc`                                   | Sort direction                                              |
| `letter`                          | `string`                                        | First letter filter                                         |
| `producers`                       | `string`                                        | Comma-separated producer IDs                                |
| `start_date`, `end_date`          | `YYYY-MM-DD`                                    | Date range                                                  |
| `hover=1`                         | `flag`                                          | Opt-in extended metadata (slower; fetches popup fields)     |

### Manga Search (`/v4/manga`)

| Parameter                         | Type / Format                                                           | Description                                               |
| :-------------------------------- | :---------------------------------------------------------------------- | :-------------------------------------------------------- |
| `q`                               | `string`                                                                | Search query                                              |
| `page`                            | `integer`                                                               | Page number                                               |
| `limit`                           | `integer`                                                               | Results per page (default: `25`)                          |
| `type`                            | `manga`, `novel`, `lightnovel`, `oneshot`, `doujin`, `manhwa`, `manhua` | Media type filter                                         |
| `score`, `min_score`, `max_score` | `number`                                                                | Score filter                                              |
| `status`                          | `publishing`, `complete`, `hiatus`, `discontinued`, `upcoming`          | Publication status filter                                 |
| `sfw`                             | `boolean`                                                               | Filter out NSFW/adult entries                             |
| `genres`, `genres_exclude`        | `string`                                                                | Comma-separated genre IDs                                 |
| `order_by`                        | `string`                                                                | Sort field (`mal_id`, `title`, `chapters`, `score`, etc.) |
| `sort`                            | `desc`, `asc`                                                           | Sort direction                                            |
| `letter`                          | `string`                                                                | First letter filter                                       |
| `magazines`                       | `string`                                                                | Comma-separated magazine IDs                              |
| `start_date`, `end_date`          | `YYYY-MM-DD`                                                            | Publication date range                                    |
| `hover=1`                         | `flag`                                                                  | Opt-in extended metadata                                  |

### User Search (`/v4/users`)

| Parameter          | Type / Format                        | Description                      |
| :----------------- | :----------------------------------- | :------------------------------- |
| `q`                | `string`                             | Search query (required)          |
| `page`             | `integer`                            | Page number                      |
| `limit`            | `integer`                            | Results per page (default: `25`) |
| `gender`           | `any`, `male`, `female`, `nonbinary` | Gender filter                    |
| `location`         | `string`                             | Location filter                  |
| `minAge`, `maxAge` | `integer`                            | Age range filter                 |

### Seasons (`/v4/seasons/*`)

| Parameter | Type / Format                                   | Description                      |
| :-------- | :---------------------------------------------- | :------------------------------- |
| `page`    | `integer`                                       | Page number                      |
| `limit`   | `integer`                                       | Results per page (default: `25`) |
| `filter`  | `tv`, `movie`, `ova`, `special`, `ona`, `music` | Media type filter                |
| `sfw`     | `boolean`                                       | Exclude Rx/Hentai                |
| `hover=1` | `flag`                                          | Opt-in extended metadata         |

> [!WARNING]
> Use `?hover=1` sparingly — it fires concurrent background requests for each
> entry on the page, increasing response times. Only supported on the HTML
> scraper fallback path.

### Reviews (`/v4/anime/:id/reviews`, `/v4/manga/:id/reviews`)

| Parameter     | Type      | Default | Description                                                    |
| :------------ | :-------- | :------ | :------------------------------------------------------------- |
| `page`        | `integer` | `1`     | Page number                                                    |
| `preliminary` | `boolean` | `true`  | Include preliminary reviews (during ongoing airing/publishing) |
| `spoilers`    | `boolean` | `true`  | Include reviews with spoilers                                  |

---

## License

MIT. See [LICENSE](LICENSE).
