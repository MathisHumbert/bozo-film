import { sanityProjectId } from "./env";

export interface StudioUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  roles?: { name: string; title?: string }[];
}

const CACHE_TTL = 60_000;

// Keyed by token, and a Studio has a handful of editors at most, so this stays
// tiny. It saves a round trip to Sanity on every request of an upload burst.
const cache = new Map<string, { user: StudioUser; expiresAt: number }>();

/**
 * Verifies the Sanity session token the Studio sends along.
 *
 * The endpoint is scoped to the project, so a token issued for another Sanity
 * project gets a 401 — that is our membership check, at no extra cost.
 *
 * Careful: an anonymous request answers `200 {}`. Checking `response.ok` alone
 * would let everyone through, so the body must carry a real user id.
 */
export async function requireStudioUser(
  request: Request,
): Promise<StudioUser | null> {
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    return null;
  }

  const cached = cache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

  const response = await fetch(
    `https://${sanityProjectId()}.api.sanity.io/v2021-06-07/users/me`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!response.ok) {
    return null;
  }

  const user = (await response.json()) as StudioUser;
  if (!user?.id) {
    return null;
  }

  cache.set(token, { user, expiresAt: Date.now() + CACHE_TTL });

  return user;
}
