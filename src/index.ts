import { Hono } from "hono";
import { trimTrailingSlash } from "hono/trailing-slash";

import { fetchMAL, jikanError, resolveSearchDate } from "./utils";
import pkg from "../package.json";
import {
  fetchFromMalApi,
  parseMalApiAnime,
  parseMalApiManga,
  mergeAnimeData,
  mergeMangaData,
  ANIME_FIELDS,
  MANGA_FIELDS,
} from "./mal_api";
import { parseAnime } from "./parsers/anime";
import { parseAnimeCharacters, parseAnimeStaff } from "./parsers/characters";
import { parseAnimeSearch } from "./parsers/anime_search";
import {
  parseAnimeEpisodes,
  parseAnimeEpisode,
} from "./parsers/anime_episodes";
import { parseNews } from "./parsers/news";
import { parseForum } from "./parsers/forum";
import { parseAnimeVideos } from "./parsers/videos";
import { parsePictures } from "./parsers/pictures";
import { parseStatistics } from "./parsers/stats";
import { parseMoreInfo } from "./parsers/moreinfo";
import {
  parseRecommendations,
  parseUserRecommendations,
} from "./parsers/recommendations";
import { parseUserUpdates } from "./parsers/userupdates";
import { parseReviews } from "./parsers/reviews";

import { parseManga, parseMangaCharacters } from "./parsers/manga";
import { parseMangaSearch } from "./parsers/manga_search";

import { parseUser, parseUserById } from "./parsers/user";
import { parseUserSearch } from "./parsers/user_search";
import { parseFriends } from "./parsers/friends";
import { parseUserClubs } from "./parsers/user_clubs";
import { parseHistory } from "./parsers/history";
import { parseHover } from "./parsers/hover";

const app = new Hono<{ Bindings: { MAL_CLIENT_ID?: string } }>().basePath(
  "/v4",
);

app.use(trimTrailingSlash());

const getMetadata = async (c: any) => {
  const malHeartbeat = {
    status: "HEALTHY",
    score: 1.0,
    down: false,
    last_downtime: 0,
  };

  try {
    const start = Date.now();
    const res = await fetch("https://myanimelist.net", { method: "HEAD" });
    const end = Date.now();
    if (!res.ok) {
      malHeartbeat.status = "UNHEALTHY";
      malHeartbeat.down = true;
    }
    // Simple score calculation based on response time (1s = 0.5 score, 0s = 1.0 score)
    malHeartbeat.score = Math.max(0, 1 - (end - start) / 2000);
  } catch {
    malHeartbeat.status = "DOWN";
    malHeartbeat.down = true;
  }

  const url = new URL(c.req.url);
  const baseUrl = `${url.protocol}//${url.host}/v4/`;

  return c.json({
    author_url: "https://github.com/nattadasu",
    discord_url: "https://nttds.my.id/discord",
    version: pkg.version,
    parser_version: pkg.version,
    website_url: "https://github.com/nattadasu/miribyou",
    documentation_url: "https://github.com/nattadasu/miribyou#readme",
    github_url: "https://github.com/nattadasu/miribyou",
    parser_github_url: "https://github.com/nattadasu/miribyou",
    production_api_url: baseUrl,
    status_url: null,
    myanimelist_heartbeat: malHeartbeat,
  });
};

app.get("/", getMetadata);

