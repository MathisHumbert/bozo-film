import { MARKDOWN_CONTENT_TYPE } from "./negotiation";
import { resolvePath } from "./routes";
import { loadQuery } from "./sanity/load-query";
import {
  aboutQuery,
  allWorkQuery,
  homeQuery,
  llmsQuery,
  photoQuery,
  workBySlugQuery,
} from "./sanity/queries";
import {
  renderAboutMarkdown,
  renderHomeMarkdown,
  renderNotFoundMarkdown,
  renderPhotoMarkdown,
  renderWorkMarkdown,
  type MarkdownContext,
} from "./seo/markdown";

// The Markdown twin of a page path, for the `.md` routes: `[...path].md.ts` for
// the singletons, and one `<prefix>/[slug].md.ts` per repeatable, which it needs
// because `work/[slug].astro` outranks a root catch-all for `/work/x.md`.
// Machine output: published content only, and `stega: false` so no invisible
// characters reach the body (see "Keep stega out of machine output").

function markdown(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": MARKDOWN_CONTENT_TYPE },
  });
}

export async function markdownResponse(
  path: string,
  site: URL | undefined,
): Promise<Response> {
  if (!site) throw new Error("`site` is not set in astro.config.mjs.");

  const doc = resolvePath(path);
  const notFound = () => markdown(renderNotFoundMarkdown(path, site), 404);

  if (!doc) return notFound();

  const llms = await loadQuery(llmsQuery, {}, { stega: false });
  const ctx: MarkdownContext = { site, settings: llms?.settings ?? null };

  switch (doc._type) {
    case "home": {
      const home = await loadQuery(homeQuery, {}, { stega: false });
      const allWork = await loadQuery(allWorkQuery, {}, { stega: false });

      if (home?.seo?.noIndex) return notFound();

      return markdown(renderHomeMarkdown(home, allWork, ctx));
    }

    case "about": {
      const about = await loadQuery(aboutQuery, {}, { stega: false });

      if (!about || about.seo?.noIndex) return notFound();

      return markdown(renderAboutMarkdown(about, ctx));
    }

    case "photo": {
      const photo = await loadQuery(photoQuery, {}, { stega: false });

      if (!photo || photo.seo?.noIndex) return notFound();

      return markdown(renderPhotoMarkdown(photo, ctx));
    }

    case "work": {
      const work = await loadQuery(
        workBySlugQuery,
        { slug: doc.slug },
        { stega: false },
      );

      if (!work || !doc.slug || work.seo?.noIndex) return notFound();

      return markdown(renderWorkMarkdown(work, doc.slug, ctx));
    }

    default:
      return notFound();
  }
}
