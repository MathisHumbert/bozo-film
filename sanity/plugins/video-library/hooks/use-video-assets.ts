import { useCallback, useEffect, useState } from "react";
import { useClient } from "sanity";

import type { VideoLibraryConfig } from "../config";
import { videoAssetsQuery, type VideoAssetListItem } from "../queries";

export interface VideoAssets {
  assets: VideoAssetListItem[] | null;
  error: string | null;
  refresh: () => void;
}

export function useVideoAssets(config: VideoLibraryConfig): VideoAssets {
  const client = useClient({ apiVersion: config.apiVersion });

  const [assets, setAssets] = useState<VideoAssetListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;

    client
      .fetch<VideoAssetListItem[]>(videoAssetsQuery)
      .then((result) => {
        if (!cancelled) {
          setAssets(result);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, nonce]);

  // Keeps the list honest when someone else uploads, or when a document is
  // edited from another tab. A bare filter on purpose: listen streams document
  // mutations, so the projection above would be dead weight here.
  useEffect(() => {
    const subscription = client
      .listen(
        `*[_type == "video-asset"]`,
        {},
        { visibility: "query", events: ["mutation"] },
      )
      .subscribe({
        next: refresh,
        error: () => undefined,
      });

    return () => subscription.unsubscribe();
  }, [client, refresh]);

  return { assets, error, refresh };
}
