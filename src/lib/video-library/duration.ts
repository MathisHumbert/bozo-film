export function formatDuration(duration?: number | null) {
  if (!duration) return null;

  const total = Math.round(duration);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;

  return {
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
    iso: `PT${minutes}M${seconds}S`,
    label: `${minutes} minute${minutes === 1 ? "" : "s"} ${seconds} second${seconds === 1 ? "" : "s"}`,
  };
}
