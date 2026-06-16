import { load } from "cheerio";
import { AnimeEpisode, AnimeEpisodes } from "../models/episodes";
import { MAL_BASE_URL } from "../constants";
import { toIsoDate, ensureMalUrl } from "../utils";

export function parseAnimeEpisodes(html: string): AnimeEpisodes {
  const $ = load(html);
  const episodes: AnimeEpisode[] = [];

  $(".js-watch-episode-list tbody tr").each((_, row) => {
    const $row = $(row);
    const episodeId = parseInt(
      $row.find(".episode-number").text().trim() || "0",
    );
    const titleLink = $row.find(".episode-title a");
    const title = titleLink.text().trim();
    const url = ensureMalUrl(titleLink.attr("href"));

    const titleJpRow = $row.find(".episode-title span.di-ib").text().trim();
    let title_japanese: string | null = null;
    let title_romanji: string | null = null;

    if (titleJpRow) {
      const matches = titleJpRow.match(/(.*)\((.*)\)/);
      if (matches) {
        title_romanji = matches[1].trim();
        title_japanese = matches[2].trim();
      }
    }

    const aired = toIsoDate($row.find(".episode-aired").text().trim());
    const scoreStr = $row.find(".episode-poll").attr("data-raw");
    const score = scoreStr ? parseFloat(scoreStr) : null;

    const filler =
      $row.find('.episode-title span.icon-episode-type-bg:contains("Filler")')
        .length > 0;
    const recap =
      $row.find('.episode-title span.icon-episode-type-bg:contains("Recap")')
        .length > 0;

    const forumLink = $row.find(".episode-forum a").attr("href");
    const forum_url = ensureMalUrl(forumLink) || null;

    episodes.push({
      mal_id: episodeId,
      url: url || null,
      title,
      title_japanese,
      title_romanji,
      aired: aired,
      score,
      filler,
      recap,
      forum_url,
    });
  });

  // Pagination
  const lastPageLink = $(".pagination a.link:last-child").attr("href");
  let last_visible_page = 1;
  if (lastPageLink) {
    const match = lastPageLink.match(/\?offset=(\d+)/);
    if (match) {
      last_visible_page = Math.floor(parseInt(match[1]) / 100) + 1;
    }
  }

  const hasNextPage = $(".pagination a.link.current").next("a.link").length > 0;

  return {
    pagination: {
      last_visible_page,
      has_next_page: hasNextPage,
    },
    data: episodes,
  };
}

export function parseAnimeEpisode(html: string): any {
  const $ = load(html);
  const titleBlock = $(".fs18");
  if (titleBlock.length === 0) throw new Error("404 on MAL");

  const title = titleBlock.clone().find("span").remove().end().text().trim();
  const episodeId = parseInt(
    titleBlock
      .find("span")
      .text()
      .replace(/[^0-9]/g, "") || "0",
  );

  const infoBlock = $('.fn-grey2:contains("Aired:")');
  const airedText = infoBlock.text().trim();
  const airedMatch = airedText.match(/Aired: (.*)$/);
  const aired = toIsoDate(airedMatch ? airedMatch[1].trim() : null);

  const durationMatch = airedText.match(/Duration: (.*)Aired/);
  const duration = durationMatch ? durationMatch[1].trim() : null;

  const synopsis = $('meta[property="og:description"]').attr("content");

  return {
    mal_id: episodeId,
    url: $('meta[property="og:url"]').attr("content"),
    title,
    aired,
    duration,
    synopsis: synopsis?.startsWith("Looking for episode specific information")
      ? null
      : synopsis,
  };
}
