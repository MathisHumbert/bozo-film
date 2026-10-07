import { videoUrl } from "./cdn";

/**
 * Tailwind's breakpoints, in pixels, as `src/styles/tailwind.css` leaves them
 * (only `md` is redeclared there, at its default value). A `<source media>`
 * is plain CSS, so it cannot read the theme.
 */
const BREAKPOINTS: Record<string, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

export interface VideoSourceAsset {
  storageKey: string | null;
  width: number | null;
  renditions: { width: number | null; storageKey: string | null }[] | null;
}

export interface VideoSource {
  src: string;
  media?: string;
}

/**
 * Turns a quality string into `<source>` elements, widest breakpoint first.
 *
 * The string reads like Tailwind: `"1280 md:1920"` means 1280 below `md` and
 * 1920 from `md` up. A number asks for the smallest file at least that wide;
 * `original` asks for the upload itself. So a request is never under-served —
 * if 1280 was dropped because it weighed too close to the original, 1280
 * gets the original — and an asset with no renditions yet simply gets the
 * original everywhere.
 *
 * Unlike `srcset`, the browser picks once, when the video loads, from the
 * first `media` that matches. Resizing afterwards changes nothing.
 */
export function videoSources(
  asset: VideoSourceAsset,
  quality: string,
): VideoSource[] {
  if (!asset.storageKey) {
    return [];
  }

  const original = { width: asset.width ?? Infinity, key: asset.storageKey };

  const candidates = [
    ...(asset.renditions ?? []).flatMap(({ width, storageKey }) =>
      width && storageKey ? [{ width, key: storageKey }] : [],
    ),
    original,
  ].sort((a, b) => a.width - b.width);

  const pick = (wanted: string) => {
    const width = Number(wanted);

    if (wanted === "original" || !Number.isFinite(width)) {
      return original.key;
    }

    return (candidates.find((item) => item.width >= width) ?? original).key;
  };

  const steps = parse(quality);

  // Base first, then each breakpoint upwards. A step that resolves to the
  // same file as the one below it is redundant and dropped.
  const resolved = steps
    .map(({ minWidth, wanted }) => ({ minWidth, src: videoUrl(pick(wanted)) }))
    .filter(
      (step, index, all) => index === 0 || step.src !== all[index - 1].src,
    );

  return resolved
    .map(({ minWidth, src }) =>
      minWidth ? { src, media: `(min-width: ${minWidth}px)` } : { src },
    )
    .reverse();
}

function parse(quality: string): { minWidth: number; wanted: string }[] {
  const steps = new Map<number, string>([[0, "original"]]);

  for (const token of quality.trim().split(/\s+/).filter(Boolean)) {
    const [prefix, value] = token.includes(":")
      ? token.split(":")
      : ["", token];

    const minWidth = prefix ? BREAKPOINTS[prefix] : 0;

    if (minWidth === undefined) {
      console.warn(`[video] unknown breakpoint "${prefix}" in "${quality}"`);
      continue;
    }

    steps.set(minWidth, value);
  }

  return [...steps.entries()]
    .sort(([a], [b]) => a - b)
    .map(([minWidth, wanted]) => ({ minWidth, wanted }));
}
