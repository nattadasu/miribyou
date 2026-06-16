import { load } from "cheerio";
import { MAL_BASE_URL } from "../constants";
import { ensureMalUrl } from "../utils";

export interface UserClub {
  mal_id: number;
  name: string;
  url: string;
}

export interface UserClubsResponse {
  pagination: {
    last_visible_page: number;
    has_next_page: boolean;
  };
  data: UserClub[];
}

export function parseUserClubs(html: string): UserClubsResponse {
  const $ = load(html);
  const clubs: UserClub[] = [];

  const content = $("#content");
  content.find("ol li").each((_, element) => {
    const $element = $(element);
    const link = $element.find("a").first();
    const name = link.text().trim();
    const href = link.attr("href") || "";

    if (href.includes("cid=")) {
      const url = ensureMalUrl(href);
      const mal_id = parseInt(href.split("cid=")[1] || "0");

      if (name) {
        clubs.push({
          mal_id,
          name,
          url,
        });
      }
    }
  });

  const paginationDiv = $(".pagination, .bgColor1");
  const lastPageLink = paginationDiv.find("a").last().attr("href");
  let lastVisiblePage = 1;
  if (lastPageLink) {
    const match = lastPageLink.match(/[?&]show=(\d+)/);
    if (match) {
      lastVisiblePage = Math.ceil(parseInt(match[1]) / 100) + 1; // Assuming 100 per page for clubs
    } else {
      const pageNum = parseInt(paginationDiv.find("a").last().text());
      if (!isNaN(pageNum)) lastVisiblePage = pageNum;
    }
  }

  const hasNextPage =
    paginationDiv.find('a:contains("Next"), a:contains(">")').length > 0;

  return {
    pagination: {
      last_visible_page: lastVisiblePage,
      has_next_page: hasNextPage,
    },
    data: clubs,
  };
}
