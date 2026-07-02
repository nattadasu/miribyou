import { load } from "cheerio";
import { User } from "../models/user.js";
import { MAL_BASE_URL } from "../constants.js";
import {
  toIsoDate,
  cleanImageUrl,
  ensureMalUrl,
  extractMalId,
} from "../utils.js";

export function parseUser(html: string): User {
  const $ = load(html);

  const titleText = $("title").text();
  const username =
    titleText.split("'s Profile")[0].trim() ||
    $(".header-profile-name").text().trim();

  const userIdMatch =
    html.match(/var\s+user_id\s*=\s*(\d+);/) ||
    html.match(
      /id=(\d+)" style="font-size: 12px;"><i class="fa-solid fa-circle-exclamation/,
    );
  const mal_id = userIdMatch ? parseInt(userIdMatch[1]) : null;

  const profile_image = cleanImageUrl(
    $(".user-profile .user-image img").attr("data-src") ||
      $(".user-profile .user-image img").attr("src"),
  );
  const images = {
    jpg: { image_url: profile_image },
    webp: { image_url: profile_image.replace(".jpg", ".webp") },
  };

  const getInfo = (label: string) => {
    const li = $(`.user-status li:contains("${label}")`);
    if (li.length === 0) return null;
    const dataSpan = li.find(".user-status-data");
    if (dataSpan.length > 0) return dataSpan.text().trim();
    return li.text().replace(label, "").trim();
  };

  const last_online = toIsoDate(getInfo("Last Online"));
  const gender = getInfo("Gender");
  const birthday = toIsoDate(getInfo("Birthday"));
  const location = getInfo("Location");
  const joined = toIsoDate(getInfo("Joined"));

  const parseStat = (container: string, label: string) => {
    // 1. Try di-tc structure (for Days, Mean Score)
    const el = $(`${container} .di-tc:contains("${label}")`);
    if (el.length > 0) {
      const valEl =
        el.find(".score-label").length > 0 ? el.find(".score-label") : el;
      const clone = valEl.clone();
      clone.find(".fn-grey2").remove();
      const text = clone.text().replace(label, "").trim().replace(/,/g, "");
      return text || null;
    }

    // 2. Try stats-status li (for Watching, Completed, etc.)
    const liStatus = $(`${container} .stats-status li:contains("${label}")`);
    if (liStatus.length > 0) {
      const val = liStatus.find("span").last().text().trim().replace(/,/g, "");
      return val || null;
    }

    // 3. Try stats-data li (for Total Entries, Rewatched, Chapters, etc.)
    const liData = $(`${container} .stats-data li:contains("${label}")`);
    if (liData.length > 0) {
      const val = liData.find("span").last().text().trim().replace(/,/g, "");
      return val || null;
    }

    return null;
  };

  const anime_stats = {
    days_watched: parseFloat(parseStat(".stats.anime", "Days:") || "0"),
    mean_score:
      parseFloat(parseStat(".stats.anime", "Mean Score:") || "0") || 0,
    watching: parseInt(parseStat(".stats.anime", "Watching") || "0"),
    completed: parseInt(parseStat(".stats.anime", "Completed") || "0"),
    on_hold: parseInt(parseStat(".stats.anime", "On-Hold") || "0"),
    dropped: parseInt(parseStat(".stats.anime", "Dropped") || "0"),
    plan_to_watch: parseInt(parseStat(".stats.anime", "Plan to Watch") || "0"),
    total_entries: parseInt(parseStat(".stats.anime", "Total Entries") || "0"),
    rewatched: parseInt(parseStat(".stats.anime", "Rewatched") || "0"),
    episodes_watched: parseInt(parseStat(".stats.anime", "Episodes") || "0"),
  };

  const manga_stats = {
    days_read: parseFloat(parseStat(".stats.manga", "Days:") || "0"),
    mean_score:
      parseFloat(parseStat(".stats.manga", "Mean Score:") || "0") || 0,
    reading: parseInt(parseStat(".stats.manga", "Reading") || "0"),
    completed: parseInt(parseStat(".stats.manga", "Completed") || "0"),
    on_hold: parseInt(parseStat(".stats.manga", "On-Hold") || "0"),
    dropped: parseInt(parseStat(".stats.manga", "Dropped") || "0"),
    plan_to_read: parseInt(parseStat(".stats.manga", "Plan to Read") || "0"),
    total_entries: parseInt(parseStat(".stats.manga", "Total Entries") || "0"),
    reread: parseInt(parseStat(".stats.manga", "Reread") || "0"),
    chapters_read: parseInt(parseStat(".stats.manga", "Chapters") || "0"),
    volumes_read: parseInt(parseStat(".stats.manga", "Volumes") || "0"),
  };

  const favorites = {
    anime: parseFavorites($, "#anime_favorites", "anime"),
    manga: parseFavorites($, "#manga_favorites", "manga"),
    characters: parseFavorites($, "#character_favorites", "character"),
    people: parseFavorites($, "#person_favorites", "person"),
  };

  const updates = {
    anime: parseLastUpdates($, ".updates.anime", "anime"),
    manga: parseLastUpdates($, ".updates.manga", "manga"),
  };

  const about = $(".user-profile .user-profile-about").html() || null;

  const external: any[] = [];
  $(".user-profile-sns a").each((_, el) => {
    const a = $(el);
    const url = a.attr("href") || "";
    const name = a.text().trim() || url.split("/")[2];
    if (
      name &&
      url &&
      !url.includes("rss.php") &&
      !external.find((e) => e.url === url)
    ) {
      external.push({ name, url });
    }
  });

  return {
    mal_id,
    username,
    url: ensureMalUrl(`/profile/${username}`),
    images,
    last_online,
    gender,
    birthday,
    location,
    joined,
    statistics: {
      anime: anime_stats,
      manga: manga_stats,
    },
    favorites,
    updates,
    about,
    external,
  };
}

