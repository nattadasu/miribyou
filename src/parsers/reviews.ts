import { load } from "cheerio";
import { Review, Reactions } from "../models/reviews";
import { MAL_BASE_URL } from "../constants";
import { toIsoDate, ensureMalUrl } from "../utils";

export function parseReviews(html: string, type: "anime" | "manga"): Review[] {
  const $ = load(html);
  const reviews: Review[] = [];

  $(".review-element").each((_, element) => {
    const $element = $(element);

    const reviewLink = $element.find(".bottom-navi .open a");
    const url = reviewLink.attr("href") || "";
    const mal_id = parseInt(url.split("id=")[1] || "0");

    const date = toIsoDate($element.find(".update_at").text().trim());
    const reviewText = $element.find(".text").first().text().trim();
    const score = parseInt($element.find(".rating .num").text().trim() || "0");

    const tags: string[] = [];
    $element.find(".tags .tag").each((_, tag) => {
      tags.push($(tag).text().trim());
    });

    const is_spoiler = $element.find(".tags .spoiler").length > 0;
    const is_preliminary = $element.find(".tags .preliminary").length > 0;

    const userLink = $element.find(".reviewer .username a");
    const username = userLink.text().trim();
    const userUrl = ensureMalUrl(userLink.attr("href"));
    const userImageUrl =
      $element.find(".reviewer .thumb img").attr("data-src") ||
      $element.find(".reviewer .thumb img").attr("src") ||
      "";

    const reactions: Reactions = {
      overall: parseInt(
        $element.find(".reactions .overall").text().trim() || "0",
      ),
      nice: parseInt($element.find(".reactions .nice").text().trim() || "0"),
      love_it: parseInt(
        $element.find(".reactions .love_it").text().trim() || "0",
      ),
      funny: parseInt($element.find(".reactions .funny").text().trim() || "0"),
      confusing: parseInt(
        $element.find(".reactions .confusing").text().trim() || "0",
      ),
      informative: parseInt(
        $element.find(".reactions .informative").text().trim() || "0",
      ),
      well_written: parseInt(
        $element.find(".reactions .well_written").text().trim() || "0",
      ),
      creative: parseInt(
        $element.find(".reactions .creative").text().trim() || "0",
      ),
    };

    const review: Review = {
      mal_id,
      url,
      type,
      reactions,
      date: date || "",
      review: reviewText,
      score,
      tags,
      is_spoiler,
      is_preliminary,
      user: {
        username,
        url: userUrl,
        images: {
          jpg: { image_url: userImageUrl },
          webp: { image_url: userImageUrl.replace(".jpg", ".webp") },
        },
      },
    };

    if (type === "anime") {
      const watchedText = $element
        .find(".tags .preliminary span")
        .text()
        .trim();
      const watchedMatch = watchedText.match(/\((\d+)\//);
      review.episodes_watched = watchedMatch ? parseInt(watchedMatch[1]) : null;
    } else {
      const readText = $element.find(".tags .preliminary span").text().trim();
      const readMatch = readText.match(/\((\d+)\//);
      review.chapters_read = readMatch ? parseInt(readMatch[1]) : null;
    }

    reviews.push(review);
  });

  return reviews;
}
