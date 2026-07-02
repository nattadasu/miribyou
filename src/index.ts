import { Hono } from "hono";
import { trimTrailingSlash } from "hono/trailing-slash";

import {
  fetchMAL,
  jikanError,
  resolveSearchDate,
  mapConcurrent,
} from "./utils";
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
import { parseAnimeCharacters } from "./parsers/characters";
import { parseAnimeStaff } from "./parsers/staff";
import { parseAnimeSearch } from "./parsers/anime_search";
import {
  parseAnimeEpisodes,
  parseAnimeEpisode,
} from "./parsers/anime_episodes";
import { parseNews } from "./parsers/news";
import { parseForum } from "./parsers/forum";
import { parseAnimeVideos, parseAnimeVideosEpisodes } from "./parsers/videos";
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
import { parseSeasonList, parseSeason } from "./parsers/seasons";
import {
  parseCharacter,
  parseCharacterAnime,
  parseCharacterManga,
  parseCharacterVoices,
  parseCharacterPictures,
} from "./parsers/character";

const app = new Hono<{ Bindings: { MAL_CLIENT_ID?: string } }>().basePath(
  "/v4",
);

app.use(trimTrailingSlash());

app.use("*", async (c, next) => {
  await next();
  c.header("X-Powered-By", "miribyou (Jikan-like)");

  const status = c.res.status;
  const path = c.req.path;
  const isRoot = path === "/" || path === "/v4" || path === "/v4/";

  if (c.req.method === "GET" && status >= 200 && status < 300 && !isRoot) {
    c.header("Cache-Control", "public, max-age=86400, s-maxage=86400");
    c.header("CDN-Cache-Control", "public, max-age=86400, s-maxage=86400");
    c.header(
      "Vercel-CDN-Cache-Control",
      "public, max-age=86400, s-maxage=86400",
    );
  }
});

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

function parseSearchDate(dateStr?: string) {
  if (!dateStr) return { y: 0, m: 0, d: 0 };
  const parts = dateStr.split("-");
  return {
    y: parseInt(parts[0]) || 0,
    m: parseInt(parts[1]) || 0,
    d: parseInt(parts[2]) || 0,
  };
}

function stripListFields(obj: any): any {
  delete obj.relations;
  delete obj.theme;
  delete obj.external;
  delete obj.streaming;
  return obj;
}