function parseFavorites($: any, selector: string, resourceType: string) {
  return $(selector)
    .find("ul li")
    .map((_: any, el: any) => {
      const $el = $(el);
      const a = $el.find("a").first();
      const href = a.attr("href") || "";
      const title = a.find(".title").text().trim() || a.text().trim();
      let imageUrl = cleanImageUrl(
        a.find("img").attr("data-src") || a.find("img").attr("src"),
      );
      imageUrl = imageUrl.replace(/\/r\/\d+x\d+/, "");

      const infoText = $el.find(".users").text().trim();
      const infoParts = infoText.split("·");
      const subType =
        infoParts.length > 1
          ? infoParts[0].trim()
          : href.includes("/anime/")
            ? "TV"
            : href.includes("/manga/")
              ? "Manga"
              : null;
      const yearText =
        infoParts.length > 1
          ? infoParts[1].trim()
          : infoParts[0]?.match(/^\d{4}$/)
            ? infoParts[0].trim()
            : null;

      const mal_id = extractMalId(href);

      const images: any = {
        jpg: {
          image_url: imageUrl,
          small_image_url: imageUrl.replace(".jpg", "t.jpg"),
          large_image_url: imageUrl.replace(".jpg", "l.jpg"),
        },
        webp: {
          image_url: imageUrl.replace(".jpg", ".webp"),
          small_image_url: imageUrl.replace(".jpg", "t.webp"),
          large_image_url: imageUrl.replace(".jpg", "l.webp"),
        },
      };

      const res: any = {
        mal_id,
        url: ensureMalUrl(href),
        images,
      };

      if (resourceType === "character" || resourceType === "person") {
        res.name = title;
      } else {
        res.title = title;
        res.type = subType;
        if (yearText) res.start_year = parseInt(yearText) || null;
      }

      return res;
    })
    .get();
}

