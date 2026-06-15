import { load } from "cheerio";
import { MAL_BASE_URL } from "../constants";
import { parseMalDate, cleanImageUrl, resolveSearchDate } from "../utils";

export function parseAnimeSearch(html: string): any {
  const $ = load(html);

  const results = $(".js-categories-seasonal table tr")
    .slice(1)
    .map((_, tr) => {
      const $tr = $(tr);
      const titleLink = $tr.find("td:nth-child(2) a.hoverinfo_trigger").first();
      const href = titleLink.attr("href") || "";
      const title = titleLink.text().trim();

      let imageUrl = cleanImageUrl(
        $tr.find("td:nth-child(1) img").attr("data-src") ||
          $tr.find("td:nth-child(1) img").attr("src"),
      );
      imageUrl = imageUrl.replace(/\/r\/\d+x\d+/, "");

      const synopsis = $tr
        .find("td:nth-child(2) .pt4")
        .clone()
        .find("a")
        .remove()
        .end()
        .text()
        .trim();

      const type = $tr.find("td:nth-child(3)").text().trim();
      const episodesStr = $tr.find("td:nth-child(4)").text().trim();
      const episodes =
        episodesStr === "-" ? null : parseInt(episodesStr) || null;

      const scoreStr = $tr.find("td:nth-child(5)").text().trim();
      const score = scoreStr === "-" ? null : parseFloat(scoreStr) || null;

      const startDate = $tr.find("td:nth-child(6)").text().trim();
      const endDate = $tr.find("td:nth-child(7)").text().trim();
      const membersStr = $tr
        .find("td:nth-child(8)")
        .text()
        .trim()
        .replace(/,/g, "");
      const members = membersStr === "-" ? null : parseInt(membersStr) || null;
      const rating = $tr.find("td:nth-child(9)").text().trim() || null;

      const rawAired =
        startDate && endDate && startDate !== "-" && endDate !== "-"
          ? `${startDate} to ${endDate}`
          : startDate && startDate !== "-"
            ? startDate
            : null;
      const aired = resolveSearchDate(rawAired);

      return {
        mal_id: parseInt(href.split("/").slice(-2, -1)[0] || "0"),
        url: href,
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
        trailer: {
          youtube_id: null,
          url: null,
          embed_url: null,
          images: {
            image_url: null,
            small_image_url: null,
            medium_image_url: null,
            large_image_url: null,
            maximum_image_url: null,
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
        episodes,
        status: episodes === 1 ? "Finished Airing" : null,
        airing: false,
        aired,
        _raw_aired: rawAired,
        duration: null,
        rating,
        score,
        scored_by: null,
        rank: null,
        popularity: null,
        members,
        favorites: null,
        synopsis,
        background: null,
        season: null,
        year: null,
        broadcast: {
          day: null,
          time: null,
          timezone: null,
          string: null,
        },
        producers: [],
        licensors: [],
        studios: [],
        genres: [],
        explicit_genres: [],
        themes: [],
        demographics: [],
      };
    })
    .get();

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
        total: last_visible_page * 50, // Best guess
        per_page: 50,
      },
    },
    data: results,
  };
}
