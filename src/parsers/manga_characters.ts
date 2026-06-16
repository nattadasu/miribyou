import { load } from "cheerio";
import { MAL_BASE_URL } from "../constants";
import { cleanImageUrl, ensureMalUrl } from "../utils";

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

      return {
        character: {
          mal_id: parseInt(charHref.split("/").pop() || "0"),
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
