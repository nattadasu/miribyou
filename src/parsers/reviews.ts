import { load } from "cheerio";
import { Review, Reactions } from "../models/reviews";
import { MAL_BASE_URL } from "../constants";
import { toIsoDate, ensureMalUrl, cleanImageUrl } from "../utils";

interface ReviewPagination {
  last_visible_page: number;
  has_next_page: boolean;
}

interface ReviewResult {
  pagination: ReviewPagination;
  data: Review[];
}

function parseReactions($element: any): Reactions {
  const defaultReactions: Reactions = {
    overall: 0,
    nice: 0,
    love_it: 0,
    funny: 0,
    confusing: 0,
    informative: 0,
    well_written: 0,
    creative: 0,
  };

  const dataAttr = $element.attr("data-reactions");
  if (!dataAttr) return defaultReactions;

  try {
    const data = JSON.parse(dataAttr);
    return {
      overall: parseInt(data.num) || 0,
      nice: parseInt(data.count[0]) || 0,
      love_it: parseInt(data.count[1]) || 0,
      funny: parseInt(data.count[2]) || 0,
      confusing: parseInt(data.count[3]) || 0,
      informative: parseInt(data.count[4]) || 0,
      well_written: parseInt(data.count[5]) || 0,
      creative: parseInt(data.count[6]) || 0,
    };
  } catch {
    return defaultReactions;
  }
}

function parseReviewText($element: any): string {
  const $textEl = $element.find(".text").first().clone();
  $textEl.find(".js-visible").remove();
  return $textEl.text().trim();
}

export function parseReviews(
  html: string,
  type: "anime" | "manga",
): ReviewResult {
  const $ = load(html);
  const reviews: Review[] = [];

  $(".review-element").each((_, element) => {
    const $element = $(element);

    const reviewLink = $element.find(".bottom-navi .open a");
    const url = reviewLink.attr("href") || "";
    const mal_id = parseInt(url.split("id=")[1] || "0");

    const $dateEl = $element.find(".update_at");
    const dateStr = $dateEl.text().trim();
    const timeStr = $dateEl.attr("title") || "";
    const date = toIsoDate(timeStr ? `${dateStr} ${timeStr}` : dateStr);
    const reviewText = parseReviewText($element);
    const score = parseInt($element.find(".rating .num").text().trim() || "0");

    const tags: string[] = [];
    $element.find(".tags .tag").each((_: any, tag: any) => {
      const text = $(tag).clone().children().remove().end().text().trim();
      if (text) tags.push(text);
    });

    const is_spoiler = $element.find(".tags .spoiler").length > 0;
    const is_preliminary = $element.find(".tags .preliminary").length > 0;

    const userLink = $element.find(".username a");
    const username = userLink.text().trim();
    const userUrl = ensureMalUrl(userLink.attr("href"));
    const userImageUrl = cleanImageUrl(
      $element.find(".thumb img").attr("data-src") ||
        $element.find(".thumb img").attr("src") ||
        "",
    );

    const reactions = parseReactions($element);

    const webpUrl = userImageUrl.endsWith(".jpg")
      ? userImageUrl.replace(".jpg", ".webp")
      : userImageUrl;

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
          webp: { image_url: webpUrl },
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

  // Pagination
  let last_visible_page = 1;
  let has_next_page = false;

  const moreReviewsLink = $('a:contains("More Reviews")');
  if (moreReviewsLink.length > 0) {
    const href = moreReviewsLink.first().attr("href");
    if (href) {
      const match = href.match(/[?&]p=(\d+)/);
      if (match) {
        last_visible_page = parseInt(match[1]);
        has_next_page = true;
      } else {
        has_next_page = true;
      }
    } else {
      has_next_page = true;
    }
  }

  return {
    pagination: { last_visible_page, has_next_page },
    data: reviews,
  };
}
