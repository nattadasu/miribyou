import { Anime, Title, DateRange } from "./models/anime.js";
import { Manga } from "./models/manga.js";
import { cleanImageUrl } from "./utils.js";

export const ANIME_FIELDS = [
  "id",
  "title",
  "main_picture",
  "alternative_titles",
  "start_date",
  "end_date",
  "synopsis",
  "mean",
  "rank",
  "popularity",
  "num_list_users",
  "num_scoring_users",
  "nsfw",
  "created_at",
  "updated_at",
  "media_type",
  "status",
  "genres",
  "num_episodes",
  "start_season",
  "broadcast",
  "source",
  "average_episode_duration",
  "rating",
  "pictures",
  "background",
  "related_anime",
  "related_manga",
  "recommendations",
  "studios",
  "statistics",
  "num_favorites",
].join(",");

export const MANGA_FIELDS = [
  "id",
  "title",
  "main_picture",
  "alternative_titles",
  "start_date",
  "end_date",
  "synopsis",
  "mean",
  "rank",
  "popularity",
  "num_list_users",
  "num_scoring_users",
  "nsfw",
  "created_at",
  "updated_at",
  "media_type",
  "status",
  "genres",
  "num_volumes",
  "num_chapters",
  "authors{first_name,last_name}",
  "pictures",
  "background",
  "related_anime",
  "related_manga",
  "recommendations",
  "serialization{name}",
  "num_favorites",
].join(",");

const GENRE_THEME_NAMES = new Set([
  "mecha",
  "school",
  "military",
  "historical",
  "music",
  "parody",
  "space",
  "martial arts",
  "super power",
  "vampire",
  "harem",
  "psychological",
  "cyberpunk",
  "game",
  "demons",
  "police",
  "sports",
  "slice of life",
]);

const GENRE_DEMO_NAMES = new Set([
  "shounen",
  "seinen",
  "shoujo",
  "josei",
  "kids",
]);

const GENRE_EXPLICIT_NAMES = new Set(["hentai", "erotica"]);

function classifyGenres(
  nodeGenres: any[],
  type: "anime" | "manga",
): {
  genres: any[];
  explicit_genres: any[];
  themes: any[];
  demographics: any[];
} {
  const genres: any[] = [];
  const explicit_genres: any[] = [];
  const themes: any[] = [];
  const demographics: any[] = [];

  if (!nodeGenres) return { genres, explicit_genres, themes, demographics };

  const isTheme = (name: string) => {
    for (const t of GENRE_THEME_NAMES) {
      if (name.includes(t)) return true;
    }
    return false;
  };

  for (const g of nodeGenres) {
    const nameLower = g.name.toLowerCase();
    const item = {
      mal_id: g.id,
      type,
      name: g.name,
      url: `https://myanimelist.net/${type}/genre/${g.id}`,
    };
    if (isTheme(nameLower)) {
      themes.push(item);
    } else if (GENRE_DEMO_NAMES.has(nameLower)) {
      demographics.push(item);
    } else if (GENRE_EXPLICIT_NAMES.has(nameLower)) {
      explicit_genres.push(item);
    } else {
      genres.push(item);
    }
  }

  return { genres, explicit_genres, themes, demographics };
}

function buildImages(mainPicture: any) {
  const raw = mainPicture?.medium || mainPicture?.large || "";
  const base = cleanImageUrl(raw);
  const small = base.replace(".jpg", "t.jpg");
  const large = base.replace(".jpg", "l.jpg");
  const toWebp = (url: string) =>
    url.endsWith(".jpg") ? url.replace(".jpg", ".webp") : url;
  return {
    jpg: { image_url: base, small_image_url: small, large_image_url: large },
    webp: {
      image_url: toWebp(base),
      small_image_url: toWebp(small),
      large_image_url: toWebp(large),
    },
  };
}

