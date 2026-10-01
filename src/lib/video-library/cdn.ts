import { cdnBaseUrl } from "./env";

/** Public playback URL for a stored object. Safe to call in the browser. */
export function videoUrl(key?: string | null): string {
  if (!key) {
    return "";
  }

  return `${cdnBaseUrl()}/${key.replace(/^\/+/, "")}`;
}
