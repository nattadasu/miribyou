import { load } from "cheerio";
import { AnimeCharacter } from "../models/characters";
import { MAL_BASE_URL } from "../constants";
import { cleanImageUrl, ensureMalUrl, extractMalId } from "../utils";

export function parseAnimeCharacters(html: string): AnimeCharacter[] {
  const $ = load(html);

  return $("table.js-anime-character-table")
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
      const favorites = parseInt(
        $table
          .find("td:nth-child(2) div:nth-child(5)")
          .text()
          .replace(/[^0-9]/g, "") || "0",
      );

      const voice_actors = $table
        .find("table.js-anime-character-va tr")
        .map((_, vaRow) => {
          const $vaRow = $(vaRow);
          const vaLink = $vaRow.find("td:nth-child(1) a").first();
          const vaHref = vaLink.attr("href") || "";
          const vaName = vaLink.text().trim();
          const vaImageUrl = cleanImageUrl(
            $vaRow.find("td:nth-child(2) img").attr("data-src") ||
              $vaRow.find("td:nth-child(2) img").attr("src"),
          );
          const language = $vaRow
            .find("td:nth-child(1) .js-anime-character-language")
            .text()
            .trim();

          return {
            person: {
              mal_id: extractMalId(vaHref),
              url: ensureMalUrl(vaHref),
              images: {
                jpg: { image_url: vaImageUrl },
                webp: {
                  image_url: vaImageUrl.replace(".jpg", ".webp"),
                  small_image_url: vaImageUrl.replace(".jpg", "t.webp"),
                },
              },
              name: vaName,
            },
            language,
          };
        })
        .get();

      return {
        character: {
          mal_id: extractMalId(charHref),
          url: ensureMalUrl(charHref),
          images: {
            jpg: { image_url: charImageUrl },
            webp: {
              image_url: charImageUrl.replace(".jpg", ".webp"),
              small_image_url: charImageUrl.replace(".jpg", "t.webp"),
            },
          },
          name: charName,
        },
        role,
        favorites,
        voice_actors,
      };
    })
    .get();
}
