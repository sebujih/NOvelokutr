import { fetchApi, fetchFile } from "@libs/fetch";
import { Plugin } from "@typings/plugin";
import { Filters } from "@libs/filterInputs";
import { load as parseHTML } from "cheerio";

class NovelOkuTR implements Plugin.PluginBase {
  id = "novelokutr.net";
  name = "Novel Oku TR";
  icon = "src/tr/novelokutr/icon.png";
  site = "https://novelokutr.net";
  version = "1.0.1";
  filters: Filters | undefined = undefined;

  // ─── Popular / Latest Novels ───────────────────────────────────────────────

  async popularNovels(
    page: number,
    { showLatestNovels }: Plugin.PopularNovelsOptions,
  ): Promise<Plugin.NovelItem[]> {
    // Latest: ana sayfa pagination  |  Popular: /manga/page/N/?m_orderby=views
    const url = showLatestNovels
      ? page === 1
        ? this.site
        : `${this.site}/page/${page}/`
      : `${this.site}/manga/page/${page}/?m_orderby=views`; // FIX: Madara path-based pagination

    const body = await fetchApi(url).then((r) => r.text());
    const $ = parseHTML(body);

    const novels: Plugin.NovelItem[] = [];

    $("div.page-item-detail").each((_, el) => {
      const anchor = $(el).find("div.item-thumb a").first();
      const name =
        anchor.attr("title") ||
        $(el).find("h3 a, h5 a").first().text().trim();
      const path = anchor.attr("href") || "";
      const cover =
        $(el).find("img").first().attr("data-src") || // FIX: data-src önce dene
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

  // ─── Novel Detail ──────────────────────────────────────────────────────────

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const body = await fetchApi(this.site + novelPath).then((r) => r.text());
    const $ = parseHTML(body);

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: $("div.post-title h1, div.post-title h3").first().text().trim(),
    };

    // Cover
    novel.cover =
      $("div.summary_image img").attr("data-src") ||
      $("div.summary_image img").attr("src") ||
      "";

    // Author — FIX: birden fazla yazar varsa hepsini al
    const authors: string[] = [];
    $("div.author-content a").each((_, el) => {
      authors.push($(el).text().trim());
    });
    if (authors.length) novel.author = authors.join(", ");

    // Status
    const statusText = $("div.post-status div.summary-content")
      .first()
      .text()
      .trim();
    if (statusText) novel.status = statusText;

    // Genres
    const genres: string[] = [];
    $("div.genres-content a").each((_, el) => {
      genres.push($(el).text().trim());
    });
    if (genres.length) novel.genres = genres.join(", ");

    // Summary
    novel.summary = $("div.summary__content p, div.description-summary p")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .join("\n");

    // ── Post ID — FIX: daha güvenilir regex ──────────────────────────────────
    const postId =
      (body.match(/"manga_id"\s*:\s*"?(\d+)"?/) ||
        body.match(/data-id="(\d+)"/) ||
        body.match(/manga_id['":\s]+(\d+)/))?.[1] ?? null;

    let chapters: Plugin.ChapterItem[] = [];

    if (postId) {
      // Madara AJAX endpoint
      const ajaxUrl = `${this.site}/wp-admin/admin-ajax.php`;
      const chapterBody = await fetchApi(ajaxUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          action: "manga_get_chapters",
          manga: postId,
        }).toString(),
      }).then((r) => r.text());

      const $ch = parseHTML(chapterBody);
      $ch("li.wp-manga-chapter").each((_, el) => {
        const a = $ch(el).find("a").first();
        const chPath = a.attr("href") || "";
        const chName = a.text().trim();

        // FIX: <i> tag'ini de kontrol et
        const releaseDate = $ch(el)
          .find("span.chapter-release-date i, span.chapter-release-date, span.post-on")
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
    } else {
      // Fallback: HTML'den direkt çek
      $("li.wp-manga-chapter").each((_, el) => {
        const a = $(el).find("a").first();
        const chPath = a.attr("href") || "";
        const chName = a.text().trim();

        // FIX: <i> tag'ini de kontrol et
        const releaseDate = $(el)
          .find("span.chapter-release-date i, span.chapter-release-date, span.post-on")
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

    // Madara'dan gelen liste newest-first; reverse → ascending, numaralandır
    novel.chapters = chapters.reverse().map((ch, idx) => ({
      ...ch,
      chapterNumber: idx + 1,
    }));

    return novel;
  }

  // ─── Chapter Content ───────────────────────────────────────────────────────

  async parseChapter(chapterPath: string): Promise<string> {
    const body = await fetchApi(this.site + chapterPath).then((r) => r.text());
    const $ = parseHTML(body);

    // FIX: daha kapsamlı reklam/gereksiz eleman temizliği
    $("div.reading-content").find(
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
      ].join(", "),
    ).remove();

    const content = $("div.reading-content").html() || "";
    return content;
  }

  // ─── Search ────────────────────────────────────────────────────────────────

  async searchNovels(
    searchTerm: string,
    page: number,
  ): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}/?s=${encodeURIComponent(searchTerm)}&post_type=wp-manga&page=${page}`;
    const body = await fetchApi(url).then((r) => r.text());
    const $ = parseHTML(body);

    const novels: Plugin.NovelItem[] = [];

    $("div.page-item-detail, div.c-tabs-item__content").each((_, el) => {
      const anchor = $(el)
        .find("div.item-thumb a, div.tab-thumb a")
        .first();
      const name =
        anchor.attr("title") ||
        $(el)
          .find("div.post-title a, div.tab-title a, h3 a, h5 a")
          .first()
          .text()
          .trim();
      const path = anchor.attr("href") || "";
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

  // ─── Image Fetching ────────────────────────────────────────────────────────

  async fetchImage(url: string): Promise<string | undefined> {
    return fetchFile(url);
  }
}

export default new NovelOkuTR();
