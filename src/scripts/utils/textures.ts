// Loaded by the Preloader, picked up by the canvas.
export const preloaded = {
  posters: new Map<string, HTMLImageElement>(),
  videos: new Map<string, HTMLVideoElement>(),
};

// The first source whose media query matches, widest first.
export function getSource(element: HTMLElement) {
  const sources: { src: string; media?: string }[] = JSON.parse(
    element.dataset.sources ?? "[]",
  );

  return (
    sources.find(({ media }) => !media || matchMedia(media).matches)?.src ?? ""
  );
}

export function createMutedVideo() {
  const video = document.createElement("video");
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.preload = "none";

  return video;
}
