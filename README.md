# miribyou

Miribyou is a lightweight MAL (MyAnimeList) scraper built for performance and accuracy. It's designed to run on Cloudflare Workers (or any modern JS environment) and provides high-fidelity JSON responses by parsing MAL's HTML directly.

![Version](https://img.shields.io/github/package-json/v/nattadasu/miribyou)
![License](https://img.shields.io/github/license/nattadasu/miribyou)
![Stars](https://img.shields.io/github/github-stats/stars/nattadasu/miribyou)
![Issues](https://img.shields.io/github/issues/nattadasu/miribyou)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/nattadasu/miribyou)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/nattadasu/miribyou)

> [!IMPORTANT]
> This project aims for parity with Jikan V4 data structures and versioning. All endpoints are prefixed with `/v4/`.

## API Information

- **Version:** `4.1.3` (Jikan Parity)
- **Discord:** [Join our Discord](https://nttds.my.id/discord)

## Deployment

### Cloudflare Workers

1. Clone the repository.
2. Install dependencies: `npm install`.
3. Login to Wrangler: `npx wrangler login`.
4. Deploy: `npm run deploy`.

### Official MAL API Integration (Optional)

Miribyou can optionally utilize the official MyAnimeList v2 API and map it to Jikan-like V4 JSON structures. This bypasses HTML scraping for search and detail endpoints:

- **Environment Secret/Variable:** Set the `MAL_CLIENT_ID` variable or secret in Wrangler (or your hosting platform).
- **Request Header:** Alternatively, clients can specify their own Client ID dynamically by sending the `X-MAL-CLIENT-ID` header with their request.

### Vercel

You can deploy miribyou to Vercel using the button above or by connecting your GitHub repository to the Vercel dashboard.

## Endpoints

All endpoints use the `GET` method and are prefixed with `/v4`.

### Base

- `/v4/` - API metadata and MyAnimeList heartbeat

### Search Parameters

The query search endpoints support full Jikan v4 parity query parameters:

#### Anime Search (`/v4/anime`)

- `q`: search query string
- `page`: page number (pagination)
- `limit`: results limit (default: 25)
- `type`: `TV`, `OVA`, `Movie`, `Special`, `ONA`, `Music`
- `score`, `min_score`, `max_score`: filter by score criteria
- `status`: `airing`, `complete`, `upcoming`
- `rating`: `g`, `pg`, `pg13`, `r17`, `r`, `rx`
- `sfw`: `true` to filter out adult entries
- `genres`, `genres_exclude`: comma-separated genre IDs (e.g. `1,2,3`)
- `order_by`: `mal_id`, `title`, `start_date`, `end_date`, `episodes`, `score`, `scored_by`, `rank`, `popularity`, `members`
- `sort`: `desc`, `asc`
- `letter`: first letter of title
- `producers`: comma-separated producer IDs
- `start_date`, `end_date`: date string `YYYY-MM-DD`
- `hover=1`: Opt-in Extended Metadata. Resolves hidden MAL data fields concurrently.

#### Manga Search (`/v4/manga`)

- `q`: search query string
- `page`: page number
- `limit`: results limit (default: 25)
- `type`: `manga`, `novel`, `lightnovel`, `oneshot`, `doujin`, `manhwa`, `manhua`
- `score`, `min_score`, `max_score`: filter by score criteria
- `status`: `publishing`, `complete`, `hiatus`, `discontinued`, `upcoming`
- `sfw`: `true` to filter out adult entries
- `genres`, `genres_exclude`: comma-separated genre IDs
- `order_by`: `mal_id`, `title`, `start_date`, `end_date`, `chapters`, `volumes`, `score`, `scored_by`, `rank`, `popularity`
- `sort`: `desc`, `asc`
- `letter`: first letter of title
- `magazines`: comma-separated magazine IDs
- `start_date`, `end_date`: date string `YYYY-MM-DD`
- `hover=1`: Opt-in Extended Metadata popup fetcher.

#### User Search (`/v4/users`)

- `q`: search query string (required)
- `page`: page number
- `limit`: results limit (default: 25)
- `gender`: `any`, `male`, `female`, `nonbinary` (performs profile check)
- `location`: filter by location
- `minAge`, `maxAge`: filter by user age

> [!WARNING]
> **Use `?hover=1` sparingly.** It triggers concurrent background requests for all search results, increasing response times. Note that `?hover` is usually only applicable under the HTML scraper path (when no MAL API Client ID is provided).

### Anime

- `/v4/anime?q=query` - Search anime
- `/v4/anime/:id` - Basic anime details
- `/v4/anime/:id/full` - Full anime metadata (includes relations, themes, etc.)
- `/v4/anime/:id/characters` - Character list
- `/v4/anime/:id/staff` - Staff list
- `/v4/anime/:id/episodes` - Episode list (pagination via `?page=n`)
- `/v4/anime/:id/episodes/:episodeId` - Single episode details
- `/v4/anime/:id/news` - Related news
- `/v4/anime/:id/forum` - Forum topics
- `/v4/anime/:id/videos` - Promotional videos and episode links
- `/v4/anime/:id/pictures` - Image gallery
- `/v4/anime/:id/statistics` - Detailed score and status stats
- `/v4/anime/:id/moreinfo` - Additional information text
- `/v4/anime/:id/recommendations` - User recommendations
- `/v4/anime/:id/userupdates` - Latest user list updates
- `/v4/anime/:id/reviews` - User reviews
- `/v4/anime/:id/relations` - Related anime/manga entries
- `/v4/anime/:id/themes` - Opening and ending themes
- `/v4/anime/:id/external` - External links
- `/v4/anime/:id/streaming` - Official streaming platforms

### Manga

- `/v4/manga?q=query` - Search manga
- `/v4/manga/:id` - Basic manga details
- `/v4/manga/:id/full` - Full manga metadata
- `/v4/manga/:id/characters` - Character list
- `/v4/manga/:id/news` - Related news
- `/v4/manga/:id/forum` - Forum topics
- `/v4/manga/:id/pictures` - Image gallery
- `/v4/manga/:id/statistics` - Detailed statistics
- `/v4/manga/:id/moreinfo` - Additional information
- `/v4/manga/:id/recommendations` - User recommendations
- `/v4/manga/:id/userupdates` - Latest user list updates
- `/v4/manga/:id/reviews` - User reviews
- `/v4/manga/:id/relations` - Related entries
- `/v4/manga/:id/external` - External links

### Users

- `/v4/users?q=query` - Search users
- `/v4/users/recentlyonline` - List recently online users
- `/v4/users/userbyid/:id` - Get username by MAL ID
- `/v4/users/:username` - Basic profile info
- `/v4/users/:username/full` - Complete profile (stats, favorites, updates, etc.)
- `/v4/users/:username/statistics` - Anime and Manga list statistics
- `/v4/users/:username/favorites` - Favorite anime, manga, characters, and people
- `/v4/users/:username/userupdates` - User's latest list updates
- `/v4/users/:username/about` - Raw "About" section HTML
- `/v4/users/:username/history` - User's activity history (`?type=anime|manga`)
- `/v4/users/:username/friends` - Friends list
- `/v4/users/:username/animelist` - Direct JSON anime list from MAL
- `/v4/users/:username/mangalist` - Direct JSON manga list from MAL
- `/v4/users/:username/recommendations` - User-submitted recommendations
- `/v4/users/:username/reviews` - User reviews
- `/v4/users/:username/clubs` - Joined clubs with pagination
- `/v4/users/:username/external` - User's linked SNS accounts

## Development

### Prerequisites

- Node.js (Latest LTS)
- npm or pnpm

### Getting Started

1. Clone the repo
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

### Testing

Tests are handled by Vitest:

```bash
npm test
```

## Licensing

Licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
