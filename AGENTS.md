## Orientation

This file holds the rules and checklists. Two companions:
[README.md](README.md) for setup and the console steps,
[DETAILED_README.md](DETAILED_README.md) for how the pieces fit and why. When a rule appears
in more than one, this file is the one to trust.

## Running without Sanity

The site boots with no `.env` at all, which is what makes this a usable starter. Three
pieces make that work, and each is easy to break:

- **`loadQuery` returns `null`** when `PUBLIC_SANITY_PROJECT_ID` is unset, and imports
  `sanity:client` **dynamically** so the client is never constructed. Every caller already
  handles null.
- **`astro.config.mjs` passes a fallback `projectId`.** The integration's middleware builds
  a client on _every request_, so a missing id crashes even a page with no imports. The
  fallback is syntactically valid and never used: nothing queries with it.
- **`studioBasePath` is conditional.** Without a real id the Studio route is not generated,
  so `/admin` is a 404 rather than a crash.

`src/lib/sanity/url-for-image.ts` builds its URL builder from the env vars rather than from
`sanity:client`, for the same reason — `src/lib/seo/meta.ts` imports it, so it is in the
module graph of every page.

The two llms endpoints return 404 when there is nothing to serve. `/robots.txt`, the SEO
head and the JSON-LD all work from defaults.

If you add a module that imports `sanity:client` at the top level, the no-Sanity mode breaks
and the symptom is a 500 on every route, including pages that import nothing. Verify with:

```sh
mv .env .env.bak && npm run dev   # / must be 200
```

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Deploying

Vercel, `output: "static"` with ISR. Two rules:

- **Every API route needs `export const prerender = false` AND an entry in
  `isr.exclude`** (`astro.config.mjs`). Miss the second and it is cached like a page.
- **`VERCEL_BYPASS_TOKEN` must exist at build time** — `astro.config.mjs` reads it from
  `process.env` while building, so a runtime-only variable leaves ISR with no purge key.

`astro preview` does not work with this adapter; use `npx vercel dev`.

Every variable in `.env` goes into all three Vercel environments. Origins have to be
allowed in three places: Sanity (Manage → API → CORS), the bucket's CORS rules, and
`STUDIO_ORIGINS` if a Studio is served outside `/admin`. Full walkthrough in the README.

## Running the Studio

Same `sanity.config.ts`, two hosts:

- embedded — `npm run dev`, at `localhost:3000/admin`
- standalone — `npm run dev:sanity`, at `localhost:3333`; `npm run dev:all` for both
- deployed — `npm run deploy:sanity`, to `<host>.sanity.studio`

`sanity.cli.ts` widens the Studio's Vite `envPrefix` to `["SANITY_STUDIO_", "PUBLIC_"]`,
so the Studio reads the same `PUBLIC_*` variables Astro reads. **Do not add
`SANITY_STUDIO_*` duplicates.** Without that override the Studio's browser bundle sees
none of them and starts with no project id.

Read configuration through `sanity/lib/studio-env.ts`, never from `import.meta.env`
directly: it also falls back to `process.env` for the Sanity CLI, which evaluates the
config in Node where nothing is inlined.

`PUBLIC_SITE_URL` drives Presentation's `previewUrl` and the video library's
`apiBasePath`. `mediaApiBasePath()` returns a relative path when the Studio is
same-origin and an absolute one when it is not, so `/admin` is unaffected.

`sanity build` and `sanity deploy` run in **production** mode and load `.env.production`;
everything else loads `.env`. Values are inlined at build time, so deploying with the
development file bakes `localhost` into the client's Studio.

