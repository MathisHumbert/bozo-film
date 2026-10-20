import type { AstroCookies } from "astro";
import type {
  ClientPerspective,
  ClientReturn,
  QueryParams,
} from "@sanity/client";
import { perspectiveCookieName } from "@sanity/preview-url-secret/constants";

const token = import.meta.env.SANITY_API_READ_TOKEN;

export const sanityConfigured = Boolean(
  import.meta.env.PUBLIC_SANITY_PROJECT_ID,
);

export function isDraftMode(cookies?: AstroCookies): boolean {
  return Boolean(cookies?.has(perspectiveCookieName));
}

function draftPerspective(cookies: AstroCookies): ClientPerspective {
  const value = cookies.get(perspectiveCookieName)?.value;

  if (!value) return "drafts";

  if (value.startsWith("[")) {
    try {
      const stack = JSON.parse(value);

      if (
        Array.isArray(stack) &&
        stack.length > 0 &&
        stack.every((item) => typeof item === "string")
      ) {
        return stack;
      }
    } catch {
      return "drafts";
    }

    return "drafts";
  }

  return value as ClientPerspective;
}

export interface LoadOptions {
  /** `Astro.cookies` — read for the draft mode cookie. Omit to always load published. */
  cookies?: AstroCookies;
  stega?: boolean;
}

export async function loadQuery<const Q extends string>(
  query: Q,
  params: QueryParams = {},
  options: LoadOptions = {},
): Promise<ClientReturn<Q> | null> {
  if (!sanityConfigured) return null;

  const { sanityClient } = await import("sanity:client");

  const draftMode = isDraftMode(options.cookies);

  if (!draftMode) {
    return sanityClient.fetch<ClientReturn<Q>>(query, params, {
      perspective: "published",
      stega: false,
    });
  }

  if (!token) {
    throw new Error(
      "The `SANITY_API_READ_TOKEN` environment variable is required in draft mode.",
    );
  }

  return sanityClient.fetch<ClientReturn<Q>>(query, params, {
    perspective: draftPerspective(options.cookies!),
    token,
    stega: options.stega !== false,
  });
}