function calculateAge(
  birthdayIso: string | null | undefined,
): number | undefined {
  if (!birthdayIso) return undefined;
  const birthDate = new Date(birthdayIso);
  if (isNaN(birthDate.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

app.get("/anime", async (c) => {
  const q = c.req.query("q") || "";
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "25");
  const hover = c.req.query("hover") === "1" || c.req.query("hover") === "true";

  // Jikan filters
  const type = c.req.query("type");
  const score = c.req.query("score")
    ? parseFloat(c.req.query("score")!)
    : undefined;
  const min_score = c.req.query("min_score")
    ? parseFloat(c.req.query("min_score")!)
    : undefined;
  const max_score = c.req.query("max_score")
    ? parseFloat(c.req.query("max_score")!)
    : undefined;
  const status = c.req.query("status");
  const rating = c.req.query("rating");
  const sfwParam = c.req.query("sfw");
  const sfw =
    sfwParam !== undefined && sfwParam !== "false" && sfwParam !== "0";
  const genres = c.req.query("genres");
  const genres_exclude = c.req.query("genres_exclude");
  const order_by = c.req.query("order_by");
  const sort = c.req.query("sort") || "asc";
  const letter = c.req.query("letter");
  const producers = c.req.query("producers");
  const start_date = c.req.query("start_date");
  const end_date = c.req.query("end_date");

  if (!q && !letter && !genres && !producers) {
    return c.json(
      jikanError(400, 'Query parameter "q" is required for search'),
      400,
    );
  }

  // Type Mapping for MAL
  const typeMap: Record<string, number> = {
    tv: 1,
    ova: 2,
    movie: 3,
    special: 4,
    ona: 5,
    music: 6,
  };
  const malType = type ? typeMap[type.toLowerCase()] || 0 : 0;

  // Status Mapping for MAL
  const statusMap: Record<string, number> = {
    airing: 1,
    complete: 2,
    upcoming: 3,
  };
  const malStatus = status ? statusMap[status.toLowerCase()] || 0 : 0;

  // Rating Mapping for MAL
  const ratingMap: Record<string, number> = {
    g: 1,
    pg: 2,
    pg13: 3,
    r17: 4,
    r: 5,
    rx: 6,
  };
  const malRating = rating ? ratingMap[rating.toLowerCase()] || 0 : 0;

  // Sorting Mapping for MAL (o=col, w=way)
  const orderByMap: Record<string, number> = {
    title: 1,
    type: 2,
    episodes: 3,
    score: 4,
    start_date: 5,
    end_date: 6,
    members: 7,
    popularity: 7,
  };
  const malOrderBy = order_by ? orderByMap[order_by.toLowerCase()] || 0 : 0;
  const malSort = sort.toLowerCase() === "desc" ? 2 : 1;

  const malClientId = c.req.header("x-mal-client-id") || c.env.MAL_CLIENT_ID;
  if (malClientId) {
    try {
      const offset = (page - 1) * limit;
      const apiResponse = await fetchFromMalApi("/anime", malClientId, {
        q: q || (letter ? letter : ""),
        limit: "100",
        offset: offset.toString(),
        fields: ANIME_FIELDS,
        nsfw: "true",
      });
      let results = (apiResponse.data || []).map((item: any) =>
        stripListFields(parseMalApiAnime(item.node)),
      );

      // In-Memory filtering
      results = results.filter((item: any) => {
        if (type && item.type?.toLowerCase() !== type.toLowerCase())
          return false;
        if (item.score !== null && item.score !== undefined) {
          if (score !== undefined && item.score !== score) return false;
          if (min_score !== undefined && item.score < min_score) return false;
          if (max_score !== undefined && item.score > max_score) return false;
        }
        if (status && item.status) {
          const sLower = item.status.toLowerCase();
          if (status === "airing" && !sLower.includes("airing")) return false;
          if (status === "complete" && !sLower.includes("finished"))
            return false;
          if (status === "upcoming" && !sLower.includes("not yet"))
            return false;
        }
        if (rating && item.rating) {
          const rLower = item.rating.toLowerCase();
          if (rating === "g" && !rLower.includes("g -")) return false;
          if (rating === "pg" && !rLower.includes("pg -")) return false;
          if (rating === "pg13" && !rLower.includes("pg-13")) return false;
          if (rating === "r17" && !rLower.includes("r - 17")) return false;
          if (rating === "r" && !rLower.includes("r+")) return false;
          if (rating === "rx" && !rLower.includes("rx")) return false;
        }
        if (sfw) {
          if (item.rating?.toLowerCase().includes("rx")) return false;
          if (
            item.genres?.some(
              (g: any) => g.mal_id === 12 || g.name?.toLowerCase() === "hentai",
            )
          )
            return false;
        }
        if (genres) {
          const gIds = genres
            .split(",")
            .map((id) => parseInt(id.trim()))
            .filter((id) => !isNaN(id));
          if (gIds.length > 0 && item.genres) {
            const itemGIds = item.genres.map((g: any) => g.mal_id);
            if (!gIds.every((id) => itemGIds.includes(id))) return false;
          }
        }
        if (genres_exclude) {
          const gIds = genres_exclude
            .split(",")
            .map((id) => parseInt(id.trim()))
            .filter((id) => !isNaN(id));
          if (gIds.length > 0 && item.genres) {
            const itemGIds = item.genres.map((g: any) => g.mal_id);
            if (gIds.some((id) => itemGIds.includes(id))) return false;
          }
        }
        if (
          letter &&
          item.title &&
          !item.title.toLowerCase().startsWith(letter.toLowerCase())
        )
          return false;
        if (start_date && item.aired?.from) {
          if (
            new Date(item.aired.from).getTime() < new Date(start_date).getTime()
          )
            return false;
        }
        if (end_date && item.aired?.to) {
          if (new Date(item.aired.to).getTime() > new Date(end_date).getTime())
            return false;
        }
        return true;
      });

      if (order_by) {
        results.sort((a: any, b: any) => {
          const valA = a[order_by.toLowerCase()] ?? 0;
          const valB = b[order_by.toLowerCase()] ?? 0;
          if (sort.toLowerCase() === "desc") {
            return valA < valB ? 1 : valA > valB ? -1 : 0;
          } else {
            return valA > valB ? 1 : valA < valB ? -1 : 0;
          }
        });
      }

      const hasNext = apiResponse.paging?.next ? true : false;
      return c.json({
        pagination: {
          last_visible_page: hasNext ? page + 1 : page,
          has_next_page: hasNext,
          current_page: page,
          items: {
            count: results.length,
            total: results.length + (hasNext ? 50 : 0),
            per_page: limit,
          },
        },
        data: results.slice(0, limit),
      });
    } catch (error: any) {
      return c.json(jikanError(500, error.message), 500);
    }
  }

  const show = Math.floor(((page - 1) * limit) / 50) * 50;

  const malParams = new URLSearchParams();
  if (q) malParams.set("q", q);
  malParams.set("show", show.toString());
  if (malType) malParams.set("type", malType.toString());

  const minScoreMAL =
    min_score !== undefined ? min_score : score !== undefined ? score : 0;
  malParams.set("score", Math.floor(minScoreMAL).toString());

  if (malStatus) malParams.set("status", malStatus.toString());
  if (malRating) malParams.set("r", malRating.toString());

  const start = parseSearchDate(start_date);
  malParams.set("sm", start.m.toString());
  malParams.set("sd", start.d.toString());
  malParams.set("sy", start.y.toString());

  const end = parseSearchDate(end_date);
  malParams.set("em", end.m.toString());
  malParams.set("ed", end.d.toString());
  malParams.set("ey", end.y.toString());

  let genreQuery = "";
  if (genres) {
    genres.split(",").forEach((id) => {
      genreQuery += `&genre[]=${encodeURIComponent(id.trim())}`;
    });
  } else if (genres_exclude) {
    genres_exclude.split(",").forEach((id) => {
      genreQuery += `&genre[]=${encodeURIComponent(id.trim())}`;
    });
    malParams.set("gx", "1");
  }

  if (letter) {
    malParams.set("letter", letter.toUpperCase());
  }

  if (producers) {
    malParams.set("p", producers.split(",")[0].trim());
  }

  if (malOrderBy) {
    malParams.set("o", malOrderBy.toString());
    malParams.set("w", malSort.toString());
  }

  const columns = ["a", "b", "c", "d", "e", "f", "g"];
  let colQuery = "";
  columns.forEach((c) => {
    colQuery += `&c[]=${c}`;
  });

  try {
    const html = await fetchMAL(
      `/anime.php?${malParams.toString()}${genreQuery}${colQuery}`,
    );
    const data = parseAnimeSearch(html);

    if (hover && data.data.length > 0) {
      await mapConcurrent(
        data.data,
        async (item: any) => {
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
        },
        5,
      );
    }

    let results = data.data;
    results = results.filter((item: any) => {
      if (item.score !== null && item.score !== undefined) {
        if (score !== undefined && item.score !== score) return false;
        if (min_score !== undefined && item.score < min_score) return false;
        if (max_score !== undefined && item.score > max_score) return false;
      }

      if (sfw) {
        if (item.rating && item.rating.toLowerCase().includes("rx"))
          return false;
        if (
          item.genres &&
          item.genres.some(
            (g: any) => g.mal_id === 12 || g.name?.toLowerCase() === "hentai",
          )
        )
          return false;
      }

      if (genres && genres_exclude && item.genres && item.genres.length > 0) {
        const excludeIds = genres_exclude
          .split(",")
          .map((id) => parseInt(id.trim()))
          .filter((id) => !isNaN(id));
        const itemGIds = item.genres.map((g: any) => g.mal_id);
        if (excludeIds.some((id) => itemGIds.includes(id))) return false;
      }

      return true;
    });

    if (order_by) {
      results.sort((a: any, b: any) => {
        const valA = a[order_by.toLowerCase()] ?? 0;
        const valB = b[order_by.toLowerCase()] ?? 0;
        if (sort.toLowerCase() === "desc") {
          return valA < valB ? 1 : valA > valB ? -1 : 0;
        } else {
          return valA > valB ? 1 : valA < valB ? -1 : 0;
        }
      });
    }

    const startIndex = ((page - 1) * limit) % 50;
    const endIndex = startIndex + limit;
    const slicedData = results.slice(startIndex, endIndex);

    slicedData.forEach((item: any) => delete item._raw_aired);

    const hasNext = data.pagination.has_next_page || endIndex < results.length;
    const lastVisiblePage = Math.ceil(
      (data.pagination.last_visible_page * 50) / limit,
    );

    return c.json({
      pagination: {
        last_visible_page: lastVisiblePage,
        has_next_page: hasNext,
        current_page: page,
        items: {
          count: slicedData.length,
          total: data.pagination.last_visible_page * 50,
          per_page: limit,
        },
      },
      data: slicedData,
    });
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
  const page = c.req.query("page") || "1";
  try {
    const html = await fetchMAL(`/anime/${id}/_/news?p=${page}`);
    const { pagination, data } = parseNews(html);
    return c.json({ pagination, data });
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
    const page = c.req.query("page") || "1";
  try {
    const html = await fetchMAL(`/anime/${id}/_/video?p=${page}`);
    const { pagination, data } = parseAnimeVideosEpisodes(html);
    return c.json({ pagination, data });
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
  const page = c.req.query("page") || "1";
  const preliminary = c.req.query("preliminary") !== "false";
  const spoilers = c.req.query("spoilers") !== "false";
  try {
    const html = await fetchMAL(
      `/anime/${id}/_/reviews?p=${page}&spoiler=${spoilers ? "on" : "off"}&preliminary=${preliminary ? "on" : "off"}`,
    );
    const { pagination, data } = parseReviews(html, "anime");
    return c.json({ pagination, data });
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
  const q = c.req.query("q") || "";
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "25");
  const hover = c.req.query("hover") === "1" || c.req.query("hover") === "true";

  // Jikan filters
  const type = c.req.query("type");
  const score = c.req.query("score")
    ? parseFloat(c.req.query("score")!)
    : undefined;
  const min_score = c.req.query("min_score")
    ? parseFloat(c.req.query("min_score")!)
    : undefined;
  const max_score = c.req.query("max_score")
    ? parseFloat(c.req.query("max_score")!)
    : undefined;
  const status = c.req.query("status");
  const sfwParam = c.req.query("sfw");
  const sfw =
    sfwParam !== undefined && sfwParam !== "false" && sfwParam !== "0";
  const genres = c.req.query("genres");
  const genres_exclude = c.req.query("genres_exclude");
  const order_by = c.req.query("order_by");
  const sort = c.req.query("sort") || "asc";
  const letter = c.req.query("letter");
  const magazines = c.req.query("magazines");
  const start_date = c.req.query("start_date");
  const end_date = c.req.query("end_date");

  if (!q && !letter && !genres && !magazines) {
    return c.json(
      jikanError(400, 'Query parameter "q" is required for search'),
      400,
    );
  }

  // Type Mapping for MAL manga type
  const typeMap: Record<string, number> = {
    manga: 1,
    novel: 2,
    lightnovel: 2,
    oneshot: 3,
    doujin: 4,
    manhwa: 5,
    manhua: 6,
  };
  const malType = type ? typeMap[type.toLowerCase()] || 0 : 0;

  // Status Mapping for MAL manga status
  const statusMap: Record<string, number> = {
    publishing: 1,
    complete: 2,
    hiatus: 3,
    discontinued: 4,
    upcoming: 5,
  };
  const malStatus = status ? statusMap[status.toLowerCase()] || 0 : 0;

  // Sorting Mapping for MAL manga (o=col, w=way)
  const orderByMap: Record<string, number> = {
    title: 1,
    type: 2,
    chapters: 3,
    volumes: 4,
    score: 5,
    start_date: 6,
    end_date: 7,
    members: 8,
    popularity: 8,
  };
  const malOrderBy = order_by ? orderByMap[order_by.toLowerCase()] || 0 : 0;
  const malSort = sort.toLowerCase() === "desc" ? 2 : 1;

  const malClientId = c.req.header("x-mal-client-id") || c.env.MAL_CLIENT_ID;
  if (malClientId) {
    try {
      const offset = (page - 1) * limit;
      const apiResponse = await fetchFromMalApi("/manga", malClientId, {
        q: q || (letter ? letter : ""),
        limit: "100",
        offset: offset.toString(),
        fields: MANGA_FIELDS,
        nsfw: "true",
      });
      let results = (apiResponse.data || []).map((item: any) =>
        stripListFields(parseMalApiManga(item.node)),
      );

      // In-Memory filtering
      results = results.filter((item: any) => {
        if (type && item.type?.toLowerCase() !== type.toLowerCase())
          return false;
        if (item.score !== null && item.score !== undefined) {
          if (score !== undefined && item.score !== score) return false;
          if (min_score !== undefined && item.score < min_score) return false;
          if (max_score !== undefined && item.score > max_score) return false;
        }
        if (status && item.status) {
          const sLower = item.status.toLowerCase();
          if (status === "publishing" && !sLower.includes("publishing"))
            return false;
          if (status === "complete" && !sLower.includes("finished"))
            return false;
          if (status === "hiatus" && !sLower.includes("hiatus")) return false;
          if (status === "discontinued" && !sLower.includes("discontinued"))
            return false;
          if (status === "upcoming" && !sLower.includes("not yet"))
            return false;
        }
        if (sfw) {
          if (
            item.genres?.some(
              (g: any) =>
                g.mal_id === 12 ||
                g.name?.toLowerCase() === "hentai" ||
                g.mal_id === 50 ||
                g.name?.toLowerCase() === "erotica",
            )
          )
            return false;
        }
        if (genres) {
          const gIds = genres
            .split(",")
            .map((id) => parseInt(id.trim()))
            .filter((id) => !isNaN(id));
          if (gIds.length > 0 && item.genres) {
            const itemGIds = item.genres.map((g: any) => g.mal_id);
            if (!gIds.every((id) => itemGIds.includes(id))) return false;
          }
        }
        if (genres_exclude) {
          const gIds = genres_exclude
            .split(",")
            .map((id) => parseInt(id.trim()))
            .filter((id) => !isNaN(id));
          if (gIds.length > 0 && item.genres) {
            const itemGIds = item.genres.map((g: any) => g.mal_id);
            if (gIds.some((id) => itemGIds.includes(id))) return false;
          }
        }
        if (
          letter &&
          item.title &&
          !item.title.toLowerCase().startsWith(letter.toLowerCase())
        )
          return false;
        if (start_date && item.published?.from) {
          if (
            new Date(item.published.from).getTime() <
            new Date(start_date).getTime()
          )
            return false;
        }
        if (end_date && item.published?.to) {
          if (
            new Date(item.published.to).getTime() > new Date(end_date).getTime()
          )
            return false;
        }
        return true;
      });

      if (order_by) {
        results.sort((a: any, b: any) => {
          const valA = a[order_by.toLowerCase()] ?? 0;
          const valB = b[order_by.toLowerCase()] ?? 0;
          if (sort.toLowerCase() === "desc") {
            return valA < valB ? 1 : valA > valB ? -1 : 0;
          } else {
            return valA > valB ? 1 : valA < valB ? -1 : 0;
          }
        });
      }

      const hasNext = apiResponse.paging?.next ? true : false;
      return c.json({
        pagination: {
          last_visible_page: hasNext ? page + 1 : page,
          has_next_page: hasNext,
          current_page: page,
          items: {
            count: results.length,
            total: results.length + (hasNext ? 50 : 0),
            per_page: limit,
          },
        },
        data: results.slice(0, limit),
      });
    } catch (error: any) {
      return c.json(jikanError(500, error.message), 500);
    }
  }

  const show = Math.floor(((page - 1) * limit) / 50) * 50;

  const malParams = new URLSearchParams();
  if (q) malParams.set("q", q);
  malParams.set("show", show.toString());
  if (malType) malParams.set("type", malType.toString());

  const minScoreMAL =
    min_score !== undefined ? min_score : score !== undefined ? score : 0;
  malParams.set("score", Math.floor(minScoreMAL).toString());

  if (malStatus) malParams.set("status", malStatus.toString());

  const start = parseSearchDate(start_date);
  malParams.set("sm", start.m.toString());
  malParams.set("sd", start.d.toString());
  malParams.set("sy", start.y.toString());

  const end = parseSearchDate(end_date);
  malParams.set("em", end.m.toString());
  malParams.set("ed", end.d.toString());
  malParams.set("ey", end.y.toString());

  let genreQuery = "";
  if (genres) {
    genres.split(",").forEach((id) => {
      genreQuery += `&genre[]=${encodeURIComponent(id.trim())}`;
    });
  } else if (genres_exclude) {
    genres_exclude.split(",").forEach((id) => {
      genreQuery += `&genre[]=${encodeURIComponent(id.trim())}`;
    });
    malParams.set("gx", "1");
  }

  if (letter) {
    malParams.set("letter", letter.toUpperCase());
  }

  if (magazines) {
    malParams.set("mid", magazines.split(",")[0].trim());
  }

  if (malOrderBy) {
    malParams.set("o", malOrderBy.toString());
    malParams.set("w", malSort.toString());
  }

  const columns = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  let colQuery = "";
  columns.forEach((c) => {
    colQuery += `&c[]=${c}`;
  });

  try {
    const html = await fetchMAL(
      `/manga.php?${malParams.toString()}${genreQuery}${colQuery}`,
    );
    const data = parseMangaSearch(html);

    if (hover && data.data.length > 0) {
      await mapConcurrent(
        data.data,
        async (item: any) => {
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
        },
        5,
      );
    }

    let results = data.data;
    results = results.filter((item: any) => {
      if (item.score !== null && item.score !== undefined) {
        if (score !== undefined && item.score !== score) return false;
        if (min_score !== undefined && item.score < min_score) return false;
        if (max_score !== undefined && item.score > max_score) return false;
      }

      if (sfw) {
        if (
          item.genres &&
          item.genres.some(
            (g: any) =>
              g.mal_id === 12 ||
              g.name?.toLowerCase() === "hentai" ||
              g.mal_id === 50 ||
              g.name?.toLowerCase() === "erotica",
          )
        )
          return false;
      }

      if (genres && genres_exclude && item.genres && item.genres.length > 0) {
        const excludeIds = genres_exclude
          .split(",")
          .map((id) => parseInt(id.trim()))
          .filter((id) => !isNaN(id));
        const itemGIds = item.genres.map((g: any) => g.mal_id);
        if (excludeIds.some((id) => itemGIds.includes(id))) return false;
      }

      return true;
    });

    if (order_by) {
      results.sort((a: any, b: any) => {
        const valA = a[order_by.toLowerCase()] ?? 0;
        const valB = b[order_by.toLowerCase()] ?? 0;
        if (sort.toLowerCase() === "desc") {
          return valA < valB ? 1 : valA > valB ? -1 : 0;
        } else {
          return valA > valB ? 1 : valA < valB ? -1 : 0;
        }
      });
    }

    const startIndex = ((page - 1) * limit) % 50;
    const endIndex = startIndex + limit;
    const slicedData = results.slice(startIndex, endIndex);

    slicedData.forEach((item: any) => delete item._raw_published);

    const hasNext = data.pagination.has_next_page || endIndex < results.length;
    const lastVisiblePage = Math.ceil(
      (data.pagination.last_visible_page * 50) / limit,
    );

    return c.json({
      pagination: {
        last_visible_page: lastVisiblePage,
        has_next_page: hasNext,
        current_page: page,
        items: {
          count: slicedData.length,
          total: data.pagination.last_visible_page * 50,
          per_page: limit,
        },
      },
      data: slicedData,
    });
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
  const page = c.req.query("page") || "1";
  try {
    const html = await fetchMAL(`/manga/${id}/_/news?p=${page}`);
    const { pagination, data } = parseNews(html);
    return c.json({ pagination, data });
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
  const page = c.req.query("page") || "1";
  const preliminary = c.req.query("preliminary") !== "false";
  const spoilers = c.req.query("spoilers") !== "false";
  try {
    const html = await fetchMAL(
      `/manga/${id}/_/reviews?p=${page}&spoiler=${spoilers ? "on" : "off"}&preliminary=${preliminary ? "on" : "off"}`,
    );
    const { pagination, data } = parseReviews(html, "manga");
    return c.json({ pagination, data });
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

// ── Characters ──

app.get("/characters/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/character/${id}`);
    const data = parseCharacter(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/characters/:id/full", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/character/${id}`);
    const data = parseCharacter(html);
    const anime = parseCharacterAnime(html);
    const manga = parseCharacterManga(html);
    const voices = parseCharacterVoices(html);
    return c.json({ data: { ...data, anime, manga, voices } });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/characters/:id/anime", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/character/${id}`);
    const data = parseCharacterAnime(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/characters/:id/manga", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/character/${id}`);
    const data = parseCharacterManga(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/characters/:id/voices", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/character/${id}`);
    const data = parseCharacterVoices(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/characters/:id/pictures", async (c) => {
  const id = c.req.param("id");
  try {
    const html = await fetchMAL(`/character/${id}/_/pics`);
    const data = parseCharacterPictures(html);
    return c.json({ data });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

function getCurrentSeason() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  let season: "winter" | "spring" | "summer" | "fall";
  if (month < 3) season = "winter";
  else if (month < 6) season = "spring";
  else if (month < 9) season = "summer";
  else season = "fall";

  return { year, season };
}

function getNextSeason(year: number, season: string) {
  const seasons = ["winter", "spring", "summer", "fall"];
  let idx = seasons.indexOf(season.toLowerCase());
  if (idx === -1) idx = 0;

  idx++;
  if (idx === 4) {
    return { year: year + 1, season: "winter" };
  }
  return { year, season: seasons[idx] };
}

app.get("/seasons", async (c) => {
  try {
    const html = await fetchMAL("/anime/season/archive");
    const data = parseSeasonList(html);
    return c.json(data);
  } catch (error: any) {
    return c.json(jikanError(500, error.message), 500);
  }
});

app.get("/seasons/now", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "25");
  const hover = c.req.query("hover") === "1" || c.req.query("hover") === "true";
  const filter = c.req.query("filter");
  const sfwParam = c.req.query("sfw");
  const sfw =
    sfwParam !== undefined && sfwParam !== "false" && sfwParam !== "0";
  const continuingParam = c.req.query("continuing");
  const includeContinuing =
    continuingParam !== undefined &&
    continuingParam !== "false" &&
    continuingParam !== "0";

  const malClientId = c.req.header("x-mal-client-id") || c.env.MAL_CLIENT_ID;
  if (malClientId) {
    try {
      const { year, season } = getCurrentSeason();
      const offset = (page - 1) * limit;
      const apiResponse = await fetchFromMalApi(
        `/anime/season/${year}/${season}`,
        malClientId,
        {
          limit: "100", // Fetch more for filtering
          offset: offset.toString(),
          fields: ANIME_FIELDS,
          nsfw: "true",
        },
      );
      let results = (apiResponse.data || []).map((item: any) => {
        const data = stripListFields(parseMalApiAnime(item.node));
        const startSeason = item.node.start_season;
        data.continuing = startSeason
          ? startSeason.season !== season || startSeason.year !== year
          : false;
        return data;
      });

      if (!includeContinuing) {
        results = results.filter((item: any) => !item.continuing);
      }
      if (filter) {
        results = results.filter(
          (item: any) => item.type?.toLowerCase() === filter.toLowerCase(),
        );
      }
      if (sfw) {
        results = results.filter((item: any) => {
          if (item.rating?.toLowerCase().includes("rx")) return false;
          if (
            item.genres?.some(
              (g: any) => g.mal_id === 12 || g.name?.toLowerCase() === "hentai",
            )
          )
            return false;
          if (item.explicit_genres?.length > 0) return false;
          return true;
        });
      }

      results.forEach((item: any) => delete item.continuing);
      const slicedData = results.slice(0, limit);
      const hasNext = apiResponse.paging?.next ? true : false;
      const hasNextPage = results.length > limit || hasNext;
      const totalEstimate = offset + results.length + (hasNext ? 100 : 0);
      return c.json({
        pagination: {
          last_visible_page: Math.ceil(totalEstimate / limit),
          has_next_page: hasNextPage,
          current_page: page,
          items: {
            count: slicedData.length,
            total: totalEstimate,
            per_page: limit,
          },
        },
        data: slicedData,
      });
    } catch (e) {
      // Fallback to scraper if API fails
    }
  }

  try {
    const html = await fetchMAL("/anime/season");
    const data = parseSeason(html);
    const { year: currentYear, season: currentSeason } = getCurrentSeason();
    let results = data.data.map((item: any) => {
      item.year = currentYear;
      item.season = currentSeason;
      return item;
    });

    if (!includeContinuing) {
      results = results.filter((item: any) => !item.continuing);
    }
    if (filter) {
      results = results.filter(
        (item: any) => item.type?.toLowerCase() === filter.toLowerCase(),
      );
    }
    if (sfw) {
      results = results.filter((item: any) => {
        if (item.rating?.toLowerCase().includes("rx")) return false;
        if (
          item.genres?.some(
            (g: any) => g.mal_id === 12 || g.name?.toLowerCase() === "hentai",
          )
        )
          return false;
        if (item.explicit_genres?.length > 0) return false;
        return true;
      });
    }

    results.forEach((item: any) => delete item.continuing);
    if (hover && results.length > 0) {
      const startIndex = (page - 1) * limit;
      const toEnrich = results.slice(startIndex, startIndex + limit);
      await mapConcurrent(
        toEnrich,
        async (item: any) => {
          const hoverHtml = await fetchMAL(`/anime/${item.mal_id}/hover`, {
            "X-Requested-With": "XMLHttpRequest",
          });
          const hoverData = parseHover(hoverHtml);
          if (hoverData.score !== null) item.score = hoverData.score;
          if (hoverData.scored_by !== null)
            item.scored_by = hoverData.scored_by;
          if (hoverData.rank !== null) item.rank = hoverData.rank;
          if (hoverData.popularity !== null)
            item.popularity = hoverData.popularity;
          if (hoverData.members !== null) item.members = hoverData.members;
          if (hoverData.status) item.status = hoverData.status;
          if (hoverData.synopsis && item.synopsis.endsWith("..."))
            item.synopsis = hoverData.synopsis;
          if (hoverData.genres.length) item.genres = hoverData.genres;
          if (hoverData.themes.length) item.themes = hoverData.themes;
          if (hoverData.demographics.length)
            item.demographics = hoverData.demographics;
        },
        5,
      );
    }

    const startIndex = (page - 1) * limit;
    const slicedData = results.slice(startIndex, startIndex + limit);
    const totalCount =
      filter || sfw || !includeContinuing
        ? results.length
        : data.total || results.length;
    const hasNext = startIndex + limit < totalCount;

    return c.json({
      pagination: {
        last_visible_page: Math.ceil(totalCount / limit),
        has_next_page: hasNext,
        current_page: page,
        items: {
          count: slicedData.length,
          total: totalCount,
          per_page: limit,
        },
      },
      data: slicedData,
    });
  } catch (error: any) {
    return c.json(jikanError(500, error.message), 500);
  }
});

app.get("/seasons/upcoming", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "25");
  const hover = c.req.query("hover") === "1" || c.req.query("hover") === "true";
  const filter = c.req.query("filter");
  const sfwParam = c.req.query("sfw");
  const sfw =
    sfwParam !== undefined && sfwParam !== "false" && sfwParam !== "0";
  const continuingParam = c.req.query("continuing");
  const includeContinuing =
    continuingParam !== undefined &&
    continuingParam !== "false" &&
    continuingParam !== "0";

  const malClientId = c.req.header("x-mal-client-id") || c.env.MAL_CLIENT_ID;
  if (malClientId) {
    try {
      const current = getCurrentSeason();
      const next = getNextSeason(current.year, current.season);
      const offset = (page - 1) * limit;
      const apiResponse = await fetchFromMalApi(
        `/anime/season/${next.year}/${next.season}`,
        malClientId,
        {
          limit: "100",
          offset: offset.toString(),
          fields: ANIME_FIELDS,
          nsfw: "true",
        },
      );
      let results = (apiResponse.data || []).map((item: any) => {
        const data = stripListFields(parseMalApiAnime(item.node));
        const startSeason = item.node.start_season;
        data.continuing = startSeason
          ? startSeason.season !== next.season || startSeason.year !== next.year
          : false;
        return data;
      });

      if (!includeContinuing) {
        results = results.filter((item: any) => !item.continuing);
      }
      if (filter) {
        results = results.filter(
          (item: any) => item.type?.toLowerCase() === filter.toLowerCase(),
        );
      }
      if (sfw) {
        results = results.filter((item: any) => {
          if (item.rating?.toLowerCase().includes("rx")) return false;
          if (
            item.genres?.some(
              (g: any) => g.mal_id === 12 || g.name?.toLowerCase() === "hentai",
            )
          )
            return false;
          if (item.explicit_genres?.length > 0) return false;
          return true;
        });
      }

      results.forEach((item: any) => delete item.continuing);
      const slicedData = results.slice(0, limit);
      const hasNext = apiResponse.paging?.next ? true : false;
      const hasNextPage = results.length > limit || hasNext;
      const totalEstimate = offset + results.length + (hasNext ? 100 : 0);
      return c.json({
        pagination: {
          last_visible_page: Math.ceil(totalEstimate / limit),
          has_next_page: hasNextPage,
          current_page: page,
          items: {
            count: slicedData.length,
            total: totalEstimate,
            per_page: limit,
          },
        },
        data: slicedData,
      });
    } catch (e) {
      // Fallback to scraper
    }
  }

  try {
    const html = await fetchMAL("/anime/season/later");
    const data = parseSeason(html);
    const current = getCurrentSeason();
    const next = getNextSeason(current.year, current.season);
    let results = data.data.map((item: any) => {
      item.year = next.year;
      item.season = next.season;
      return item;
    });

    if (!includeContinuing) {
      results = results.filter((item: any) => !item.continuing);
    }
    if (filter) {
      results = results.filter(
        (item: any) => item.type?.toLowerCase() === filter.toLowerCase(),
      );
    }
    if (sfw) {
      results = results.filter((item: any) => {
        if (item.rating?.toLowerCase().includes("rx")) return false;
        if (
          item.genres?.some(
            (g: any) => g.mal_id === 12 || g.name?.toLowerCase() === "hentai",
          )
        )
          return false;
        if (item.explicit_genres?.length > 0) return false;
        return true;
      });
    }

    results.forEach((item: any) => delete item.continuing);
    if (hover && results.length > 0) {
      const startIndex = (page - 1) * limit;
      const toEnrich = results.slice(startIndex, startIndex + limit);
      await mapConcurrent(
        toEnrich,
        async (item: any) => {
          const hoverHtml = await fetchMAL(`/anime/${item.mal_id}/hover`, {
            "X-Requested-With": "XMLHttpRequest",
          });
          const hoverData = parseHover(hoverHtml);
          if (hoverData.score !== null) item.score = hoverData.score;
          if (hoverData.scored_by !== null)
            item.scored_by = hoverData.scored_by;
          if (hoverData.rank !== null) item.rank = hoverData.rank;
          if (hoverData.popularity !== null)
            item.popularity = hoverData.popularity;
          if (hoverData.members !== null) item.members = hoverData.members;
          if (hoverData.status) item.status = hoverData.status;
          if (hoverData.synopsis && item.synopsis.endsWith("..."))
            item.synopsis = hoverData.synopsis;
          if (hoverData.genres.length) item.genres = hoverData.genres;
          if (hoverData.themes.length) item.themes = hoverData.themes;
          if (hoverData.demographics.length)
            item.demographics = hoverData.demographics;
        },
        5,
      );
    }

    const startIndex = (page - 1) * limit;
    const slicedData = results.slice(startIndex, startIndex + limit);
    const totalCount =
      filter || sfw || !includeContinuing
        ? results.length
        : data.total || results.length;
    const hasNext = startIndex + limit < totalCount;

    return c.json({
      pagination: {
        last_visible_page: Math.ceil(totalCount / limit),
        has_next_page: hasNext,
        current_page: page,
        items: {
          count: slicedData.length,
          total: totalCount,
          per_page: limit,
        },
      },
      data: slicedData,
    });
  } catch (error: any) {
    return c.json(jikanError(500, error.message), 500);
  }
});

app.get("/seasons/:year/:season", async (c) => {
  const { year, season } = c.req.param();
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "25");
  const hover = c.req.query("hover") === "1" || c.req.query("hover") === "true";
  const filter = c.req.query("filter");
  const sfwParam = c.req.query("sfw");
  const sfw =
    sfwParam !== undefined && sfwParam !== "false" && sfwParam !== "0";
  const continuingParam = c.req.query("continuing");
  const includeContinuing =
    continuingParam !== undefined &&
    continuingParam !== "false" &&
    continuingParam !== "0";

  const malClientId = c.req.header("x-mal-client-id") || c.env.MAL_CLIENT_ID;
  if (malClientId) {
    try {
      const offset = (page - 1) * limit;
      const apiResponse = await fetchFromMalApi(
        `/anime/season/${year}/${season.toLowerCase()}`,
        malClientId,
        {
          limit: "100",
          offset: offset.toString(),
          fields: ANIME_FIELDS,
          nsfw: "true",
        },
      );
      let results = (apiResponse.data || []).map((item: any) => {
        const data = stripListFields(parseMalApiAnime(item.node));
        const startSeason = item.node.start_season;
        data.continuing = startSeason
          ? startSeason.season !== season.toLowerCase() ||
            startSeason.year !== parseInt(year)
          : false;
        return data;
      });

      if (!includeContinuing) {
        results = results.filter((item: any) => !item.continuing);
      }
      if (filter) {
        results = results.filter(
          (item: any) => item.type?.toLowerCase() === filter.toLowerCase(),
        );
      }
      if (sfw) {
        results = results.filter((item: any) => {
          if (item.rating?.toLowerCase().includes("rx")) return false;
          if (
            item.genres?.some(
              (g: any) => g.mal_id === 12 || g.name?.toLowerCase() === "hentai",
            )
          )
            return false;
          if (item.explicit_genres?.length > 0) return false;
          return true;
        });
      }

      results.forEach((item: any) => delete item.continuing);
      const slicedData = results.slice(0, limit);
      const hasNext = apiResponse.paging?.next ? true : false;
      const hasNextPage = results.length > limit || hasNext;
      const totalEstimate = offset + results.length + (hasNext ? 100 : 0);
      return c.json({
        pagination: {
          last_visible_page: Math.ceil(totalEstimate / limit),
          has_next_page: hasNextPage,
          current_page: page,
          items: {
            count: slicedData.length,
            total: totalEstimate,
            per_page: limit,
          },
        },
        data: slicedData,
      });
    } catch (e) {
      // Fallback to scraper
    }
  }

  try {
    const html = await fetchMAL(
      `/anime/season/${year}/${season.toLowerCase()}`,
    );
    const data = parseSeason(html);
    let results = data.data.map((item: any) => {
      item.year = parseInt(year);
      item.season = season.toLowerCase();
      return item;
    });

    if (!includeContinuing) {
      results = results.filter((item: any) => !item.continuing);
    }
    if (filter) {
      results = results.filter(
        (item: any) => item.type?.toLowerCase() === filter.toLowerCase(),
      );
    }
    if (sfw) {
      results = results.filter((item: any) => {
        if (item.rating?.toLowerCase().includes("rx")) return false;
        if (
          item.genres?.some(
            (g: any) => g.mal_id === 12 || g.name?.toLowerCase() === "hentai",
          )
        )
          return false;
        if (item.explicit_genres?.length > 0) return false;
        return true;
      });
    }

    results.forEach((item: any) => delete item.continuing);
    if (hover && results.length > 0) {
      const startIndex = (page - 1) * limit;
      const toEnrich = results.slice(startIndex, startIndex + limit);
      await mapConcurrent(
        toEnrich,
        async (item: any) => {
          const hoverHtml = await fetchMAL(`/anime/${item.mal_id}/hover`, {
            "X-Requested-With": "XMLHttpRequest",
          });
          const hoverData = parseHover(hoverHtml);
          if (hoverData.score !== null) item.score = hoverData.score;
          if (hoverData.scored_by !== null)
            item.scored_by = hoverData.scored_by;
          if (hoverData.rank !== null) item.rank = hoverData.rank;
          if (hoverData.popularity !== null)
            item.popularity = hoverData.popularity;
          if (hoverData.members !== null) item.members = hoverData.members;
          if (hoverData.status) item.status = hoverData.status;
          if (hoverData.synopsis && item.synopsis.endsWith("..."))
            item.synopsis = hoverData.synopsis;
          if (hoverData.genres.length) item.genres = hoverData.genres;
          if (hoverData.themes.length) item.themes = hoverData.themes;
          if (hoverData.demographics.length)
            item.demographics = hoverData.demographics;
        },
        5,
      );
    }

    const startIndex = (page - 1) * limit;
    const slicedData = results.slice(startIndex, startIndex + limit);
    const totalCount =
      filter || sfw || !includeContinuing
        ? results.length
        : data.total || results.length;
    const hasNext = startIndex + limit < totalCount;

    return c.json({
      pagination: {
        last_visible_page: Math.ceil(totalCount / limit),
        has_next_page: hasNext,
        current_page: page,
        items: {
          count: slicedData.length,
          total: totalCount,
          per_page: limit,
        },
      },
      data: slicedData,
    });
  } catch (error: any) {
    const status = error.message.includes("404") ? 404 : 500;
    return c.json(jikanError(status, error.message), status);
  }
});

app.get("/users", async (c) => {
  const q = c.req.query("q");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "25");

  // Jikan filters
  const gender = c.req.query("gender");
  const location = c.req.query("location");
  const maxAge = c.req.query("maxAge")
    ? parseInt(c.req.query("maxAge")!)
    : undefined;
  const minAge = c.req.query("minAge")
    ? parseInt(c.req.query("minAge")!)
    : undefined;

  if (!q) {
    return c.json(
      jikanError(400, 'Query parameter "q" is required for search'),
      400,
    );
  }

  const malShow = Math.floor(((page - 1) * limit) / 20) * 20;

  try {
    const html = await fetchMAL(
      `/users.php?q=${encodeURIComponent(q)}&show=${malShow}`,
    );
    const data = parseUserSearch(html);

    let results = data.data;

    const hasDemographicFilters =
      gender || location || maxAge !== undefined || minAge !== undefined;
    if (hasDemographicFilters && results.length > 0) {
      const detailedUsers = await Promise.all(
        results.map(async (user: any) => {
          try {
            const profileHtml = await fetchMAL(`/profile/${user.username}`);
            const profile = parseUser(profileHtml);
            return {
              ...user,
              gender: profile.gender,
              location: profile.location,
              age: calculateAge(profile.birthday),
            };
          } catch (e) {
            return null;
          }
        }),
      );

      results = detailedUsers.filter((user: any) => {
        if (!user) return false;

        if (gender && gender.toLowerCase() !== "any") {
          if (
            !user.gender ||
            user.gender.toLowerCase() !== gender.toLowerCase()
          )
            return false;
        }

        if (location) {
          if (
            !user.location ||
            !user.location.toLowerCase().includes(location.toLowerCase())
          )
            return false;
        }

        if (user.age !== undefined) {
          if (minAge !== undefined && user.age < minAge) return false;
          if (maxAge !== undefined && user.age > maxAge) return false;
        } else if (minAge !== undefined || maxAge !== undefined) {
          return false;
        }

        return true;
      });

      results.forEach((user: any) => {
        delete user.gender;
        delete user.location;
        delete user.age;
      });
    }

    const startIndex = ((page - 1) * limit) % 20;
    const endIndex = startIndex + limit;
    const slicedData = results.slice(startIndex, endIndex);

    const hasNext = data.pagination.has_next_page || endIndex < results.length;
    const lastVisiblePage = Math.ceil(
      (data.pagination.last_visible_page * 20) / limit,
    );

    return c.json({
      pagination: {
        last_visible_page: lastVisiblePage,
        has_next_page: hasNext,
        current_page: page,
        items: {
          count: slicedData.length,
          total: data.pagination.last_visible_page * 20,
          per_page: limit,
        },
      },
      data: slicedData,
    });
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
