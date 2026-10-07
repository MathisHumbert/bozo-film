import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  ConversionCanceledError,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
} from "mediabunny";

import { putWithProgress, type MediaApi } from "./api-client";

/** One rendition as stored on the `video-asset` document. */
export interface Rendition {
  _key: string;
  _type: "rendition";
  width: number;
  height: number;
  size: number;
  storageKey: string;
}

export interface EncodedRendition {
  width: number;
  height: number;
  blob: Blob;
}

export interface RenditionSource {
  width: number;
  aspectRatio: number;
  /** Seconds. */
  duration: number;
}

interface RunOptions {
  signal: AbortSignal;
  onProgress?: (ratio: number) => void;
}

/**
 * A quality level rather than a bitrate: Mediabunny turns it into a constant
 * quantizer (ffmpeg's CRF) wherever the encoder supports one, so a static shot
 * costs little and a busy one gets what it needs. It falls back to a bitrate
 * on encoders without quantizer support.
 */
const QUALITY = new Quality("high");

/**
 * A rendition is kept only if it weighs at most this share of the next larger
 * file already kept. A copy barely lighter than the one above it is not worth
 * a request, nor the storage.
 */
const MAX_SIZE_RATIO = 0.9;

/** Length of the trial encode that runs before the real ones. */
const PROBE_SECONDS = 0.3;

/**
 * Encodes the smaller copies of a video, entirely in the browser.
 *
 * WebCodecs does the work, so like the stills there is no ffmpeg, no Lambda
 * and no queue. Every width is encoded from the source rather than from the
 * previous rung, so no rung is a copy of a copy.
 *
 * A 0.3 s trial runs first: a missing encoder or an exotic source codec then
 * fails in a second, not after minutes spent on the first full rung.
 */
export function encodeRenditions(
  source: Blob,
  original: RenditionSource,
  widths: number[],
  options: RunOptions,
): Promise<EncodedRendition[]> {
  return exclusive(() => encodeAll(source, original, widths, options));
}

/**
 * Uploads run three at a time, encodes one at a time. A hardware encoder
 * serves a handful of sessions at best, and three 4K encodes in parallel are
 * no faster than in a row — only more likely to fail.
 */
let encoderTurn: Promise<unknown> = Promise.resolve();

function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = encoderTurn.then(task, task);
  encoderTurn = run.catch(() => undefined);

  return run;
}

async function encodeAll(
  source: Blob,
  original: RenditionSource,
  widths: number[],
  { signal, onProgress }: RunOptions,
): Promise<EncodedRendition[]> {
  const targets = [...widths]
    .map(even)
    .filter((width) => width < original.width)
    .sort((a, b) => b - a)
    .map((width) => ({
      width,
      height: Math.max(2, even(Math.round(width / original.aspectRatio))),
    }));

  if (!targets.length) {
    return [];
  }

  const smallest = targets[targets.length - 1];

  await encode(source, smallest, {
    signal,
    trim: { start: 0, end: Math.min(PROBE_SECONDS, original.duration) },
  });

  // Progress is weighted by pixel count, which tracks encoding time far
  // better than giving each rung an equal share.
  const pixels = targets.map(({ width, height }) => width * height);
  const total = pixels.reduce((sum, value) => sum + value, 0);

  const kept: EncodedRendition[] = [];
  let ceiling = source.size;
  let done = 0;

  for (const [index, target] of targets.entries()) {
    const blob = await encode(source, target, {
      signal,
      onProgress: (ratio) =>
        onProgress?.((done + ratio * pixels[index]) / total),
    });

    done += pixels[index];
    onProgress?.(done / total);

    if (blob.size <= ceiling * MAX_SIZE_RATIO) {
      kept.push({ ...target, blob });
      ceiling = blob.size;
    }
  }

  return kept;
}

/**
 * Puts encoded renditions in the bucket, beside their original.
 *
 * All or nothing: if one PUT fails, the ones already stored are deleted, so a
 * failed run never leaves objects that no document points at.
 */
export async function uploadRenditions(
  api: MediaApi,
  storageKey: string,
  encoded: EncodedRendition[],
  { signal, onProgress }: RunOptions,
): Promise<Rendition[]> {
  if (!encoded.length) {
    return [];
  }

  const signed = await api.signRenditions(
    storageKey,
    encoded.map(({ width, blob }) => ({ width, size: blob.size })),
  );

  const total = encoded.reduce((sum, { blob }) => sum + blob.size, 0);
  const stored: string[] = [];
  let done = 0;

  try {
    for (const [index, { blob }] of encoded.entries()) {
      const { uploadUrl, headers, key } = signed[index];

      await putWithProgress(
        uploadUrl,
        blob,
        headers,
        (ratio) => onProgress?.((done + ratio * blob.size) / total),
        signal,
      );

      stored.push(key);
      done += blob.size;
    }
  } catch (cause) {
    if (stored.length) {
      await api.deleteObjects(stored).catch(() => undefined);
    }

    throw cause;
  }

  return encoded.map(({ width, height, blob }, index) => ({
    _key: crypto.randomUUID().slice(0, 12),
    _type: "rendition",
    width,
    height,
    size: blob.size,
    storageKey: signed[index].key,
  }));
}

async function encode(
  source: Blob,
  { width, height }: { width: number; height: number },
  {
    signal,
    onProgress,
    trim,
  }: RunOptions & { trim?: { start: number; end: number } },
): Promise<Blob> {
  throwIfAborted(signal);

  const input = new Input({
    source: new BlobSource(source),
    formats: ALL_FORMATS,
  });

  // `in-memory` writes the index at the head of the file: playback starts
  // before the download ends, which matters for a four-minute film.
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target,
  });

  let conversion: Conversion | undefined;
  const cancel = () => void conversion?.cancel();

  try {
    conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      trim,
      showWarnings: false,
      video: {
        width,
        height,
        // Both sides are rounded to even numbers, which H.264 requires, so the
        // box can differ from the source ratio by a pixel. Cover crops that
        // pixel rather than stretching the picture.
        fit: "cover",
        codec: "avc",
        quality: QUALITY,
        forceTranscode: true,
      },
      // AAC is copied as is, anything else transcoded to it.
      audio: { codec: "aac" },
    });

    // A silently dropped audio track would make a rendition that differs
    // from its original. Better no rendition at all.
    const unusable = conversion.discardedTracks.find(
      ({ reason }) => reason !== "discarded_by_user",
    );

    if (!conversion.isValid || unusable) {
      throw new Error(
        `This browser cannot encode this video (${unusable?.reason ?? "no usable track"})`,
      );
    }

    if (onProgress) {
      conversion.onProgress = (ratio) => onProgress(ratio);
    }

    signal.addEventListener("abort", cancel, { once: true });
    await conversion.execute();
  } catch (cause) {
    if (cause instanceof ConversionCanceledError) {
      throw new DOMException("Encoding cancelled", "AbortError");
    }

    throw cause;
  } finally {
    signal.removeEventListener("abort", cancel);
    input.dispose();
  }

  if (!target.buffer) {
    throw new Error("The encoder produced no output");
  }

  return new Blob([target.buffer], { type: "video/mp4" });
}

function even(value: number): number {
  return value - (value % 2);
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new DOMException("Encoding cancelled", "AbortError");
  }
}
