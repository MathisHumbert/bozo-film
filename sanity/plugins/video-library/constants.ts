/**
 * Layout constants taken from sanity-plugin-media (MIT, © Sanity.io) so this
 * tool and the Media tool read as one product.
 *
 * https://github.com/sanity-io/plugins/tree/main/plugins/sanity-plugin-media
 */

/** Height of a card's footer strip, and of the table header. */
export const PANEL_HEIGHT = 32;

export const FOLDERS_PANEL_WIDTH = 260;
export const TAGS_PANEL_WIDTH = 250;

/**
 * Their column tracks, with two repurposed: MIME type becomes duration, and
 * the reference count is kept for the usage check that lands later.
 *
 * checkbox · preview · title · resolution · duration · size · uploaded ·
 * used in · spacer
 */
export const GRID_TEMPLATE_COLUMNS = {
  SMALL: "3rem 100px auto 1.5rem",
  LARGE: "3rem 100px auto 5.5rem 5.5rem 3.5rem 8.5rem 4.75rem 2rem",
};

/** Below this index @sanity/ui considers the viewport narrow. */
export const NARROW_BELOW = 3;
