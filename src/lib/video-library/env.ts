/**
 * Environment access for the video library. Read at request time: see
 * `serverEnv()` for why.
 */
import { serverEnv as read } from "../env";

export function requireEnv(key: string): string {
  const value = read(key);

  if (value === undefined) {
    throw new Error(`[video-library] missing environment variable: ${key}`);
  }

  return value;
}

export function optionalEnv(key: string, fallback = ""): string {
  return read(key) ?? fallback;
}

export type StorageProvider = "s3" | "r2";

export const storageProvider = () =>
  optionalEnv("STORAGE_PROVIDER", "s3") as StorageProvider;

export const storageBucket = () => requireEnv("STORAGE_BUCKET");

/** An empty prefix means "store at the root of the bucket". */
export const storagePrefix = () =>
  optionalEnv("STORAGE_PREFIX").replace(/^\/+|\/+$/g, "");

export const cdnBaseUrl = () =>
  requireEnv("PUBLIC_CDN_URL").replace(/\/+$/, "");

export const sanityProjectId = () => requireEnv("PUBLIC_SANITY_PROJECT_ID");
