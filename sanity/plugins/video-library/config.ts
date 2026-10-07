/**
 * Everything the plugin needs from the host application.
 *
 * Nothing under `sanity/plugins/video-library/` imports from outside this
 * folder: the whole contract with the app is this object plus the three
 * `/api/media/*` routes. That is what will let the folder be extracted into a
 * standalone npm package without a rewrite.
 */
export interface VideoLibraryConfig {
  /** Where the media API routes are mounted. */
  apiBasePath: string;
  /**
   * Origin the stored objects are served from, without a trailing slash.
   *
   * Deliberately not stored on each document: moving to another CDN domain
   * would otherwise leave every asset pointing at the old one.
   */
  cdnUrl: string;
  /** API version used for every Sanity client call made by the plugin. */
  apiVersion: string;
  /** Accepted upload types, matching what the sign-upload route allows. */
  acceptedTypes: string[];
  /** Largest file the sign-upload route will sign, in bytes. */
  maxFileSize: number;
  /** How many files upload at once. */
  concurrency: number;
  /**
   * Widths encoded beside the original, largest first. Only those below the
   * original's width are produced, so a 4K upload gets all of them and a
   * 1280-wide one only the smallest.
   *
   * An empty list turns renditions off: uploads skip the encoding step and the
   * tool hides its Generate buttons. `[1920]` keeps only a cap for uploads
   * larger than full HD.
   */
  renditionWidths: number[];
}

export const defaultConfig: VideoLibraryConfig = {
  apiBasePath: "/api/media",
  cdnUrl: "",
  apiVersion: "2025-01-28",
  acceptedTypes: ["video/mp4", "video/quicktime", "video/webm"],
  maxFileSize: 500 * 1024 * 1024,
  concurrency: 3,
  renditionWidths: [1920, 1280, 640],
};

export function resolveConfig(
  options?: Partial<VideoLibraryConfig>,
): VideoLibraryConfig {
  // Undefined entries are dropped before merging. Spreading them would
  // overwrite the defaults with undefined, which is exactly what happens when
  // the host passes `import.meta.env.PUBLIC_CDN_URL` and the Sanity CLI loads
  // the config in Node, where that variable does not exist.
  const provided = Object.fromEntries(
    Object.entries(options ?? {}).filter(([, value]) => value !== undefined),
  ) as Partial<VideoLibraryConfig>;

  const config = { ...defaultConfig, ...provided };

  return { ...config, cdnUrl: (config.cdnUrl ?? "").replace(/\/+$/, "") };
}

/** Public playback URL for a stored object. */
export function playbackUrl(
  config: VideoLibraryConfig,
  storageKey?: string | null,
): string {
  if (!config.cdnUrl || !storageKey) {
    return "";
  }

  return `${config.cdnUrl}/${storageKey.replace(/^\/+/, "")}`;
}
