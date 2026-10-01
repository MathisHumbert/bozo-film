import { useCallback, useEffect, useRef, useState } from "react";
import { useClient } from "sanity";

import type { VideoLibraryConfig } from "../config";
import type { VideoAssetListItem } from "../queries";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface EditableFields {
  title: string;
  description: string;
  altText: string;
  tags: string;
}

export interface AssetEditor {
  values: EditableFields;
  setValue: (field: keyof EditableFields, value: string) => void;
  status: SaveStatus;
  error: string | null;
}

const DEBOUNCE_MS = 700;

/**
 * Edits an asset's metadata straight onto the document.
 *
 * `video-asset` is `liveEdit`, so there is no draft to reconcile and no
 * publish step: typing settles into a patch. The local state is what the
 * inputs render, which keeps typing smooth while the write is in flight.
 */
export function useAssetEditor(
  asset: VideoAssetListItem | null,
  config: VideoLibraryConfig,
): AssetEditor {
  const client = useClient({ apiVersion: config.apiVersion });

  const [values, setValues] = useState<EditableFields>(() => toFields(asset));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const timer = useRef<number | undefined>(undefined);
  const editingId = useRef<string | null>(asset?._id ?? null);

  // Switching assets discards any pending write for the previous one: it
  // belonged to a document the editor is no longer looking at.
  useEffect(() => {
    window.clearTimeout(timer.current);
    editingId.current = asset?._id ?? null;

    setValues(toFields(asset));
    setStatus("idle");
    setError(null);
  }, [asset?._id]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const setValue = useCallback(
    (field: keyof EditableFields, value: string) => {
      const documentId = asset?._id;
      if (!documentId) return;

      setValues((current) => {
        const next = { ...current, [field]: value };

        window.clearTimeout(timer.current);
        setStatus("saving");

        timer.current = window.setTimeout(() => {
          client
            .patch(documentId)
            .set(toPatch(next))
            .commit({ autoGenerateArrayKeys: true })
            .then(() => {
              // A slower edit may have finished after the editor moved on.
              if (editingId.current !== documentId) return;

              setStatus("saved");
              setError(null);
            })
            .catch((cause: unknown) => {
              if (editingId.current !== documentId) return;

              setStatus("error");
              setError(cause instanceof Error ? cause.message : String(cause));
            });
        }, DEBOUNCE_MS);

        return next;
      });
    },
    [asset?._id, client],
  );

  return { values, setValue, status, error };
}

function toFields(asset: VideoAssetListItem | null): EditableFields {
  return {
    title: asset?.title ?? "",
    description: asset?.description ?? "",
    altText: asset?.altText ?? "",
    tags: (asset?.tags ?? []).join(", "),
  };
}

function toPatch(fields: EditableFields) {
  return {
    title: fields.title,
    description: fields.description,
    altText: fields.altText,
    tags: fields.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
}
