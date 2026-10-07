export function attachSources(video: HTMLVideoElement): boolean {
  const pending = video.querySelectorAll<HTMLSourceElement>("source[data-src]");

  if (pending.length === 0) {
    return false;
  }

  for (const source of pending) {
    source.src = source.dataset.src ?? "";
    source.removeAttribute("data-src");
  }

  video.load();

  return true;
}
