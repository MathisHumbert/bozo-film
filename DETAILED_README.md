# Detailed README

The long version. [README.md](README.md) gets you running; [AGENTS.md](AGENTS.md) holds the
rules and the step-by-step checklists. This file explains **how the pieces fit and why they
are built this way** — read it once, then use the other two as reference.

- [The three documents](#the-three-documents)
- [Rendering one page, end to end](#rendering-one-page-end-to-end)
- [The content model](#the-content-model)
- [The type pipeline](#the-type-pipeline)
- [The route map](#the-route-map)
- [Rendering modes and caching](#rendering-modes-and-caching)
- [The SEO layer](#the-seo-layer)
- [The video library](#the-video-library)
- [The front-end runtime](#the-front-end-runtime)
- [Styling](#styling)
- [The Studio](#the-studio)
- [Conventions](#conventions)
- [Decisions worth knowing](#decisions-worth-knowing)
- [Known gaps](#known-gaps)

## The three documents

| File                 | Audience                   | Contains                                            |
| :------------------- | :------------------------- | :-------------------------------------------------- |
| `README.md`          | you, on day one            | setup, commands, the console steps for each service |
| `DETAILED_README.md` | you, wanting to understand | architecture, data flow, reasoning                  |
| `AGENTS.md`          | an agent, or you mid-task  | rules, gotchas, ordered checklists                  |

They cross-link rather than repeat. When a rule appears in two of them, `AGENTS.md` is the
one to trust — it sits next to the code that enforces it.

## Rendering one page, end to end

Take `/work/aurora/`. Seven steps:

**1. The route runs.** `src/pages/work/[slug].astro` has `export const prerender = false`,
so it executes per request rather than at build time. There is no `getStaticPaths` — an
on-demand route cannot enumerate its paths, so an unknown slug is handled explicitly:

```ts
const work = await loadQuery(workQuery, { slug });

if (!work) return new Response(null, { status: 404 });
```

**2. `loadQuery` fetches.** `src/lib/sanity/load-query.ts` is the only place that talks to
Sanity from the front end. It decides three things:

- **perspective** — `drafts` when Visual Editing is on, `published` otherwise
- **stega** — the invisible Unicode that makes Visual Editing clickable, on unless the
  caller passes `{ stega: false }`
- **token** — only sent when Visual Editing is on, since drafts need authentication

It deliberately does _not_ set `useCdn`. The Sanity integration pins it to `false`, and
that has to hold: right after a purge the page re-renders immediately, and `apicdn` can
still be serving the pre-publish document.

**3. The query is typed.** `workQuery` is a `defineQuery` template literal, so
`sanity typegen` has generated `WorkQueryResult` from it. `loadQuery` returns
`ClientReturn<Q>`, which resolves through the generated `SanityQueries` interface — the
route gets a fully typed object with no annotation.

**4. The layout receives four props.**

```astro
<Layout
  seo={work.seo}
  settings={work.settings}
  ogType="article"
  page={{ type: "work", work }}
  updatedAt={work._updatedAt}
/>
```

`seo` and `settings` come from the document. `page` describes _what the page is_, which is
what the structured data needs; `updatedAt` becomes `dateModified`.

**5. The layout fetches the global settings** with `siteSettingsQuery` and builds the head:

- `buildMeta()` merges page `seo` over `fallbackSEO`, derives the canonical from the route,
  resolves the OG image at 1200×630, extracts a Twitter handle from `sameAs`, and ends with
  `stegaClean()`.
- `buildGraph()` assembles the schema.org `@graph` from the same inputs plus `page`, and
  also ends with `stegaClean()`.

**6. The body renders.** The layout emits the preloader, the progress bar, the nav, then
the scroll containers, then `<slot />`. One thing to know: **the DOM differs between dev
and production.**

```astro
{
  isDev ? (
    <main class="content">
      <div id="swup" class="page">
        <slot />
      </div>
    </main>
  ) : (
    <div id="scroll-wrapper">
      <div id="scroll-content"> … </div>
    </div>
  )
}
```

In dev the page scrolls natively; in production it scrolls inside `#scroll-wrapper`. That
split exists so the dev experience stays simple, but it means smooth-scroll behaviour is
one of the few things you cannot fully trust in dev.

**7. The page builder dispatches.** `<PageBuilder content={work.content} />` switches on
`_type` and renders one component per block. The `switch` is deliberate: TypeScript narrows
each `case`, so every component is checked against its real props and a missing case is a
compile error rather than a blank space.

## The content model

Three kinds of schema, in three folders:

**`singletons/`** — exactly one document per type. `home`, `about`, `work-index`,
`settings`. They get a fixed document id equal to their type name, and
`documentTypeSingletonItem()` in the structure opens that one document directly instead of
a list. `sanity.config.ts` also filters them out of the "create new" menu.

**`documents/`** — repeatables. `work` (case studies) and `video-asset` (the video
catalogue). These have slugs and appear as lists.

**`objects/`** — reusable, not documents. Two sub-kinds that behave differently:

- _Field objects_: `seo`, `page-settings`, `link`. Reused across documents, never rendered
  on their own.
- _Page builder blocks_: `hero`, `heading-text`, `slider`, `accordion`, `scroll-section`,
  `wysiwyg`, `video`. Each is an array member of a document's `content` field.

Every page document carries the same three groups — `content`, `seo`, `settings` — which is
why one derived type works for all four routes.

One schema constraint worth remembering: **an `array` cannot be an array member.** That is
why `wysiwyg` is an object with a `body` field rather than a bare Portable Text array.

## The type pipeline

This is the part that silently breaks if you skip a step.

```
schema files  →  sanity schema deploy  →  Presentation + MCP see the schema
              →  npm run typegen       →  sanity/sanity.types.ts
                                          ├─ schema types   (Work, Hero, Slider…)
                                          └─ query results  (WorkQueryResult…)
```

`npm run typegen` does two things: extracts the schema to `sanity/schema.json`, then
statically evaluates every `defineQuery` in the repo against it. The result is a
`SanityQueries` interface mapping the exact query string to its result type, which is how
`loadQuery` stays typed without generics at the call site.

**The two families are not interchangeable.** `Work` describes a raw document; a projection
changes the shape, so `WorkQueryResult` is what a component actually receives. They diverge
in three systematic ways: projected fields exist only in the result, GROQ returns `null`
where the schema says `undefined`, and `_key` is added by the containing array. Hence the
rule: read from Sanity → derive from `*QueryResult`; write to Sanity → use the schema type.

`src/lib/sanity/types.ts` does the deriving:

```ts
export type PageBuilder = NonNullable<
  | NonNullable<HomeQueryResult>["content"]
  | NonNullable<AboutQueryResult>["content"]
  | NonNullable<WorkQueryResult>["content"]
  | NonNullable<WorkIndexQueryResult>["content"]
>;

export type PageBuilderBlockOf<T extends PageBuilderBlock["_type"]> = Extract<
  PageBuilderBlock,
  { _type: T }
>;
```

So a component types itself with `PageBuilderBlockOf<"slider">` and gets exactly what the
projection returns for that block, on every document that offers it.

**There is one thing typegen cannot do:** resolve an imported identifier inside a
`defineQuery` template literal. It only evaluates same-file identifiers. Import a shared
constant into a query and every result type silently becomes `unknown`, which cascades
through `PageBuilder` and breaks the dispatcher without an obvious error. That constraint
is why the route map has hand-written GROQ twins — see below.

## The route map

`src/lib/routes.ts` owns the document → URL mapping and **imports nothing**. That is the
whole design: it has to be consumable from the Studio bundle (`sanity/lib/resolve.ts`), from
Astro pages, from plain API endpoints, and from `astro.config.mjs`, which runs in Node
outside the Astro module graph.

It exports:

| Export                         | Role                               |
| :----------------------------- | :--------------------------------- |
| `hrefFor(doc)`                 | the only place a path is built     |
| `ROUTABLE_TYPES`               | every type that has a URL          |
| `REPEATABLE_TYPES`             | the subset with slugs              |
| `INDEX_FOR`                    | a repeatable → its listing page    |
| `allPaths(slugs)`              | every path on the site             |
| `absoluteUrl`, `normalizePath` | origin and trailing-slash handling |

Paths carry a trailing slash on everything but the root. That is not cosmetic: it has to
match what `@astrojs/sitemap` emits, what the canonical claims, and what the ISR cache is
keyed on. A purge for `/about` will not hit a page cached as `/about/`.

Because everything derives from this file, adding a document type needs no change in the
sitemap builder, in `allPaths()`, or in the revalidation endpoint.

**Its twins.** Two places repeat the mapping by hand, and cannot do otherwise:

1. the `select()` inside `linkProjection` — it runs inside Sanity, not in Node;
2. the type list in `repeatableSlugsQuery` — same reason.

Both live in `src/lib/sanity/queries.ts`, and both are subject to the typegen constraint
above, which is why importing `REPEATABLE_TYPES` there is not an option. The list is
written as a same-file const so typegen can at least evaluate it and narrow `_type` to a
literal.

## Rendering modes and caching

`output: "static"` with the Vercel adapter, but almost nothing is actually static. Three
tiers, and mixing them up fails silently:

|                                    | `prerender` | `isr.exclude` | Served as                                           |
| :--------------------------------- | :---------- | :------------ | :-------------------------------------------------- |
| pages, `llms.txt`, `llms-full.txt` | `false`     | no            | rendered once, then from the ISR cache until purged |
| `/api/*`                           | `false`     | **yes**       | a function, on every request                        |
| `robots.txt`, `/admin`             | default     | —             | a file on disk                                      |

The mechanism behind the rule: a prerendered route is written to
`.vercel/output/static` and served by `handle: filesystem`, which sits **above every
function** in the routing table. So a prerendered page can never be revalidated, and an
`isr.exclude` entry for it would be inert. Conversely, excluding a page makes it run
uncached on every request — the opposite of what you want.

After a build, only `admin/index.html` should be left on disk:

```sh
find .vercel/output/static -name '*.html'
```

**What happens on publish.** Sanity fires a signed webhook at `/api/revalidate`. The route
verifies the signature, maps `_type` to a list of paths, and sends a `HEAD` to each with the
bypass token, which makes Vercel regenerate and re-cache them. `resolvePaths()` derives
those paths from the route map:

- a **site-wide** type (`settings`, `video-asset`) purges everything, because `Layout`
  wraps every page and a video can be referenced from any of them;
- a **repeatable** purges its own page, its listing, and every other entry of its type,
  since one publish can reorder or retitle the whole listing;
- any other **routable** type purges its own page;
- everything else is a no-op.

Plus `/llms.txt` and `/llms-full.txt` in every branch.

**The sitemap.** Because every page is on-demand, `@astrojs/sitemap` finds the static
routes but cannot enumerate `[slug]`. `sitemapPages()` in `src/lib/sitemap.ts` runs one
query at build time over `ROUTABLE_TYPES` and returns two things: `customPages` for the
repeatables, and `excluded` — the URLs whose document has `seo.noIndex` — which the
integration's synchronous `filter` then drops. That is what makes `noIndex` work on
singletons too. It swallows its own errors: a sitemap short one route is recoverable, a red
deploy is not.

## The SEO layer

`src/lib/seo/` contains no fetching. Every function takes data and returns a value, which
is what lets the layout and the text endpoints share the same builders.

```
constants.ts      lang, locale, OG size, author, theme colour
url.ts            canonicalUrl(), nodeId()
types.ts          the SeoPage union
meta.ts           buildMeta()  → the flat object seo.astro renders
json-ld.ts        buildGraph() → the schema.org @graph
llms.ts           renderLlmsIndex(), renderLlmsFull()
text-endpoint.ts  originOf(), textResponse()
```

**The graph** cross-references nodes by absolute `@id` with a fragment, so a crawler
merging several pages sees one entity:

| `@id`                    | Node                                                         |
| :----------------------- | :----------------------------------------------------------- |
| `<site>/#identity`       | `Organization` or `Person`                                   |
| `<site>/#website`        | `WebSite`, `publisher` → `#identity`                         |
| `<canonical>#webpage`    | `WebPage`, or `AboutPage` / `CollectionPage` / `ProfilePage` |
| `<canonical>#breadcrumb` | `BreadcrumbList`, omitted on the home page                   |
| `<canonical>#work`       | `CreativeWork`, `creator` → `#identity`                      |

The fragment is `#identity`, not `#person` or `#organization`, so references survive an
editor flipping `entityType`.

**The schema side is generic by construction.** This is a boilerplate, so every field is
either universal or absent. `aiContent.sections` is one list of `{ title, items[] }` rather
than named `expertise` / `awards` fields — a studio fills _Services_, a portfolio fills
_Expertise_, a corporate site fills _Markets_, with no schema change and no empty fields
staring at anyone. Two title groups are also read by the structured data, case-insensitively:
`expertise`/`services`/`skills` → `knowsAbout`, `awards`/`award`/`recognition` → `award`.

**`llms.txt`** is built from `llmsQuery`, a lean sibling of the page queries: no image
dimensions, no LQIP, no video joins. Its Portable Text is flattened with a **per-block**
`pt::text(@)` rather than `pt::text(body)`, which keeps `style` and `listItem` so an `h2`
stays a heading and a bullet keeps its marker instead of melting into prose.

**Two rules that are not negotiable.**

_Escape before `set:html`._ `json-ld.astro` does
`JSON.stringify(graph).replace(/</g, "\\u003c")`. `set:html` performs no escaping, so an
editor string containing `</script>` would break out of the tag.

_Keep stega out of machine output._ Two chokepoints, chosen by whether a human reads the
value in the Studio or a machine parses it. The llms endpoints pass `{ stega: false }`, so
the bytes never arrive. `buildMeta()` and `buildGraph()` each **end** with `stegaClean()`,
because the page queries must keep stega for Visual Editing to work on visible content.

## The video library

Images stay Sanity assets. Videos do not: their bytes live in S3 or R2 behind a CDN, and a
`video-asset` document describes each one. The reason is cost and delivery; the reason it
needs a catalogue at all is that a bucket cannot answer "what is this called", "what does it
look like" or "which pages use it" — `ListObjectsV2` gives names and byte counts, nothing
more.

```
sanity/plugins/video-library/   the Videos tool — self-contained
src/lib/video-library/          storage client, auth guard, key generation, CDN URLs
src/pages/api/media/            sign-upload, delete, list, config
src/components/sanity-video.astro   the reusable media component
src/components/video/               the page builder block
```

The plugin imports nothing from outside its folder and talks to the host only through
`/api/media/*` and the config object passed to `videoLibrary()`. Credentials live on the
server, so **no AWS key reaches the browser**, and repointing the whole thing at another
backend is a `fetch` away.

**The upload pipeline**, all in the browser then one API call:

1. the file is loaded into an off-screen `<video>` to read duration and dimensions
2. a canvas captures a poster plus a storyboard of 10 frames in a 5×2 grid
3. `/api/media/sign-upload` returns a presigned PUT and an opaque, immutable key
4. the browser PUTs straight to the bucket — the file never transits the server
5. the poster and storyboard go up as Sanity images, then the document is created

The document is created **last** on purpose. A document without an object is a visibly
broken asset; an object without a document is invisible, and the failure path deletes it
anyway.

**The key** is `videos/<uuid>-<slug>.<ext>` and carries neither the folder nor the title.
That is what makes renaming or moving an asset a metadata patch — no re-upload, no CDN
invalidation.

**Deletion** removes four things in this order: the document, the object, then the poster
and storyboard images. Reversing the first two would leave documents pointing at missing
objects. The images go last because Sanity refuses to delete an asset a document still
references, and they have to go at all because Sanity never garbage-collects unreferenced
ones.

A video used by a page cannot be deleted: the reference in `objects/video.ts` is **strong**,
so Sanity refuses the mutation and — because `deleteObjects` runs after the commit — the
bucket is untouched. Safe, but the editor sees a raw error rather than "used on 2 pages".

**Two provider gotchas.** R2 needs `requestChecksumCalculation: "WHEN_REQUIRED"`, or
presigned PUTs fail with an opaque 400. And `sign-upload` passes
`signableHeaders: new Set(["content-type"])`: a presigned URL signs only `host` by default,
so without it any payload could be stored under any content type — including `text/html`,
which the CDN would then serve from your own domain.

## The front-end runtime

`src/scripts/index.ts` boots one `App`. The order matters:

```
Scroll.init()            Locomotive/Lenis created but stopped
new Preloader()
new AnimationManager()
new Transition({…})      swup
preloader.preloadPage()
                         ↓ on "page:loaded"
animationManager.create()
await nextFrame()
await <c-preloader>?.play()
html.is-ready
Scroll.start()
```

`is-ready` is the gate: the stylesheet keeps `html { pointer-events: none }` and
`.site { opacity: 0 }` until then, and flips `#scroll-wrapper` from
`position: fixed; overflow: hidden` to `position: relative; overflow-y: scroll`. So the page
is visually and interactively locked until the preloader is done, with no JavaScript
guarding it.

**Scroll** wraps Locomotive Scroll v5 (Lenis underneath) with `autoStart: false` and a
custom ticker so Lenis renders on GSAP's clock rather than its own `requestAnimationFrame` —
one loop, no drift between scroll and tweens. Its wrapper is `window` in dev and
`#scroll-wrapper` in production, matching the layout's two DOM shapes.

**Gsap** registers the plugins, sets `ease: "none"` as the default and disables lag
smoothing, then — in production only — installs a `scrollerProxy` so ScrollTrigger reads
positions from Lenis instead of the window, and makes `#scroll-wrapper` the default
scroller. In dev none of that is needed because the window _is_ the scroller.

**Device** detects phone/tablet/desktop from the user agent (including the iPadOS
`Macintosh` + `maxTouchPoints` case), exposes `isWebkit` and `isAppBrowser`, and tracks two
media queries: `prefers-reduced-motion` and `hover: none`. It emits `device:motion` when the
motion preference changes at runtime, which is what lets a component react without polling.

**Transition** is swup with three plugins: head (so `<title>` and meta follow a
navigation), preload (hovered links, and the initial page outside dev), and scripts. It
calls back into the app on content replacement so `AnimationManager` can rebuild.

**AnimationManager** is deliberately thin: it finds `[data-animation="text"]`, builds a
`Text` animation for each, and `reset()` destroys and recreates them after a swup
navigation. Blocks that animate themselves do it in their own web component instead.

**The event bus** (`src/scripts/utils/events.ts`) is a typed emitter with an explicit
`AppEvents` map — `resize`, `update`, `lenis`, `page:loaded`, `transition:*`,
`device:motion`, `menu:open`, `menu:close`. Declaring the payload types there means a typo
in an event name is a compile error, unlike `addEventListener`.

**Web components** are the unit of interactivity. A block that needs behaviour ships
`<c-name>` plus a `name.ts` next to its `.astro`, and the component registers itself. Two
consequences worth stating: it cleans up in `disconnectedCallback`, so a swup navigation
cannot leak listeners or ScrollTriggers; and the Preloader can await
`:not(:defined)` to know when interactivity is actually ready.

## Styling

Tailwind v4, configured in CSS rather than a config file.

**The rem trick.** `html` gets

```css
font-size: min(calc(100vw / var(--sizes-mobile) * 10), 12px);
```

so `1rem` scales with the viewport up to a ceiling, with a separate `--sizes-desktop` above
the `md` breakpoint. Every spacing token is therefore fluid without a single `clamp()` in
component code — `py-96` means 96 design units, not 96 pixels.

**The z-index scale** is two-part, in `src/styles/tailwind.css`:

```css
--z-index-below: -1;
--z-index-base: 0;
--z-index-above: 1;
--z-index-canvas: 2;
--z-index-content: 3;
--z-index-navigation: 4;
--z-index-menu: 5;
--z-index-preloader: 6;
--z-index-grid: 7;
--z-index-progress: 8;
```

The first three are the local vocabulary for stacking inside a component; the named layers
are global and ordered, so a new overlay slots in by name rather than by inventing a number.

## The Studio

One `sanity.config.ts`, three hosts: embedded at `/admin`, standalone on `:3333`, and
deployed to `<host>.sanity.studio`.

The trick that avoids duplicated environment variables is in `sanity.cli.ts`:

```ts
vite: (config) => ({ ...config, envPrefix: ["SANITY_STUDIO_", "PUBLIC_"] });
```

Without it the Studio's browser bundle only sees `SANITY_STUDIO_*`, so a standalone Studio
starts with no project id. With it, the Studio reads the same `PUBLIC_*` variables Astro
reads and nothing is declared twice. `sanity/lib/studio-env.ts` reads `import.meta.env`
first and falls back to `process.env`, because the Sanity CLI evaluates the config in Node
where nothing is inlined.

`sanity build` and `sanity deploy` run in **production** mode and load `.env.production`;
everything else loads `.env`. Values are inlined at build time, so deploying with the
development file bakes `localhost` into the client's Studio.

`PUBLIC_SITE_URL` is the one extra variable a standalone Studio needs: Presentation previews
that origin, and the video library calls its media API there. `mediaApiBasePath()` returns a
relative path when the Studio is same-origin and an absolute one when it is not, which is
why `/admin` needs no CORS at all.

## Conventions

**Typing.** Reading from Sanity → derive from `*QueryResult`. Writing → schema types. Props
are `T | null`, never `T | undefined`, because that is what GROQ returns.

**Comments.** Code under `src/` carries no explanatory comments — the exception is
`sanity/plugins/video-library/` and `src/lib/video-library/`, where the S3 and browser-media
details are genuinely non-obvious. Everywhere else, naming and this document do the work.

**Inline `if`.** No braceless `if` unless the body is exactly `return;`.

**Language.** Code, comments and documentation in English, whatever language the
conversation happens in.

**Web components** are named `c-*` and live next to the `.astro` that uses them.

## Decisions worth knowing

**No per-page canonical field.** It is the most misused field in any CMS — an editor pastes
the wrong URL and de-indexes the page. The canonical is derivable with certainty from the
route, so it is derived.

**`noIndex` as the single visibility switch.** One boolean with three consumers: the
`robots` meta, the sitemap filter and the `llms.txt` filter. Adding a fourth place that
decides visibility means reading all three first.

**Strong references on `video-asset`.** A weak reference would let an editor delete a video
that a live page uses, leaving a dangling ref and a broken player. Strong means Sanity
refuses, which is the right failure.

**`page` as a prop rather than pathname inference.** The layout could infer the page type
from the URL, but the work title, excerpt and thumbnail are not in `siteSettingsQuery` — it
would need a second round trip per page plus another copy of the route map.

**A `switch` in the page builder** rather than a lookup object, because only a `switch`
narrows the union per case and turns a missing block into a compile error.

**Dev and production render different DOM.** The smooth-scroll wrapper only exists in
production. It keeps dev simple and fast, at the cost of scroll behaviour being the one
thing you must check in a real build.

## Known gaps

Honest list, as of the last pass:

- **R2 has never been exercised.** The code path exists and the SDK settings are right, but
  only S3 has actually run.
- **The `OPTIONS` preflight on `/api/media/*`** is shadowed by Vite in dev, so that path is
  unverified until `vercel dev` or a deploy.
- **No usage check before deleting a video.** Safe, because the reference is strong, but the
  editor gets a raw 409 instead of "used on 2 pages", and a multi-delete fails as a whole
  when one asset is referenced.
- **No reconciliation screen** for objects in the bucket with no document, or images with no
  asset. `npm run check:storage` finds them; nothing cleans them.
- **Bucket CORS may still be `*`** on a project set up quickly. Restrict it to the Studio
  origins.
- **`/api/revalidate` returns 500 locally** — it reads `VERCEL_BYPASS_TOKEN` from
  `process.env`, which Vite does not populate in dev. Expected, not a bug.