app.get("/anime", async (c) => {
  const q = c.req.query("q");
  const page = parseInt(c.req.query("page") || "1");
  const hover = c.req.query("hover") === "1" || c.req.query("hover") === "true";

  if (!q) {
    return c.json(
      jikanError(400, 'Query parameter "q" is required for search'),
      400,
    );
  }

  const malClientId = c.req.header("x-mal-client-id") || c.env.MAL_CLIENT_ID;
  if (malClientId) {
    try {
      const offset = (page - 1) * 50;
      const apiResponse = await fetchFromMalApi("/anime", malClientId, {
        q,
        limit: "50",
        offset: offset.toString(),
        fields: ANIME_FIELDS,
        nsfw: "true",
      });
      const results = (apiResponse.data || []).map((item: any) =>
        parseMalApiAnime(item.node),
      );
      const hasNext = apiResponse.paging?.next ? true : false;
      return c.json({
        pagination: {
          last_visible_page: hasNext ? page + 1 : page,
          has_next_page: hasNext,
          current_page: page,
          items: {
            count: results.length,
            total: results.length + (hasNext ? 50 : 0),
            per_page: 50,
          },
        },
        data: results,
      });
    } catch (error: any) {
      return c.json(jikanError(500, error.message), 500);
    }
  }

  const show = (page - 1) * 50;

  try {
    const html = await fetchMAL(
      `/anime.php?q=${encodeURIComponent(q)}&show=${show}&type=0&score=0&status=0&p=0&r=0&sm=0&sd=0&sy=0&em=0&ed=0&ey=0&c[]=a&c[]=b&c[]=c&c[]=d&c[]=e&c[]=f&c[]=g`,
    );
    const data = parseAnimeSearch(html);
    data.pagination.current_page = page;

    if (hover && data.data.length > 0) {
      await Promise.all(
        data.data.map(async (item: any) => {
          try {
            const hoverHtml = await fetchMAL(`/anime/${item.mal_id}/hover`, {
              "X-Requested-With": "XMLHttpRequest",
            });
            const hoverData = parseHover(hoverHtml);

            if (hoverData.year) {
              item.year = hoverData.year;
              if (item._raw_aired) {
                item.aired = resolveSearchDate(item._raw_aired, hoverData.year);
              }
            }
            if (hoverData.synopsis && item.synopsis.endsWith("..."))
              item.synopsis = hoverData.synopsis;
            if (hoverData.genres.length) item.genres = hoverData.genres;
            if (hoverData.themes.length) item.themes = hoverData.themes;
            if (hoverData.demographics.length)
              item.demographics = hoverData.demographics;
            if (hoverData.status) item.status = hoverData.status;
            if (hoverData.score !== null) item.score = hoverData.score;
            if (hoverData.scored_by !== null)
              item.scored_by = hoverData.scored_by;
            if (hoverData.rank !== null) item.rank = hoverData.rank;
            if (hoverData.popularity !== null)
              item.popularity = hoverData.popularity;
            if (hoverData.members !== null) item.members = hoverData.members;
          } catch (e) {
            // Silently fail for individual hover requests
          }
          delete item._raw_aired;
        }),
      );
    } else {
      data.data.forEach((item: any) => delete item._raw_aired);
    }

    return c.json(data);
  } catch (error: any) {
    return c.json(jikanError(500, error.message), 500);
  }
});

