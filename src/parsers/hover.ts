import { load } from "cheerio";
import { MalUrl } from "../models/anime";
import { ensureMalUrl } from "../utils";

export interface HoverData {
  title?: string;
  year?: number | null;
  synopsis?: string;
  genres: MalUrl[];
  themes: MalUrl[];
  demographics: MalUrl[];
  status?: string;
  score?: number | null;
  scored_by?: number | null;
  rank?: number | null;
  popularity?: number | null;
  members?: number | null;
}

export function parseHover(html: string): HoverData {
  const $ = load(html);

  const titleText = $(".hovertitle").text().trim();
  const yearMatch = titleText.match(/\((\d{4})\)/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;

  const synopsis = $("div[style*='margin-top: 8px']")
    .clone()
    .find("a")
    .remove()
    .end()
    .text()
    .trim();

  const extractList = (
    label: string,
    type: "anime" | "manga" = "anime",
  ): MalUrl[] => {
    const section = $(`.dark_text:contains('${label}')`);
    if (!section.length) return [];

    const textNode = section[0].nextSibling;
    if (textNode && textNode.nodeType === 3) {
      const text = textNode.nodeValue?.trim();
      if (text) {
        return text.split(",").map((name) => {
          name = name.trim();
          return {
            mal_id: 0, // ID not provided in hover
            type,
            name,
            url: `https://myanimelist.net/${type}/genre/0/${name.replace(/\s+/g, "_")}`,
          };
        });
      }
    }
    return [];
  };

  const genres = extractList("Genres:");
  const themes = extractList("Theme:") || extractList("Themes:");
  const demographics =
    extractList("Demographic:") || extractList("Demographics:");

  const getInfo = (label: string) => {
    const section = $(`.dark_text:contains('${label}')`);
    if (!section.length) return null;
    let text =
      section[0].nextSibling?.nodeType === 3
        ? section[0].nextSibling.nodeValue?.trim()
        : null;
    if (!text) {
      text = section.parent().text().replace(label, "").trim();
    }
    return text;
  };

  const status = getInfo("Status:") || undefined;

  const scoreText = getInfo("Score:");
  const score = scoreText ? parseFloat(scoreText) : null;

  const scoredByText = $("small:contains('scored by')").text();
  const scoredByMatch = scoredByText.match(/scored by ([\d,]+) users/);
  const scored_by = scoredByMatch
    ? parseInt(scoredByMatch[1].replace(/,/g, ""))
    : null;

  const rankText = getInfo("Ranked:");
  const rank = rankText?.startsWith("#")
    ? parseInt(rankText.substring(1))
    : null;

  const popularityText = getInfo("Popularity:");
  const popularity = popularityText?.startsWith("#")
    ? parseInt(popularityText.substring(1))
    : null;

  const membersText = getInfo("Members:");
  const members = membersText ? parseInt(membersText.replace(/,/g, "")) : null;

  return {
    year,
    synopsis,
    genres,
    themes,
    demographics,
    status,
    score,
    scored_by,
    rank,
    popularity,
    members,
  };
}
