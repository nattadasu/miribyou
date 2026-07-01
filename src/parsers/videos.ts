import { load } from "cheerio";
import { AnimeVideos, Promo, VideoEpisode, MusicVideo } from "../models/videos";
import { MAL_BASE_URL } from "../constants";
import { cleanImageUrl, ensureMalUrl, extractMalId } from "../utils";

export function parseAnimeVideos(html: string): AnimeVideos {
  const $ = load(html);

  const promos: Promo[] = [];
  $(".video-block.promotional-video section div").each((_, element) => {
    const $element = $(element);
    const title = $element.find("span.title").text().trim();
    const trailerUrl = $element.find("a.js-video-item").attr("href") || null;
    const youtubeId = trailerUrl
      ? trailerUrl.split("/").pop()?.split("?")[0] || null
      : null;
    const imageUrl = cleanImageUrl(
      $element.find("img").attr("data-src") || $element.find("img").attr("src"),
    );

    promos.push({
      title,
      trailer: {
        youtube_id: youtubeId,
        url: trailerUrl,
        embed_url: youtubeId
          ? `https://www.youtube.com/embed/${youtubeId}`
          : null,
        images: {
          image_url: imageUrl,
          medium_image_url: imageUrl,
          large_image_url: imageUrl,
        },
      },
    });
  });

  const episodes: VideoEpisode[] = [];
  $(".video-block.episode-video .video-list-outer").each((_, element) => {
    const $element = $(element);
    const titleLink = $element.find("a.title");
    const title = titleLink.text().trim();
    const url = ensureMalUrl(titleLink.attr("href"));
    const mal_id = extractMalId(url);
    const episode = $element.find("span.title").text().trim();
    const imageUrl = cleanImageUrl(
      $element.find("img").attr("data-src") || $element.find("img").attr("src"),
    );

    episodes.push({
      mal_id,
      url,
      title,
      episode,
      images: {
        jpg: { image_url: imageUrl },
        webp: { image_url: imageUrl.replace(".jpg", ".webp") },
      },
    });
  });

  const music_videos: MusicVideo[] = [];
  $(".video-block.music-video section div").each((_, element) => {
    const $element = $(element);
    const title = $element.find("span.title").text().trim();
    const videoUrl = $element.find("a.js-video-item").attr("href") || null;
    const youtubeId = videoUrl
      ? videoUrl.split("/").pop()?.split("?")[0] || null
      : null;
    const imageUrl = cleanImageUrl(
      $element.find("img").attr("data-src") || $element.find("img").attr("src"),
    );

    const author = $element.find(".meta .author").text().trim() || null;
    const metaTitle = $element.find(".meta .title").text().trim() || null;

    music_videos.push({
      title,
      video: {
        youtube_id: youtubeId,
        url: videoUrl,
        embed_url: youtubeId
          ? `https://www.youtube.com/embed/${youtubeId}`
          : null,
        images: {
          image_url: imageUrl,
          medium_image_url: imageUrl,
          large_image_url: imageUrl,
        },
      },
      meta: {
        title: metaTitle,
        author,
      },
    });
  });

  return {
    promo: promos,
    episodes,
    music_videos,
  };
}
