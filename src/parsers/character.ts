import { load } from "cheerio";
import {
  Character,
  CharacterAnimeEntry,
  CharacterMangaEntry,
  CharacterVoiceEntry,
  CharacterImages,
} from "../models/characters.js";
import { cleanImageUrl, ensureMalUrl, extractMalId } from "../utils.js";

function parseNameKanji(html: string): string[] {
  const $ = load(html);
  const h2Text = $("h2.normal_header").text();
  const match = h2Text.match(/\(([^)]*)\)/);
  if (!match) return [];
  return match[1].split(" / ").map((n) => n.trim()).filter(Boolean);
}

function parseFavorites(html: string): number {
  const m = html.match(/Member\s+Favorites:\s*([\d,]+)/);
  if (!m) return 0;
  return parseInt(m[1].replace(/,/g, ""), 10) || 0;
}

function parseAbout(html: string): string | null {
  const h2Match = html.match(
    /<h2[^>]*class="normal_header"[^>]*>.*?<\/h2>\s*(.*?)(?:<div\s+class="normal_header"|<h2)/s,
  );
  if (!h2Match) return null;
  let text = h2Match[1]
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&quot;/g, '"')
    .replace(/&rsquo;/g, "’")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&eacute;/g, "é")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c)))
    .replace(/&#x([0-9a-f]+);/gi, (_, c) =>
      String.fromCharCode(parseInt(c, 16)),
    )
    .trim();
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return text || null;
}

function parseNicknames(html: string): string[] {
  const $ = load(html);
  const strongText = $("h1 > strong").text();
  const quoteMatch = strongText.match(/"([^"]+)"/);
  if (!quoteMatch) return [];
  return quoteMatch[1]
    .split(", ")
    .map((n) => n.trim())
    .filter(Boolean);
}

export function parseCharacter(html: string): Character {
  const $ = load(html);

  const malId = extractMalId(
    $('meta[property="og:url"]').attr("content") || "",
  );
  const url = $('meta[property="og:url"]').attr("content") || "";
  const name = $('meta[property="og:title"]').attr("content") || "";

  const imageUrl = cleanImageUrl(
    $('meta[property="og:image"]').attr("content") || "",
  );

  const images: CharacterImages = {
    jpg: {
      image_url: imageUrl || null,
    },
    webp: imageUrl
      ? {
          image_url: imageUrl.replace(".jpg", ".webp"),
          small_image_url: imageUrl.replace(".jpg", "t.webp"),
        }
      : undefined,
  };

  const nameKanjiArray = parseNameKanji(html);
  const nicknames = [
    ...parseNicknames(html),
    ...nameKanjiArray.slice(1),
  ];
  const about = parseAbout(html);
  const favorites = parseFavorites(html);

  return {
    mal_id: malId,
    url,
    images,
    name,
    name_kanji: nameKanjiArray[0] || null,
    nicknames: nicknames.length > 0 ? nicknames : [],
    favorites,
    about,
  };
}

export function parseCharacterAnime(html: string): CharacterAnimeEntry[] {
  const $ = load(html);
  const entries: CharacterAnimeEntry[] = [];

  let inAnimeography = false;
  $("div.normal_header").each((_, el) => {
    if ($(el).text().trim() === "Animeography") {
      inAnimeography = true;
      const table = $(el).nextAll("table").first();
      table.find("tr").each((_, tr) => {
        const $tr = $(tr);
        const link = $tr.find("td:nth-child(2) a").first();
        const href = link.attr("href") || "";
        const title = link.text().trim();
        const role = $tr.find("td:nth-child(2) small").first().text().trim();
        const imgUrl = cleanImageUrl(
          $tr.find("td:nth-child(1) img").attr("data-src") ||
            $tr.find("td:nth-child(1) img").attr("src") ||
            "",
        );

        if (href && title) {
          entries.push({
            role,
            anime: {
              mal_id: extractMalId(href),
              url: ensureMalUrl(href),
              images: {
                jpg: {
                  image_url: imgUrl,
                  small_image_url: imgUrl
                    ? imgUrl.replace(".jpg", "t.jpg")
                    : undefined,
                  large_image_url: imgUrl
                    ? imgUrl.replace(".jpg", "l.jpg")
                    : undefined,
                },
                webp: imgUrl
                  ? {
                      image_url: imgUrl.replace(".jpg", ".webp"),
                      small_image_url: imgUrl.replace(".jpg", "t.webp"),
                      large_image_url: imgUrl.replace(".jpg", "l.webp"),
                    }
                  : undefined,
              },
              title,
            },
          });
        }
      });
    }
  });

  return entries;
}

