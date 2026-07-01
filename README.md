# miribyou

Miribyou is a lightweight, database-free MyAnimeList (MAL) scraper built to provide structure and data parity with the Jikan v4 API.

Designed for serverless environments like Cloudflare Workers (or any modern JS runtime), miribyou requires no database setup. It achieves high-fidelity JSON output by parsing MAL's HTML directly, optionally enhanced by the official MAL API.

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
    <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare Workers" />
  </a>
  <a href="https://vercel.com/import/project?template=https://github.com/nattadasu/miribyou">
    <img src="https://vercel.com/button" alt="Deploy with Vercel" />
  </a>
</p>

> [!IMPORTANT]
> This project aims for parity with Jikan V4 data structures and versioning. All endpoints are prefixed with `/v4`.

> [!WARNING]
> Because miribyou does not rely on a persistent database, some advanced search or filtering queries may return stub/partial data. Providing a `MAL_CLIENT_ID` helps resolve many of these limitations.

---

## 📖 Table of Contents

- [Deployment](#🚀-deployment)
  - [Cloudflare Workers](#cloudflare-workers)
  - [Vercel](#vercel)
  - [Official MAL API Integration](#official-mal-api-integration-optional)
- [Client Compatibility & Detection](#-client-compatibility--detection)
- [Caching Strategy](#-caching-strategy)
- [API Endpoints](#⚡-api-endpoints)
  - [Base](#base)
  - [Anime](#anime)
  - [Manga](#manga)
  - [Seasons](#seasons)
  - [Users](#users)
- [Query Parameter Reference](#⚙️-query-parameter-reference)
  - [Anime Search](#anime-search-v4anime)
  - [Manga Search](#manga-search-v4manga)
  - [User Search](#user-search-v4users)
  - [Seasons](#seasons-v4seasonsnow-v4seasonsupcoming-v4seasonsyearseason)
- [Development](#🛠️-development)

---

## 🚀 Deployment

### Cloudflare Workers

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Authenticate with Wrangler:
   ```bash
   npx wrangler login
   ```
4. Deploy to Cloudflare:
   ```bash
   npm run deploy
   ```

### Vercel

Deploy instantly by linking your GitHub repository to Vercel, or click the **Deploy with Vercel** button above.

### Official MAL API Integration (Optional)

You can configure miribyou to use the official MyAnimeList v2 API to speed up search requests and retrieve richer metadata.

- **Global Config:** Set `MAL_CLIENT_ID` as a secret or environment variable on your hosting platform.
- **Client Override:** Clients can dynamically specify a Client ID by passing the `X-MAL-CLIENT-ID` header.

To get your Client ID, log in to MyAnimeList, visit the [API Config page](https://myanimelist.net/apiconfig), and create a new **web** client. If a redirect URL is required, you can use `http://localhost:8787`.

---

## 🔌 Client Compatibility & Detection

`miribyou` is designed as a drop-in replacement for Jikan v4. Clients can detect whether an API deployment is powered by `miribyou` using the response headers:

- **Header:** `X-Powered-By`
- **Value:** `miribyou (Jikan-like)`

#### Example Detection (JavaScript / TypeScript)

```typescript
const response = await fetch("https://api.example.com/v4/anime/1");

const isMiribyou =
  response.headers.get("X-Powered-By") === "miribyou (Jikan-like)";
if (isMiribyou) {
  console.log("This deployment is powered by miribyou!");
}
```

---

## 💾 Caching Strategy

To keep the service lightweight and database-free, `miribyou` returns cache headers instructing browsers and CDNs (such as Cloudflare and Vercel) to cache successful `GET` responses for 1 day:

- **Headers set on successful GET requests (status 200-299):**
  - `Cache-Control: public, max-age=86400, s-maxage=86400`
  - `CDN-Cache-Control: public, max-age=86400, s-maxage=86400`
  - `Vercel-CDN-Cache-Control: public, max-age=86400, s-maxage=86400`
- **Exclusions:** Caching is completely bypassed on base metadata endpoints (`/` and `/v4/`) and on any non-GET or unsuccessful requests.

---

## ⚡ API Endpoints

All endpoints are `GET` requests.

### Base

- `GET /v4/` - API metadata and heartbeat check

### Anime

- `GET /v4/anime?q=query` - Search anime
- `GET /v4/anime/:id` - Basic anime details
- `GET /v4/anime/:id/full` - Full anime metadata (relations, themes, etc.)
- `GET /v4/anime/:id/characters` - Characters list
- `GET /v4/anime/:id/staff` - Production staff list
- `GET /v4/anime/:id/episodes` - Episode list (supports pagination via `?page=n`)
- `GET /v4/anime/:id/episodes/:episodeId` - Single episode details
- `GET /v4/anime/:id/news` - News articles
- `GET /v4/anime/:id/forum` - Forum discussion topics
- `GET /v4/anime/:id/videos` - Promotional videos and episode streaming links
- `GET /v4/anime/:id/pictures` - Image gallery
- `GET /v4/anime/:id/statistics` - Score distribution and watch status statistics
- `GET /v4/anime/:id/moreinfo` - Additional information text
- `GET /v4/anime/:id/recommendations` - User recommendations
- `GET /v4/anime/:id/userupdates` - Latest user list updates
- `GET /v4/anime/:id/reviews` - User reviews
- `GET /v4/anime/:id/relations` - Related anime/manga entries
- `GET /v4/anime/:id/themes` - Opening and ending themes
- `GET /v4/anime/:id/external` - External resources links
- `GET /v4/anime/:id/streaming` - Streaming platforms links

### Manga

- `GET /v4/manga?q=query` - Search manga
- `GET /v4/manga/:id` - Basic manga details
- `GET /v4/manga/:id/full` - Full manga metadata
- `GET /v4/manga/:id/characters` - Character list
- `GET /v4/manga/:id/news` - News articles
- `GET /v4/manga/:id/forum` - Forum topics
- `GET /v4/manga/:id/pictures` - Image gallery
- `GET /v4/manga/:id/statistics` - Reading stats and scores
- `GET /v4/manga/:id/moreinfo` - Additional information text
- `GET /v4/manga/:id/recommendations` - User recommendations
- `GET /v4/manga/:id/userupdates` - Latest list updates
- `GET /v4/manga/:id/reviews` - User reviews
- `GET /v4/manga/:id/relations` - Related entries
- `GET /v4/manga/:id/external` - External links

### Characters

- `GET /v4/characters/:id` - Basic character info (name, images, about, favorites)
- `GET /v4/characters/:id/full` - Full character data including anime, manga, and voice actor appearances
- `GET /v4/characters/:id/anime` - Anime appearances with roles
- `GET /v4/characters/:id/manga` - Manga appearances with roles
- `GET /v4/characters/:id/voices` - Voice actors
- `GET /v4/characters/:id/pictures` - Character image gallery

### Seasons

- `GET /v4/seasons` - List of all archived years and seasons
- `GET /v4/seasons/now` - Current season anime list
- `GET /v4/seasons/upcoming` - Upcoming season anime list
- `GET /v4/seasons/:year/:season` - Specific seasonal anime archive list

### Users

- `GET /v4/users?q=query` - Search users
- `GET /v4/users/recentlyonline` - List recently online users
- `GET /v4/users/userbyid/:id` - Get username by MAL ID
- `GET /v4/users/:username` - Basic profile info
- `GET /v4/users/:username/full` - Full profile metadata
- `GET /v4/users/:username/statistics` - Anime and Manga list stats
- `GET /v4/users/:username/favorites` - Favorite anime, manga, characters, and people
- `GET /v4/users/:username/userupdates` - Latest updates
- `GET /v4/users/:username/about` - About section (raw HTML)
- `GET /v4/users/:username/history` - Activity history (supports `?type=anime|manga`)
- `GET /v4/users/:username/friends` - Friends list
- `GET /v4/users/:username/animelist` - Direct anime list
- `GET /v4/users/:username/mangalist` - Direct manga list
- `GET /v4/users/:username/recommendations` - User-submitted recommendations
- `GET /v4/users/:username/reviews` - User reviews
- `GET /v4/users/:username/clubs` - Joined clubs list
- `GET /v4/users/:username/external` - Linked external social accounts

---

## ⚙️ Query Parameter Reference

### Anime Search (`/v4/anime`)

| Parameter                         | Type / Format                                   | Description                                                       |
| :-------------------------------- | :---------------------------------------------- | :---------------------------------------------------------------- |
| `q`                               | `string`                                        | Search query string                                               |
| `page`                            | `integer`                                       | Page number for pagination                                        |
| `limit`                           | `integer`                                       | Results limit (default: `25`)                                     |
| `type`                            | `TV`, `OVA`, `Movie`, `Special`, `ONA`, `Music` | Media type filter                                                 |
| `score`, `min_score`, `max_score` | `number`                                        | Score criteria filter                                             |
| `status`                          | `airing`, `complete`, `upcoming`                | Airing status filter                                              |
| `rating`                          | `g`, `pg`, `pg13`, `r17`, `r`, `rx`             | Age rating filter                                                 |
| `sfw`                             | `boolean`                                       | Set `true` to filter out NSFW/adult entries                       |
| `genres`, `genres_exclude`        | `string`                                        | Comma-separated genre IDs (e.g. `1,2`)                            |
| `order_by`                        | `string`                                        | Field to sort by (`mal_id`, `title`, `start_date`, `score`, etc.) |
| `sort`                            | `desc`, `asc`                                   | Sort direction                                                    |
| `letter`                          | `string`                                        | Filter by first letter of title                                   |
| `producers`                       | `string`                                        | Comma-separated producer IDs                                      |
| `start_date`, `end_date`          | `YYYY-MM-DD`                                    | Release date range boundaries                                     |
| `hover=1`                         | `flag`                                          | Opt-in Extended Metadata (slower; fetches popup fields)           |

### Manga Search (`/v4/manga`)

| Parameter                         | Type / Format                                                           | Description                                                     |
| :-------------------------------- | :---------------------------------------------------------------------- | :-------------------------------------------------------------- |
| `q`                               | `string`                                                                | Search query string                                             |
| `page`                            | `integer`                                                               | Page number for pagination                                      |
| `limit`                           | `integer`                                                               | Results limit (default: `25`)                                   |
| `type`                            | `manga`, `novel`, `lightnovel`, `oneshot`, `doujin`, `manhwa`, `manhua` | Media type filter                                               |
| `score`, `min_score`, `max_score` | `number`                                                                | Score criteria filter                                           |
| `status`                          | `publishing`, `complete`, `hiatus`, `discontinued`, `upcoming`          | Publication status filter                                       |
| `sfw`                             | `boolean`                                                               | Set `true` to filter out NSFW/adult entries                     |
| `genres`, `genres_exclude`        | `string`                                                                | Comma-separated genre IDs                                       |
| `order_by`                        | `string`                                                                | Field to sort by (`mal_id`, `title`, `chapters`, `score`, etc.) |
| `sort`                            | `desc`, `asc`                                                           | Sort direction                                                  |
| `letter`                          | `string`                                                                | Filter by first letter of title                                 |
| `magazines`                       | `string`                                                                | Comma-separated magazine IDs                                    |
| `start_date`, `end_date`          | `YYYY-MM-DD`                                                            | Publication date range boundaries                               |
| `hover=1`                         | `flag`                                                                  | Opt-in Extended Metadata                                        |

### User Search (`/v4/users`)

| Parameter          | Type / Format                        | Description                    |
| :----------------- | :----------------------------------- | :----------------------------- |
| `q`                | `string`                             | Search query string (Required) |
| `page`             | `integer`                            | Page number for pagination     |
| `limit`            | `integer`                            | Results limit (default: `25`)  |
| `gender`           | `any`, `male`, `female`, `nonbinary` | Filters by user profile gender |
| `location`         | `string`                             | Filters by location string     |
| `minAge`, `maxAge` | `integer`                            | Age range filter               |

### Seasons (`/v4/seasons/now`, `/v4/seasons/upcoming`, `/v4/seasons/:year/:season`)

| Parameter | Type / Format                                   | Description                                                         |
| :-------- | :---------------------------------------------- | :------------------------------------------------------------------ |
| `page`    | `integer`                                       | Page number for pagination                                          |
| `limit`   | `integer`                                       | Results limit (default: `25`)                                       |
| `filter`  | `tv`, `movie`, `ova`, `special`, `ona`, `music` | Media type filter                                                   |
| `sfw`     | `boolean`                                       | Safe For Work toggle (`?sfw=1` or `?sfw=true`) to exclude Rx/Hentai |
| `hover=1` | `flag`                                          | Opt-in Extended Metadata                                            |

> [!WARNING]
> **Use `?hover=1` sparingly.** It fires concurrent background requests for each entry on the page, increasing response times. Note that `?hover` is only supported on the HTML scraper fallback path.

---

## 🛠️ Development

### Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the local hot-reloading server:
   ```bash
   npm run dev
   ```

### Testing

Run the Vitest test suite to verify code changes:

```bash
npm test
```

---

## 📄 Licensing

Licensed under the MIT License. See [LICENSE](LICENSE) for more details.