app.get("/anime/:id", async (c) => {
  const id = c.req.param("id");
  const malClientId = c.req.header("x-mal-client-id") || c.env.MAL_CLIENT_ID;
  if (malClientId) {
    try {
      const apiResponse = await fetchFromMalApi(`/anime/${id}`, malClientId, {
        fields: ANIME_FIELDS,
        nsfw: "true",
      });
      let data = parseMalApiAnime(apiResponse);
      try {
        const html = await fetchMAL(`/anime/${id}`);
        const scraped = parseAnime(html);
        data = mergeAnimeData(data, scraped);
      } catch (e) {
        // Silently fallback to API-only if scraper fails
      }
      // Remove heavy fields for non-full endpoint
      delete data.relations;
      delete data.external;
      delete data.streaming;
      delete data.theme;
      return c.json({ data });
    } catch (error: any) {
      const status = error.message.includes("404") ? 404 : 500;
      return c.json(jikanError(status, error.message), status);
    }
  }

  try {
    const html = await fetchMAL(`/anime/${id}`);
    const data = parseAnime(html);
    // Remove heavy fields for non-full endpoint
    delete data.relations;
    delete data.external;
    delete data.streaming;
    delete data.theme;
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/anime/:id/full", async (c) => {
  const id = c.req.param("id");
  const malClientId = c.req.header("x-mal-client-id") || c.env.MAL_CLIENT_ID;
  if (malClientId) {
    try {
      const apiResponse = await fetchFromMalApi(`/anime/${id}`, malClientId, {
        fields: ANIME_FIELDS,
        nsfw: "true",
      });
      let data = parseMalApiAnime(apiResponse);
      try {
        const html = await fetchMAL(`/anime/${id}`);
        const scraped = parseAnime(html);
        data = mergeAnimeData(data, scraped);
      } catch (e) {
        // Silently fallback to API-only if scraper fails
      }
      return c.json({ data });
    } catch (error: any) {
      const status = error.message.includes("404") ? 404 : 500;
      return c.json(jikanError(status, error.message), status);
    }
  }

  try {
    const html = await fetchMAL(`/anime/${id}`);
    const data = parseAnime(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/anime/:id/characters", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/anime/${id}/_/characters`);
    const data = parseAnimeCharacters(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/anime/:id/staff", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/anime/${id}/_/characters`);
    const data = parseAnimeStaff(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/anime/:id/episodes", async (c) => {
  const id = c.req.param("id");
  const page = c.req.query("page") || "1";
  try {
    const html = await fetchMAL(
      `/anime/${id}/_/episode?offset=${(parseInt(page) - 1) * 100}`,
    );
    const data = parseAnimeEpisodes(html);
    return c.json(data);
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/anime/:id/episodes/:episodeId", async (c) => {
  const { id, episodeId } = c.req.param();
  try {
    const html = await fetchMAL(`/anime/${id}/_/episode/${episodeId}`);
    const data = parseAnimeEpisode(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/anime/:id/news", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/anime/${id}/_/news`);
    const data = parseNews(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/anime/:id/forum", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/anime/${id}/_/forum`);
    const data = parseForum(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/anime/:id/videos", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/anime/${id}/_/video`);
    const data = parseAnimeVideos(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/anime/:id/videos/episodes", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/anime/${id}/_/video`);
    const data = parseAnimeVideos(html);
    return c.json({ data: data.episodes });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/anime/:id/pictures", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/anime/${id}/_/pics`);
    const data = parsePictures(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/anime/:id/statistics", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/anime/${id}/_/stats`);
    const data = parseStatistics(html, "anime");
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/anime/:id/moreinfo", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/anime/${id}/_/moreinfo`);
    const data = parseMoreInfo(html);
    return c.json({ data: { moreinfo: data } });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/anime/:id/recommendations", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/anime/${id}/_/userrecs`);
    const data = parseRecommendations(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/anime/:id/userupdates", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/anime/${id}/_/stats`);
    const data = parseUserUpdates(html, "anime");
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/anime/:id/reviews", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/anime/${id}/_/reviews`);
    const data = parseReviews(html, "anime");
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/anime/:id/relations", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/anime/${id}`);
    const data = parseAnime(html);
    return c.json({ data: data.relations });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/anime/:id/themes", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/anime/${id}`);
    const data = parseAnime(html);
    return c.json({ data: data.theme });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/anime/:id/external", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/anime/${id}`);
    const data = parseAnime(html);
    return c.json({ data: data.external });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/anime/:id/streaming", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/anime/${id}`);
    const data = parseAnime(html);
    return c.json({ data: data.streaming });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/manga", async (c) => {
  const q = c.req.query("q");
  const page = parseInt(c.req.query("page") || "1");
  const hover = c.req.query("hover") === "1" || c.req.query("hover") === "true";

  if (!q) {
    return c.json(
      jikanError(400, 'Query parameter "q" is required for search'),
      400,
    );
  }

  const malClientId = c.req.header("x-mal-client-id") || c.env.MAL_CLIENT_ID;
  if (malClientId) {
    try {
      const offset = (page - 1) * 50;
      const apiResponse = await fetchFromMalApi("/manga", malClientId, {
        q,
        limit: "50",
        offset: offset.toString(),
        fields: MANGA_FIELDS,
        nsfw: "true",
      });
      const results = (apiResponse.data || []).map((item: any) =>
        parseMalApiManga(item.node),
      );
      const hasNext = apiResponse.paging?.next ? true : false;
      return c.json({
        pagination: {
          last_visible_page: hasNext ? page + 1 : page,
          has_next_page: hasNext,
          current_page: page,
          items: {
            count: results.length,
            total: results.length + (hasNext ? 50 : 0),
            per_page: 50,
          },
        },
        data: results,
      });
    } catch (error: any) {
      return c.json(jikanError(500, error.message), 500);
    }
  }

  const show = (page - 1) * 50;

  try {
    const html = await fetchMAL(
      `/manga.php?q=${encodeURIComponent(q)}&show=${show}&type=0&score=0&status=0&mid=0&sm=0&sd=0&sy=0&em=0&ed=0&ey=0&c[]=a&c[]=b&c[]=c&c[]=d&c[]=e&c[]=f&c[]=g&c[]=h&c[]=i`,
    );
    const data = parseMangaSearch(html);
    data.pagination.current_page = page;

    if (hover && data.data.length > 0) {
      await Promise.all(
        data.data.map(async (item: any) => {
          try {
            const hoverHtml = await fetchMAL(`/manga/${item.mal_id}/hover`, {
              "X-Requested-With": "XMLHttpRequest",
            });
            const hoverData = parseHover(hoverHtml);

            if (hoverData.year) {
              item.year = hoverData.year;
              if (item._raw_published) {
                item.published = resolveSearchDate(
                  item._raw_published,
                  hoverData.year,
                );
              }
            }
            if (hoverData.synopsis && item.synopsis.endsWith("..."))
              item.synopsis = hoverData.synopsis;
            if (hoverData.genres.length) item.genres = hoverData.genres;
            if (hoverData.themes.length) item.themes = hoverData.themes;
            if (hoverData.demographics.length)
              item.demographics = hoverData.demographics;
            if (hoverData.status) item.status = hoverData.status;
            if (hoverData.score !== null) item.score = hoverData.score;
            if (hoverData.scored_by !== null)
              item.scored_by = hoverData.scored_by;
            if (hoverData.rank !== null) item.rank = hoverData.rank;
            if (hoverData.popularity !== null)
              item.popularity = hoverData.popularity;
            if (hoverData.members !== null) item.members = hoverData.members;
          } catch (e) {
            // Silently fail for individual hover requests
          }
          delete item._raw_published;
        }),
      );
    } else {
      data.data.forEach((item: any) => delete item._raw_published);
    }

    return c.json(data);
  } catch (error: any) {
    return c.json(jikanError(500, error.message), 500);
  }
});

app.get("/manga/:id", async (c) => {
  const id = c.req.param("id");
  const malClientId = c.req.header("x-mal-client-id") || c.env.MAL_CLIENT_ID;
  if (malClientId) {
    try {
      const apiResponse = await fetchFromMalApi(`/manga/${id}`, malClientId, {
        fields: MANGA_FIELDS,
        nsfw: "true",
      });
      let data = parseMalApiManga(apiResponse);
      try {
        const html = await fetchMAL(`/manga/${id}`);
        const scraped = parseManga(html);
        data = mergeMangaData(data, scraped);
      } catch (e) {
        // Silently fallback to API-only if scraper fails
      }
      // Remove heavy fields for non-full endpoint
      delete data.relations;
      delete data.external;
      return c.json({ data });
    } catch (error: any) {
      const status = error.message.includes("404") ? 404 : 500;
      return c.json(jikanError(status, error.message), status);
    }
  }

  try {
    const html = await fetchMAL(`/manga/${id}`);
    const data = parseManga(html);
    // Remove heavy fields for non-full endpoint
    delete data.relations;
    delete data.external;
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/manga/:id/full", async (c) => {
  const id = c.req.param("id");
  const malClientId = c.req.header("x-mal-client-id") || c.env.MAL_CLIENT_ID;
  if (malClientId) {
    try {
      const apiResponse = await fetchFromMalApi(`/manga/${id}`, malClientId, {
        fields: MANGA_FIELDS,
        nsfw: "true",
      });
      let data = parseMalApiManga(apiResponse);
      try {
        const html = await fetchMAL(`/manga/${id}`);
        const scraped = parseManga(html);
        data = mergeMangaData(data, scraped);
      } catch (e) {
        // Silently fallback to API-only if scraper fails
      }
      return c.json({ data });
    } catch (error: any) {
      const status = error.message.includes("404") ? 404 : 500;
      return c.json(jikanError(status, error.message), status);
    }
  }

  try {
    const html = await fetchMAL(`/manga/${id}`);
    const data = parseManga(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/manga/:id/characters", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/manga/${id}/_/characters`);
    const data = parseMangaCharacters(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/manga/:id/news", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/manga/${id}/_/news`);
    const data = parseNews(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/manga/:id/forum", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/manga/${id}/_/forum`);
    const data = parseForum(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/manga/:id/pictures", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/manga/${id}/_/pics`);
    const data = parsePictures(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/manga/:id/statistics", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/manga/${id}/_/stats`);
    const data = parseStatistics(html, "manga");
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/manga/:id/moreinfo", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/manga/${id}/_/moreinfo`);
    const data = parseMoreInfo(html);
    return c.json({ data: { moreinfo: data } });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/manga/:id/recommendations", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/manga/${id}/_/userrecs`);
    const data = parseRecommendations(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/manga/:id/userupdates", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/manga/${id}/_/stats`);
    const data = parseUserUpdates(html, "manga");
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/manga/:id/reviews", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/manga/${id}/_/reviews`);
    const data = parseReviews(html, "manga");
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/manga/:id/relations", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/manga/${id}`);
    const data = parseManga(html);
    return c.json({ data: data.relations });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/manga/:id/external", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/manga/${id}`);
    const data = parseManga(html);
    return c.json({ data: data.external });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/users", async (c) => {
  const q = c.req.query("q");
  if (!q) {
    return c.json(
      jikanError(400, 'Query parameter "q" is required for search'),
      400,
    );
  }
  try {
    const html = await fetchMAL(`/users.php?q=${encodeURIComponent(q)}`);
    const data = parseUserSearch(html);
    return c.json(data);
  } catch (error: any) {
    return c.json(jikanError(500, error.message), 500);
  }
});

app.get("/users/recentlyonline", async (c) => {
  try {
    const html = await fetchMAL(`/users.php`);
    const data = parseUserSearch(html);
    return c.json(data);
  } catch (error: any) {
    return c.json(jikanError(500, error.message), 500);
  }
});

app.get("/users/userbyid/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/comments.php?id=${id}`);
    const data = parseUserById(html);
    return c.json({ data });
  } catch (error: any) {
    return c.json(jikanError(500, error.message), 500);
  }
});

app.get("/users/:username", async (c) => {
  const username = c.req.param("username");
  try {
    const html = await fetchMAL(`/profile/${username}/`);
    const data = parseUser(html);
    // Remove heavy fields for non-full endpoint
    delete data.statistics;
    delete data.favorites;
    delete data.updates;
    delete data.about;
    delete data.external;
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/users/:username/full", async (c) => {
  const username = c.req.param("username");
  try {
    const html = await fetchMAL(`/profile/${username}/`);
    const data = parseUser(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/users/:username/statistics", async (c) => {
  const username = c.req.param("username");
  try {
    const html = await fetchMAL(`/profile/${username}/`);
    const data = parseUser(html);
    return c.json({ data: data.statistics });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/users/:username/favorites", async (c) => {
  const username = c.req.param("username");
  try {
    const html = await fetchMAL(`/profile/${username}/`);
    const data = parseUser(html);
    return c.json({ data: data.favorites });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/users/:username/userupdates", async (c) => {
  const username = c.req.param("username");
  try {
    const html = await fetchMAL(`/profile/${username}/`);
    const data = parseUser(html);
    return c.json({ data: data.updates });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/users/:username/about", async (c) => {
  const username = c.req.param("username");
  try {
    const html = await fetchMAL(`/profile/${username}/`);
    const data = parseUser(html);
    return c.json({ data: { about: data.about } });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/users/:username/history", async (c) => {
  const username = c.req.param("username");
  const type = c.req.query("type");
  try {
    const html = await fetchMAL(`/history/${username}/${type || ""}`);
    const data = parseHistory(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/users/:username/friends", async (c) => {
  const username = c.req.param("username");
  try {
    const html = await fetchMAL(`/profile/${username}/friends`);
    const data = parseFriends(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/users/:username/animelist", async (c) => {
  const username = c.req.param("username");
  try {
    const response = await fetch(
      `https://myanimelist.net/animelist/${username}/load.json`,
    );
    const data = await response.json();
    return c.json({ data });
  } catch (error: any) {
    return c.json(jikanError(500, error.message), 500);
  }
});

app.get("/users/:username/mangalist", async (c) => {
  const username = c.req.param("username");
  try {
    const response = await fetch(
      `https://myanimelist.net/mangalist/${username}/load.json`,
    );
    const data = await response.json();
    return c.json({ data });
  } catch (error: any) {
    return c.json(jikanError(500, error.message), 500);
  }
});

app.get("/users/:username/recommendations", async (c) => {
  const username = c.req.param("username");
  try {
    const html = await fetchMAL(`/profile/${username}/recommendations`);
    const data = parseUserRecommendations(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/users/:username/reviews", async (c) => {
  const username = c.req.param("username");
  try {
    const html = await fetchMAL(`/profile/${username}/reviews`);
    const data = parseReviews(html, "anime"); // User reviews list usually shows both, defaulting to anime type parser
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/users/:username/clubs", async (c) => {
  const username = c.req.param("username");
  try {
    const html = await fetchMAL(`/profile/${username}/clubs`);
    const response = parseUserClubs(html);
    return c.json(response);
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/users/:username/external", async (c) => {
  const username = c.req.param("username");
  try {
    const html = await fetchMAL(`/profile/${username}/`);
    const data = parseUser(html);
    return c.json({ data: data.external });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.onError((err, c) => {
  const status = err.message.includes("404") ? 404 : 500;
  return c.json(jikanError(status, err.message), status);
});

app.notFound((c) => {
  return c.json(jikanError(404, "Resource not found"), 404);
});

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      url.pathname = "/v4/";
      request = new Request(url.toString(), request);
    }
    return app.fetch(request, env, ctx);
  },
};
