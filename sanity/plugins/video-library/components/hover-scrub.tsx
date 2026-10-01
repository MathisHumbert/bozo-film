import { Box } from "@sanity/ui";
import { useRef, useState, type PointerEvent } from "react";

import { defaultStillsOptions } from "../lib/stills";

interface HoverScrubProps {
  posterUrl: string | null;
  storyboardUrl: string | null;
  columns: number | null;
  rows: number | null;
  /** Rendered underneath the scrubber, e.g. a duration badge. */
  children?: React.ReactNode;
}

/**
 * Scrubs through the storyboard sprite as the pointer moves across the card.
 *
 * No network request and no video decoding: the whole interaction is one
 * already-loaded image moved under a window with `background-position`. That
 * is what makes a wall of near-identical posters browsable.
 */
export function HoverScrub({
  posterUrl,
  storyboardUrl,
  columns,
  rows,
  children,
}: HoverScrubProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<number | null>(null);

  // Assets captured before the layout was stored fall back to the current one.
  const gridColumns = columns ?? defaultStillsOptions.storyboardColumns;
  const gridRows = rows ?? defaultStillsOptions.storyboardRows;
  const frameCount = gridColumns * gridRows;

  const scrubbable = Boolean(storyboardUrl) && frameCount > 1;

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!scrubbable) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;

    const ratio = (event.clientX - rect.left) / rect.width;
    const next = clamp(Math.floor(ratio * frameCount), 0, frameCount - 1);

    // Re-render only when the frame actually changes, not on every pixel.
    setFrame((current) => (current === next ? current : next));
  }

  return (
    <Box
      ref={containerRef}
      style={{
        position: "relative",
        aspectRatio: "16 / 9",
        overflow: "hidden",
        borderRadius: "inherit",
      }}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setFrame(null)}
    >
      {posterUrl ? (
        <img
          src={posterUrl}
          alt=""
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : null}

      {scrubbable && frame !== null ? (
        <Box
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${storyboardUrl})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${gridColumns * 100}% ${gridRows * 100}%`,
            backgroundPosition: spritePosition(frame, gridColumns, gridRows),
          }}
        />
      ) : null}

      {children}

      {scrubbable && frame !== null ? (
        <Progress frame={frame} count={frameCount} />
      ) : null}
    </Box>
  );
}

/**
 * Percentage background positioning is proportional, not absolute: to land on
 * column `c` of `n`, the offset is `c / (n - 1)` of the overflow, not `c / n`.
 */
function spritePosition(frame: number, columns: number, rows: number): string {
  const column = frame % columns;
  const row = Math.floor(frame / columns);

  const x = columns > 1 ? (column / (columns - 1)) * 100 : 0;
  const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;

  return `${x}% ${y}%`;
}

function Progress({ frame, count }: { frame: number; count: number }) {
  return (
    <Box
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 2,
        background: "rgba(0, 0, 0, 0.35)",
      }}
    >
      <Box
        style={{
          width: `${((frame + 1) / count) * 100}%`,
          height: "100%",
          background: "rgba(255, 255, 255, 0.9)",
        }}
      />
    </Box>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
