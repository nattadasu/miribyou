import { load } from "cheerio";
import { ForumTopic } from "../models/forum";
import { MAL_BASE_URL } from "../constants";
import { ensureMalUrl, toIsoDate } from "../utils";

export function parseForum(html: string): ForumTopic[] {
  const $ = load(html);
  const topics: ForumTopic[] = [];

  // Forum topics are in a table, skip header
  $('tr[id^="topicRow"]').each((_, element) => {
    const $element = $(element);
    const titleLink = $element.find('td:nth-child(2) a[href*="topicid="]').first();
    const title = titleLink.text().trim();
    const url = ensureMalUrl(titleLink.attr("href"));
    const mal_id = parseInt(url.split("topicid=")[1] || "0");

    const date = toIsoDate($element.find("td:nth-child(2) span.lightLink").text().trim());
    const authorLink = $element.find("span.forum_postusername a");
    const author_username = authorLink.text().trim();
    const author_url = ensureMalUrl(authorLink.attr("href"));

    const comments = parseInt(
      $element.find("td:nth-child(3)").text().trim() || "0",
    );

    const lastPostTd = $element.find("td:nth-child(4)");
    const lastAuthorLink = lastPostTd.find("a").first();
    const lastAuthorUsername = lastAuthorLink.text().trim();
    const lastAuthorUrl = ensureMalUrl(lastAuthorLink.attr("href"));
    const lastPostLink = lastPostTd.find("a").last();
    const lastPostUrl = ensureMalUrl(lastPostLink.attr("href"));
    const lastDate = toIsoDate(lastPostTd.contents().last().text().trim());

    topics.push({
      mal_id,
      url,
      title,
      date,
      author_username,
      author_url,
      comments,
      last_comment: {
        url: lastPostUrl,
        author_username: lastAuthorUsername,
        author_url: lastAuthorUrl,
        date: lastDate,
      },
    });
  });

  return topics;
}
