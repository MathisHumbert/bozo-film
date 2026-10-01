import { sanityClient } from "sanity:client";
import type { ClientReturn, QueryParams } from "@sanity/client";

const visualEditingEnabled =
  import.meta.env.PUBLIC_SANITY_VISUAL_EDITING_ENABLED === "true";
const token = import.meta.env.SANITY_API_READ_TOKEN;

export interface LoadOptions {
  stega?: boolean;
}

export async function loadQuery<const Q extends string>(
  query: Q,
  params: QueryParams = {},
  options: LoadOptions = {},
): Promise<ClientReturn<Q>> {
  if (visualEditingEnabled && !token) {
    throw new Error(
      "The `SANITY_API_READ_TOKEN` environment variable is required during Visual Editing.",
    );
  }

  const stega = visualEditingEnabled && options.stega !== false;

  return sanityClient.fetch<ClientReturn<Q>>(query, params, {
    perspective: visualEditingEnabled ? "drafts" : "published",
    ...(visualEditingEnabled ? { token, stega } : {}),
  });
}
