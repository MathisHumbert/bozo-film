import { useTheme } from "@sanity/ui";

/**
 * The orange sanity-plugin-media uses to outline picked assets.
 *
 * Read from the theme rather than hard-coded, so it stays right in both colour
 * schemes and follows a restyled Studio. The cast keeps us off the deprecated
 * `Theme` typings while still reading the value the Media tool reads.
 */
export function usePickedColor(): string {
  const theme = useTheme() as {
    sanity?: { color?: { spot?: Record<string, string> } };
  };

  return theme?.sanity?.color?.spot?.orange ?? "#e08800";
}
