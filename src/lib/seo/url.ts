import { normalizePath } from "../routes";

export function canonicalUrl(pathname: string, site: URL | undefined): string {
  const path = normalizePath(pathname);

  if (!site) return path;

  return new URL(path, site).href;
}

export function nodeId(base: string, fragment: string): string {
  return `${base}#${fragment}`;
}
