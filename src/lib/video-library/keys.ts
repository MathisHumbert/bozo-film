import { storagePrefix } from "./env";

const MAX_SLUG_LENGTH = 60;

function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, MAX_SLUG_LENGTH) || "video"
  );
}

/**
 * Opaque, immutable object key: it carries neither the folder nor the title.
 * Renaming an asset or moving it to another folder is therefore a metadata
 * patch — the CDN URL never changes and no cache has to be invalidated.
 *
 * The random segment also means two uploads of the same filename never
 * overwrite each other.
 */
export function buildVideoKey(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const rawExtension = dot > 0 ? filename.slice(dot + 1) : "";
  const extension =
    rawExtension.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";

  const id = crypto.randomUUID().slice(0, 8);
  const name = `${id}-${slugify(base)}.${extension}`;
  const prefix = storagePrefix();

  return prefix ? `${prefix}/${name}` : name;
}

/**
 * Key of one rendition, derived from the original's and stored beside it:
 * `bozo-film/7bd6015b-hero.mov` → `bozo-film/7bd6015b-hero.1280-k3x9.mp4`.
 *
 * Sitting next to the original keeps it inside the managed prefix with no
 * change to `isManagedKey`. The revision segment makes a regenerated rendition
 * a new URL: the old one is cached as immutable, so overwriting it in place
 * would keep serving stale bytes for a year.
 */
export function buildRenditionKey(storageKey: string, width: number): string {
  const slash = storageKey.lastIndexOf("/");
  const dot = storageKey.lastIndexOf(".");
  const base = dot > slash ? storageKey.slice(0, dot) : storageKey;
  const revision = crypto.randomUUID().slice(0, 4);

  return `${base}.${width}-${revision}.mp4`;
}

/**
 * Guard for every route that acts on a caller-supplied key. The IAM policy is
 * broad enough to reach the whole bucket, so this check is the only thing
 * keeping a delete request inside the library's own namespace.
 */
export function isManagedKey(key: unknown): key is string {
  if (typeof key !== "string" || key.includes("..")) {
    return false;
  }

  const prefix = storagePrefix();

  return prefix ? key.startsWith(`${prefix}/`) : !key.includes("/");
}
