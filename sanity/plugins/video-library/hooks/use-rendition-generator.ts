import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClient } from "sanity";

import { playbackUrl, type VideoLibraryConfig } from "../config";
import { createMediaApi } from "../lib/api-client";
import { encodeRenditions, uploadRenditions } from "../lib/renditions";
import type { VideoAssetListItem } from "../queries";
import { useStudioToken } from "./use-studio-token";

export type GenerationPhase =
  | "queued"
  | "downloading"
  | "encoding"
  | "uploading"
  | "saving"
  | "done"
  | "failed";

export interface GenerationState {
  phase: GenerationPhase;
  /** 0 to 1, for the current phase. */
  progress: number;
  error: string | null;
}

export interface RenditionGenerator {
  /** False when `renditionWidths` is empty: the tool then offers nothing. */
  enabled: boolean;
  /** Keyed by document id; absent means never run in this session. */
  jobs: Record<string, GenerationState>;
  running: boolean;
  generate: (assets: VideoAssetListItem[]) => Promise<void>;
  cancel: () => void;
}

/**
 * Builds the renditions of assets already in the library — the ones uploaded
 * before renditions existed, or whose encode failed at upload.
 *
 * The original is read back from the CDN and goes through the same encoder as
 * an upload, so there is one implementation of the ladder, not a browser one
 * and an ffmpeg one to keep in step.
 *
 * Order, per asset: new objects first, then the patch, then the old objects.
 * If the patch fails the new objects are removed; if the last step fails the
 * leftovers are invisible, which the reconciliation screen can find later.
 *
 * Assets run one after the other: each holds its whole original in memory.
 */
export function useRenditionGenerator(
  config: VideoLibraryConfig,
): RenditionGenerator {
  const client = useClient({ apiVersion: config.apiVersion });
  const token = useStudioToken();
  const api = useMemo(() => createMediaApi(config, token), [config, token]);

  const [jobs, setJobs] = useState<Record<string, GenerationState>>({});
  const [running, setRunning] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const update = useCallback(
    (id: string, changes: Partial<GenerationState>) =>
      // Every job is seeded by `generate` before its first update.
      setJobs((current) => ({
        ...current,
        [id]: { ...current[id], ...changes },
      })),
    [],
  );

  const generate = useCallback(
    async (assets: VideoAssetListItem[]) => {
      if (controller.current) {
        return;
      }

      const abort = new AbortController();
      controller.current = abort;
      setRunning(true);

      // A new batch replaces the last one's results, so its counter starts
      // from zero.
      setJobs(
        Object.fromEntries(
          assets.map((asset) => [
            asset._id,
            { phase: "queued", progress: 0, error: null },
          ]),
        ),
      );

      try {
        for (const asset of assets) {
          if (abort.signal.aborted) {
            break;
          }

          try {
            await generateOne(asset, abort.signal, (changes) =>
              update(asset._id, changes),
            );
            update(asset._id, { phase: "done", progress: 1 });
          } catch (cause) {
            const aborted =
              cause instanceof DOMException && cause.name === "AbortError";

            update(asset._id, {
              phase: "failed",
              error: aborted
                ? "Cancelled"
                : cause instanceof Error
                  ? cause.message
                  : String(cause),
            });
          }
        }
      } finally {
        controller.current = null;
        setRunning(false);
      }

      async function generateOne(
        asset: VideoAssetListItem,
        signal: AbortSignal,
        report: (changes: Partial<GenerationState>) => void,
      ) {
        const { storageKey, width, aspectRatio, duration } = asset;
        const url = playbackUrl(config, storageKey);

        if (!storageKey || !url || !width || !aspectRatio || !duration) {
          throw new Error("The asset lacks a key, a CDN URL or dimensions");
        }

        report({ phase: "downloading", progress: 0 });
        const source = await download(url, signal, (progress) =>
          report({ progress }),
        );

        report({ phase: "encoding", progress: 0 });
        const encoded = await encodeRenditions(
          source,
          { width, aspectRatio, duration },
          config.renditionWidths,
          { signal, onProgress: (progress) => report({ progress }) },
        );

        report({ phase: "uploading", progress: 0 });
        const renditions = await uploadRenditions(api, storageKey, encoded, {
          signal,
          onProgress: (progress) => report({ progress }),
        });

        report({ phase: "saving", progress: 1 });

        try {
          await client.patch(asset._id).set({ renditions }).commit();
        } catch (cause) {
          const fresh = renditions.map(({ storageKey: key }) => key);

          if (fresh.length) {
            await api.deleteObjects(fresh).catch(() => undefined);
          }

          throw cause;
        }

        const stale = (asset.renditions ?? [])
          .map(({ storageKey: key }) => key)
          .filter((key): key is string => Boolean(key));

        if (stale.length) {
          await api.deleteObjects(stale).catch(() => undefined);
        }
      }
    },
    [api, client, config, update],
  );

  const cancel = useCallback(() => controller.current?.abort(), []);

  return {
    enabled: config.renditionWidths.length > 0,
    jobs,
    running,
    generate,
    cancel,
  };
}

/**
 * The whole original, as a Blob: the encoder reads it several times, once per
 * rung, and a second download per rung would cost far more than the memory.
 */
async function download(
  url: string,
  signal: AbortSignal,
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  const response = await fetch(url, { signal });

  if (!response.ok || !response.body) {
    throw new Error(`Could not read the original (${response.status})`);
  }

  const total = Number(response.headers.get("content-length")) || 0;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    chunks.push(value);
    received += value.byteLength;

    if (total) {
      onProgress(received / total);
    }
  }

  return new Blob(chunks as BlobPart[], {
    type: response.headers.get("content-type") ?? "video/mp4",
  });
}
