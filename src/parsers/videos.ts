import { load } from "cheerio";
import type {
  AnimeVideos,
  Promo,
  VideoEpisode,
  MusicVideo,
} from "../models/videos";
import { MAL_BASE_URL } from "../constants";
import {
  cleanImageUrl,
  ensureMalUrl,
  extractMalId,
  youtubeIdFromUrl,
  youtubeTrailerImages,
} from "../utils";

function buildTrailer(href: string | null) {
  const youtubeId = youtubeIdFromUrl(href);
  return {
    youtube_id: youtubeId,
    url: youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : null,
    embed_url: href,
    images: youtubeTrailerImages(youtubeId),
  };
}

export function parseAnimeVideos(html: string): AnimeVideos {
  const $ = load(html);

  const promos: Promo[] = [];
  $(".video-block.promotional-video .video-list-outer").each((_, el) => {
    const $el = $(el);
    const $link = $el.children("a.video-list");
    if (!$link.length) return;
    const href = $link.attr("href") || null;
    const title = $link.find("span.title").text().trim();
    promos.push({ title, trailer: buildTrailer(href) });
  });

  const episodes: VideoEpisode[] = [];
  $(".video-block.episode-video .video-list-outer").each((_, el) => {
    const $el = $(el);
    const $link = $el.find("a.video-list");
    const href = $link.attr("href") || "";
    if (!href.includes("/episode/")) return;
    const url = ensureMalUrl(href);
    const mal_id = extractMalId(url);
    const $title = $link.find("span.title");
    const episodeText = $title.contents().first().text().trim();
    const episodeTitle = $link.find("span.episode-title").text().trim();
    const imgSrc =
      $link.find("img").attr("data-src") || $link.find("img").attr("src") || "";
    const imageUrl = imgSrc.includes("icon-banned-youtube")
      ? null
      : cleanImageUrl(imgSrc) || null;
    episodes.push({
      mal_id,
      url,
      title: episodeTitle,
      episode: episodeText,
      images: { jpg: { image_url: imageUrl } },
    });
  });

  const music_videos: MusicVideo[] = [];
  $(".video-block.music-video .video-list-outer").each((_, el) => {
    const $el = $(el);
    const $link = $el.children("a.video-list");
    if (!$link.length) return;
    const href = $link.attr("href") || null;
    const title = $link.find("span.title").text().trim();

    let metaTitle: string | null = null;
    let metaAuthor: string | null = null;
    const metaDiv = $el.children("div").not(".btn-video-edit-block");
    const metaText = metaDiv.text().trim();
    if (metaText) {
      const byMatch = metaText.match(/^"(.*)"\s+by\s+(.*)$/);
      if (byMatch) {
        metaTitle = byMatch[1];
        metaAuthor = byMatch[2];
      }
    }

    music_videos.push({
      title,
      video: buildTrailer(href),
      meta: { title: metaTitle, author: metaAuthor },
    });
  });

  return { promo: promos, episodes, music_videos };
}

export function parseAnimeVideosEpisodes(html: string): {
  pagination: { last_visible_page: number; has_next_page: boolean };
  data: VideoEpisode[];
} {
  const { episodes, ..._rest } = parseAnimeVideos(html);

  const $ = load(html);

  let last_visible_page = 1;
  let has_next_page = false;

  const pagination = $(".video-block.episode-video .pagination-numbers");
  if (pagination.length) {
    const lastLink = pagination.find('a:contains("Last")');
    const moreLink = pagination.find('a:contains("More")');
    const prevLink = pagination.find('a:contains("Previous")');

    if (lastLink.length) {
      const qs = lastLink.attr("href")?.split("?")[1];
      if (qs) {
        const p = new URLSearchParams(qs).get("p");
        last_visible_page = p ? parseInt(p, 10) : 1;
      }
      has_next_page = true;
    } else if (moreLink.length) {
      const qs = moreLink.attr("href")?.split("?")[1];
      if (qs) {
        const p = new URLSearchParams(qs).get("p");
        last_visible_page = p ? parseInt(p, 10) : 1;
      }
      has_next_page = true;
    } else if (prevLink.length) {
      const currentPage = pagination.find("span.link-blue-box").last().text().trim();
      last_visible_page = currentPage ? parseInt(currentPage, 10) : 1;
      has_next_page = false;
    } else {
      const currentPage = pagination.find("span.link-blue-box").last().text().trim();
      last_visible_page = currentPage ? parseInt(currentPage, 10) : 1;
    }
  }

  return {
    pagination: { last_visible_page, has_next_page },
    data: episodes,
  };
}
