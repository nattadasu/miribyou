import { load } from "cheerio";
import { Recommendation } from "../models/recommendations.js";
import { MAL_BASE_URL } from "../constants.js";
import {
  cleanImageUrl,
  toIsoDate,
  ensureMalUrl,
  extractMalId,
} from "../utils.js";

export function parseRecommendations(html: string): Recommendation[] {
  const $ = load(html);
  const recommendations: Recommendation[] = [];

  $(".borderClass").each((_, element) => {
    const $element = $(element);
    const titleLink = $element
      .find("table tr td:nth-child(2) div:nth-child(2) a")
      .first();
    const title = titleLink.text().trim();
    const url = titleLink.attr("href") || "";
    const mal_id = extractMalId(url);
    const imageUrl = cleanImageUrl(
      $element
        .find("table tr td:nth-child(1) div:nth-child(1) a img")
        .attr("data-src") ||
        $element
          .find("table tr td:nth-child(1) div:nth-child(1) a img")
          .attr("src"),
    );

    const recLink = $element
      .find("table tr td:nth-child(2) div:nth-child(2) span a")
      .first();
    const recUrl = ensureMalUrl(recLink.attr("href"));

    const votesText = $element
      .find("table tr td:nth-child(2) div:nth-child(4) a:nth-child(1) strong")
      .text();
    const votes = votesText ? parseInt(votesText) + 1 : 1;

    if (title) {
      recommendations.push({
        entry: {
          mal_id,
          url,
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
          title,
        },
        url: recUrl,
        votes,
      });
    }
  });

  return recommendations;
}

export function parseUserRecommendations(html: string): any[] {
  const $ = load(html);
  const recommendations: any[] = [];

  $(".spaceit.borderClass").each((_, element) => {
    const $element = $(element);
    const entries: any[] = [];

    $element.find("table tr td").each((_, td) => {
      const $td = $(td);
      const link = $td.find("a").first();
      const title = $td.find("strong").text().trim();
      const url = link.attr("href") || "";
      const imageUrl = cleanImageUrl(
        $td.find("img").attr("data-src") || $td.find("img").attr("src"),
      );

      if (title) {
        entries.push({
          mal_id: extractMalId(url),
          url,
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
          title,
        });
      }
    });

    const content = $element
      .find(".profile-user-recs-text, .recommendations-user-recs-text")
      .text()
      .trim();
    const date = toIsoDate($element.find(".lightLink").text().trim());

    recommendations.push({
      entry: entries,
      content,
      date: date || "",
    });
  });

  return recommendations;
}
