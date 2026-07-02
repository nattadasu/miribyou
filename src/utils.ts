import { MAL_BASE_URL } from "./constants.js";

const requestCache = new Map<string, Promise<string>>();
const responseCache = new Map<string, { text: string; expires: number }>();
const CACHE_MAX_SIZE = 100;
const CACHE_TTL_MS = 60_000;

function trimRequestCache() {
  if (requestCache.size > CACHE_MAX_SIZE) {
    const keys = [...requestCache.keys()];
    for (let i = 0; i < keys.length - CACHE_MAX_SIZE; i++) {
      requestCache.delete(keys[i]);
    }
  }
}

function trimResponseCache() {
  if (responseCache.size > CACHE_MAX_SIZE) {
    const oldest = [...responseCache.entries()].sort(
      (a, b) => a[1].expires - b[1].expires,
    );
    for (let i = 0; i < oldest.length - CACHE_MAX_SIZE; i++) {
      responseCache.delete(oldest[i][0]);
    }
  }
}

export function clearRequestCache() {
  requestCache.clear();
  responseCache.clear();
}

export async function mapConcurrent<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 5,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  const worker = async () => {
    while (index < items.length) {
      const i = index++;
      try {
        results[i] = await fn(items[i]);
      } catch {
        results[i] = undefined as unknown as R;
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results.filter((r) => r !== undefined);
}

export async function fetchMAL(
  path: string,
  headers: Record<string, string> = {},
): Promise<string> {
  const url = `https://myanimelist.net${path}`;

  const existing = responseCache.get(url);
  if (existing && Date.now() < existing.expires) {
    return existing.text;
  }

  const inflight = requestCache.get(url);
  if (inflight) return inflight;

  trimRequestCache();
  trimResponseCache();

  const promise = (async (): Promise<string> => {
    const text = await doFetchMAL(url, headers);
    responseCache.set(url, { text, expires: Date.now() + CACHE_TTL_MS });
    return text;
  })().finally(() => requestCache.delete(url));

  requestCache.set(url, promise);
  return promise;
}

async function doFetchMAL(
  url: string,
  headers: Record<string, string>,
): Promise<string> {
  const userAgent = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 miribyou",
    ...headers,
  };

  const response = await fetch(url, { headers: userAgent });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`404 on ${url}`);
    }
    throw new Error(
      `MAL fetch failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.text();
}

export function parseMalDate(dateStr: string | null) {
  if (
    !dateStr ||
    dateStr === "Unknown" ||
    dateStr === "None" ||
    dateStr === "?" ||
    dateStr === "Not available"
  ) {
    return {
      from: null,
      to: null,
      prop: {
        from: { day: null, month: null, year: null },
        to: { day: null, month: null, year: null },
      },
      string: dateStr || "Unknown",
    };
  }

  const parts = dateStr.split(" to ");
  const fromStr = parts[0]?.trim();
  const toStr = parts[1]?.trim();

  const fromData = parseSingleDate(fromStr);
  const toData = parseSingleDate(toStr);

  return {
    from: fromData.iso,
    to: toData.iso,
    prop: {
      from: fromData.prop,
      to: toData.prop,
    },
    string: dateStr,
  };
}

export function resolveSearchDate(
  dateStr: string | null,
  hoverYear?: number | null,
) {
  if (!dateStr || dateStr === "Unknown" || dateStr === "-" || dateStr === "?") {
    return {
      from: null,
      to: null,
      prop: {
        from: { day: null, month: null, year: null },
        to: { day: null, month: null, year: null },
      },
      string: "Unknown",
    };
  }

  const parts = dateStr.split(" to ");
  const fromStr = parts[0]?.trim();
  const toStr = parts[1]?.trim();

  const parseYY = (
    str: string,
    refYear: number | null | undefined,
    isEndDate: boolean,
  ) => {
    if (!str || str === "?" || str === "-")
      return { day: null, month: null, year: null, iso: null, formatted: "?" };

    const match = str.match(/(\d{2}|\?\?)-(\d{2}|\?\?)-(\d{2}|\?\?)/);
    if (!match) {
      const fallback = parseSingleDate(str);
      return { ...fallback, formatted: str };
    }

    const mStr = match[1];
    const dStr = match[2];
    const yStr = match[3];

    const m = mStr !== "??" ? parseInt(mStr) : null;
    const d = dStr !== "??" ? parseInt(dStr) : null;
    const yShort = yStr !== "??" ? parseInt(yStr) : null;

    let year = null;
    if (yShort !== null) {
      if (refYear !== undefined && refYear !== null) {
        const century = Math.floor(refYear / 100) * 100;
        year = century + yShort;
        if (isEndDate) {
          if (year < refYear) year += 100;
        } else {
          const diff1 = Math.abs(year - refYear);
          const diff2 = Math.abs(year + 100 - refYear);
          const diff3 = Math.abs(year - 100 - refYear);
          if (diff2 < diff1 && diff2 < diff3) year += 100;
          else if (diff3 < diff1 && diff3 < diff2) year -= 100;
        }
      } else {
        const currentYear = new Date().getFullYear();
        const currentCentury = Math.floor(currentYear / 100) * 100;
        year = currentCentury + yShort;
        if (year > currentYear + 10) {
          year -= 100;
        }
      }
    }

    let iso: string | null = null;
    if (year) {
      const isoM = m ? m.toString().padStart(2, "0") : "01";
      const isoD = d ? d.toString().padStart(2, "0") : "01";
      iso = `${year}-${isoM}-${isoD}T00:00:00+00:00`;
    }

    const fM = m ? m.toString().padStart(2, "0") : "??";
    const fD = d ? d.toString().padStart(2, "0") : "??";
    const fY = year
      ? year.toString()
      : yShort !== null
        ? yShort.toString().padStart(2, "0")
        : "??";
    const formatted = `${fM}-${fD}-${fY}`;

    return { day: d, month: m, year, iso, formatted };
  };

  const fromData = parseYY(fromStr, hoverYear, false);
  const toData = parseYY(toStr, fromData.year || hoverYear, true);

  let finalString = fromData.formatted;
  if (toStr) {
    finalString += ` to ${toData.formatted}`;
  }

  return {
    from: fromData.iso,
    to: toData.iso,
    prop: {
      from: { day: fromData.day, month: fromData.month, year: fromData.year },
      to: { day: toData.day, month: toData.month, year: toData.year },
    },
    string: finalString === "?" ? "Unknown" : finalString,
  };
}

function parseSingleDate(str: string | undefined) {
  if (!str || str === "?" || str === "Unknown")
    return { iso: null, prop: { day: null, month: null, year: null } };

  const months: Record<string, number> = {
    Jan: 1,
    Feb: 2,
    Mar: 3,
    Apr: 4,
    May: 5,
    Jun: 6,
    Jul: 7,
    Aug: 8,
    Sep: 9,
    Oct: 10,
    Nov: 11,
    Dec: 12,
  };

  let day: number | null = null;
  let month: number | null = null;
  let year: number | null = null;

  const fullMatch = str.match(/([a-zA-Z]+)\s+(\d+),\s+(\d+)/);
  if (fullMatch) {
    month = months[fullMatch[1]];
    day = parseInt(fullMatch[2]);
    year = parseInt(fullMatch[3]);
  } else {
    const monthYearMatch = str.match(/([a-zA-Z]+),?\s+(\d+)/);
    if (monthYearMatch) {
      month = months[monthYearMatch[1]];
      year = parseInt(monthYearMatch[2]);
    } else {
      const yearMatch = str.match(/(\d{4})/);
      if (yearMatch) {
        year = parseInt(yearMatch[1]);
      }
    }
  }

  let iso: string | null = null;
  if (year) {
    const m = month ? month.toString().padStart(2, "0") : "01";
    const d = day ? day.toString().padStart(2, "0") : "01";
    iso = `${year}-${m}-${d}T00:00:00+00:00`;
  }

  return {
    iso,
    prop: { day, month, year },
  };
}

export function toIsoDate(str: string | null): string | null {
  if (!str || str === "Unknown") return null;
  if (str === "Now") {
    return new Date().toISOString().split(".")[0] + "+00:00";
  }

  // Handle "Today, 8:55 PM"
  if (str.includes("Today")) {
    const date = new Date();
    const timePart = str.split(",")[1]?.trim();
    if (timePart) {
      const timeDate = new Date(`${date.toDateString()} ${timePart} UTC`);
      if (!isNaN(timeDate.getTime()))
        return timeDate.toISOString().split(".")[0] + "+00:00";
    }
    return date.toISOString().split(".")[0] + "+00:00";
  }

  // Handle "Yesterday, 8:55 PM"
  if (str.includes("Yesterday")) {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const timePart = str.split(",")[1]?.trim();
    if (timePart) {
      const timeDate = new Date(`${date.toDateString()} ${timePart} UTC`);
      if (!isNaN(timeDate.getTime()))
        return timeDate.toISOString().split(".")[0] + "+00:00";
    }
    return date.toISOString().split(".")[0] + "+00:00";
  }

  // Handle relative times: "X minutes ago", "X hours ago", "X days ago"
  const relativeMatch = str.match(/(\d+)\s+(minute|hour|day)s?\s+ago/);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2];
    const date = new Date();
    if (unit === "minute") date.setMinutes(date.getMinutes() - amount);
    else if (unit === "hour") date.setHours(date.getHours() - amount);
    else if (unit === "day") date.setDate(date.getDate() - amount);
    return date.toISOString().split(".")[0] + "+00:00";
  }

  try {
    let normalizedDate = str;
    if (!str.includes("T")) {
      if (!str.match(/\d{4}/)) {
        normalizedDate = `${str}, ${new Date().getFullYear()}`;
      }
      // Check if it has a time but no timezone
      if (str.includes(":") && !str.match(/[A-Z]{3,}/)) {
        normalizedDate = `${normalizedDate} UTC`;
      }
    }
    const d = new Date(normalizedDate);
    return isNaN(d.getTime()) ? null : d.toISOString().split(".")[0] + "+00:00";
  } catch {
    return null;
  }
}

export function extractMalId(href: string): number {
  const parts = href.split("/").filter(Boolean);
  const last = parts.at(-1);
  return parseInt(last || "0") || parseInt(parts.at(-2) || "0");
}

export function cleanImageUrl(url: string | undefined): string {
  if (!url) return "";
  return url
    .split("?")[0]
    .replace(/\/r\/\d+x\d+\//, "/")
    .replace(/(\d+)[tlv](\.(?:jpg|png|webp|gif))$/, "$1$2");
}

export function ensureMalUrl(url: string | undefined): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return MAL_BASE_URL + url;
}

export function youtubeIdFromUrl(url: string | null): string | null {
  if (!url) return null;
  const re =
    /^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtu\.be\/|(?:youtube|youtube-nocookie)\.com\/(?:(?:watch)?\?(?:.*&)?v(?:i)?=|(?:embed|v|vi|user|shorts)\/))([^\?&"'>]{11})/;
  const m = url.match(re);
  return m?.[1] ?? null;
}

export function youtubeTrailerImages(id: string | null): {
  image_url: string | null;
  small_image_url: string | null;
  medium_image_url: string | null;
  large_image_url: string | null;
  maximum_image_url: string | null;
} {
  if (!id) {
    return {
      image_url: null,
      small_image_url: null,
      medium_image_url: null,
      large_image_url: null,
      maximum_image_url: null,
    };
  }
  return {
    image_url: `https://img.youtube.com/vi/${id}/default.jpg`,
    small_image_url: `https://img.youtube.com/vi/${id}/sddefault.jpg`,
    medium_image_url: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
    large_image_url: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    maximum_image_url: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
  };
}

export function sanitizeCRLF(str: string | null | undefined): string | null {
  if (str == null) return null;
  return str.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return sanitizeCRLF(obj) as T;
  if (Array.isArray(obj)) return obj.map((item) => sanitizeObject(item)) as T;
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeObject(value);
    }
    return result as T;
  }
  return obj;
}

export function pageParam(c: any): number {
  return parseInt(c.req.query("page") || c.req.query("p") || "1", 10);
}

export function jikanError(status: number, message: string, type?: string) {
  const defaultTypes: Record<number, string> = {
    400: "BadRequestException",
    404: "BadResponseException",
    405: "MethodNotAllowedException",
    429: "RateLimitException",
    500: "InternalServerErrorException",
  };

  const errors: Record<number, string> = {
    400: "Bad Request",
    404: "Not Found",
    405: "Method Not Allowed",
    429: "Too Many Requests",
    500: "Internal Server Error",
  };

  let finalMessage = message;
  let finalError = errors[status] || "Error";

  if (status === 404) {
    finalMessage = "Resource does not exist";
    if (message.startsWith("404 on ")) {
      finalError = message;
    }
  }

  return {
    status,
    type: type || defaultTypes[status] || "Exception",
    message: finalMessage,
    error: finalError,
  };
}