export async function fetchFromMalApi(
  endpoint: string,
  malClientId: string,
  params: Record<string, string> = {},
): Promise<any> {
  const query = new URLSearchParams(params).toString();
  const url = `https://api.myanimelist.net/v2${endpoint}${query ? `?${query}` : ""}`;
  const response = await fetch(url, {
    headers: {
      "X-MAL-CLIENT-ID": malClientId,
      "User-Agent": "miribyou/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `MAL API fetch failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatDate(dateStr: string): string {
  const parts = dateStr.split("-");
  const month = parseInt(parts[1]) || 1;
  const day = parseInt(parts[2]) || 1;
  const year = parts[0] || "";
  return `${MONTH_NAMES_SHORT[month - 1] || "Jan"} ${day}, ${year}`;
}

function parseMalApiDate(
  startDate?: string | null,
  endDate?: string | null,
): DateRange {
  const parsePart = (dateStr?: string | null) => {
    if (!dateStr) return { day: null, month: null, year: null, iso: null };
    const parts = dateStr.split("-");
    const year = parts[0] ? parseInt(parts[0]) : null;
    const month = parts[1] ? parseInt(parts[1]) : null;
    const day = parts[2] ? parseInt(parts[2]) : null;
    const iso = year
      ? `${year.toString().padStart(4, "0")}-${(month || 1).toString().padStart(2, "0")}-${(day || 1).toString().padStart(2, "0")}T00:00:00+00:00`
      : null;
    return { day, month, year, iso };
  };

  const from = parsePart(startDate);
  const to = parsePart(endDate);

  let dateString = "Unknown";
  if (startDate) {
    try {
      dateString = formatDate(startDate);
      if (endDate) {
        dateString += ` to ${formatDate(endDate)}`;
      }
    } catch {
      dateString = startDate;
    }
  }

  return {
    from: from.iso,
    to: to.iso,
    prop: {
      from: { day: from.day, month: from.month, year: from.year },
      to: { day: to.day, month: to.month, year: to.year },
    },
    string: dateString,
  };
}

function mapRelations(node: any): any[] {
  const relationsMap: Record<string, any[]> = {};

  const processRelated = (relatedList: any[], isManga: boolean) => {
    if (!relatedList) return;
    for (const item of relatedList) {
      const relName = (
        item.relation_type_formatted ||
        item.relation_type ||
        "Other"
      )
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
      if (!relationsMap[relName]) {
        relationsMap[relName] = [];
      }
      relationsMap[relName].push({
        mal_id: item.node.id,
        type: isManga ? "manga" : "anime",
        name: item.node.title,
        url: `https://myanimelist.net/${isManga ? "manga" : "anime"}/${item.node.id}`,
      });
    }
  };

  processRelated(node.related_anime, false);
  processRelated(node.related_manga, true);

  return Object.entries(relationsMap).map(([relation, entry]) => ({
    relation,
    entry,
  }));
}

export function parseMalApiAnime(node: any): Anime {
  const title = node.title || "";
  const titles: Title[] = [{ type: "Default", title }];
  if (node.alternative_titles?.en) {
    titles.push({ type: "English", title: node.alternative_titles.en });
  }
  if (node.alternative_titles?.ja) {
    titles.push({ type: "Japanese", title: node.alternative_titles.ja });
  }
  if (node.alternative_titles?.synonyms) {
    for (const syn of node.alternative_titles.synonyms) {
      titles.push({ type: "Synonym", title: syn });
    }
  }

  const images = buildImages(node.main_picture);

  const typeMap: Record<string, string> = {
    tv: "TV",
    ova: "OVA",
    movie: "Movie",
    special: "Special",
    ona: "ONA",
    music: "Music",
  };

  const statusMap: Record<string, string> = {
    finished_airing: "Finished Airing",
    currently_airing: "Currently Airing",
    not_yet_aired: "Not yet aired",
  };

  const ratingMap: Record<string, string> = {
    g: "G - All Ages",
    pg: "PG - Children",
    pg_13: "PG-13 - Teens 13 or older",
    r: "R - 17+ (violence & profanity)",
    rplus: "R+ - Mild Nudity",
    rx: "Rx - Hentai",
  };

  const { genres, explicit_genres, themes, demographics } = classifyGenres(
    node.genres,
    "anime",
  );

  const durationMin = node.average_episode_duration
    ? Math.floor(node.average_episode_duration / 60)
    : null;
  const duration = durationMin ? `${durationMin} min` : null;

  return {
    mal_id: node.id,
    url: `https://myanimelist.net/anime/${node.id}`,
    images,
    trailer: {
      youtube_id: null,
      url: null,
      embed_url: null,
      images: {
        image_url: null,
        small_image_url: null,
        medium_image_url: null,
        large_image_url: null,
        maximum_image_url: null,
      },
    },
    approved: true,
    titles,
    title,
    title_english: node.alternative_titles?.en || null,
    title_japanese: node.alternative_titles?.ja || null,
    title_synonyms: node.alternative_titles?.synonyms || [],
    type: typeMap[node.media_type] || node.media_type || null,
    source: node.source
      ? node.source
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c: string) => c.toUpperCase())
      : null,
    episodes: node.num_episodes || null,
    status: statusMap[node.status] || node.status || null,
    airing: node.status === "currently_airing",
    aired: parseMalApiDate(node.start_date, node.end_date),
    duration,
    rating: ratingMap[node.rating] || node.rating || null,
    score: node.mean || null,
    scored_by: node.num_scoring_users || null,
    rank: node.rank || null,
    popularity: node.popularity || null,
    members: node.num_list_users || null,
    favorites: node.num_favorites || null,
    synopsis: node.synopsis || null,
    background: node.background || null,
    season: node.start_season?.season || null,
    year: node.start_season?.year || null,
    broadcast: {
      day: node.broadcast?.day_of_the_week || null,
      time: node.broadcast?.start_time || null,
      timezone: "Asia/Tokyo",
      string: node.broadcast
        ? `${node.broadcast.day_of_the_week}s at ${node.broadcast.start_time} (JST)`
        : null,
    },
    producers: [],
    licensors: [],
    studios: node.studios
      ? node.studios.map((s: any) => ({
          mal_id: s.id,
          type: "anime",
          name: s.name,
          url: `https://myanimelist.net/anime/producer/${s.id}`,
        }))
      : [],
    genres,
    explicit_genres,
    themes,
    demographics,
    relations: mapRelations(node),
    theme: {
      openings: [],
      endings: [],
    },
    external: [],
    streaming: [],
  };
}

export function parseMalApiManga(node: any): Manga {
  const title = node.title || "";
  const titles: Title[] = [{ type: "Default", title }];
  if (node.alternative_titles?.en) {
    titles.push({ type: "English", title: node.alternative_titles.en });
  }
  if (node.alternative_titles?.ja) {
    titles.push({ type: "Japanese", title: node.alternative_titles.ja });
  }
  if (node.alternative_titles?.synonyms) {
    for (const syn of node.alternative_titles.synonyms) {
      titles.push({ type: "Synonym", title: syn });
    }
  }

  const images = buildImages(node.main_picture);

  const typeMap: Record<string, string> = {
    manga: "Manga",
    novel: "Novel",
    lightnovel: "Light Novel",
    oneshot: "One-shot",
    doujin: "Doujinshi",
    manhwa: "Manhwa",
    manhua: "Manhua",
  };

  const statusMap: Record<string, string> = {
    finished: "Finished",
    currently_publishing: "Publishing",
    not_yet_published: "Not yet published",
  };

  const { genres, explicit_genres, themes, demographics } = classifyGenres(
    node.genres,
    "manga",
  );

  const authors = node.authors
    ? node.authors.map((a: any) => ({
        mal_id: a.node.id,
        type: "people",
        name:
          `${a.node.first_name || ""} ${a.node.last_name || ""}`.trim() ||
          a.node.id.toString(),
        url: `https://myanimelist.net/people/${a.node.id}`,
      }))
    : [];

  const serializations = node.serialization
    ? node.serialization.map((s: any) => ({
        mal_id: s.node?.id || 0,
        type: "manga",
        name: s.node?.name || "",
        url: `https://myanimelist.net/manga/magazine/${s.node?.id || 0}`,
      }))
    : [];

  return {
    mal_id: node.id,
    url: `https://myanimelist.net/manga/${node.id}`,
    images,
    approved: true,
    titles,
    title,
    title_english: node.alternative_titles?.en || null,
    title_japanese: node.alternative_titles?.ja || null,
    title_synonyms: node.alternative_titles?.synonyms || [],
    type: typeMap[node.media_type] || node.media_type || null,
    chapters: node.num_chapters || null,
    volumes: node.num_volumes || null,
    status: statusMap[node.status] || node.status || null,
    publishing: node.status === "currently_publishing",
    published: parseMalApiDate(node.start_date, node.end_date),
    score: node.mean || null,
    scored: node.mean || null,
    scored_by: node.num_scoring_users || null,
    rank: node.rank || null,
    popularity: node.popularity || null,
    members: node.num_list_users || null,
    favorites: node.num_favorites || null,
    synopsis: node.synopsis || null,
    background: node.background || null,
    authors,
    serializations,
    genres,
    explicit_genres,
    themes,
    demographics,
    relations: mapRelations(node),
    external: [],
  };
}

export function mergeAnimeData(api: Anime, scraped: Anime): Anime {
  return {
    ...scraped,
    ...api,
    images: api.images?.jpg?.image_url ? api.images : scraped.images,
    trailer: api.trailer?.youtube_id ? api.trailer : scraped.trailer,
    titles: api.titles && api.titles.length > 1 ? api.titles : scraped.titles,
    title: api.title || scraped.title,
    title_english: api.title_english || scraped.title_english,
    title_japanese: api.title_japanese || scraped.title_japanese,
    title_synonyms:
      api.title_synonyms && api.title_synonyms.length > 0
        ? api.title_synonyms
        : scraped.title_synonyms,
    broadcast: api.broadcast?.string ? api.broadcast : scraped.broadcast,
    producers:
      api.producers && api.producers.length > 0
        ? api.producers
        : scraped.producers,
    licensors:
      api.licensors && api.licensors.length > 0
        ? api.licensors
        : scraped.licensors,
    studios:
      api.studios && api.studios.length > 0 ? api.studios : scraped.studios,
    genres: api.genres && api.genres.length > 0 ? api.genres : scraped.genres,
    explicit_genres:
      api.explicit_genres && api.explicit_genres.length > 0
        ? api.explicit_genres
        : scraped.explicit_genres,
    themes: api.themes && api.themes.length > 0 ? api.themes : scraped.themes,
    demographics:
      api.demographics && api.demographics.length > 0
        ? api.demographics
        : scraped.demographics,
    relations:
      api.relations && api.relations.length > 0
        ? api.relations
        : scraped.relations,
    theme: api.theme?.openings?.length ? api.theme : scraped.theme,
    external:
      api.external && api.external.length > 0 ? api.external : scraped.external,
    streaming:
      api.streaming && api.streaming.length > 0
        ? api.streaming
        : scraped.streaming,
  };
}

export function mergeMangaData(api: Manga, scraped: Manga): Manga {
  return {
    ...scraped,
    ...api,
    images: api.images?.jpg?.image_url ? api.images : scraped.images,
    titles: api.titles && api.titles.length > 1 ? api.titles : scraped.titles,
    title: api.title || scraped.title,
    title_english: api.title_english || scraped.title_english,
    title_japanese: api.title_japanese || scraped.title_japanese,
    title_synonyms:
      api.title_synonyms && api.title_synonyms.length > 0
        ? api.title_synonyms
        : scraped.title_synonyms,
    authors:
      api.authors && api.authors.length > 0 ? api.authors : scraped.authors,
    serializations:
      api.serializations && api.serializations.length > 0
        ? api.serializations
        : scraped.serializations,
    genres: api.genres && api.genres.length > 0 ? api.genres : scraped.genres,
    explicit_genres:
      api.explicit_genres && api.explicit_genres.length > 0
        ? api.explicit_genres
        : scraped.explicit_genres,
    themes: api.themes && api.themes.length > 0 ? api.themes : scraped.themes,
    demographics:
      api.demographics && api.demographics.length > 0
        ? api.demographics
        : scraped.demographics,
    relations:
      api.relations && api.relations.length > 0
        ? api.relations
        : scraped.relations,
    external:
      api.external && api.external.length > 0 ? api.external : scraped.external,
  };
}
