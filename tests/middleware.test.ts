import { describe, expect, it, vi } from "vitest";

import { onRequest } from "../src/middleware";

function context(path: string, accept?: string) {
  const url = new URL(path, "https://bozo-film.vercel.app");
  const headers = new Headers(accept ? { accept } : {});

  return {
    url,
    request: new Request(url, { headers }),
    rewrite: vi.fn(
      async (to: string) =>
        new Response(`# md for ${to}`, {
          headers: { "content-type": "text/markdown; charset=utf-8" },
        }),
    ),
  };
}

const html = () =>
  vi.fn(
    async () =>
      new Response("<html></html>", {
        headers: { "content-type": "text/html" },
      }),
  );

// The middleware only reads url, request and rewrite.
async function run(ctx: ReturnType<typeof context>, next = html()) {
  const response = await onRequest(ctx as never, next as never);

  return { response: response as Response, next };
}

describe("middleware", () => {
  it("serves Markdown for Accept: text/markdown, with Vary", async () => {
    const ctx = context("/", "text/markdown");
    const { response, next } = await run(ctx);

    expect(ctx.rewrite).toHaveBeenCalledWith("/index.md");
    expect(next).not.toHaveBeenCalled();
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(response.headers.get("vary")).toBe("Accept");
  });

  it("rewrites nested pages and unknown paths to their .md twin", async () => {
    const work = context("/work/aurora/", "text/markdown");
    await run(work);
    expect(work.rewrite).toHaveBeenCalledWith("/work/aurora.md");

    const probe = context("/__ora-404-probe", "text/markdown");
    await run(probe);
    expect(probe.rewrite).toHaveBeenCalledWith("/__ora-404-probe.md");
  });

  it("serves HTML for a browser, with Vary", async () => {
    const ctx = context("/", "text/html,application/xhtml+xml,*/*;q=0.8");
    const { response, next } = await run(ctx);

    expect(next).toHaveBeenCalled();
    expect(ctx.rewrite).not.toHaveBeenCalled();
    expect(await response.text()).toBe("<html></html>");
    expect(response.headers.get("vary")).toBe("Accept");
  });

  it("honours q-values: HTML preferred over Markdown", async () => {
    const ctx = context("/about", "text/html, text/markdown;q=0.5");
    const { next } = await run(ctx);

    expect(next).toHaveBeenCalled();
    expect(ctx.rewrite).not.toHaveBeenCalled();
  });

  it("answers 406 when neither representation is acceptable", async () => {
    const { response } = await run(
      context("/", "text/markdown;q=0, application/json"),
    );

    expect(response.status).toBe(406);
    expect(response.headers.get("vary")).toBe("Accept");
  });

  it("appends to an existing Vary rather than replacing it", async () => {
    const next = vi.fn(
      async () => new Response("", { headers: { vary: "Accept-Encoding" } }),
    );
    const { response } = await run(context("/"), next);

    expect(response.headers.get("vary")).toBe("Accept-Encoding, Accept");
  });

  it("leaves non-page routes alone", async () => {
    for (const path of [
      "/llms.txt",
      "/api/revalidate",
      "/admin",
      "/about.md",
    ]) {
      const ctx = context(path, "text/markdown");
      const next = vi.fn(async () => new Response("x"));
      const { response } = await run(ctx, next);

      expect(next).toHaveBeenCalled();
      expect(ctx.rewrite).not.toHaveBeenCalled();
      expect(response.headers.get("vary")).toBeNull();
    }
  });
});
