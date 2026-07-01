import { load } from "cheerio";
import { AnimeStaff } from "../models/staff";
import { cleanImageUrl, ensureMalUrl, extractMalId } from "../utils";

export function parseAnimeStaff(html: string): AnimeStaff[] {
  const $ = load(html);
  const staffSection = $('h2:contains("Staff")').parent().nextAll("table");

  return staffSection
    .map((_, table) => {
      const $table = $(table);
      const personLink = $table.find("td:nth-child(2) a").first();
      const personHref = personLink.attr("href") || "";
      const personName = personLink.text().trim();
      const personImageUrl = cleanImageUrl(
        $table.find("td:nth-child(1) img").attr("data-src") ||
          $table.find("td:nth-child(1) img").attr("src"),
      );
      const positions = $table
        .find("td:nth-child(2) small")
        .text()
        .trim()
        .split(", ");

      return {
        person: {
          mal_id: extractMalId(personHref),
          url: ensureMalUrl(personHref),
          images: {
            jpg: { image_url: personImageUrl },
            webp: {
              image_url: personImageUrl.replace(".jpg", ".webp"),
            },
          },
          name: personName,
        },
        positions,
      };
    })
    .get();
}
