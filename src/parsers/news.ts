import { load } from "cheerio";
import { NewsListItem } from "../models/news";
import { MAL_BASE_URL } from "../constants";
import { toIsoDate, cleanImageUrl, ensureMalUrl } from "../utils";

export function parseNews(html: string): NewsListItem[] {
  const $ = load(html);
  const news: NewsListItem[] = [];

  // Try different potential containers
  // 1. Global News / Recent News (.news-unit)
  // 2. Anime/Manga Specific News (.picSurround)
  const newsUnits = $(".news-unit");
  const animeNewsUnits = $(".picSurround").parent();

  const processElement = ($element: any) => {
    // Title and URL
    const titleLink = $element.find(".title a, .spaceit a strong").first();
    const actualLink = titleLink.is("strong") ? titleLink.parent() : titleLink;

    if (actualLink.length === 0) return;

    const title = actualLink.text().trim();
    const url = ensureMalUrl(actualLink.attr("href"));
    const mal_id = parseInt(url.split("/").pop() || "0");

    const imageUrl = cleanImageUrl(
      $element.find("img").attr("data-src") || $element.find("img").attr("src"),
    );

    // Info row (date and author)
    const infoRow = $element.find(".info, .lightLink").text().trim();
    const datePart = infoRow.split(" by")[0];
    const date = toIsoDate(datePart);

    const authorLink = $element.find('a[href*="/profile/"]').first();
    const author_username = authorLink.text().trim();
    const author_url = ensureMalUrl(authorLink.attr("href"));

    // Forum link and comments
    const forumLink = $element.find('a[href*="/forum/"]').last();
    const forum_url = ensureMalUrl(forumLink.attr("href"));
    const commentsText = forumLink.text();
    const commentsMatch = commentsText.match(/(\d+)/);
    const comments = commentsMatch ? parseInt(commentsMatch[1]) : 0;

    const excerptEl = $element
      .find(".text, .clearfix p, .news-unit-right div")
      .first()
      .clone();
    excerptEl.find("a, .title, .info, .information, .tags").remove();
    const excerpt = excerptEl.text().trim();

    if (title && url && !isNaN(mal_id)) {
      news.push({
        mal_id,
        url,
        title,
        date: date || datePart,
        author_username,
        author_url,
        forum_url,
        images: {
          jpg: { image_url: imageUrl || "" },
          webp: {
            image_url: imageUrl ? imageUrl.replace(".jpg", ".webp") : "",
          },
        },
        comments,
        excerpt,
      });
    }
  };

  if (newsUnits.length > 0) {
    newsUnits.each((_, el) => processElement($(el)));
  } else if (animeNewsUnits.length > 0) {
    animeNewsUnits.each((_, el) => processElement($(el)));
  }

  return news;
}
