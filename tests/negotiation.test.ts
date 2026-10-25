import { describe, expect, it } from "vitest";

import {
  MARKDOWN_ROUTE,
  isNegotiable,
  markdownPathFor,
  mentionsMarkdown,
  negotiate,
  pagePathFor,
  withMarkdownRoute,
} from "../src/lib/negotiation";

describe("negotiate", () => {
  it.each([
    ["text/markdown", "markdown"],
    ["TEXT/MARKDOWN", "markdown"],
    ["text/markdown, text/html", "markdown"],
    ["text/html, text/markdown", "markdown"],
    ["text/markdown, text/html;q=0.9", "markdown"],
    ["text/html, text/markdown;q=0.5", "html"],
    ["text/markdown;q=0, text/html", "html"],
    ["text/markdown;q=0.8, */*;q=0.1", "markdown"],
    ["text/*;q=0.5, text/markdown;q=0.9", "markdown"],
    ["text/html,application/xhtml+xml,*/*;q=0.8", "html"],
    ["*/*", "markdown"],
    ["", "html"],
    [null, "html"],
  ] as const)("%s → %s", (accept, expected) => {
    expect(negotiate(accept)).toBe(expected);
  });

  it("returns null when neither representation is acceptable", () => {
    expect(negotiate("text/markdown;q=0, application/json")).toBeNull();
    expect(negotiate("application/json")).toBeNull();
  });
});

describe("isNegotiable", () => {
  it.each(["/", "/about", "/about/", "/photo", "/work/aurora", "/__probe-x"])(
    "negotiates %s",
    (path) => expect(isNegotiable(path)).toBe(true),
  );

  it.each([
    "/api/revalidate",
    "/api",
    "/admin",
    "/admin/structure",
    "/_astro/a.css",
    "/_image",
    "/_server-islands/x",
    "/_vercel/insights",
    "/llms.txt",
    "/about.md",
    "/logo.svg",
  ])("leaves %s alone", (path) => expect(isNegotiable(path)).toBe(false));

  it("does not catch paths that merely start like an excluded one", () => {
    expect(isNegotiable("/administration")).toBe(true);
    expect(isNegotiable("/apiary")).toBe(true);
  });
});

describe("markdown paths", () => {
  it.each([
    ["/", "/index.md"],
    ["/about", "/about.md"],
    ["/about/", "/about.md"],
    ["/work/aurora/", "/work/aurora.md"],
  ])("%s → %s", (page, md) => expect(markdownPathFor(page)).toBe(md));

  it.each([
    ["index", "/"],
    [undefined, "/"],
    ["about", "/about"],
    ["work/aurora", "/work/aurora"],
  ])("param %s → %s", (param, page) => expect(pagePathFor(param)).toBe(page));
});

// The Vercel route and the middleware must agree, or a Markdown request could
// reach the ISR function and be cached under the HTML URL.
describe("MARKDOWN_ROUTE", () => {
  const src = new RegExp(MARKDOWN_ROUTE.src!);
  const header = new RegExp(`^${MARKDOWN_ROUTE.has![0].value}$`);

  it.each([
    "/",
    "/about/",
    "/work/aurora",
    "/api/media/list",
    "/admin",
    "/llms.txt",
    "/_astro/x.js",
    "/apiary",
  ])("routes %s exactly when the middleware negotiates it", (path) => {
    expect(src.test(path)).toBe(isNegotiable(path));
  });

  it.each([
    "text/markdown",
    "Text/Markdown;q=0.5",
    "text/html, text/markdown",
    "text/html",
    "*/*",
    "application/json",
  ])("matches %s exactly when the middleware sees Markdown", (accept) => {
    expect(header.test(accept)).toBe(mentionsMarkdown(accept));
  });

  it("goes to the uncached function", () => {
    expect(MARKDOWN_ROUTE.dest).toBe("_render");
    expect(MARKDOWN_ROUTE.has![0].key).toBe("accept");
  });
});

describe("withMarkdownRoute", () => {
  const config = {
    version: 3,
    routes: [
      { src: "^/_astro(?:/(.*))$", headers: {}, continue: true },
      { handle: "filesystem" },
      { src: "^/api/revalidate$", dest: "_render" },
      { src: "^(/)$", dest: "/_isr?x_astro_path=$1" },
    ],
  };

  it("inserts the route straight after the filesystem, above every page", () => {
    const routes = withMarkdownRoute(config).routes!;

    expect(routes[1]).toEqual({ handle: "filesystem" });
    expect(routes[2]).toBe(MARKDOWN_ROUTE);
    expect(routes.at(-1)!.dest).toContain("/_isr");
  });

  it("is idempotent", () => {
    const twice = withMarkdownRoute(withMarkdownRoute(config));

    expect(twice.routes!.filter((r) => r === MARKDOWN_ROUTE)).toHaveLength(1);
    expect(twice.routes).toHaveLength(config.routes.length + 1);
  });

  it("keeps the other routes and fields", () => {
    const out = withMarkdownRoute(config);

    expect(out.version).toBe(3);
    expect(out.routes).toEqual(expect.arrayContaining(config.routes));
  });

  it("throws without a filesystem handle", () => {
    expect(() => withMarkdownRoute({ routes: [] })).toThrow(/filesystem/);
  });
});
