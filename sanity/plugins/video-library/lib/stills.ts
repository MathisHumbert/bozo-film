import { readProbe, withVideoElement, type VideoProbe } from "./probe";

export interface StillsOptions {
  /** Longest edge of the poster, in pixels. */
  posterWidth: number;
  /** Width of one storyboard cell, in pixels. */
  frameWidth: number;
  storyboardColumns: number;
  storyboardRows: number;
  /** JPEG quality, 0 to 1. */
  quality: number;
}

export const defaultStillsOptions: StillsOptions = {
  posterWidth: 1280,
  frameWidth: 240,
  storyboardColumns: 5,
  storyboardRows: 2,
  quality: 0.82,
};

export interface VideoStills {
  probe: VideoProbe;
  poster: Blob;
  /**
   * Frames laid out in a grid, used to scrub through the video on hover in
   * the library. One image instead of ten requests.
   */
  storyboard: Blob;
  storyboardColumns: number;
  storyboardRows: number;
}

const SEEK_TIMEOUT = 15_000;

/**
 * Captures a poster and a storyboard from a local file, entirely in the
 * browser. No ffmpeg, no Lambda, no queue: the file is already on the editor's
 * machine, and a canvas can read any frame the player can decode.
 */
export async function captureStills(
  file: File,
  options: Partial<StillsOptions> = {},
): Promise<VideoStills> {
  const settings = { ...defaultStillsOptions, ...options };

  return withVideoElement(file, async (video) => {
    const probe = await readProbe(video);

    const poster = await capturePoster(video, probe, settings);
    const storyboard = await captureStoryboard(video, probe, settings);

    return {
      probe,
      poster,
      storyboard,
      storyboardColumns: settings.storyboardColumns,
      storyboardRows: settings.storyboardRows,
    };
  });
}

async function capturePoster(
  video: HTMLVideoElement,
  probe: VideoProbe,
  settings: StillsOptions,
): Promise<Blob> {
  // A frame a second in avoids the black or white leader most edits open on,
  // while staying early enough to be representative.
  const time = Math.min(1, probe.duration * 0.1);

  const width = Math.min(settings.posterWidth, probe.width);
  const height = Math.round(width / probe.aspectRatio);

  const canvas = createCanvas(width, height);
  const context = get2dContext(canvas);

  await seek(video, time);
  context.drawImage(video, 0, 0, width, height);

  return toBlob(canvas, settings.quality);
}

async function captureStoryboard(
  video: HTMLVideoElement,
  probe: VideoProbe,
  settings: StillsOptions,
): Promise<Blob> {
  const { storyboardColumns: columns, storyboardRows: rows } = settings;
  const count = columns * rows;

  const cellWidth = settings.frameWidth;
  const cellHeight = Math.round(cellWidth / probe.aspectRatio);

  const canvas = createCanvas(cellWidth * columns, cellHeight * rows);
  const context = get2dContext(canvas);

  // Trim the very start and end: the first and last frames of an edit are
  // usually a fade, which makes for useless scrub targets.
  const from = probe.duration * 0.02;
  const to = probe.duration * 0.98;
  const step = (to - from) / Math.max(count - 1, 1);

  for (let index = 0; index < count; index += 1) {
    await seek(video, from + step * index);

    context.drawImage(
      video,
      (index % columns) * cellWidth,
      Math.floor(index / columns) * cellHeight,
      cellWidth,
      cellHeight,
    );
  }

  return toBlob(canvas, settings.quality);
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  return canvas;
}

function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not get a 2d canvas context");
  }

  return context;
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out seeking to ${time.toFixed(2)}s`));
    }, SEEK_TIMEOUT);

    function cleanup() {
      window.clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    }

    function onSeeked() {
      cleanup();
      resolve();
    }

    function onError() {
      cleanup();
      reject(new Error("The browser failed while seeking"));
    }

    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);

    // Clamping avoids a seek past the end, which never fires `seeked`.
    video.currentTime = Math.max(0, Math.min(time, video.duration - 0.05));
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("The canvas produced no image"));
        }
      },
      "image/jpeg",
      quality,
    );
  });
}
