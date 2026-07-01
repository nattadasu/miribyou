import { load } from "cheerio";
import { MAL_BASE_URL } from "../constants";
import {
  parseMalDate,
  cleanImageUrl,
  resolveSearchDate,
  extractMalId,
} from "../utils";

export function parseMangaSearch(html: string): any {
  const $ = load(html);
  const results: any[] = [];

  $(".js-categories-seasonal table tr:not(:first-child)").each((_, row) => {
    const $row = $(row);
    const titleLink = $row.find("td:nth-child(2) a.hoverinfo_trigger");
    const title = titleLink.text().trim();
    const url = titleLink.attr("href") || "";
    const mal_id = extractMalId(url);

    let imageUrl = cleanImageUrl(
      $row.find("td:nth-child(1) img").attr("data-src") ||
        $row.find("td:nth-child(1) img").attr("src"),
    );
    imageUrl = imageUrl.replace(/\/r\/\d+x\d+/, "");

    const type = $row.find("td:nth-child(3)").text().trim();

    const volumesStr = $row.find("td:nth-child(4)").text().trim();
    const volumes = volumesStr === "-" ? null : parseInt(volumesStr) || null;

    const chaptersStr = $row.find("td:nth-child(5)").text().trim();
    const chapters = chaptersStr === "-" ? null : parseInt(chaptersStr) || null;

    const scoreStr = $row.find("td:nth-child(6)").text().trim();
    const score = scoreStr === "-" ? null : parseFloat(scoreStr) || null;

    const startDate = $row.find("td:nth-child(7)").text().trim();
    const endDate = $row.find("td:nth-child(8)").text().trim();
    const membersStr = $row
      .find("td:nth-child(9)")
      .text()
      .trim()
      .replace(/,/g, "");
    const members = membersStr === "-" ? null : parseInt(membersStr) || null;

    const rawPublished =
      startDate && endDate && startDate !== "-" && endDate !== "-"
        ? `${startDate} to ${endDate}`
        : startDate && startDate !== "-"
          ? startDate
          : null;
    const published = resolveSearchDate(rawPublished);

    const synopsis = $row
      .find("td:nth-child(2) .pt4")
      .clone()
      .find("a")
      .remove()
      .end()
      .text()
      .trim();

    if (title) {
      results.push({
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
        approved: true,
        titles: [
          {
            type: "Default",
            title: title,
          },
        ],
        title,
        title_english: null,
        title_japanese: null,
        title_synonyms: [],
        type,
        source: null,
        volumes,
        chapters,
        airing: false,
        published,
        _raw_published: rawPublished,
        status: null,
        score,
        scored_by: null,
        rank: null,
        popularity: null,
        members,
        favorites: null,
        synopsis,
        background: null,
        authors: [],
        serializations: [],
        genres: [],
        explicit_genres: [],
        themes: [],
        demographics: [],
      });
    }
  });

  // Pagination
  const paginationDiv = $(".pagination, .bgColor1");
  const lastPageLink = paginationDiv.find("a").last().attr("href");
  let last_visible_page = 1;
  if (lastPageLink) {
    const match = lastPageLink.match(/show=(\d+)/);
    if (match) {
      last_visible_page = Math.floor(parseInt(match[1]) / 50) + 1;
    } else {
      const pageNum = parseInt(paginationDiv.find("a").last().text());
      if (!isNaN(pageNum)) last_visible_page = pageNum;
    }
  }

  const hasNext = paginationDiv
    .find("a")
    .map((_, el) => {
      const pageText = $(el).text();
      const page = parseInt(pageText);
      const current = parseInt(
        paginationDiv.text().match(/\[(\d+)\]/)?.[1] || "1",
      );
      return (
        page > current || pageText.includes("Next") || pageText.includes(">")
      );
    })
    .get()
    .some((v) => v);

  return {
    pagination: {
      last_visible_page,
      has_next_page: hasNext,
      current_page: 1,
      items: {
        count: results.length,
        total: last_visible_page * 50,
        per_page: 50,
      },
    },
    data: results,
  };
}
