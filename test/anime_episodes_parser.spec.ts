import { describe, it, expect } from "vitest";
import { parseAnimeEpisodes } from "../src/parsers/anime_episodes";

describe("Anime Episodes Parser", () => {
  it("should not double prefix URLs if they are already absolute", () => {
    const html = `
      <div class="js-watch-episode-list">
        <table>
          <tbody>
            <tr>
              <td class="episode-number">1</td>
              <td class="episode-title">
                <a href="https://myanimelist.net/anime/14227/Tonari_no_Kaibutsu-kun/episode/1">Sitting Next to Yoshida-kun</a>
              </td>
              <td class="episode-aired">Oct 2, 2012</td>
              <td class="episode-poll" data-raw="4.48"></td>
              <td class="episode-forum">
                <a href="https://myanimelist.net/forum/?topicid=498941">Forum</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pagination">
        <a class="link current" href="#">1</a>
      </div>
    `;

    const result = parseAnimeEpisodes(html);
    expect(result.data[0].url).toBe(
      "https://myanimelist.net/anime/14227/Tonari_no_Kaibutsu-kun/episode/1",
    );
    expect(result.data[0].forum_url).toBe(
      "https://myanimelist.net/forum/?topicid=498941",
    );
  });

  it("should prefix relative URLs with MAL_BASE_URL", () => {
    const html = `
      <div class="js-watch-episode-list">
        <table>
          <tbody>
            <tr>
              <td class="episode-number">1</td>
              <td class="episode-title">
                <a href="/anime/14227/Tonari_no_Kaibutsu-kun/episode/1">Sitting Next to Yoshida-kun</a>
              </td>
              <td class="episode-aired">Oct 2, 2012</td>
              <td class="episode-poll" data-raw="4.48"></td>
              <td class="episode-forum">
                <a href="/forum/?topicid=498941">Forum</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pagination">
        <a class="link current" href="#">1</a>
      </div>
    `;

    const result = parseAnimeEpisodes(html);
    expect(result.data[0].url).toBe(
      "https://myanimelist.net/anime/14227/Tonari_no_Kaibutsu-kun/episode/1",
    );
    expect(result.data[0].forum_url).toBe(
      "https://myanimelist.net/forum/?topicid=498941",
    );
  });
});
