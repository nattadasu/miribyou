import { load } from "cheerio";
import { MAL_BASE_URL } from "../constants";
import { cleanImageUrl, ensureMalUrl, parseMalDate } from "../utils";

export function parseSeasonList(html: string): any {
  const $ = load(html);
  const resultsMap: Record<number, string[]> = {};

  $(".anime-seasonal-byseason a").each((_, a) => {
    const text = $(a).text().trim();
    const match = text.match(/(Winter|Spring|Summer|Fall)\s+(\d{4})/i);
    if (match) {
      const season = match[1].toLowerCase();
      const year = parseInt(match[2]);
      if (!resultsMap[year]) {
        resultsMap[year] = [];
      }
      if (!resultsMap[year].includes(season)) {
        resultsMap[year].push(season);
      }
    }
  });

  const data = Object.entries(resultsMap)
    .map(([year, seasons]) => ({
      year: parseInt(year),
      seasons,
    }))
    .sort((a, b) => b.year - a.year);

  return { data };
}

export function parseSeason(html: string): any {
  const $ = load(html);
  const data: any[] = [];

  $(".seasonal-anime").each((_, el) => {
    const $el = $(el);
    const titleLink = $el.find(".link-title");
    const title = titleLink.text().trim();
    const href = titleLink.attr("href") || "";
    const idMatch = href.match(/\/anime\/(\d+)/);
    const mal_id = idMatch ? parseInt(idMatch[1]) : 0;

    const imageUrl = cleanImageUrl(
      $el.find("img").attr("data-src") || $el.find("img").attr("src"),
    );

    const synopsis = $el.find(".synopsis .preline").text().trim();

    const info = $el.find(".info");
    const type = info.find(".item").first().text().trim();
    const episodesStr = info
      .find(".item:contains('eps')")
      .text()
      .trim()
      .replace(" eps", "");
    const episodes = episodesStr === "?" ? null : parseInt(episodesStr) || null;

    const scoreStr = $el.find(".score").text().trim();
    const score = scoreStr === "N/A" ? null : parseFloat(scoreStr) || null;

    const membersStr = $el.find(".member").text().trim().replace(/,/g, "");
    const members = parseInt(membersStr) || null;

    const genres: any[] = [];
    $el.find(".genres .genre").each((_, g) => {
      const $g = $(g).find("a");
      const gHref = $g.attr("href") || "";
      const match = gHref.match(/\/genre\/(\d+)/);
      const gId = match ? parseInt(match[1]) : 0;
      genres.push({
        mal_id: gId,
        type: "anime",
        name: $g.text().trim(),
        url: ensureMalUrl(gHref),
      });
    });

    const studios: any[] = [];
    $el
      .find(".properties .property:contains('Studio') .value a")
      .each((_, s) => {
        const $s = $(s);
        const sHref = $s.attr("href") || "";
        const match = sHref.match(/\/producer\/(\d+)/);
        const sId = match ? parseInt(match[1]) : 0;
        studios.push({
          mal_id: sId,
          type: "anime",
          name: $s.text().trim(),
          url: ensureMalUrl(sHref),
        });
      });

    const producers: any[] = [];
    $el.find(".properties .property:contains('Source') .value").each((_, p) => {
      // Source is usually a text value, not a link to producer
    });
    const source =
      $el
        .find(".properties .property:contains('Source') .value")
        .text()
        .trim() || null;

    const themes: any[] = [];
    $el.find(".genres .theme").each((_, t) => {
      const $t = $(t).find("a");
      const tHref = $t.attr("href") || "";
      const match = tHref.match(/\/genre\/(\d+)/); // Themes are also under genre on MAL? No, they might be different.
      const tId = match ? parseInt(match[1]) : 0;
      themes.push({
        mal_id: tId,
        type: "anime",
        name: $t.text().trim(),
        url: ensureMalUrl(tHref),
      });
    });

    const demographics: any[] = [];
    $el.find(".genres .demographic").each((_, d) => {
      const $d = $(d).find("a");
      const dHref = $d.attr("href") || "";
      const match = dHref.match(/\/genre\/(\d+)/);
      const dId = match ? parseInt(match[1]) : 0;
      demographics.push({
        mal_id: dId,
        type: "anime",
        name: $d.text().trim(),
        url: ensureMalUrl(dHref),
      });
    });

    const explicit_genres: any[] = [];

    const infoItems = $el.find(".info .item");
    const airing_start = infoItems.eq(2).text().trim();
    const aired = parseMalDate(airing_start);

    let broadcast: any = {
      day: null,
      time: null,
      timezone: null,
      string: null,
    };

    if (airing_start && airing_start.includes(",")) {
      const parts = airing_start.split(",");
      if (parts.length >= 3) {
        const timePart = parts[2].trim(); // e.g., "23:00 (JST)"
        const dateStr = `${parts[0].trim()}, ${parts[1].trim()}`;
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          const days = [
            "Sundays",
            "Mondays",
            "Tuesdays",
            "Wednesdays",
            "Thursdays",
            "Fridays",
            "Saturdays",
          ];
          broadcast.day = days[date.getDay()];
          const timeMatch = timePart.match(/(\d{2}:\d{2})/);
          if (timeMatch) {
            broadcast.time = timeMatch[1];
            broadcast.timezone = timePart.includes("JST") ? "Asia/Tokyo" : null;
            broadcast.string = `${broadcast.day} at ${broadcast.time} (${timePart.includes("JST") ? "JST" : "UTC"})`;
          }
        }
      }
    }

    const isAiring =
      airing_start &&
      !airing_start.includes("?") &&
      new Date(airing_start.split(",").slice(0, 2).join(",")) <= new Date();

    const isContinuing = $el
      .closest(".seasonal-anime-list")
      .find(".anime-header")
      .text()
      .toLowerCase()
      .includes("continuing");

    data.push({
      mal_id,
      url: ensureMalUrl(href),
      images: {
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
      },
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
      titles: [{ type: "Default", title }],
      title,
      title_english: null,
      title_japanese: null,
      title_synonyms: [],
      type,
      source,
      episodes,
      status: isAiring ? "Currently Airing" : "Not yet aired",
      airing: isAiring,
      aired,
      duration: null,
      rating: null,
      score,
      scored_by: null,
      rank: null,
      popularity: null,
      members,
      favorites: null,
      synopsis,
      background: "",
      season: null,
      year: null,
      continuing: isContinuing,
      broadcast,
      producers,
      licensors: [],
      studios,
      genres,
      explicit_genres,
      themes,
      demographics,
    });
  });

  const visibleCountText = $(".js-visible-anime-count").text().trim();
  let total = data.length;
  if (visibleCountText) {
    const parts = visibleCountText.split("/");
    const parsedTotal = parseInt(parts[parts.length - 1]);
    if (!isNaN(parsedTotal)) {
      total = parsedTotal;
    }
  }

  return { data, total };
}
