import { load } from "cheerio";
import { UserUpdate } from "../models/userupdates";
import { MAL_BASE_URL } from "../constants";
import { cleanImageUrl, toIsoDate, ensureMalUrl } from "../utils";

export function parseUserUpdates(
  html: string,
  type: "anime" | "manga",
): UserUpdate[] {
  const $ = load(html);
  const updates: UserUpdate[] = [];

  $(".table-recently-updated tr:not(:first-child)").each((_, element) => {
    const $element = $(element);
    const userLink = $element.find("td:nth-child(1) div:nth-child(2) a");
    const username = userLink.text().trim();
    const url = userLink.attr("href") || "";

    const style =
      $element.find("td:nth-child(1) div:nth-child(1) a").attr("style") || "";
    const rawImageUrl = style.replace(
      /background-image:url\(['"]?(.*?)['"]?\)/,
      "$1",
    );
    const imageUrl = cleanImageUrl(
      rawImageUrl.replace("thumbs/", "").replace("_thumb", ""),
    );

    const scoreText = $element.find("td:nth-child(2)").text().trim();
    const score = scoreText === "-" ? null : parseInt(scoreText);

    const status = $element.find("td:nth-child(3)").text().trim();

    const progressText = $element.find("td:nth-child(4)").text().trim();
    const progressParts = progressText.split("/");

    const date = toIsoDate($element.find("td:nth-child(5)").text().trim());

    const update: UserUpdate = {
      user: {
        username,
        url: ensureMalUrl(url),
        images: {
          jpg: { image_url: imageUrl },
          webp: { image_url: imageUrl.replace(".jpg", ".webp") },
        },
      },
      score,
      status,
      date: date || "",
    };

    if (type === "anime") {
      update.episodes_seen =
        progressParts[0] === "-" ? null : parseInt(progressParts[0]);
      update.episodes_total =
        progressParts[1] === "-" ? null : parseInt(progressParts[1]);
    } else {
      update.chapters_read =
        progressParts[0] === "-" ? null : parseInt(progressParts[0]);
      update.chapters_total =
        progressParts[1] === "-" ? null : parseInt(progressParts[1]);
    }

    updates.push(update);
  });

  return updates;
}
