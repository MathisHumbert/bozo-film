import type { SanityClient } from "sanity";

import type { VideoLibraryConfig } from "../config";
import { putWithProgress, type MediaApi } from "./api-client";
import { captureStills } from "./stills";

export type UploadPhase =
  | "queued"
  | "analysing"
  | "uploading"
  | "finalising"
  | "done"
  | "failed"
  | "cancelled";

export interface UploadContext {
  api: MediaApi;
  client: SanityClient;
  config: VideoLibraryConfig;
  uploadedBy: string | null;
  signal: AbortSignal;
  onPhase: (phase: UploadPhase) => void;
  onProgress: (ratio: number) => void;
}

/** "Hero shot v2 FINAL.mp4" -> "Hero shot v2 FINAL" */
export function titleFromFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");

  return (dot > 0 ? filename.slice(0, dot) : filename).trim() || filename;
}

/**
 * One file, end to end: read it, cut its stills, put the bytes in the bucket,
 * store the stills as Sanity image assets, then create the document that ties
 * all of it together.
 *
 * The document is created last on purpose. A document without an object is a
 * broken asset in the library; an object without a document is invisible, and
 * the compensating delete below clears it anyway.
 */
export async function uploadVideo(
  file: File,
  context: UploadContext,
): Promise<string> {
  const { api, client, signal, onPhase, onProgress } = context;

  onPhase("analysing");
  const stills = await captureStills(file);
  throwIfAborted(signal);

  onPhase("uploading");

  // One call only: the route mints a fresh random key every time, so signing
  // twice would upload to one key and record another.
  const { key, uploadUrl } = await api.signUpload(file);
  throwIfAborted(signal);

  let objectStored = false;

  try {
    await putWithProgress(uploadUrl, file, onProgress, signal);
    objectStored = true;

    onPhase("finalising");

    const [poster, storyboard] = await Promise.all([
      client.assets.upload("image", stills.poster, {
        filename: `${titleFromFilename(file.name)}-poster.jpg`,
      }),
      client.assets.upload("image", stills.storyboard, {
        filename: `${titleFromFilename(file.name)}-storyboard.jpg`,
      }),
    ]);

    throwIfAborted(signal);

    const document = await client.create({
      _type: "video-asset",
      title: titleFromFilename(file.name),
      filename: file.name,
      storageKey: key,
      contentType: file.type,
      size: file.size,
      duration: stills.probe.duration,
      width: stills.probe.width,
      height: stills.probe.height,
      aspectRatio: stills.probe.aspectRatio,
      thumbnail: imageField(poster._id),
      storyboard: imageField(storyboard._id),
      storyboardColumns: stills.storyboardColumns,
      storyboardRows: stills.storyboardRows,
      uploadedAt: new Date().toISOString(),
      uploadedBy: context.uploadedBy,
    });

    onPhase("done");

    return document._id;
  } catch (cause) {
    // The bytes are in the bucket but nothing references them. Removing them
    // now is what keeps the bucket and the catalogue from drifting apart.
    if (objectStored) {
      await api.deleteObjects([key]).catch(() => undefined);
    }

    throw cause;
  }
}

function imageField(assetId: string) {
  return {
    _type: "image" as const,
    asset: { _type: "reference" as const, _ref: assetId },
  };
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new DOMException("Upload cancelled", "AbortError");
  }
}
