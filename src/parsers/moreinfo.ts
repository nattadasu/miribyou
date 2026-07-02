import { load } from "cheerio";

export function parseMoreInfo(html: string): string | null {
  const $ = load(html);

  // Remove noise elements before extracting text
  const rightside = $(".rightside");
  if (!rightside.length) return null;
  rightside.find("#horiznav_nav, .breadcrumb, script, style, div[style]").remove();

  const full = rightside.text().trim();
  if (full.includes("No more information has been added to this title.")) {
    return null;
  }

  // Content is the text after "More Info" heading
  const idx = full.indexOf("More Info");
  if (idx === -1) return null;

  const text = full.slice(idx + "More Info".length).trim();
  return text || null;
}
