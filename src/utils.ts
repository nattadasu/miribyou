import { MAL_BASE_URL } from "./constants";

export async function fetchMAL(path: string, headers: Record<string, string> = {}): Promise<string> {
  const url = `https://myanimelist.net${path}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 miribyou",
      ...headers,
    },
  });

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

  // Handle relative times: "X minutes ago", "X hours ago", "Yesterday, 8:55 PM"
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

  if (str.includes("Yesterday")) {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const timePart = str.split(",")[1]?.trim();
    if (timePart) {
      // Attempt to parse time
      const timeDate = new Date(`${date.toDateString()} ${timePart} UTC`);
      if (!isNaN(timeDate.getTime()))
        return timeDate.toISOString().split(".")[0] + "+00:00";
    }
    return date.toISOString().split(".")[0] + "+00:00";
  }

  try {
    let normalizedDate = str;
    if (!str.includes("T")) {
      if (!str.match(/\d{4}/)) {
        normalizedDate = `${str}, ${new Date().getFullYear()}`;
      }
      normalizedDate = `${normalizedDate} UTC`;
    }
    const d = new Date(normalizedDate);
    return isNaN(d.getTime()) ? null : d.toISOString().split(".")[0] + "+00:00";
  } catch {
    return null;
  }
}

export function cleanImageUrl(url: string | undefined): string {
  if (!url) return "";
  return url.split("?")[0];
}

export function ensureMalUrl(url: string | undefined): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return MAL_BASE_URL + url;
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
