import { describe, expect, it } from "vitest";

import { hrefFor, resolvePath } from "../src/lib/routes";

describe("resolvePath", () => {
  it.each([
    ["/", { _type: "home" }],
    ["/about", { _type: "about" }],
    ["/about/", { _type: "about" }],
    ["/photo", { _type: "photo" }],
    ["/work/aurora", { _type: "work", slug: "aurora" }],
    ["/work/aurora/", { _type: "work", slug: "aurora" }],
  ])("%s → %o", (path, doc) => expect(resolvePath(path)).toEqual(doc));

  it.each(["/nope", "/work", "/work/", "/work/a/b", "/__ora-404-probe"])(
    "%s → null",
    (path) => expect(resolvePath(path)).toBeNull(),
  );

  it("inverts hrefFor", () => {
    const docs = [
      { _type: "home" },
      { _type: "about" },
      { _type: "photo" },
      { _type: "work", slug: "kosar-ali" },
    ];

    for (const doc of docs) {
      expect(resolvePath(hrefFor(doc)!)).toEqual(doc);
    }
  });
});
