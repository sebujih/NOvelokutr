import { fetchApi, fetchFile } from "@libs/fetch";
import { Plugin } from "@/types/plugin";
import { Filters } from "@libs/filterInputs";
import { load as parseHTML } from "cheerio";

class NovelOkuTR implements Plugin.PluginBase {
  id = "novelokutr.net";
  name = "Novel Oku TR";
  icon = "src/tr/novelokutr/icon.png";
  site = "https://novelokutr.net/";
  version = "1.0.2";
  filters: Filters | undefined = undefined;

  async popularNovels(
    page: number,
    { showLatestNovels }: Plugin.PopularNovelsOptions
  ): Promise<Plugin.NovelItem[]> {
    const url = showLatestNovels
      ? `${this.site}page/${page}/`
      : `${this.site}manga/page/${page}/?m_orderby=views`;

    const body = await fetchApi(url).then((r) => r.text());
    const $ = parseHTML(body);

    const novels: Plugin.NovelItem[] = [];

    $("div.page-item-detail").each((_, el) => {
      const thumbAnchor = $(el).find("div.item-thumb a").first();
      const titleAnchor = $(el).find("div.post-title a, h3.h5 a").first();

      const name =
        titleAnchor.text().trim() || thumbAnchor.attr("title") || "";
      const path =
        thumbAnchor.attr("href") || titleAnchor.attr("href") || "";

      const cover =
        $(el).find("img").first().attr("data-src") ||
        $(el).find("img").first().attr("src") ||
        "";

      if (name && path) {
        novels.push({
          name,
          cover,
          path: path.replace(this.site, ""),
        });
      }
    });

    return novels;
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const body = await fetchApi(this.site + novelPath).then((r) => r.text());
    const $ = parseHTML(body);

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: $("div.post-title h1, div.post-title h3").first().text().trim(),
    };

    novel.cover =
      $("div.summary_image img").attr("data-src") ||
      $("div.summary_image img").attr("src") ||
      "";

    const authors: string[] = [];
    $("div.author-content a").each((_, el) => {
      authors.push($(el).text().trim());
    });
    if (authors.length) novel.author = authors.join(", ");

    novel.status = $("div.post-status div.summary-content")
      .first()
      .text()
      .trim();

    const genres: string[] = [];
    $("div.genres-content a").each((_, el) => {
      genres.push($(el).text().trim());
    });
    if (genres.length) novel.genres = genres.join(", ");

    novel.summary = $("div.summary__content p, div.description-summary p")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .join("\n");

    const postId =
      (body.match(/["'](manga|post)_id["']\s*:\s*["']?(\d+)["']?/))?.[2] ||
      (body.match(/data-id=["'](\d+)["']/))?.[1] ||
      (body.match(/manga_id[^\d]+(\d+)/))?.[1] ||
      null;

    let chapters: Plugin.ChapterItem[] = [];

    if (postId) {
      const ajaxUrl = `${this.site}wp-admin/admin-ajax.php`;
      const resp = await fetchApi(ajaxUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Referer: this.site + novelPath,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: new URLSearchParams({
          action: "manga_get_chapters",
          manga: postId,
        }).toString(),
      });

      const chapterBody = await resp.text();

      if (chapterBody && chapterBody !== "0" && chapterBody.trim() !== "") {
        const $ch = parseHTML(chapterBody);
        $ch("li.wp-manga-chapter").each((_, el) => {
          const a = $ch(el).find("a").first();
          const chPath = a.attr("href") || "";
          const chName = a.text().trim();
          const releaseDate = $ch(el)
            .find("span.chapter-release-date i, span.chapter-release-date")
            .first()
            .text()
            .trim();

          if (chName && chPath) {
            chapters.push({
              name: chName,
              path: chPath.replace(this.site, ""),
              releaseTime: releaseDate || undefined,
              chapterNumber: 0,
            });
          }
        });
      }
    }

    // Fallback: AJAX boş geldiyse HTML'den çek
    if (chapters.length === 0) {
      $("li.wp-manga-chapter").each((_, el) => {
        const a = $(el).find("a").first();
        const chPath = a.attr("href") || "";
        const chName = a.text().trim();
        const releaseDate = $(el)
          .find("span.chapter-release-date i, span.chapter-release-date")
          .first()
          .text()
          .trim();

        if (chName && chPath) {
          chapters.push({
            name: chName,
            path: chPath.replace(this.site, ""),
            releaseTime: releaseDate || undefined,
            chapterNumber: 0,
          });
        }
      });
    }

    novel.chapters = chapters.reverse().map((ch, idx) => ({
      ...ch,
      chapterNumber: idx + 1,
    }));

    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const body = await fetchApi(this.site + chapterPath).then((r) => r.text());
    const $ = parseHTML(body);

    $("div.reading-content")
      .find(
        [
          ".code-block",
          "script",
          "ins",
          "noscript",
          ".ezoic-ad",
          "[id*='ad']",
          "[class*='ad-']",
          "[class*='adsbygoogle']",
          ".sharedaddy",
        ].join(", ")
      )
      .remove();

    return $("div.reading-content").html() || "";
  }

  async searchNovels(
    searchTerm: string,
    page: number
  ): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}?s=${encodeURIComponent(searchTerm)}&post_type=wp-manga&page=${page}`;
    const body = await fetchApi(url).then((r) => r.text());
    const $ = parseHTML(body);

    const novels: Plugin.NovelItem[] = [];

    $("div.page-item-detail, div.c-tabs-item__content").each((_, el) => {
      const titleAnchor = $(el)
        .find("div.post-title a, div.tab-title a, h3 a, h5 a")
        .first();
      const thumbAnchor = $(el)
        .find("div.item-thumb a, div.tab-thumb a")
        .first();

      const name =
        titleAnchor.text().trim() || thumbAnchor.attr("title") || "";
      const path =
        thumbAnchor.attr("href") || titleAnchor.attr("href") || "";
      const cover =
        $(el).find("img").first().attr("data-src") ||
        $(el).find("img").first().attr("src") ||
        "";

      if (name && path) {
        novels.push({
          name,
          cover,
          path: path.replace(this.site, ""),
        });
      }
    });

    return novels;
  }

  async fetchImage(url: string): Promise<string | undefined> {
    return fetchFile(url);
  }
}

export default new NovelOkuTR();
