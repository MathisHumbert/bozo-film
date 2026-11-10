import { describe, expect, it } from "vitest";

import {
  isNegotiable,
  markdownPathFor,
  mentionsMarkdown,
  negotiate,
  pagePathFor,
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

describe("mentionsMarkdown", () => {
  it.each([
    ["text/markdown", true],
    ["Text/Markdown;q=0.5", true],
    ["text/html, text/markdown", true],
    ["text/html", false],
    ["*/*", false],
    [null, false],
  ])("%s → %s", (accept, expected) =>
    expect(mentionsMarkdown(accept)).toBe(expected),
  );
});
