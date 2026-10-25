export const ROUTABLE_TYPES = ["home", "about", "photo", "work"] as const;

export const REPEATABLE_TYPES = ["work"] as const;

export type RoutableType = (typeof ROUTABLE_TYPES)[number];

export type RepeatableType = (typeof REPEATABLE_TYPES)[number];

export const INDEX_FOR: Record<RepeatableType, RoutableType> = {
  work: "home",
};

export type SlugsByType = Partial<Record<string, string[]>>;

export function isRoutable(type?: string | null): type is RoutableType {
  return ROUTABLE_TYPES.includes(type as RoutableType);
}

export function isRepeatable(type?: string | null): type is RepeatableType {
  return REPEATABLE_TYPES.includes(type as RepeatableType);
}

export interface RoutableDocument {
  _type?: string | null;
  slug?: string | null;
}

export function hrefFor(doc?: RoutableDocument | null): string | null {
  switch (doc?._type) {
    case "home":
      return "/";
    case "about":
      return "/about";
    case "photo":
      return "/photo";
    case "work":
      return doc.slug ? `/work/${doc.slug}` : null;
    default:
      return null;
  }
}

// The inverse of `hrefFor()`, derived from it rather than written by hand: a
// repeatable's pattern comes from the path it builds for a placeholder slug.
export function resolvePath(path: string): RoutableDocument | null {
  const target = path.length > 1 ? path.replace(/\/+$/, "") : path;

  for (const type of ROUTABLE_TYPES) {
    if (!isRepeatable(type)) {
      if (hrefFor({ _type: type }) === target) return { _type: type };
      continue;
    }

    const template = hrefFor({ _type: type, slug: "\u0000" });
    if (!template) continue;

    const [prefix, suffix] = template.split("\u0000");

    if (target.startsWith(prefix) && target.endsWith(suffix)) {
      const slug = target.slice(prefix.length, target.length - suffix.length);

      if (slug && !slug.includes("/")) return { _type: type, slug };
    }
  }

  return null;
}

export function allPaths(slugs: SlugsByType = {}): string[] {
  return ROUTABLE_TYPES.flatMap((type) => {
    if (!isRepeatable(type)) return paths([{ _type: type }]);

    return paths((slugs[type] ?? []).map((slug) => ({ _type: type, slug })));
  });
}

function paths(docs: RoutableDocument[]): string[] {
  return docs
    .map((doc) => hrefFor(doc))
    .filter((path): path is string => Boolean(path));
}

export function absoluteUrl(path: string, site: URL | string): string {
  const origin = String(site).replace(/\/+$/, "");

  return `${origin}${normalizePath(path)}`;
}

export function normalizePath(path: string): string {
  const withLeading = path.startsWith("/") ? path : `/${path}`;
  const collapsed = withLeading.replace(/\/{2,}/g, "/");

  if (collapsed === "/") return "/";

  return collapsed.endsWith("/") ? collapsed : `${collapsed}/`;
}