export function parseCharacterManga(html: string): CharacterMangaEntry[] {
  const $ = load(html);
  const entries: CharacterMangaEntry[] = [];

  let inMangaography = false;
  $("div.normal_header").each((_, el) => {
    if ($(el).text().trim() === "Mangaography") {
      inMangaography = true;
      const table = $(el).nextAll("table").first();
      table.find("tr").each((_, tr) => {
        const $tr = $(tr);
        const link = $tr.find("td:nth-child(2) a").first();
        const href = link.attr("href") || "";
        const title = link.text().trim();
        const role = $tr.find("td:nth-child(2) small").first().text().trim();
        const imgUrl = cleanImageUrl(
          $tr.find("td:nth-child(1) img").attr("data-src") ||
            $tr.find("td:nth-child(1) img").attr("src") ||
            "",
        );

        if (href && title) {
          entries.push({
            role,
            manga: {
              mal_id: extractMalId(href),
              url: ensureMalUrl(href),
              images: {
                jpg: {
                  image_url: imgUrl,
                  small_image_url: imgUrl
                    ? imgUrl.replace(".jpg", "t.jpg")
                    : undefined,
                  large_image_url: imgUrl
                    ? imgUrl.replace(".jpg", "l.jpg")
                    : undefined,
                },
                webp: imgUrl
                  ? {
                      image_url: imgUrl.replace(".jpg", ".webp"),
                      small_image_url: imgUrl.replace(".jpg", "t.webp"),
                      large_image_url: imgUrl.replace(".jpg", "l.webp"),
                    }
                  : undefined,
              },
              title,
            },
          });
        }
      });
    }
  });

  return entries;
}

export function parseCharacterVoices(html: string): CharacterVoiceEntry[] {
  const $ = load(html);
  const entries: CharacterVoiceEntry[] = [];

  let inVoiceActors = false;
  $("div.normal_header").each((_, el) => {
    if ($(el).text().trim() === "Voice Actors") {
      inVoiceActors = true;
      $(el)
        .nextAll("table")
        .each((_, table) => {
          const $table = $(table);
          const link = $table.find("td:nth-child(2) a").first();
          const href = link.attr("href") || "";
          const name = link.text().trim();
          const language = $table
            .find("td:nth-child(2) small")
            .first()
            .text()
            .trim();
          const imgUrl = cleanImageUrl(
            $table.find("td:nth-child(1) img").attr("data-src") ||
              $table.find("td:nth-child(1) img").attr("src") ||
              "",
          );

          if (href && name) {
            entries.push({
              language,
              person: {
                mal_id: extractMalId(href),
                url: ensureMalUrl(href),
                images: {
                  jpg: { image_url: imgUrl },
                },
                name,
              },
            });
          }
        });
    }
  });

  return entries;
}

export function parseCharacterPictures(html: string): {
  jpg: { image_url: string | null };
}[] {
  const $ = load(html);
  const pictures: { jpg: { image_url: string | null } }[] = [];

  $(".picSurround a").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (!href.includes("cdn.myanimelist.net")) return;
    const imageUrl = cleanImageUrl(href);
    if (imageUrl) {
      pictures.push({
        jpg: { image_url: imageUrl },
      });
    }
  });

  return pictures;
}
