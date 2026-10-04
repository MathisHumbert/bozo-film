export const ROUTABLE_TYPES = ["home", "about", "work"] as const;

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
    case "work":
      return doc.slug ? `/work/${doc.slug}` : null;
    default:
      return null;
  }
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
