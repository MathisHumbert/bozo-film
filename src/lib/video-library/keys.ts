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
