export function formatDuration(seconds?: number | null): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return "—";
  }

  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);

  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

export function formatBytes(bytes?: number | null): string {
  if (typeof bytes !== "number" || bytes <= 0) {
    return "—";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function formatDimensions(
  width?: number | null,
  height?: number | null,
): string {
  return width && height ? `${width}×${height}` : "—";
}
