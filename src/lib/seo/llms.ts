import type { LlmsQueryResult } from "../../../sanity/sanity.types";
import { hrefFor } from "../routes";

type Llms = NonNullable<LlmsQueryResult>;
type LlmsHome = NonNullable<Llms["home"]>;
type Block = NonNullable<LlmsHome["content"]>[number];

interface Entry {
  title: string;
  path: string;
  description?: string;
  content: Block[] | null;
}

interface PageDoc {
  seo: LlmsHome["seo"];
  content: Block[] | null;
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

  for (const social of data.settings?.footer?.socials ?? []) {
    if (social.external && social.href) {
      contact.push(`- [${social.label ?? social.href}](${social.href})`);
    }
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

    const blocks = (entry.content ?? [])
      .map(serializeBlock)
      .filter((text): text is string => Boolean(text));

    return [lines.join("\n"), ...blocks].join("\n\n");
  });

  return `${[header, ...bodies].join("\n\n---\n\n")}\n`;
}

function entriesFor(data: Llms): Entry[] {
  const candidates: { doc: PageDoc | null; title: string; type: string }[] = [
    { doc: data.home, title: "Home", type: "home" },
  ];

  return candidates.flatMap(({ doc, title, type }) => {
    const path = hrefFor({ _type: type });

    if (!doc || !path || doc.seo?.noIndex) return [];

    return [
      {
        title: doc.seo?.metaTitle || title,
        path,
        description: doc.seo?.metaDescription ?? undefined,
        content: doc.content,
      } satisfies Entry,
    ];
  });
}

function serializeBlock(block: Block): string | null {
  switch (block._type) {
    case "wysiwyg":
      return join((block.blocks ?? []).map(serializePortableTextBlock));

    case "video": {
      const parts = [block.videoTitle, block.caption].filter(Boolean);

      return parts.length ? `Video: ${parts.join(" — ")}` : null;
    }

    default:
      return null;
  }
}

function serializePortableTextBlock(block: {
  style: string | null;
  listItem: string | null;
  text: string;
}): string | null {
  const text = collapse(block.text);

  if (!text) return null;

  if (block.listItem === "bullet") return `- ${text}`;

  const heading = block.style?.match(/^h([1-4])$/);

  if (heading) return `${"#".repeat(Number(heading[1]) + 1)} ${text}`;

  if (block.style === "blockquote") return `> ${text}`;

  return text;
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

function join(parts: (string | null | undefined | false)[]): string | null {
  const lines = parts
    .filter((part): part is string => Boolean(part))
    .map(collapse)
    .filter(Boolean);

  return lines.length ? lines.join("\n\n") : null;
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
