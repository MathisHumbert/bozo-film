import type { LlmsQueryResult } from "../../../sanity/sanity.types";
import { hrefFor } from "../routes";

type Llms = NonNullable<LlmsQueryResult>;
type LlmsHome = NonNullable<Llms["home"]>;

interface Entry {
  title: string;
  path: string;
  description?: string;
}

interface PageDoc {
  seo: LlmsHome["seo"];
}

export function renderLlmsIndex(data: Llms, origin: string): string {
  const identity = data.settings?.siteIdentity;
  const ai = data.settings?.aiContent;
  const fallback = data.settings?.fallbackSEO;

  const name = identity?.name || fallback?.metaTitle || "Website";
  const summary = ai?.summary || fallback?.metaDescription;

  const out: string[] = [`# ${name}`];

  if (summary) {
    out.push(`> ${collapse(summary)}`);
  }

  const pages = entriesFor(data).map((entry) =>
    link(entry.title, entry.path, origin, entry.description),
  );

  if (pages.length) {
    out.push(section("Pages", pages));
  }

  for (const custom of ai?.sections ?? []) {
    const items = (custom.items ?? []).filter(Boolean);

    if (custom.title && items.length) {
      out.push(
        section(
          custom.title,
          items.map((item) => `- ${collapse(item)}`),
        ),
      );
    }
  }

  const contact: string[] = [];

  if (identity?.email) {
    contact.push(`- [Email](mailto:${identity.email})`);
  }

  if (contact.length) {
    out.push(section("Contact", contact));
  }

  out.push(
    section("Optional", [
      link(
        "Full site text",
        "/llms-full.txt",
        origin,
        "every page as plain text",
      ),
    ]),
  );

  return `${out.join("\n\n")}\n`;
}

export function renderLlmsFull(data: Llms, origin: string): string {
  const identity = data.settings?.siteIdentity;
  const fallback = data.settings?.fallbackSEO;
  const name = identity?.name || fallback?.metaTitle || "Website";

  const header = [
    `# ${name} — full site text`,
    `> Index: ${origin}/llms.txt`,
  ].join("\n\n");

  const bodies = entriesFor(data).map((entry) => {
    const lines = [`# ${entry.title}`, `URL: ${origin}${entry.path}`];

    if (entry.description) {
      lines.push(collapse(entry.description));
    }

    return lines.join("\n");
  });

  return `${[header, ...bodies].join("\n\n---\n\n")}\n`;
}

function entriesFor(data: Llms): Entry[] {
  const candidates: { doc: PageDoc | null; title: string; type: string }[] = [
    { doc: data.home, title: "Home", type: "home" },
    { doc: data.about, title: "About", type: "about" },
  ];

  return candidates.flatMap(({ doc, title, type }) => {
    const path = hrefFor({ _type: type });

    if (!doc || !path || doc.seo?.noIndex) return [];

    return [
      {
        title: doc.seo?.metaTitle || title,
        path,
        description: doc.seo?.metaDescription ?? undefined,
      } satisfies Entry,
    ];
  });
}

function section(title: string, lines: string[]): string {
  return `## ${collapse(title)}\n\n${lines.join("\n")}`;
}

function link(
  label: string,
  path: string,
  origin: string,
  description?: string,
): string {
  const suffix = description ? `: ${collapse(description)}` : "";

  return `- [${collapse(label)}](${origin}${path})${suffix}`;
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
