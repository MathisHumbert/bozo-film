import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClient, useCurrentUser } from "sanity";

import type { VideoLibraryConfig } from "../config";
import { createMediaApi } from "../lib/api-client";
import { uploadVideo, type UploadPhase } from "../lib/upload";
import { useStudioToken } from "./use-studio-token";

export interface UploadItem {
  id: string;
  file: File;
  phase: UploadPhase;
  /** 0 to 1, for the bytes transfer only. */
  progress: number;
  error: string | null;
  documentId: string | null;
}

export interface UploadQueue {
  items: UploadItem[];
  enqueue: (files: File[]) => void;
  cancel: (id: string) => void;
  clearFinished: () => void;
  isUploading: boolean;
  ready: boolean;
}

const ACTIVE_PHASES: UploadPhase[] = [
  "queued",
  "analysing",
  "uploading",
  "finalising",
];

export function useUploadQueue(
  config: VideoLibraryConfig,
  /** Called with the id of each document the pipeline creates. */
  onUploaded?: (documentId: string) => void,
): UploadQueue {
  const client = useClient({ apiVersion: config.apiVersion });
  const currentUser = useCurrentUser();
  const token = useStudioToken();

  const [items, setItems] = useState<UploadItem[]>([]);

  const api = useMemo(() => createMediaApi(config, token), [config, token]);

  const controllers = useRef(new Map<string, AbortController>());
  const running = useRef(0);
  const pending = useRef<UploadItem[]>([]);
  const onUploadedRef = useRef(onUploaded);

  useEffect(() => {
    onUploadedRef.current = onUploaded;
  }, [onUploaded]);

  const patch = useCallback((id: string, changes: Partial<UploadItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }, []);

  const pump = useCallback(() => {
    while (running.current < config.concurrency && pending.current.length) {
      const item = pending.current.shift();
      if (!item) {
        break;
      }

      running.current += 1;

      const controller = new AbortController();
      controllers.current.set(item.id, controller);

      uploadVideo(item.file, {
        api,
        client,
        config,
        uploadedBy: currentUser?.name ?? currentUser?.id ?? null,
        signal: controller.signal,
        onPhase: (phase) => patch(item.id, { phase }),
        onProgress: (progress) => patch(item.id, { progress }),
      })
        .then((documentId) => {
          patch(item.id, { phase: "done", progress: 1, documentId });
          onUploadedRef.current?.(documentId);
        })
        .catch((cause: unknown) => {
          const aborted =
            cause instanceof DOMException && cause.name === "AbortError";

          patch(item.id, {
            phase: aborted ? "cancelled" : "failed",
            error: aborted
              ? null
              : cause instanceof Error
                ? cause.message
                : String(cause),
          });
        })
        .finally(() => {
          controllers.current.delete(item.id);
          running.current -= 1;
          pump();
        });
    }
  }, [api, client, config, currentUser, patch]);

  const enqueue = useCallback(
    (files: File[]) => {
      const accepted = files.filter((file) =>
        config.acceptedTypes.includes(file.type),
      );

      const created: UploadItem[] = accepted.map((file) => ({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        phase: "queued",
        progress: 0,
        error: null,
        documentId: null,
      }));

      const rejected: UploadItem[] = files
        .filter((file) => !config.acceptedTypes.includes(file.type))
        .map((file) => ({
          id: `${file.name}-${crypto.randomUUID()}`,
          file,
          phase: "failed",
          progress: 0,
          error: `Unsupported format: ${file.type || "unknown"}`,
          documentId: null,
        }));

      setItems((current) => [...current, ...created, ...rejected]);
      pending.current.push(...created);
      pump();
    },
    [config.acceptedTypes, pump],
  );

  const cancel = useCallback((id: string) => {
    controllers.current.get(id)?.abort();

    // Not started yet: drop it from the waiting list rather than abort it.
    pending.current = pending.current.filter((item) => item.id !== id);

    setItems((current) =>
      current.map((item) =>
        item.id === id && ACTIVE_PHASES.includes(item.phase)
          ? { ...item, phase: "cancelled" }
          : item,
      ),
    );
  }, []);

  const clearFinished = useCallback(() => {
    setItems((current) =>
      current.filter((item) => ACTIVE_PHASES.includes(item.phase)),
    );
  }, []);

  useEffect(() => {
    const controllersAtMount = controllers.current;

    return () => {
      for (const controller of controllersAtMount.values()) controller.abort();
    };
  }, []);

  return {
    items,
    enqueue,
    cancel,
    clearFinished,
    isUploading: items.some((item) => ACTIVE_PHASES.includes(item.phase)),
    ready: Boolean(token),
  };
}
