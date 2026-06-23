import { describe, it, expect, vi } from "vitest";
import { SELF } from "cloudflare:test";

describe("Seasons Endpoint", () => {
  it("GET /seasons returns season list", async () => {
    const mockHtml = `
      <table class="anime-seasonal-byseason">
        <tr>
          <td><a href="/anime/season/2024/spring">Spring 2024</a></td>
          <td><a href="/anime/season/2024/summer">Summer 2024</a></td>
        </tr>
      </table>
    `;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/anime/season/archive")) {
        return Promise.resolve(new Response(mockHtml, { status: 200 }));
      }
      return originalFetch(url);
    });

    try {
      const response = await SELF.fetch("https://example.com/v4/seasons");
      const body = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=86400, s-maxage=86400",
      );
      expect(response.headers.get("CDN-Cache-Control")).toBe(
        "public, max-age=86400, s-maxage=86400",
      );
      expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe(
        "public, max-age=86400, s-maxage=86400",
      );
      expect(response.headers.get("X-Powered-By")).toBe(
        "miribyou (Jikan-like)",
      );
      expect(body.data).toBeDefined();
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data[0].year).toBe(2024);
      expect(body.data[0].seasons).toContain("spring");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("GET /seasons/now returns current season anime", async () => {
    const mockHtml = `
      <div class="seasonal-anime">
        <div class="title">
          <a href="https://myanimelist.net/anime/52991/Sousou_no_Frieren" class="link-title">Sousou no Frieren</a>
        </div>
        <div class="image">
          <img src="https://cdn.myanimelist.net/images/anime/1015/138006.jpg">
        </div>
        <div class="synopsis">
          <p class="preline">Synopsis here...</p>
        </div>
        <div class="info">
          <span class="item">TV</span>
          <span class="item">28 eps</span>
          <span class="item">Sep 29, 2023, 21:00 (JST)</span>
        </div>
        <div class="score" title="Score">9.39</div>
        <div class="member" title="Members">1,000,000</div>
        <div class="genres">
            <span class="genre"><a href="/anime/genre/1/Action">Action</a></span>
        </div>
        <div class="properties">
            <div class="property">
                <span class="caption">Studio</span>
                <span class="value"><a href="/anime/producer/11/Madhouse">Madhouse</a></span>
            </div>
            <div class="property">
                <span class="caption">Source</span>
                <span class="value">Manga</span>
            </div>
        </div>
      </div>
    `;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/anime/season")) {
        return Promise.resolve(new Response(mockHtml, { status: 200 }));
      }
      return originalFetch(url);
    });

    try {
      const response = await SELF.fetch("https://example.com/v4/seasons/now");
      const body = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(body.data).toBeDefined();
      expect(body.data.length).toBe(1);
      expect(body.data[0].title).toBe("Sousou no Frieren");
      expect(body.data[0].mal_id).toBe(52991);
      expect(body.data[0].type).toBe("TV");
      expect(body.data[0].score).toBe(9.39);
      expect(body.data[0].studios[0].name).toBe("Madhouse");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("GET /seasons/:year/:season returns specific season anime", async () => {
    const mockHtml = `
      <div class="seasonal-anime">
        <div class="title">
          <a href="https://myanimelist.net/anime/5114/Fullmetal_Alchemist__Brotherhood" class="link-title">Fullmetal Alchemist: Brotherhood</a>
        </div>
        <div class="info">
           <span class="item">TV</span>
           <span class="item">64 eps</span>
           <span class="item">Apr 5, 2009, 17:00 (JST)</span>
        </div>
      </div>
    `;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/anime/season/2009/spring")) {
        return Promise.resolve(new Response(mockHtml, { status: 200 }));
      }
      return originalFetch(url);
    });

    try {
      const response = await SELF.fetch(
        "https://example.com/v4/seasons/2009/spring",
      );
      const body = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(body.data[0].title).toBe("Fullmetal Alchemist: Brotherhood");
      expect(body.data[0].mal_id).toBe(5114);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("GET /seasons/now with hover=1 enriches data", async () => {
    const mockSeasonalHtml = `
      <div class="seasonal-anime">
        <div class="title">
          <a href="https://myanimelist.net/anime/52991/Sousou_no_Frieren" class="link-title">Sousou no Frieren</a>
        </div>
      </div>
    `;
    const mockHoverHtml = `
      <div class="hover-info">
        <div><span class="dark_text">Score:</span> 9.39</div>
        <div><span class="dark_text">Members:</span> 1,000,000</div>
      </div>
    `;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/anime/season")) {
        return Promise.resolve(new Response(mockSeasonalHtml, { status: 200 }));
      }
      if (url.includes("/anime/52991/hover")) {
        return Promise.resolve(new Response(mockHoverHtml, { status: 200 }));
      }
      return originalFetch(url);
    });

    try {
      const response = await SELF.fetch(
        "https://example.com/v4/seasons/now?hover=1",
      );
      const body = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(body.data[0].score).toBe(9.39);
      expect(body.data[0].members).toBe(1000000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("GET /seasons/now uses MAL API if client id is provided", async () => {
    const mockApiResponse = {
      data: [
        {
          node: {
            id: 52991,
            title: "Sousou no Frieren",
            mean: 9.39,
            main_picture: { medium: "url" },
          },
        },
      ],
      paging: {},
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("api.myanimelist.net/v2/anime/season")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockApiResponse), { status: 200 }),
        );
      }
      return originalFetch(url);
    });

    try {
      const response = await SELF.fetch("https://example.com/v4/seasons/now", {
        headers: { "x-mal-client-id": "mock" },
      });
      const body = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(body.data[0].mal_id).toBe(52991);
      expect(body.data[0].score).toBe(9.39);
      expect(body.pagination.items.total).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("GET /seasons/upcoming returns upcoming season anime", async () => {
    const mockHtml = `
      <div class="seasonal-anime">
        <div class="title">
          <a href="https://myanimelist.net/anime/54837/Oshi_no_Ko_2nd_Season" class="link-title">Oshi no Ko 2nd Season</a>
        </div>
      </div>
    `;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/anime/season/later")) {
        return Promise.resolve(new Response(mockHtml, { status: 200 }));
      }
      return originalFetch(url);
    });

    try {
      const response = await SELF.fetch(
        "https://example.com/v4/seasons/upcoming",
      );
      const body = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(body.data[0].title).toBe("Oshi no Ko 2nd Season");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("GET /seasons/:year/:season returns 404 for non-existent season", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/anime/season/1900/spring")) {
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      }
      return originalFetch(url);
    });

    try {
      const response = await SELF.fetch(
        "https://example.com/v4/seasons/1900/spring",
      );
      expect(response.status).toBe(404);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("GET /seasons/now respects page and limit", async () => {
    const mockSeasonalHtml = `
      <p class="fs11 ar fn-grey2 pt8 pr4">
        Showing: <span class="js-visible-anime-count">3/3</span>
      </p>
      <div class="seasonal-anime"><a href="/anime/1" class="link-title">Anime 1</a><div class="info"><span class="item">TV</span><span class="item">1 eps</span><span class="item">Jan 1, 2024</span></div></div>
      <div class="seasonal-anime"><a href="/anime/2" class="link-title">Anime 2</a><div class="info"><span class="item">TV</span><span class="item">1 eps</span><span class="item">Jan 1, 2024</span></div></div>
      <div class="seasonal-anime"><a href="/anime/3" class="link-title">Anime 3</a><div class="info"><span class="item">TV</span><span class="item">1 eps</span><span class="item">Jan 1, 2024</span></div></div>
    `;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/anime/season")) {
        return Promise.resolve(new Response(mockSeasonalHtml, { status: 200 }));
      }
      return originalFetch(url);
    });

    try {
      // Page 1, limit 2
      const res1 = await SELF.fetch(
        "https://example.com/v4/seasons/now?page=1&limit=2&continuing",
      );
      const body1 = (await res1.json()) as any;
      expect(body1.data.length).toBe(2);
      expect(body1.data[0].title).toBe("Anime 1");
      expect(body1.data[1].title).toBe("Anime 2");
      expect(body1.pagination.has_next_page).toBe(true);
      expect(body1.pagination.items.total).toBe(3);
      expect(body1.pagination.last_visible_page).toBe(2);

      // Page 2, limit 2
      const res2 = await SELF.fetch(
        "https://example.com/v4/seasons/now?page=2&limit=2&continuing",
      );
      const body2 = (await res2.json()) as any;
      expect(body2.data.length).toBe(1);
      expect(body2.data[0].title).toBe("Anime 3");
      expect(body2.pagination.has_next_page).toBe(false);
      expect(body2.pagination.items.total).toBe(3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("GET /seasons/now parses large js-visible-anime-count correctly", async () => {
    const mockSeasonalHtml = `
      <p class="fs11 ar fn-grey2 pt8 pr4">
        Showing: <span class="js-visible-anime-count">210/210</span>
      </p>
      <div class="seasonal-anime"><a href="/anime/1" class="link-title">Anime 1</a><div class="info"><span class="item">TV</span></div></div>
    `;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/anime/season")) {
        return Promise.resolve(new Response(mockSeasonalHtml, { status: 200 }));
      }
      return originalFetch(url);
    });

    try {
      const res = await SELF.fetch(
        "https://example.com/v4/seasons/now?continuing",
      );
      const body = (await res.json()) as any;
      expect(body.pagination.items.total).toBe(210);
      expect(body.pagination.last_visible_page).toBe(9); // Math.ceil(210 / 25) = 9
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("GET /seasons/now respects filter and sfw", async () => {
    const mockSeasonalHtml = `
      <div class="seasonal-anime"><a href="/anime/1" class="link-title">TV Show</a><div class="info"><span class="item">TV</span><span class="item">1 eps</span><span class="item">Jan 1, 2024</span></div></div>
      <div class="seasonal-anime"><a href="/anime/2" class="link-title">Movie</a><div class="info"><span class="item">Movie</span><span class="item">1 eps</span><span class="item">Jan 1, 2024</span></div></div>
      <div class="seasonal-anime"><a href="/anime/3" class="link-title">Hentai</a><div class="info"><span class="item">TV</span><span class="item">1 eps</span><span class="item">Jan 1, 2024</span></div><div class="genres"><span class="genre"><a href="/anime/genre/12/Hentai">Hentai</a></span></div></div>
    `;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/anime/season")) {
        return Promise.resolve(new Response(mockSeasonalHtml, { status: 200 }));
      }
      return originalFetch(url);
    });

    try {
      // Filter by Movie
      const res1 = await SELF.fetch(
        "https://example.com/v4/seasons/now?filter=movie",
      );
      const body1 = (await res1.json()) as any;
      expect(body1.data.length).toBe(1);
      expect(body1.data[0].title).toBe("Movie");

      // Filter by SFW
      const res2 = await SELF.fetch("https://example.com/v4/seasons/now?sfw=1");
      const body2 = (await res2.json()) as any;
      expect(body2.data.length).toBe(2);
      expect(body2.data.some((i: any) => i.title === "Hentai")).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("GET /seasons/now respects continuing flag", async () => {
    const mockSeasonalHtml = `
      <div class="seasonal-anime-list">
        <div class="anime-header">TV (New)</div>
        <div class="seasonal-anime">
          <div class="title"><a href="/anime/1" class="link-title">New Anime</a></div>
          <div class="info"><span class="item">TV</span></div>
        </div>
      </div>
      <div class="seasonal-anime-list">
        <div class="anime-header">TV (Continuing)</div>
        <div class="seasonal-anime">
          <div class="title"><a href="/anime/2" class="link-title">Continuing Anime</a></div>
          <div class="info"><span class="item">TV</span></div>
        </div>
      </div>
    `;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/anime/season")) {
        return Promise.resolve(new Response(mockSeasonalHtml, { status: 200 }));
      }
      return originalFetch(url);
    });

    try {
      // By default (excludes continuing)
      const resDefault = await SELF.fetch("https://example.com/v4/seasons/now");
      const bodyDefault = (await resDefault.json()) as any;
      expect(bodyDefault.data.length).toBe(1);
      expect(bodyDefault.data[0].title).toBe("New Anime");

      // With continuing flag
      const resWithContinuing = await SELF.fetch(
        "https://example.com/v4/seasons/now?continuing",
      );
      const bodyWithContinuing = (await resWithContinuing.json()) as any;
      expect(bodyWithContinuing.data.length).toBe(2);
      expect(
        bodyWithContinuing.data.some(
          (i: any) => i.title === "Continuing Anime",
        ),
      ).toBe(true);
      expect(bodyWithContinuing.data[0].continuing).toBeUndefined();
      expect(bodyWithContinuing.data[1].continuing).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("GET /seasons/now checks sfw=false behaves correctly", async () => {
    const mockSeasonalHtml = `
      <p class="fs11 ar fn-grey2 pt8 pr4">
        Showing: <span class="js-visible-anime-count">10/10</span>
      </p>
      <div class="seasonal-anime"><a href="/anime/1" class="link-title">SFW Anime</a><div class="info"><span class="item">TV</span></div></div>
      <div class="seasonal-anime"><a href="/anime/2" class="link-title">Hentai Anime</a><div class="info"><span class="item">TV</span></div><div class="genres"><span class="genre"><a href="/genre/12/Hentai">Hentai</a></span></div></div>
    `;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/anime/season")) {
        return Promise.resolve(new Response(mockSeasonalHtml, { status: 200 }));
      }
      return originalFetch(url);
    });

    try {
      // ?sfw=false should keep NSFW anime, total is still data.total (10)
      const res = await SELF.fetch(
        "https://example.com/v4/seasons/now?sfw=false&continuing",
      );
      const body = (await res.json()) as any;
      expect(body.data.length).toBe(2);
      expect(body.pagination.items.total).toBe(10);

      // ?sfw flag (no value) should filter out Hentai anime, total is results.length (1)
      const resFlag = await SELF.fetch(
        "https://example.com/v4/seasons/now?sfw&continuing",
      );
      const bodyFlag = (await resFlag.json()) as any;
      expect(bodyFlag.data.length).toBe(1);
      expect(bodyFlag.data[0].title).toBe("SFW Anime");
      expect(bodyFlag.pagination.items.total).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