A Studio outside `/admin` calls the media API cross-origin, so add its origin to
`STUDIO_ORIGINS` (and to the bucket's own CORS rules). Empty means same-origin only.

## ISR revalidation

`output: "static"` on the Vercel adapter, with pages served from the ISR cache and
purged by a signed Sanity webhook hitting `/api/revalidate`.

Three rules are easy to break:

- **Every API route needs `export const prerender = false` AND an entry in
  `isr.exclude`** (`astro.config.mjs`). Miss the second and the route is cached like a
  page and never executes.
- **Every _page_ route needs `export const prerender = false` and NO `isr.exclude`
  entry.** A prerendered page is written to `.vercel/output/static` and served by
  `handle: filesystem`, which sits above every function — so it can never be purged, and
  the webhook's HEAD request hits a static file and does nothing. An `isr.exclude` entry
  would be the opposite mistake: it makes the route run on every request, uncached.
- **`useCdn` stays `false`**, in the Sanity integration _and_ in `loadQuery`. This is the
  one that only bites once pages render on demand: the webhook purges the ISR cache, the
  page re-renders immediately, and `apicdn` can still be serving the pre-publish
  document — so the visitor gets stale content, now cached until the next purge.

After a build, no page should be left on disk:

```bash
find .vercel/output/static -name '*.html'   # only admin/index.html
```

Because every page is on-demand, `@astrojs/sitemap` still discovers the static routes
but cannot enumerate `[slug]`. `sitemapPages()` in `src/lib/sitemap.ts` fills the gap
with one build-time query over `ROUTABLE_TYPES`, and returns two things:

- `customPages` — every repeatable document's URL, which the integration cannot find;
- `excluded` — every URL whose document has `seo.noIndex`, which the sync `filter`
  callback then drops. This is what makes `noIndex` apply to singletons too.

It is **generic on purpose**: add a repeatable type to `REPEATABLE_TYPES` in
`src/lib/routes.ts` and its pages appear in the sitemap with no change here. That is
also why this module, like `routes.ts`, imports nothing else — it runs inside
`astro.config.mjs`, in Node, outside the Astro module graph, so `sanity:client` and
`astro:*` are unavailable and it uses plain `fetch`.

It never throws: on a failed query or a missing project id it warns and returns empty.
A sitemap short one route is recoverable, a red deploy is not. The cost is that
`noIndex` is then not honoured either, which the warning says out loud.

`allPaths(slugs)` derives the whole site from `ROUTABLE_TYPES` the same way, taking
`{ work: ["aurora", …] }` and returning every path. Nothing in it names a URL.

`[slug].astro` has no `getStaticPaths`: Astro forbids it on an on-demand route. Unknown
slugs are handled by `if (!work) return new Response(null, { status: 404 })`. The upside
is that publishing a new `work` makes it reachable with no rebuild.

`resolvePaths()` in `src/pages/api/revalidate.ts` is driven by the same map, so adding a
routable document type needs no change there:

- a **site-wide** type (`SITE_WIDE_TYPES`: `settings`, `video-asset`) purges everything,
  because `Layout` wraps every page and a video can be referenced from any of them;
- a **repeatable** purges its own page, its listing (`INDEX_FOR`) and every other entry of
  its type, since one publish can reorder or retitle the whole listing;
- any other **routable** type purges its own page;
- anything else is a no-op.

Every branch also purges `AI_PATHS`. A new document type only needs a `SITE_WIDE_TYPES`
entry if `Layout` reads it.

Env vars: `SANITY_REVALIDATE_SECRET` (must match the webhook's secret) and
`VERCEL_BYPASS_TOKEN` (read from `process.env` at build time, so it has to exist in the
Vercel build environment). Full setup, including the webhook filter and projection, is
in the README.

## Video library

Videos are not Sanity assets: their bytes live in S3 or R2, and a `video-asset` document
describes each one. `sanity/plugins/video-library/` is self-contained — it imports
nothing from outside that folder, and talks to the host only through `/api/media/*` and
the config object passed to `videoLibrary()`. Keep it that way.

The credentials live on the server only. The plugin never touches the bucket, so no AWS
key ever reaches the browser.

Things that will bite:

- **`STORAGE_PROVIDER=r2`** needs `requestChecksumCalculation: "WHEN_REQUIRED"` (already
  in `storage.ts`), or presigned PUTs fail with an opaque 400.
- **`signableHeaders: new Set(["content-type"])`** in `sign-upload` is not optional: a
  presigned URL signs only `host`, so without it any payload can be stored under any
  type, `text/html` included.
- **The upload order** — object first, document last, and a failed document deletes the
  object. Reversing it leaves visibly broken assets.
- **Deleting** removes the document, the object, _and_ the poster and storyboard images.
  Sanity never collects unreferenced assets.
- **The storage key is opaque and immutable** (`videos/<id>-<slug>.<ext>`). Never derive
  it from a folder or title: that is what makes renaming a metadata patch.

`npm run check:storage` verifies a bucket end to end, `npm run check:media` the whole
API surface. Run both after touching either.

### Rendering a video

Two components, the same split as images:

|                      | Role                                                                             |
| :------------------- | :------------------------------------------------------------------------------- |
| `sanity-video.astro` | the media. `<c-video>` + `<video>`, scroll-driven playback, nothing about layout |
| `video/video.astro`  | the page builder block: a `<figure>`, padding and the caption                    |

So a video is **not** tied to being a section. Any block can embed one — give its schema a
`type: "video"` field, project it, then render the media directly:

```astro
---
import SanityVideo from "../sanity-video.astro";
---

<SanityVideo
  asset={block.video?.asset}
  autoplay
  loop
  class="h-full w-full object-cover"
/>
```

`sanity-video.astro` takes `asset`, `autoplay`, `loop`, `controls` and `class`, typed with
`VideoAsset` from `src/lib/sanity/types.ts` (derived from the query result, not the schema
type). It renders nothing when the asset or its `storageKey` is missing.

It emits `width`/`height` from the asset so the browser reserves the space, and falls back
to an inline `aspect-ratio` only when those are absent. It owns the `import("./video/video")`
side effect, so the custom element is registered once however many videos a page holds.

Playback is driven by Locomotive, not by an `IntersectionObserver`: `data-scroll-call`
fires `video:inview` on `window`, and each `c-video` filters on `detail.target === this`.
`preload="none"` plus `data-src` means nothing is fetched until the video is in view, which
is why the Preloader's `videos` option has to attach `src` itself.

## Routes

`src/lib/routes.ts` owns the document → URL map. `hrefFor(doc)` is the only place a path
is built, and paths carry a trailing slash on everything but the root — matching what
@astrojs/sitemap emits, what the build writes to disk, and what the canonical URL claims.
A purge for `/about` will not hit a page cached as `/about/`.

It imports nothing, on purpose: that is what lets the Studio bundle
(`sanity/lib/resolve.ts`), the Astro pages and the plain endpoints all consume it.

**It has twins on the GROQ side that cannot call it:** the `select()` inside
`linkProjection` and the type list in `repeatableSlugsQuery`
(`src/lib/sanity/queries.ts`) run in Sanity, not in Node, so they repeat the map by hand.
And it cannot be generated from the map either — `sanity typegen` statically evaluates
`defineQuery` template literals and resolves only same-file identifiers, so importing the
map there would make every query result `unknown` and silently break `src/lib/sanity/types.ts`.

## SEO, JSON-LD and llms.txt

`src/lib/seo/` holds everything. Nothing in it fetches: each function takes data and
returns a value, so the layout and the endpoints share the same builders.

| File               | Exports                                                          |
| :----------------- | :--------------------------------------------------------------- |
| `meta.ts`          | `buildMeta()` → the flat object `seo.astro` renders              |
| `json-ld.ts`       | `buildGraph()` → the schema.org `@graph`                         |
| `llms.ts`          | `renderLlmsIndex()`, `renderLlmsFull()`                          |
| `types.ts`         | the `SeoPage` union                                              |
| `constants.ts`     | lang, locale, OG size, author, theme colour                      |
| `url.ts`           | `canonicalUrl()`, `nodeId()`                                     |
| `text-endpoint.ts` | `originOf()`, `textResponse()` — shared by the three text routes |

`layout.astro` builds both, because it already fetches `siteSettingsQuery`. Routes pass
one prop describing what the page _is_:

```ts
page={{ type: "work", work }}
updatedAt={work?._updatedAt}
```

Do **not** make routes build the graph themselves, and do not make the layout infer the
page from the pathname — the work title, excerpt and thumbnail are not in
`siteSettingsQuery`, so that would mean a second round trip per page.

### Two rules that are not optional

**Escape before `set:html`.** `json-ld.astro` does
`JSON.stringify(graph).replace(/</g, "\\u003c")`. `set:html` does no escaping, so any
editor string containing `</script>` would break out of the tag.

**Keep stega out of machine output.** Two chokepoints, chosen by whether a human reads
the value in the Studio or a machine parses it:

- the llms endpoints pass `{ stega: false }` to `loadQuery`, so the bytes never arrive;
- `buildMeta()` and `buildGraph()` each **end** with `stegaClean()`, because the page
  queries must keep stega for Visual Editing.

Add a new machine-readable endpoint and it needs one of the two. Verify with
`PUBLIC_SANITY_VISUAL_EDITING_ENABLED=true` and grep the output for invisible
characters — a non-zero count means a chokepoint was missed.

### Prerender, deliberately split

| Route              | `prerender`           | Why                                              |
| :----------------- | :-------------------- | :----------------------------------------------- |
| `robots.txt.ts`    | default (prerendered) | no Sanity data; build time is right              |
| `llms.txt.ts`      | `false`               | must reflect published content without a rebuild |
| `llms-full.txt.ts` | `false`               | same                                             |

A prerendered route is written to `.vercel/output/static` and served by `handle:
filesystem`, which sits above every function — so it can never be revalidated, and an
`isr.exclude` entry for it would be inert. Neither llms route goes in `isr.exclude`:
excluding a route makes it run on every request, which is the opposite of what these
want. Both paths are already in `AI_PATHS` in `src/pages/api/revalidate.ts`.

Check after a build:

```bash
ls .vercel/output/static/robots.txt      # exists
ls .vercel/output/static/llms.txt        # must NOT exist
grep -n 'llms' .vercel/output/config.json  # dest: "/_isr?…"
```

### The schema side is generic on purpose

This is a boilerplate: every field is either universal or absent. `aiContent.sections`
is one list of `{ title, items[] }` rather than named `expertise` / `awards` fields, so
a studio, a portfolio and a corporate site all fit with no schema change. Two title
groups are read by `json-ld.ts` case-insensitively — `expertise`/`services`/`skills` →
`knowsAbout`, `awards`/`award`/`recognition` → `award`. Everything else is content only.

Do not add a per-page canonical field. It is the most misused field in any CMS and the
canonical is derivable with certainty from the route.

`seo.noIndex` has three consumers — the `robots` meta, the `llms.txt` filter and the
sitemap filter. Adding a fourth place that decides visibility means reading all three.

### llmsQuery

`blockTextProjection` in `src/lib/sanity/queries.ts` is a lean sibling of
`contentProjection`: no image dimensions, no LQIP, no video joins. Note the **per-block**
`pt::text(@)` rather than `pt::text(body)` — it keeps `style` and `listItem`, so an `h2`
stays a heading and a bullet keeps its marker.

**Add a block to `contentProjection` and you must add it to `blockTextProjection` too**,
or its text is invisible to every LLM. Same for `serializeBlock()` in `llms.ts`, whose
`default` case silently returns `null`.

## Starting a new project

Two jobs: wire a fresh Sanity project, then strip the demo content model. The README has
the short version for a human; this is the ordered procedure.

### Setting up

1. Sanity project created at sanity.io/manage, dataset `production`.
2. **CORS origin with credentials** for every origin that serves a Studio —
   `http://localhost:3000`, `http://localhost:3333` if you use the standalone Studio, and
   the production domain. Missing this is the single most common "the Studio won't log in".
3. Viewer token, into `SANITY_API_READ_TOKEN`.
4. `cp .env.example .env`, fill `PUBLIC_SANITY_PROJECT_ID` and the token.
5. `npm install && npx sanity schema deploy && npm run typegen`.

Only those two variables are needed to boot. The video library needs a bucket, a CDN and
its own CORS rules; ISR needs `VERCEL_BYPASS_TOKEN` **at build time** plus a webhook.

### Then

Write the first block with the _Adding a page builder block_ checklist below. `home` and
`settings` already carry the `content` / `seo` / `settings` groups, so a new block shows
up in the Studio as soon as it is registered and added to `home`'s `content` array.

## Modal

`src/components/modal/` is a generic overlay. It wraps anything, and **the slotted content
owns every visual decision** — height, position, background, padding. The component only
provides the dialog, the animation, the scroll and the accessibility.

```astro
<Modal name="menu" labelledby="menu-title">
  <div class="p-grid flex min-h-dvh flex-col bg-black text-white">
    <h2 id="menu-title">Menu</h2>
    <button type="button" data-modal-close>Close</button>
  </div>
</Modal>
```

| Prop         | Role                                                   |
| :----------- | :----------------------------------------------------- |
| `name`       | the address used to open and close it                  |
| `labelledby` | id of a heading inside — preferred                     |
| `label`      | literal `aria-label`, when there is no visible heading |
| `class`      | extra classes on the `<dialog>` itself                 |

### Opening and closing

Three ways, all equivalent:

```html
<button data-modal-open="menu">Menu</button>
<!-- delegated, any depth -->
<button data-modal-close>Close</button>
<!-- anywhere inside -->
```

```ts
events.emit("modal:open", { name: "menu" });
events.emit("modal:close", { name: "menu" });
```

```ts
document.querySelector<Modal>('c-modal[data-name="menu"]')?.toggle();
```

The open trigger is bound by **delegation on `document`**, so triggers keep working after a
swup content replacement. It emits `modal:opened` and `modal:closed` when the animation
finishes, for anything that needs to react.

### Why a native `<dialog>`

The reference implementation used `focus-trap` on a `<div>`. `<dialog>` + `showModal()`
gives more, with no dependency:

- focus is contained, and **returned to the trigger** on `close()`
- the rest of the page becomes genuinely **inert** — a focus trap only blocks Tab, it does
  not stop a screen reader's virtual cursor reaching the background
- Esc is handled by the browser
- it renders in the **top layer**, so it cannot be clipped by an ancestor or lose a z-index
  fight — which matters here, since the page scrolls inside `#scroll-wrapper`
- `aria-modal` is implied

The one thing it costs is the `cancel` event: Esc would close the dialog instantly and skip
the exit animation, so the component calls `preventDefault()` and runs its own close.

```ts
onCancel = (event: Event) => {
  event.preventDefault();
  this.close();
};
```

Styling has to undo the browser defaults — `<dialog>` ships centred, `width: fit-content`,
with a border, padding and a white background. That reset is a Tailwind class list on the
element, like everywhere else in this repo; **no component here uses a `<style>` block**.
The scrollbar hiding reuses the existing `scroll-wrapper` utility from
`src/styles/tailwind/helpers.css` rather than repeating the rules.

`::backdrop` goes through Tailwind's `backdrop:` variant, transparent by default and opt-in
per instance:

```astro
<Modal
  name="cart"
  label="Cart"
  class="…"
  style="--modal-backdrop: rgb(0 0 0 / 0.5)"
/>
```

### Animation and scroll

A clip-path wipe, matching the reference: `inset(0% 0% 100% 0%)` → `inset(0)`, `expo.out`,
0.9s in and 0.6s out, with the duration dropped to 0 under `prefers-reduced-motion`. The
clip is **set before `showModal()`**, or the panel flashes at full size for a frame.

Each modal owns its own Lenis instance for the panel, with `autoRaf: false`, driven from the
app's ticker like everything else:

```ts
onUpdate = ({ time }: { time: number }) => {
  if (this.isOpen) this.lenis?.raf(time);
};
```

It only advances while open, so a closed modal costs nothing per frame. Two calls matter on
open: `lenis.resize()`, because the wrapper had no dimensions while `display` was `none`,
and `scrollTo(0, { immediate: true })` so reopening starts at the top.

The page behind is frozen with `Scroll.stop()` and released with `Scroll.resume()` —
`resume()` exists precisely for this: `Scroll.start()` also calls `loco.resize()` and
`ScrollTrigger.refresh()`, which is far too heavy to run every time an overlay closes.

`overscroll-behavior: contain` on the scroll wrapper stops a touch scroll chaining to the
page behind.

Lenis drives real `scrollTop` rather than a transform, so `position: sticky` works inside
the panel. **Use it for the close affordance** whenever the content is taller than the
viewport — `nav.astro` does. A close button that scrolls out of reach leaves Esc as the only
way out, which is not enough on a touch device.

The menu example sets `min-h-[150dvh]` deliberately, so the scroll is visible in a fresh
clone. Drop it on a real project.

### Adding a second one

Nothing to change. Give it another `name`, point a trigger at it, and style its content.
Several modals can coexist; each listens only for its own name.

## Icons

`src/icons/` holds SVG files, imported as components. This is Astro's own SVG support
(stable since 5.7) — no integration, no dependency, nothing in `astro.config.mjs`:

```astro
---
import ArrowRight from "../icons/arrow-right.svg";
---

<ArrowRight class="w-16" aria-hidden="true" />
```

The file is **inlined** into the HTML with its `xmlns` stripped, and every attribute you
pass lands on the `<svg>`. Props are typed as `SVGAttributes`, so `astro check` catches a
typo. There is no `size` prop — that was the experimental API; use `class` or
`width`/`height`.

Three icons ship as examples, each showing one thing:

| Icon                 | Used by                             | Shows                                                                                         |
| :------------------- | :---------------------------------- | :-------------------------------------------------------------------------------------------- |
| `plus.svg`           | `accordion.astro`                   | state-driven transform — `group-data-[state=open]:rotate-45` turns it into a cross            |
| `arrow-right.svg`    | `footer.astro`, `work/[slug].astro` | one file, two directions: the work page adds `rotate-180` rather than shipping a second asset |
| `arrow-up-right.svg` | `footer.astro` socials              | the external-link convention                                                                  |

### Writing one

Keep the set visually coherent, because these are inline and inherit their surroundings:

- `viewBox="0 0 24 24"`, no `width`/`height` in the file — let the class size it
- `stroke="currentColor"` and `fill="none"`, so the icon follows the text colour and the
  light/dark theme with no extra work
- `stroke-width="1.5"`, `stroke-linecap`/`stroke-linejoin` `round`
- no `id`, no `<style>`, no hardcoded colour — an inlined `id` repeated on a page is
  invalid HTML

Add `aria-hidden="true"` whenever the icon sits next to a text label, which is every
case here. An icon that is the _only_ content of a link needs a label on the link
instead.

Because the markup is inline, CSS and GSAP can target individual paths — that is the
reason to prefer this over a sprite or an `<img>` in a motion-driven project.

### When to reach for astro-icon instead

One case: you want Iconify's catalogue by name (`<Icon name="mdi:arrow-right" />`) without
keeping files. Useful for a dashboard, rarely for a bespoke site where the icons come from
the designer. If you do add it, note that its docs recommend configuring `include` for
server output — and every page here is server-rendered, so without it the build bundles
every icon in the set. The two can coexist; the native import keeps working.

Vite also emits each SVG to `_astro/` alongside the inlined copy. They are a few hundred
bytes each and never requested.

## Preloader

`src/scripts/classes/Preloader.ts` holds the page back until the assets it is told to
wait for are ready.

### The three content options

| Option   | Default              | Waits for                                                                    |
| :------- | :------------------- | :--------------------------------------------------------------------------- |
| `images` | `true`               | every image in `document.body`, backgrounds included                         |
| `fonts`  | `true` \| `string[]` | each family, via `FontFaceObserver` — `["Satoshi"]` unless you pass an array |
| `videos` | `false`              | `canplay` on every `video[data-src]` inside the first viewport               |

`fonts` doubles as its own list: `true` uses `DEFAULT_FONTS`, an array replaces it.
Add a family there whenever you add one to `public/fonts`, or the page reveals before
it has swapped in.

`videos` is off by default, because preloading them would undo the lazy-loading the
video block relies on. Turn it on when a page opens on a video and the first frame has
to be there. It only touches videos already in the first viewport — those further down
stay lazy — and it attaches `src` itself, so `c-video` finds the source in place and
does not fetch twice.

### Passing them

Three places, each overriding the one before it:

```ts
// 1. defaults for every load, in src/scripts/index.ts
new Preloader({ fonts: ["Satoshi", "Editorial"] });

// 2. first load only
this.preloader.preloadPage({ videos: true });

// 3. after a swup navigation — called by Transition on animation:in:start
this.preloader.loadPage({ images: false });
```

Two more options exist and rarely need touching: `webComponents` (`true`, awaits every
`:not(:defined)` tag) and `timeout` (`5000`, the ceiling for fonts, videos and web
components — images are not raced).

## Sanity

The Studio is mounted at `/admin`. Schema lives in `sanity/schemaTypes/`, split by role:

- `singletons/` — one document per type (`home`, `about`, `work-index`, `settings`)
- `documents/` — repeatables (`work`)
- `objects/` — reusable objects, including every page builder block

Pages are built from a `content` array (the page builder). The front end renders it
through `src/components/page-builder.astro`, which dispatches on `_type`.

### After any schema change

```
npx sanity schema deploy   # required for Presentation and the MCP tools
npm run typegen            # regenerates sanity/sanity.types.ts
```

Never skip `typegen`: `src/lib/sanity/types.ts` derives the page builder union from the
generated query result types, so stale types silently break the dispatcher.

### Adding a document type

1. **Schema** — create `sanity/schemaTypes/documents/<name>.ts` (or `singletons/`
   for a one-off page). Export a `defineType` named `<name>Type`. Give it the
   standard `content` / `seo` / `settings` field groups if it is a page.
2. **Register** — add it to `sanity/schemaTypes/index.ts`.
3. **Structure** — add it to `sanity/structure/index.ts`. Singletons use
   `documentTypeSingletonItem(S, title, icon, type, id)`; repeatables use
   `S.documentTypeListItem(type)`.
4. **Routes** — in `src/lib/routes.ts`, add a case to `hrefFor()`, and add the type to
   `REPEATABLE_TYPES` + `INDEX_FOR` if it is a repeatable. Then mirror it on the GROQ
   side: the `select()` in `linkProjection`, and `repeatableSlugsQuery`'s type list for
   a repeatable (`src/lib/sanity/queries.ts`). They are twins — see the Routes section
   above. Everything downstream — the sitemap, `allPaths()`, `resolvePaths()` — derives
   from the map and needs no edit.
5. **References** — if pages should be able to link to it, add `{ type: "<name>" }`
   to the `to: [...]` arrays in `objects/link.ts` and `objects/page-settings.ts`.
6. **Query** — add `<name>Query` in `src/lib/sanity/queries.ts` with `defineQuery`, reusing
   `contentProjection`, `seoProjection` and `settingsProjection`. For repeatables,
   also add a `<name>SlugsQuery`.
7. **Types** — if it has a page builder, add `NonNullable<<Name>QueryResult>["content"]`
   to the `PageBuilder` union in `src/lib/sanity/types.ts`.
8. **Route** — add the page under `src/pages/`, pass `seo`, `settings`, `page` and
   `updatedAt` to `Layout`, and render `<PageBuilder content={doc?.content} />`. Add
   the type to the `SeoPage` union in `src/lib/seo/types.ts`, and a case to
   `webPageType()` in `src/lib/seo/json-ld.ts` if it deserves more than `WebPage`.
9. **Presentation** — add a location resolver in `sanity/lib/resolve.ts`.
10. **Discoverability** — add it to `llmsQuery`, or the page never reaches `/llms.txt`.
    `resolvePaths()` needs nothing unless `Layout` reads the type, in which case add it
    to `SITE_WIDE_TYPES`.
11. Deploy the schema, run typegen.

### Adding an object

1. Create `sanity/schemaTypes/objects/<name>.ts`, export `<name>Type`, register it
   in `sanity/schemaTypes/index.ts`.
2. Reference it from a field with `type: "<name>"`. That is all — a plain object
   needs no query, component or type work beyond the projection of its parent.

An `array` type cannot be an array member. If the type has to live inside another
array, wrap the array in an `object` (this is why `wysiwyg` is an object with a
`body` field rather than a bare array).

### Adding a page builder block

A block is an object with three extra steps:

1. **Schema** — `sanity/schemaTypes/objects/<name>.ts`, registered in the schema index.
   Always give it a `preview` with a meaningful `subtitle`; editors see a list of
   blocks, not fields.
2. **Enable it** — add `defineArrayMember({ type: "<name>" })` to the `content`
   field of every document that should offer it (`home`, `about`, `work`,
   `work-index`).
3. **Projection** — if the block contains images or references, add a conditional
   branch to `contentProjection` in `src/lib/sanity/queries.ts`:

   ```ts
   _type == "<name>" => {
     images[] ${imageProjection}
   }
   ```

   Without it the front end gets raw asset refs, with no dimensions or LQIP.

4. **Component** — `src/components/<name>.astro`, typed with
   `PageBuilderBlockOf<"<name>">`. Never type it with the schema type (`Slider`,
   `Accordion`, …): those describe raw documents, not query results, and lack the
   projected fields.
5. **Dispatcher** — add a `case "<name>":` to `src/components/page-builder.astro`.
6. **Text for LLMs** — if the block carries words, add a branch to
   `blockTextProjection` and a `case` to `serializeBlock()` in `src/lib/seo/llms.ts`.
   Both fail silently otherwise: the block's text just never reaches `/llms.txt`.
7. Deploy the schema, run typegen.

### Typing rules

- Reading from Sanity → derive from `*QueryResult` types.
- Writing to Sanity (migrations, functions) → use the schema types.
- GROQ returns `null` for missing fields, not `undefined`. Props are
  `T | null`, not `T | undefined`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
