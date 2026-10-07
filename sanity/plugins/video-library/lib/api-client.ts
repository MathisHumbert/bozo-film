import type { VideoLibraryConfig } from "../config";

export interface SignUploadResponse {
  key: string;
  uploadUrl: string;
  /** Sent verbatim with the PUT: they are part of the signature. */
  headers: Record<string, string>;
  cdnUrl: string;
}

export interface SignedRendition {
  width: number;
  key: string;
  uploadUrl: string;
  headers: Record<string, string>;
}

export interface StoredObject {
  key: string;
  size: number;
  lastModified: string | null;
}

export interface MediaApi {
  signUpload(file: File): Promise<SignUploadResponse>;
  signRenditions(
    storageKey: string,
    renditions: { width: number; size: number }[],
  ): Promise<SignedRendition[]>;
  deleteObjects(
    keys: string[],
  ): Promise<{ deleted: number; failed: unknown[] }>;
  listObjects(): Promise<StoredObject[]>;
}

/**
 * The plugin never talks to the bucket: it talks to the host application,
 * which holds the storage credentials. Everything here is one `fetch` away
 * from being pointed at a different backend.
 */
export function createMediaApi(
  config: VideoLibraryConfig,
  token: string | null,
): MediaApi {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!token) {
      throw new Error(
        "No Sanity session token available; the media API cannot be called.",
      );
    }

    const response = await fetch(`${config.apiBasePath}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "content-type": "application/json" } : {}),
        authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });

    if (!response.ok) {
      const detail = await response
        .json()
        .then((body: { error?: string }) => body.error)
        .catch(() => null);

      throw new Error(detail ?? `${path} failed with ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  return {
    signUpload: (file) =>
      request<SignUploadResponse>("/sign-upload", {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      }),

    signRenditions: (storageKey, renditions) =>
      request<{ renditions: SignedRendition[] }>("/sign-renditions", {
        method: "POST",
        body: JSON.stringify({ storageKey, renditions }),
      }).then((body) => body.renditions),

    deleteObjects: (keys) =>
      request<{ deleted: number; failed: unknown[] }>("/delete", {
        method: "POST",
        body: JSON.stringify({ keys }),
      }),

    listObjects: () =>
      request<{ objects: StoredObject[] }>("/list").then(
        (body) => body.objects,
      ),
  };
}

/**
 * XHR rather than fetch: upload progress still has no portable equivalent on
 * the fetch API, and a progress bar is the whole point of this screen.
 */
export function putWithProgress(
  url: string,
  body: Blob,
  headers: Record<string, string>,
  onProgress: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("PUT", url);

    // Exactly the headers the URL was signed for, or the signature fails.
    for (const [name, value] of Object.entries(headers)) {
      request.setRequestHeader(name, value);
    }

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(new Error(`Upload failed with ${request.status}`));
      }
    });

    request.addEventListener("error", () =>
      reject(new Error("Upload failed: network error")),
    );

    request.addEventListener("abort", () =>
      reject(new DOMException("Upload cancelled", "AbortError")),
    );

    signal?.addEventListener("abort", () => request.abort(), { once: true });

    request.send(body);
  });
}
