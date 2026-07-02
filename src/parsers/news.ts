import { load } from "cheerio";
import { NewsListItem } from "../models/news.js";
import { MAL_BASE_URL } from "../constants.js";
import {
  toIsoDate,
  cleanImageUrl,
  ensureMalUrl,
  extractMalId,
} from "../utils.js";

interface NewsPagination {
  last_visible_page: number;
  has_next_page: boolean;
}

interface NewsResult {
  pagination: NewsPagination;
  data: NewsListItem[];
}

function parseGlobalNewsItem($: any, $el: any): NewsListItem | null {
  const titleLink = $el.find(".title a").first();
  if (titleLink.length === 0) return null;

  const title = titleLink.text().trim();
  const url = ensureMalUrl(titleLink.attr("href"));
  const mal_id = extractMalId(url);

  const imageUrl = cleanImageUrl(
    $el.find("img").attr("data-src") || $el.find("img").attr("src"),
  );

  const infoRow = $el.find(".info").text().trim();
  const datePart = infoRow.split(" by")[0];
  const date = toIsoDate(datePart);

  const authorLink = $el.find('a[href*="/profile/"]').first();
  const author_username = authorLink.text().trim();
  const author_url = ensureMalUrl(authorLink.attr("href"));

  const forumLink = $el.find('a[href*="/forum/"]').last();
  const forum_url = ensureMalUrl(forumLink.attr("href"));
  const commentsText = forumLink.text();
  const commentsMatch = commentsText.match(/(\d+)/);
  const comments = commentsMatch ? parseInt(commentsMatch[1]) : 0;

  const excerptEl = $el.find(".text").first().clone();
  excerptEl.find("a, .title, .info, .information, .tags").remove();
  const excerpt = excerptEl.text().trim();

  if (title && url && !isNaN(mal_id)) {
    return {
      mal_id,
      url,
      title,
      date: date || datePart,
      author_username,
      author_url,
      forum_url,
      images: {
        jpg: { image_url: imageUrl || "" },
      },
      comments,
      excerpt,
    };
  }
  return null;
}

function parseAnimeNewsItem($: any, $el: any): NewsListItem | null {
  // $el is <div class="clearfix"> containing picSurround, title p, excerpt, info p
  const titleLink = $el.find("p.spaceit a").first();
  if (titleLink.length === 0) return null;

  const title = titleLink.text().trim();
  const url = ensureMalUrl(titleLink.attr("href"));
  const mal_id = extractMalId(url);

  const imageUrl = cleanImageUrl(
    $el.find(".picSurround img").attr("data-src") ||
      $el.find(".picSurround img").attr("src"),
  );

  // Info is in the last <p> child: <p class="lightLink spaceit">
  const infoP = $el.find("p.lightLink").first();
  const infoRow = infoP.text().trim();
  const datePart = infoRow.split(" by")[0];
  const date = toIsoDate(datePart);

  const authorLink = $el.find('a[href*="/profile/"]').first();
  const author_username = authorLink.text().trim();
  const author_url = ensureMalUrl(authorLink.attr("href"));

  // Forum link is the last <a> in the info p
  const forumLink = $el.find('a[href*="/forum/"]').last();
  const forum_url = ensureMalUrl(forumLink.attr("href"));
  const commentsText = forumLink.text();
  const commentsMatch = commentsText.match(/(\d+)/);
  const comments = commentsMatch ? parseInt(commentsMatch[1]) : 0;

  // Excerpt: <div class="clearfix" style="overflow:hidden;"> <p>...</p> </div>
  const excerptEl = $el.find('.clearfix[style*="overflow"] p').first().clone();
  excerptEl.find("a").remove();
  const excerpt = excerptEl.text().trim();

  if (title && url && !isNaN(mal_id)) {
    return {
      mal_id,
      url,
      title,
      date: date || datePart,
      author_username,
      author_url,
      forum_url,
      images: {
        jpg: { image_url: imageUrl || "" },
      },
      comments,
      excerpt,
    };
  }
  return null;
}

function parseNewsPagination($: any): NewsPagination {
  let last_visible_page = 1;
  let has_next_page = false;

  // Try global news pagination: .pagination a.link (numbered)
  const pageLinks = $(".pagination a.link");
  if (pageLinks.length > 0) {
    const pageNums: number[] = [];
    pageLinks.each((_: any, el: any) => {
      const href = $(el).attr("href");
      if (href) {
        const match = href.match(/[?&]p=(\d+)/);
        if (match) {
          pageNums.push(parseInt(match[1]));
        }
      }
    });
    if (pageNums.length > 0) {
      last_visible_page = Math.max(...pageNums);
      const currentLink = $(".pagination a.link.current");
      const currentHref = currentLink.attr("href");
      let currentPage = 1;
      if (currentHref) {
        const match = currentHref.match(/[?&]p=(\d+)/);
        if (match) currentPage = parseInt(match[1]);
      }
      has_next_page = currentPage < last_visible_page;
      return { last_visible_page, has_next_page };
    }
  }

  // Try anime/manga news pagination: "More News" link
  const moreNewsLink = $('a:contains("More News")');
  if (moreNewsLink.length > 0) {
    const href = moreNewsLink.attr("href");
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
    return { last_visible_page, has_next_page };
  }

  // Check for next page via post-pagination empty state
  // If pagination div exists but is empty, no next page
  // Otherwise assume single page
  return { last_visible_page, has_next_page };
}

export function parseNews(html: string): NewsResult {
  const $ = load(html);
  const news: NewsListItem[] = [];

  // Try global news (.news-unit)
  const $newsUnits = $(".news-unit");
  if ($newsUnits.length > 0) {
    $newsUnits.each((_, el) => {
      const item = parseGlobalNewsItem($, $(el));
      if (item) news.push(item);
    });
    const pagination = parseNewsPagination($);
    return { pagination, data: news };
  }

  // Try anime/manga-specific news (.picSurround parent)
  const $animeNewsUnits = $(".picSurround").parent();
  if ($animeNewsUnits.length > 0) {
    $animeNewsUnits.each((_, el) => {
      const item = parseAnimeNewsItem($, $(el));
      if (item) news.push(item);
    });
    const pagination = parseNewsPagination($);
    return { pagination, data: news };
  }

  return {
    pagination: { last_visible_page: 1, has_next_page: false },
    data: [],
  };
}
