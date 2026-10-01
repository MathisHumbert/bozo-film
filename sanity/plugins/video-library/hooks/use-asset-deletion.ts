import { useCallback, useMemo, useState } from "react";
import { useClient } from "sanity";

import type { VideoLibraryConfig } from "../config";
import { createMediaApi } from "../lib/api-client";
import type { VideoAssetListItem } from "../queries";
import { useStudioToken } from "./use-studio-token";

export interface AssetDeletion {
  deleting: boolean;
  error: string | null;
  remove: (assets: VideoAssetListItem[]) => Promise<boolean>;
}

export function useAssetDeletion(
  config: VideoLibraryConfig,
  onDeleted?: () => void,
): AssetDeletion {
  const client = useClient({ apiVersion: config.apiVersion });
  const token = useStudioToken();
  const api = useMemo(() => createMediaApi(config, token), [config, token]);

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = useCallback(
    async (assets: VideoAssetListItem[]) => {
      if (!assets.length) {
        return true;
      }

      setDeleting(true);
      setError(null);

      try {
        // Documents first, objects second. Reversing it would leave documents
        // pointing at objects that no longer exist — a broken card in the
        // library, and a broken video on the site. An object left behind is
        // invisible instead, and the reconciliation screen finds it later.
        const transaction = assets.reduce(
          (batch, asset) => batch.delete(asset._id),
          client.transaction(),
        );

        await transaction.commit();

        const keys = assets
          .map((asset) => asset.storageKey)
          .filter((key): key is string => Boolean(key));

        if (keys.length) {
          await api.deleteObjects(keys);
        }

        // The poster and storyboard are Sanity image assets, and Sanity never
        // collects unreferenced ones. Left alone they pile up forever, so they
        // go now — after the document, since an asset still referenced by a
        // document cannot be deleted.
        //
        // Best-effort on purpose: the asset the editor cares about is already
        // gone, and a leftover image is not worth failing the whole operation.
        const imageIds = assets.flatMap((asset) =>
          [asset.thumbnailAssetId, asset.storyboardAssetId].filter(
            (id): id is string => Boolean(id),
          ),
        );

        await Promise.all(
          imageIds.map((id) => client.delete(id).catch(() => undefined)),
        );

        onDeleted?.();

        return true;
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : String(cause));

        return false;
      } finally {
        setDeleting(false);
      }
    },
    [api, client, onDeleted],
  );

  return { deleting, error, remove };
}