function parseLastUpdates($: any, selector: string, type: "anime" | "manga") {
  return $(selector)
    .find(".statistics-updates")
    .map((_: any, el: any) => {
      const $el = $(el);
      const titleLink = $el.find(".data a");
      const title = titleLink.text().trim();
      const href = titleLink.attr("href") || "";
      let imageUrl = cleanImageUrl(
        $el.find("img").attr("data-src") || $el.find("img").attr("src"),
      );
      imageUrl = imageUrl.replace(/\/r\/\d+x\d+/, "");

      const dataEl = $el.find(".data");
      const fnGrey2 = dataEl.find(".fn-grey2");

      const statusText = fnGrey2.first().text().trim();
      let status = statusText;
      if (statusText.includes("/") || statusText.match(/^\d+$/)) {
        status = type === "anime" ? "Watching" : "Reading";
      } else if (
        statusText.match(
          /(Yesterday|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|ago)/,
        )
      ) {
        const text = dataEl.text().replace(/\s+/g, " ");
        if (text.includes("Watching")) status = "Watching";
        else if (text.includes("Completed")) status = "Completed";
        else if (text.includes("On-Hold")) status = "On-Hold";
        else if (text.includes("Dropped")) status = "Dropped";
        else if (text.includes("Plan to"))
          status = type === "anime" ? "Plan to Watch" : "Plan to Read";
        else if (text.includes("Reading")) status = "Reading";
      }

      if (
        status === statusText &&
        (statusText.includes(",") || statusText.includes("ago"))
      ) {
        const text = dataEl.text();
        if (text.includes("Watching")) status = "Watching";
        else if (text.includes("Reading")) status = "Reading";
        else if (text.includes("Completed")) status = "Completed";
      }

      const scoreText = fnGrey2.text();
      const scoreMatch = scoreText.match(/Scored\s+(\d+)/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : null;

      const dateText = dataEl
        .find(".graph-content span.fn-grey2")
        .text()
        .trim();
      const date = toIsoDate(dateText);

      const mal_id = extractMalId(href);

      const images = {
        jpg: {
          image_url: imageUrl,
          small_image_url: imageUrl.replace(".jpg", "t.jpg"),
          large_image_url: imageUrl.replace(".jpg", "l.jpg"),
        },
        webp: {
          image_url: imageUrl.replace(".jpg", ".webp"),
          small_image_url: imageUrl.replace(".jpg", "t.webp"),
          large_image_url: imageUrl.replace(".jpg", "l.webp"),
        },
      };

      const res: any = {
        entry: {
          mal_id,
          url: ensureMalUrl(href),
          images,
          title,
        },
        score,
        status,
        date: date || "",
      };

      const epMatch =
        statusText.match(/(\d+)\/(\d+)/) ||
        statusText.match(/(\d+)/) ||
        dataEl.text().match(/(\d+)\/(\d+)/) ||
        dataEl.text().match(/(\d+)/);
      if (type === "anime") {
        res.episodes_seen = epMatch ? parseInt(epMatch[1]) : null;
        res.episodes_total =
          epMatch && epMatch[2] ? parseInt(epMatch[2]) : null;
      } else {
        res.chapters_read = epMatch ? parseInt(epMatch[1]) : null;
        res.chapters_total =
          epMatch && epMatch[2] ? parseInt(epMatch[2]) : null;
      }

      return res;
    })
    .get();
}

export function parseUserClubs(html: string) {
  const $ = load(html);
  return $("ol li")
    .map((_, el) => {
      const a = $(el).find("a");
      const href = a.attr("href") || "";
      const name = a.text().trim();
      const parts = href.split("cid=");
      return {
        mal_id: parseInt(parts[1] || "0"),
        name,
        url: ensureMalUrl(href),
      };
    })
    .get();
}

export function parseUserById(html: string) {
  const $ = load(html);
  const node = $("#content div:nth-child(1) div:nth-child(1) a");
  const text = node.text();
  const username = text.split("'s Profile")[0];
  const url = ensureMalUrl(node.attr("href"));
  return {
    username,
    url,
  };
}
