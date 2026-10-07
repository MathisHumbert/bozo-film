import type { APIRoute } from "astro";

import { requireStudioUser } from "../../../lib/video-library/auth";
import { json, unauthorized, preflight } from "../../../lib/video-library/http";
import {
  buildRenditionKey,
  isManagedKey,
} from "../../../lib/video-library/keys";
import { signPut } from "../../../lib/video-library/sign";

export const prerender = false;

const MAX_SIZE = 500 * 1024 * 1024;
const MAX_RENDITIONS = 4;
const MIN_WIDTH = 160;
const MAX_WIDTH = 3840;

interface RenditionRequest {
  width?: unknown;
  size?: unknown;
}

/**
 * Signs one PUT per rendition of an existing original.
 *
 * The widths are chosen by the plugin, not here: the route only checks that
 * each is a sane, even pixel count. The keys, on the other hand, are always
 * built here — a caller never names the object it writes to.
 */
export const POST: APIRoute = async ({ request }) => {
  const user = await requireStudioUser(request);
  if (!user) {
    return unauthorized(request);
  }

  const body = (await request.json().catch(() => null)) as {
    storageKey?: unknown;
    renditions?: RenditionRequest[];
  } | null;

  const storageKey = body?.storageKey;

  if (!isManagedKey(storageKey)) {
    return json({ error: "storageKey is missing or unmanaged" }, 400, request);
  }

  const renditions = Array.isArray(body?.renditions) ? body.renditions : [];

  if (!renditions.length || renditions.length > MAX_RENDITIONS) {
    return json(
      { error: `Between 1 and ${MAX_RENDITIONS} renditions expected` },
      400,
      request,
    );
  }

  const invalid = renditions.some(
    ({ width, size }) =>
      typeof width !== "number" ||
      !Number.isInteger(width) ||
      width % 2 !== 0 ||
      width < MIN_WIDTH ||
      width > MAX_WIDTH ||
      typeof size !== "number" ||
      size <= 0 ||
      size > MAX_SIZE,
  );

  if (invalid) {
    return json({ error: "Invalid rendition width or size" }, 400, request);
  }

  // Renditions are always re-encoded to H.264 in an MP4, whatever the
  // original's container, so the type is fixed rather than caller-supplied.
  const signed = await Promise.all(
    renditions.map(async ({ width }) => {
      const key = buildRenditionKey(storageKey, width as number);

      return { width, key, ...(await signPut(key, "video/mp4")) };
    }),
  );

  return json({ renditions: signed }, 200, request);
};

export const OPTIONS: APIRoute = ({ request }) => preflight(request);
