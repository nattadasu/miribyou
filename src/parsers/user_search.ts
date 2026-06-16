import { load } from "cheerio";
import { UserMeta } from "../models/user";
import { MAL_BASE_URL } from "../constants";
import { toIsoDate, cleanImageUrl, ensureMalUrl } from "../utils";

export function parseUserSearch(html: string): any {
  const $ = load(html);

  // Check if we are on a profile page (redirected)
  if ($(".user-profile").length > 0) {
    const titleText = $("title").text();
    const username =
      titleText.split("'s Profile")[0].trim() ||
      $(".header-profile-name").text().trim();
    const profile_image = cleanImageUrl(
      $(".user-profile .user-image img").attr("data-src") ||
        $(".user-profile .user-image img").attr("src"),
    );

    return {
      pagination: {
        last_visible_page: 1,
        has_next_page: false,
        current_page: 1,
        items: {
          count: 1,
          total: 1,
          per_page: 1,
        },
      },
      data: [
        {
          username,
          url: ensureMalUrl(`/profile/${username}`),
          images: {
            jpg: {
              image_url: profile_image
                .replace("thumbs/", "")
                .replace("_thumb", ""),
            },
            webp: {
              image_url: profile_image
                .replace("thumbs/", "")
                .replace("_thumb", "")
                .replace(".jpg", ".webp"),
            },
          },
          last_online: toIsoDate(
            $(".user-status li:contains('Last Online')")
              .text()
              .replace("Last Online", "")
              .trim(),
          ),
        },
      ],
    };
  }

  const results: any[] = [];

  // Search results are often in a table
  $(".table-list tr").each((i, row) => {
    if (i === 0) return; // Skip header
    const $row = $(row);
    const $link = $row.find("td:nth-child(2) a");
    const username = $link.text().trim();
    const url = $link.attr("href") || "";

    if (!username) return;

    let imageUrl = cleanImageUrl(
      $row.find("td:nth-child(1) img").attr("data-src") ||
        $row.find("td:nth-child(1) img").attr("src"),
    );
    const lastOnlineText = $row.find("td:nth-child(3)").text().trim();

    results.push({
      username,
      url: ensureMalUrl(url),
      images: {
        jpg: {
          image_url: imageUrl.replace("thumbs/", "").replace("_thumb", ""),
        },
        webp: {
          image_url: imageUrl
            .replace("thumbs/", "")
            .replace("_thumb", "")
            .replace(".jpg", ".webp"),
        },
      },
      last_online: toIsoDate(lastOnlineText),
    });
  });

  // Fallback for different page structure
  if (results.length === 0) {
    $('a[href*="/profile/"]').each((_, element) => {
      const $el = $(element);
      const url = $el.attr("href") || "";
      const match = url.match(/\/profile\/([^\/\?#]+)$/);
      if (!match) return;
      const username = match[1];
      if (!username || username === "Profile") return;
      if (results.find((r) => r.username === username)) return;

      let imageUrl = "";
      const imgEl = $(`a[href*="/profile/${username}"] img`);
      imgEl.each((_, i) => {
        const src = cleanImageUrl($(i).attr("data-src") || $(i).attr("src"));
        if (src && !src.includes("spacer.gif")) {
          imageUrl = src;
          return false;
        }
      });

      results.push({
        username,
        url: ensureMalUrl(url),
        images: {
          jpg: {
            image_url: imageUrl.replace("thumbs/", "").replace("_thumb", ""),
          },
          webp: {
            image_url: imageUrl
              .replace("thumbs/", "")
              .replace("_thumb", "")
              .replace(".jpg", ".webp"),
          },
        },
        last_online: null,
      });
    });
  }

  const paginationDiv = $(".pagination, .bgColor1");
  const lastPageNum = parseInt(paginationDiv.find("a").last().text());
  const last_visible_page = !isNaN(lastPageNum) ? lastPageNum : 1;

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
        total: last_visible_page * 20, // MAL user search usually shows 20 per page
        per_page: 20,
      },
    },
    data: results,
  };
}
