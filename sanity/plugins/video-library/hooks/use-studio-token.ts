import { useMemo } from "react";
import { useClient, useWorkspace } from "sanity";

import { defaultConfig } from "../config";

/**
 * localStorage keys the Studio has used to hold its per-project session token,
 * newest first. Sanity renamed this at some point, and the plugin is meant to
 * work across Studio versions, so both are tried.
 *
 * Value shape: `{ token?: string }`.
 */
const TOKEN_STORAGE_KEYS = (projectId: string) => [
  `__studio_auth_token_${projectId}`,
  `__sanity_auth_token_${projectId}`,
];

/**
 * The session token the Studio is already authenticated with.
 *
 * Returns null rather than throwing, so the UI can explain itself. Null is a
 * real possibility: a Studio using cookie auth holds no token at all, and the
 * cookies it does hold belong to sanity.io, so they never reach our own API.
 */
export function useStudioToken(): string | null {
  const client = useClient({ apiVersion: defaultConfig.apiVersion });
  const { projectId } = useWorkspace();

  return useMemo(() => {
    const fromClient = client.config().token;
    if (fromClient) {
      return fromClient;
    }

    for (const key of TOKEN_STORAGE_KEYS(projectId)) {
      const token = readToken(key);
      if (token) {
        return token;
      }
    }

    return null;
  }, [client, projectId]);
}

function readToken(key: string): string | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { token?: string };

    return parsed.token ?? null;
  } catch {
    return null;
  }
}
