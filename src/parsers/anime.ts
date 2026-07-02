import { load } from "cheerio";
import { Anime, MalUrl, Title, Relation } from "../models/anime";
import { MAL_BASE_URL } from "../constants";
import {
  parseMalDate,
  cleanImageUrl,
  ensureMalUrl,
  youtubeIdFromUrl,
  youtubeTrailerImages,
} from "../utils";

export function parseAnime(html: string): Anime {
  const $ = load(html);

  const ogUrl = $('meta[property="og:url"]').attr("content") || "";
  const idMatch = ogUrl.match(/\/anime\/(\d+)/);
  const final_mal_id = idMatch ? parseInt(idMatch[1]) : 0;
  const url = ogUrl;
  const title = $('meta[property="og:title"]').attr("content") || "";

  const image_url = cleanImageUrl(
    $('meta[property="og:image"]').attr("content"),
  );
  const images = {
    jpg: {
      image_url: image_url,
      small_image_url: image_url.replace(".jpg", "t.jpg"),
      large_image_url: image_url.replace(".jpg", "l.jpg"),
    },
    webp: {
      image_url: image_url.replace(".jpg", ".webp"),
      small_image_url: image_url.replace(".jpg", "t.webp"),
      large_image_url: image_url.replace(".jpg", "l.webp"),
    },
  };

  const darkTextSpans = $(".dark_text");
  const darkTextLabels = darkTextSpans.map((_, el) => $(el).text()).get();

  const getInfo = (label: string) => {
    const span = darkTextSpans.filter((idx) =>
      darkTextLabels[idx].startsWith(label),
    );
    if (span.length === 0) return null;
    const parent = span.parent();
    const clone = parent.clone();
    clone.find(".dark_text, sup, small").remove();
    let text = clone.text().trim();
    return text === "Unknown" || text === "None" || text === "N/A"
      ? null
      : text;
  };

  const type = getInfo("Type:");
  const episodes = parseInt(getInfo("Episodes:") || "0") || null;
  const status = getInfo("Status:");
  const aired_string = getInfo("Aired:");

  const scoreText = getInfo("Score:");
  const score = parseFloat(scoreText || "0") || null;

  let scored_by: number | null = null;
  const scoredBySpan = $('span[itemprop="ratingCount"]');
  if (scoredBySpan.length > 0) {
    scored_by = parseInt(scoredBySpan.text().replace(/[^0-9]/g, ""));
  } else if (scoreText) {
    const match = scoreText.match(/\((scored by )?([0-9,]+) users\)/);
    if (match) {
      scored_by = parseInt(match[2].replace(/,/g, ""));
    }
  }

  const rankText = getInfo("Ranked:");
  const rank = rankText
    ? parseInt(rankText.replace(/[^0-9]/g, "").split(/\s+/)[0])
    : null;
  const popularity =
    parseInt(getInfo("Popularity:")?.replace(/[^0-9]/g, "") || "0") || null;
  const members =
    parseInt(getInfo("Members:")?.replace(/[^0-9]/g, "") || "0") || null;
  const favorites =
    parseInt(getInfo("Favorites:")?.replace(/[^0-9]/g, "") || "0") || null;

  const synopsis = $('[itemprop="description"]').text().trim() || null;

  let background: string | null = null;
  const backgroundH2 = $("#background");
  if (backgroundH2.length > 0) {
    const parent = backgroundH2.parent();
    const parts: string[] = [];
    let curr = parent[0].nextSibling;
    while (curr) {
      const $curr = $(curr);
      if (
        $curr.is("h2") ||
        $curr.find("h2").length > 0 ||
        $curr.hasClass("border_top")
      )
        break;
      parts.push($curr.text());
      curr = curr.nextSibling;
    }
    background = parts.join("").trim() || null;
  }

  // Titles
  const titles: Title[] = [{ type: "Default", title }];
  const sidebar = $(".leftside");
  const altTitlesHeader = sidebar.find('h2:contains("Alternative Titles")');
  if (altTitlesHeader.length > 0) {
    let next = altTitlesHeader.next();
    while (next.length > 0 && !next.is("h2")) {
      next
        .find(".spaceit_pad")
        .addBack(".spaceit_pad")
        .each((_, padEl) => {
          const pad = $(padEl);
          const label = pad.find(".dark_text").text().replace(":", "").trim();
          if (!label) return;

          const val = pad
            .clone()
            .find(".dark_text")
            .remove()
            .end()
            .text()
            .trim();
          if (!val || val === "None" || val === "N/A") return;

          if (label === "Synonyms") {
            val.split(",").forEach((s) => {
              const syn = s.trim();
              if (syn && !titles.find((t) => t.title === syn)) {
                titles.push({ type: "Synonym", title: syn });
              }
            });
          } else {
            if (!titles.find((t) => t.title === val && t.type === label)) {
              titles.push({ type: label, title: val });
            }
          }
        });
      next = next.next();
    }
  }

  const title_english = titles.find((t) => t.type === "English")?.title || null;
  const title_japanese =
    titles.find((t) => t.type === "Japanese")?.title || null;
  const title_synonyms = titles
    .filter((t) => t.type === "Synonym")
    .map((t) => t.title);

  const extractMalUrls = (label: string): MalUrl[] => {
    const altLabel = label.replace("s:", ":");
    const span = darkTextSpans.filter((idx) => {
      const text = darkTextLabels[idx];
      return text.startsWith(label) || text.startsWith(altLabel);
    });
    if (span.length === 0) return [];
    return span
      .parent()
      .find("a")
      .map((_, el) => {
        const a = $(el);
        const name = a.text().trim();
        if (name === "add some") return null;
        const href = a.attr("href") || "";
        const parts = href.split("/").filter(Boolean);
        return {
          mal_id: parseInt(parts[parts.length - 2]) || 0,
          type: "anime",
          name,
          url: ensureMalUrl(href),
        };
      })
      .get()
      .filter(Boolean);
  };

  const genres = extractMalUrls("Genres:");
  const explicit_genres = extractMalUrls("Explicit Genres:");
  const themes = extractMalUrls("Themes:");
  const demographics = extractMalUrls("Demographics:");
  const producers = extractMalUrls("Producers:");
  const licensors = extractMalUrls("Licensors:");
  const studios = extractMalUrls("Studios:");

  const aired = parseMalDate(aired_string);

  const premiered = getInfo("Premiered:");
  let season: string | null = null;
  let year: number | null = null;
  if (premiered) {
    const [s, y] = premiered.split(" ");
    season = s.toLowerCase();
    year = parseInt(y);
  }

  const broadcastStr = getInfo("Broadcast:");
  let broadcast: any = {
    day: null,
    time: null,
    timezone: null,
    string: broadcastStr,
  };
  if (broadcastStr && broadcastStr !== "Unknown") {
    const matches = broadcastStr.match(/(.*) at (\d{2}:\d{2}) \((.*)\)/);
    if (matches) {
      broadcast.day = matches[1];
      broadcast.time = matches[2];
      broadcast.timezone = matches[3] === "JST" ? "Asia/Tokyo" : matches[3];
    }
  }

  // Relations
  const relations: Relation[] = [];
  $(".related-entries .entries-tile .entry").each((_, el) => {
    const $el = $(el);
    const relationText = $el.find(".relation").text().trim();
    const relation = relationText.split("(")[0].trim();
    const a = $el.find(".title a");
    if (a.length === 0) return;
    const href = a.attr("href") || "";
    const parts = href.split("/").filter(Boolean);
    const entry = {
      mal_id: parseInt(parts[parts.length - 2]),
      type: parts[parts.length - 3] === "manga" ? "manga" : "anime",
      name: a.text().trim(),
      url: ensureMalUrl(href),
    };
    const existing = relations.find((r) => r.relation === relation);
    if (existing) existing.entry.push(entry);
    else relations.push({ relation, entry: [entry] });
  });
  $(".related-entries .entries-table tr").each((_, el) => {
    const $el = $(el);
    const relation = $el.find("td:first-child").text().replace(":", "").trim();
    const entries = $el
      .find("td:nth-child(2) ul.entries li")
      .map((_, li) => {
        const a = $(li).find("a");
        if (a.length === 0) return null;
        const href = a.attr("href") || "";
        const parts = href.split("/").filter(Boolean);
        const typeMatch = $(li)
          .text()
          .match(/\((.*)\)/);
        const type = typeMatch
          ? typeMatch[1].toLowerCase().includes("manga")
            ? "manga"
            : "anime"
          : parts[parts.length - 3] === "manga"
            ? "manga"
            : "anime";
        return {
          mal_id: parseInt(parts[parts.length - 2]),
          type,
          name: a.text().trim(),
          url: ensureMalUrl(href),
        };
      })
      .get()
      .filter(Boolean);
    if (relation && entries.length > 0) {
      const existing = relations.find((r) => r.relation === relation);
      if (existing) existing.entry.push(...entries);
      else relations.push({ relation, entry: entries });
    }
  });

  if (relations.length === 0) {
    $(".anime_detail_related_anime tr").each((_, el) => {
      const $el = $(el);
      const relation = $el
        .find("td:nth-child(1)")
        .text()
        .replace(":", "")
        .trim();
      const links = $el
        .find("td:nth-child(2) a")
        .map((_, linkEl) => {
          const a = $(linkEl);
          const href = a.attr("href") || "";
          const parts = href.split("/").filter(Boolean);
          return {
            mal_id: parseInt(parts[parts.length - 2]),
            type: parts[parts.length - 3] === "manga" ? "manga" : "anime",
            name: a.text(),
            url: ensureMalUrl(href),
          };
        })
        .get();
      if (relation && links.length > 0)
        relations.push({ relation, entry: links });
    });
  }

  // External & Streaming
  const external: any[] = [];
  const streaming: any[] = [];
  $(".external_links a").each((_, el) => {
    const a = $(el);
    const name = a.text().trim();
    if (name === "More links" || name === "") return;
    const href = a.attr("href") || "";
    external.push({ name, url: href });
  });
  $(".broadcast-item").each((_, el) => {
    const a = $(el);
    const name = a.attr("title") || a.find(".caption").text().trim();
    const url = a.attr("href") || "";
    if (name && url && !streaming.find((s) => s.name === name))
      streaming.push({ name, url });
  });

  // Themes
  const parseThemes = (typeSelector: string) => {
    const themes: string[] = [];
    const container = $(`.theme-songs${typeSelector}`);
    if (container.length === 0) return themes;
    container.find("table:not(.oped-popup-table) tr").each((_, el) => {
      const tds = $(el).children("td");
      let targetTd;
      if (tds.length >= 2) {
        for (let i = 0; i < tds.length; i++) {
          const td = tds[i];
          if (
            td.attribs?.width === "84%" ||
            $(td).find(".theme-song-index, .theme-song-title").length > 0
          ) {
            targetTd = tds.eq(i);
            break;
          }
        }
        if (!targetTd || targetTd.length === 0)
          targetTd = tds.eq(Math.floor(tds.length / 2));
      } else {
        targetTd = tds.first();
      }

      if (!targetTd || targetTd.length === 0) return;

      let text = "";
      targetTd.contents().each((_, node) => {
        if (
          node.type === "text" ||
          !$(node).is(
            "input, .js-theme-song-play, svg, audio, div.oped-preview-button, .oped-video-button, .oped-popup",
          )
        ) {
          text += $(node).text();
        }
      });
      text = text.trim().replace(/\s+/g, " ");
      if (
        text &&
        !text.includes("Help improve our database") &&
        !text.includes("No opening themes") &&
        !text.includes("No ending themes")
      ) {
        themes.push(text);
      }
    });
    return themes;
  };

  const openings = parseThemes(".opnening");
  const endings = parseThemes(".ending");

  // Trailer
  const trailerUrl = $(".video-promotion a").attr("href") || null;
  const youtubeId = youtubeIdFromUrl(trailerUrl);

  return {
    mal_id: final_mal_id,
    url,
    images,
    trailer: {
      youtube_id: youtubeId,
      url: youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : null,
      embed_url: trailerUrl,
      images: youtubeTrailerImages(youtubeId),
    },
    approved: true,
    titles,
    title,
    title_english,
    title_japanese,
    title_synonyms,
    type,
    source: getInfo("Source:"),
    episodes,
    status,
    airing: status === "Currently Airing",
    aired,
    duration:
      (getInfo("Duration:") || null)
        ?.replace(/min\./g, "min")
        .replace(/[\. ]+$/, "") || null,
    rating: getInfo("Rating:"),
    score,
    scored_by,
    rank,
    popularity,
    members,
    favorites,
    synopsis,
    background,
    season,
    year,
    broadcast,
    producers,
    licensors,
    studios,
    genres,
    explicit_genres,
    themes,
    demographics,
    relations,
    theme: { openings, endings },
    external,
    streaming,
  };
}
