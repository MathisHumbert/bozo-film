export interface VideoProbe {
  /** Seconds. */
  duration: number;
  width: number;
  height: number;
  /** Width divided by height, rounded to four decimals. */
  aspectRatio: number;
}

const METADATA_TIMEOUT = 15_000;

/**
 * Loads a local file into an off-screen <video> and hands it to `read`.
 *
 * Nothing here touches the network: the file is addressed through an object
 * URL, which is why the whole pipeline costs no infrastructure at all.
 */
export async function withVideoElement<T>(
  file: File,
  read: (video: HTMLVideoElement) => Promise<T>,
): Promise<T> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");

  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.src = url;

  try {
    await waitForMetadata(video);
    return await read(video);
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while reading the video metadata"));
    }, METADATA_TIMEOUT);

    function cleanup() {
      window.clearTimeout(timer);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
    }

    function onLoaded() {
      cleanup();
      resolve();
    }

    function onError() {
      cleanup();
      reject(new Error("The browser could not decode this video"));
    }

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("error", onError);
  });
}

/**
 * Some containers — WebM especially, but also MP4 files written by a stream
 * recorder — report `Infinity` until the player has seen the end of the file.
 * Seeking far past the end forces the browser to resolve the real duration.
 */
async function resolveDuration(video: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(video.duration) && video.duration > 0) {
    return video.duration;
  }

  return new Promise((resolve) => {
    const onTimeUpdate = () => {
      if (!Number.isFinite(video.duration)) return;

      video.removeEventListener("timeupdate", onTimeUpdate);
      video.currentTime = 0;
      resolve(video.duration);
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.currentTime = 1e101;
  });
}

export async function probeVideo(file: File): Promise<VideoProbe> {
  return withVideoElement(file, readProbe);
}

export async function readProbe(video: HTMLVideoElement): Promise<VideoProbe> {
  const duration = await resolveDuration(video);
  const width = video.videoWidth;
  const height = video.videoHeight;

  if (!width || !height) {
    throw new Error("The video reports no dimensions");
  }

  return {
    duration,
    width,
    height,
    aspectRatio: Math.round((width / height) * 10_000) / 10_000,
  };
}
