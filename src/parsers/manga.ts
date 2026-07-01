import { load } from "cheerio";
import { Manga } from "../models/manga";
import { MalUrl, Title, Relation } from "../models/anime";
import { MAL_BASE_URL } from "../constants";
import {
  parseMalDate,
  cleanImageUrl,
  ensureMalUrl,
  extractMalId,
} from "../utils";

export function parseManga(html: string): Manga {
  const $ = load(html);

  const ogUrl = $('meta[property="og:url"]').attr("content") || "";
  const idMatch = ogUrl.match(/\/manga\/(\d+)/);
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

  const getInfo = (label: string) => {
    const span = $(`.dark_text`).filter((_, el) =>
      $(el).text().startsWith(label),
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
  const chapters = parseInt(getInfo("Chapters:") || "0") || null;
  const volumes = parseInt(getInfo("Volumes:") || "0") || null;
  const status = getInfo("Status:");
  const published_string = getInfo("Published:");
  const score = parseFloat(getInfo("Score:") || "0") || null;

  let scored_by: number | null = null;
  const scoredBySpan = $('span[itemprop="ratingCount"]');
  if (scoredBySpan.length > 0) {
    scored_by = parseInt(scoredBySpan.text().replace(/[^0-9]/g, ""));
  } else {
    const scoreText = getInfo("Score:");
    const match = scoreText?.match(/\((scored by )?([0-9,]+) users\)/);
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

  const synopsis = $('span[itemprop="description"]').text().trim() || null;
  const background =
    $('.js-scrollfix-bottom-rel h2:contains("Background")')
      .next()
      .text()
      .trim() || null;

  const titles: Title[] = [{ type: "Default", title }];
  const title_english = getInfo("English:");
  if (title_english) titles.push({ type: "English", title: title_english });
  const title_japanese = getInfo("Japanese:");
  if (title_japanese) titles.push({ type: "Japanese", title: title_japanese });
  const title_synonyms =
    getInfo("Synonyms:")
      ?.split(",")
      .map((s) => s.trim()) || [];
  title_synonyms.forEach((s) => titles.push({ type: "Synonym", title: s }));

  const extractMalUrls = (label: string, defaultType: string): MalUrl[] => {
    const span = $(`.dark_text`).filter((_, el) => {
      const text = $(el).text();
      return (
        text.startsWith(label) || text.startsWith(label.replace("s:", ":"))
      );
    });
    if (span.length === 0) return [];
    return span
      .parent()
      .find("a")
      .map((_, el) => {
        const a = $(el);
        const href = a.attr("href") || "";
        const parts = href.split("/").filter(Boolean);
        let type = defaultType;
        if (href.includes("/people/") || href.includes("/producer/"))
          type = "people";
        else if (href.includes("/anime/")) type = "anime";
        else if (href.includes("/manga/")) type = "manga";

        return {
          mal_id: parseInt(parts[parts.length - 2]),
          type,
          name: a.text(),
          url: ensureMalUrl(href),
        };
      })
      .get();
  };

  const genres = extractMalUrls("Genres:", "manga");
  const explicit_genres = extractMalUrls("Explicit Genres:", "manga");
  const themes = extractMalUrls("Themes:", "manga");
  const demographics = extractMalUrls("Demographics:", "manga");
  const authors = extractMalUrls("Authors:", "people");
  const serializations = extractMalUrls("Serialization:", "manga");

  const published = parseMalDate(published_string);

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
    const entryId = parseInt(parts[parts.length - 2] || "0");
    if (!entryId) return;

    const entry = {
      mal_id: entryId,
      type: parts[parts.length - 3] === "anime" ? "anime" : "manga",
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
        const entryId = parseInt(parts[parts.length - 2] || "0");
        if (!entryId) return null;

        const typeMatch = $(li)
          .text()
          .match(/\((.*)\)/);
        const type = typeMatch
          ? typeMatch[1].toLowerCase().includes("anime")
            ? "anime"
            : "manga"
          : parts[parts.length - 3] === "anime"
            ? "anime"
            : "manga";
        return {
          mal_id: entryId,
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
          const entryId = parseInt(parts[parts.length - 2] || "0");
          if (!entryId) return null;

          return {
            mal_id: entryId,
            type: parts[parts.length - 3] === "anime" ? "anime" : "manga",
            name: a.text(),
            url: ensureMalUrl(href),
          };
        })
        .get()
        .filter(Boolean);
      if (relation && links.length > 0)
        relations.push({ relation, entry: links });
    });
  }

  // External
  const external: any[] = [];
  $(".external_links a").each((_, el) => {
    const a = $(el);
    const name = a.text().trim();
    if (name === "More links" || name === "") return;
    const href = a.attr("href") || "";
    external.push({ name, url: href });
  });

  return {
    mal_id: final_mal_id,
    url,
    images,
    approved: true,
    titles,
    title,
    title_english,
    title_japanese,
    title_synonyms,
    type,
    chapters,
    volumes,
    status,
    publishing: status === "Publishing",
    published,
    score,
    scored: score,
    scored_by,
    rank,
    popularity,
    members,
    favorites,
    synopsis,
    background,
    authors,
    serializations,
    genres,
    explicit_genres,
    themes,
    demographics,
    relations,
    external,
  };
}

export function parseMangaCharacters(html: string): any[] {
  const $ = load(html);

  return $(".manga-character-container table")
    .map((_, table) => {
      const $table = $(table);
      const charLink = $table.find("td:nth-child(2) a").first();
      const charHref = charLink.attr("href") || "";
      const charName = charLink.text().trim();
      const charImageUrl = cleanImageUrl(
        $table.find("td:nth-child(1) img").attr("data-src") ||
          $table.find("td:nth-child(1) img").attr("src"),
      );
      const role = $table
        .find("td:nth-child(2) div:nth-child(4)")
        .text()
        .trim();

      const mal_id = extractMalId(charHref);

      return {
        character: {
          mal_id,
          url: ensureMalUrl(charHref),
          images: {
            jpg: { image_url: charImageUrl },
            webp: {
              image_url: charImageUrl.replace(".jpg", ".webp"),
            },
          },
          name: charName,
        },
        role,
      };
    })
    .get();
}
