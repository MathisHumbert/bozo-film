export function originOf(site: URL | undefined): string {
  if (!site) {
    throw new Error(
      "`site` is not set in astro.config.mjs, so absolute URLs cannot be built.",
    );
  }

  return site.origin;
}

export function textResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
