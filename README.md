# Astro Creative Boilerplate

A stripped starting point: Astro 7, Sanity v6, Tailwind v4, GSAP and Locomotive Scroll,
with the SEO, structured data, `llms.txt`, ISR and video-library plumbing already wired.

No demo sections. `home` and `settings` are the only page documents; `video` and `wysiwyg`
are the only page builder blocks. Everything else is infrastructure, ready to build on.

> Coming from the full boilerplate? The demo sections, the `work` case-study model and the
> `/clean-demo` command live there. This repo is the result of running it.

## Run it right now

No Sanity account, no `.env`, nothing to configure:

```sh
npm install
npm run dev
```

The home page renders a placeholder hero telling you what to set up next. Every Sanity
query is skipped, the Studio is not mounted, and `/llms.txt` returns 404 — the rest of the
site, including the SEO head, the JSON-LD and `/robots.txt`, works.

The nav and the footer hide themselves while they have nothing to show, so what you get is
the hero alone. Fill `nav` or any footer field in **Settings** and they appear.

Connect Sanity when you are ready, with the five steps below. The page switches to the real
content as soon as the Home document has blocks.

## Getting started

Five steps, about ten minutes.

**1. Create the Sanity project** — on [sanity.io/manage](https://sanity.io/manage):
new project, dataset `production`, and note the **Project ID**.

**2. Allow this origin** — same page, _API → CORS origins_: add
`http://localhost:3000` **with credentials**. Without it the Studio cannot log in.

**3. Create a read token** — _API → Tokens_, **Viewer** role. Needed for Visual Editing.

**4. Fill the environment**

```sh
cp .env.example .env
```

Only two values are required to boot: `PUBLIC_SANITY_PROJECT_ID` and
`SANITY_API_READ_TOKEN`. Everything else is grouped by feature in the file, and the
video library and ISR sections can stay empty for now.

**5. Install, push the schema, run**

```sh
npm install
npx sanity schema deploy   # required for Presentation and the MCP tools
npm run typegen            # generates sanity/sanity.types.ts
npm run dev                # http://localhost:3000, Studio on /admin
```

The dataset is empty at this point, so the home page shows a placeholder hero telling you
so. Open `/admin`, add blocks to the Home document, and they render through the page
builder.

When you get to the optional pieces: [video library](#video-library) also needs a bucket
and a CDN, and [ISR revalidation](#isr-revalidation) needs a webhook. Both have their own
section.

## Commands

| Command                    | Action                                                                        |
| :------------------------- | :---------------------------------------------------------------------------- |
| `npm run dev`              | Site on `localhost:3000`, Studio on `/admin`                                  |
| `npm run dev:sanity`       | Standalone Studio on `localhost:3333`                                         |
| `npm run dev:all`          | Both at once                                                                  |
| `npm run build`            | Production build to `.vercel/output`                                          |
| `npx vercel dev`           | Run the build locally — `astro preview` does not work with the Vercel adapter |
| `npm run typegen`          | Extract the schema and regenerate `sanity/sanity.types.ts`                    |
| `npx sanity schema deploy` | Publish the schema (needed for Presentation and MCP)                          |
| `npm run deploy:sanity`    | Deploy the Studio to `<host>.sanity.studio`                                   |
| `npm run check:storage`    | Verify the bucket, credentials and CDN end to end                             |
| `npm run check:media`      | Verify `/api/media/*`: auth, signing, upload, delivery, deletion              |
| `npm run format`           | Prettier over the repo (`format:check` in CI)                                 |

## Project structure

```text
sanity/
├── schemaTypes/
│   ├── singletons/     home, settings
│   ├── documents/      video-asset
│   ├── objects/        hero, heading-text, slider, accordion, wysiwyg,
│   └── index.ts        schema registry
│   │                   seo, page-settings, link, video
├── plugins/
│   └── video-library/  the Videos tool: upload, grid, tags, deletion
├── structure/          Studio desk structure
├── lib/
│   ├── resolve.ts      Presentation document locations
│   └── studio-env.ts   config shared by both Studios
└── sanity.types.ts     generated — do not edit

src/
├── components/         page-builder.astro + one component per block
│                       plus seo.astro and json-ld.astro
├── icons/              SVG files, imported as components
├── layouts/            layout.astro (nav, footer, head, theme)
├── lib/
│   ├── routes.ts       the document → URL map, imported by everything
│   ├── sitemap.ts      build-time page list for @astrojs/sitemap
│   ├── sanity/
│   │   ├── queries.ts      GROQ queries and shared projections
│   │   ├── types.ts        types derived from the generated query results
│   │   ├── load-query.ts   fetch wrapper (perspective, stega, token)
│   │   └── url-for-image.ts image URL builder
│   ├── seo/
│   │   ├── meta.ts         buildMeta() — every tag the head renders
│   │   ├── json-ld.ts      buildGraph() — the schema.org @graph
│   │   ├── llms.ts         the llms.txt serializers
│   │   ├── types.ts        the SeoPage union
│   │   └── constants.ts    lang, locale, OG size, author, theme colour
│   └── video-library/  storage client, auth guard, object keys, CDN URLs
├── pages/
│   ├── robots.txt.ts   prerendered, AI crawlers allowed
│   ├── llms.txt.ts     the AI index, revalidated by ISR
│   ├── llms-full.txt.ts every page as plain text
│   ├── api/media/      presigned uploads, deletion, listing
│   └── api/revalidate  the ISR purge webhook
└── scripts/            app runtime: Scroll, Preloader, Transition, Device
```

## How a page renders

Every page document holds three fields:

- `content` — the page builder array
- `seo` — per-page metadata, falling back to `settings.fallbackSEO`
- `settings` — theme, footer toggle, and the footer's "next page" link

A route loads its query, hands `seo` and `settings` to `Layout`, and passes
`content` to the page builder. Two extra props feed the structured data — `page`
says what the page _is_, `updatedAt` gives it a `dateModified`:

```astro
const home = await loadQuery(homeQuery);

<Layout
  seo={home?.seo}
  settings={home?.settings}
  page={{ type: "home" }}
  updatedAt={home?._updatedAt}
>
  <PageBuilder content={home?.content} />
</Layout>
```

Omitting `page` is safe: the page still gets a full head and a `WebPage` node, it
just loses the breadcrumb and the page-specific node.

`page-builder.astro` switches on `_type` and renders the matching component. The
`switch` is deliberate: TypeScript narrows each case, so every component is checked
against its real props and a missing case is visible.

## Deploying to Vercel

### 1. Import the repo

Vercel detects Astro on its own. The adapter outputs `.vercel/output`, so leave the
build command and output directory alone.

### 2. Environment variables

Add every variable from `.env` to **all three environments** (Production, Preview,
Development), with production values:

| Variable                                            | Notes                                                                  |
| :-------------------------------------------------- | :--------------------------------------------------------------------- |
| `PUBLIC_SANITY_PROJECT_ID`, `PUBLIC_SANITY_DATASET` |                                                                        |
| `PUBLIC_SANITY_VISUAL_EDITING_ENABLED`              | `false` in Production, `true` in Preview if you want overlays          |
| `SANITY_API_READ_TOKEN`                             | required whenever Visual Editing is on                                 |
| `PUBLIC_SITE_URL`                                   | the production origin, e.g. `https://example.com`                      |
| `SANITY_REVALIDATE_SECRET`                          | same value as the Sanity webhook's secret                              |
| `VERCEL_BYPASS_TOKEN`                               | **must be available at build time** — it is read in `astro.config.mjs` |
| `STORAGE_*`, `R2_ACCOUNT_ID`                        | bucket credentials, never prefixed `PUBLIC_`                           |
| `PUBLIC_CDN_URL`                                    | where the videos are served from                                       |
| `STUDIO_ORIGINS`                                    | only if a Studio is served outside `/admin`                            |

`VERCEL_BYPASS_TOKEN` is the one that fails silently: it is used by the adapter while
building, so a variable scoped to runtime only leaves ISR without a purge key.

### 3. Set the site URL

`astro.config.mjs` carries `site`. Point it at the production domain before the first
deploy — the sitemap and canonical URLs are built from it.

### 4. Wire the revalidation webhook

Once the domain resolves, create the Sanity webhook described in
[ISR revalidation](#isr-revalidation). Publish a document and check the webhook's
**Attempts** tab for a 200.

### 5. Allow the origins

- **Sanity** — Manage → API → CORS origins: add the production domain (and any preview
  domain you use) with credentials, or the Studio at `/admin` cannot read the dataset.
- **The bucket** — add the same origins to its CORS rules. The browser PUTs straight to
  the bucket, so the site's own domain has to be listed.

### What runs where

Pages and the two `llms.txt` endpoints are cached by ISR; `/api/*` runs on every request;
`robots.txt` and the Studio are static files. Getting that split wrong is silent, so the
rules are spelled out in [AGENTS.md](AGENTS.md#isr-revalidation).

## Running the Studio

Three places, one `sanity.config.ts`:

|                       | Command                 | URL                    |
| :-------------------- | :---------------------- | :--------------------- |
| Embedded in the site  | `npm run dev`           | `localhost:3000/admin` |
| Standalone            | `npm run dev:sanity`    | `localhost:3333`       |
| Both at once          | `npm run dev:all`       |                        |
| Deployed for a client | `npm run deploy:sanity` | `<host>.sanity.studio` |

Nothing is declared twice: the Studio reads the same `PUBLIC_*` variables Astro reads.

### Deploying it for a client

`sanity deploy` builds locally and uploads, so **the values baked in are the ones on your
machine**. The CLI loads `.env.production` for `build` and `deploy`, and `.env` for
everything else — so production values go in `.env.production`, or the deployed Studio
points Presentation and the media API at `localhost:3000`:

```sh
# .env.production — gitignored
PUBLIC_SANITY_PROJECT_ID="…"
PUBLIC_SANITY_DATASET="production"
PUBLIC_SITE_URL="https://your-domain.com"
PUBLIC_CDN_URL="https://…"
```

The first deploy asks for a hostname and writes it to `sanity.cli.ts`; later ones reuse it.

Then allow the new origin in two places — Sanity's CORS settings, and:

```sh
STUDIO_ORIGINS="https://<host>.sanity.studio"
```

A Studio outside `/admin` calls `/api/media/*` cross-origin, which is what that variable
permits; the bucket needs the same origins in its own CORS rules. **Staying at `/admin`
avoids all of it** — same-origin needs no CORS and the session token is already there. A
subdomain pointing at the same Vercel deployment gives a client their own URL while
staying same-origin.

Why the env plumbing works the way it does is in
[AGENTS.md](AGENTS.md#running-the-studio).

## ISR revalidation

Pages are rendered on demand and served from Vercel's ISR cache until a signed Sanity
webhook purges them. Publishing in the Studio updates the site without a rebuild.

### Setting it up

Two variables, both in `.env` **and** in all three Vercel environments:

```sh
SANITY_REVALIDATE_SECRET=   # openssl rand -hex 32
VERCEL_BYPASS_TOKEN=        # openssl rand -hex 32
```

`VERCEL_BYPASS_TOKEN` is read **at build time**, so a runtime-only variable leaves ISR with
no purge key.

Then Sanity Manage → API → **Webhooks** → Create webhook:

- **URL** — `https://<domain>/api/revalidate`
- **Trigger on** — Create, Update, Delete
- **Filter** — `_type in ["home", "about", "work-index", "work", "settings", "video-asset"]`
- **Projection** — `{_type, "slug": slug.current}`
- **Secret** — the same value as `SANITY_REVALIDATE_SECRET`

Keep the filter in sync with your document types. The projection matters: the endpoint
reads only `_type` and `slug`.

### Checking it

Publish a change, then confirm the webhook shows a `200` in its delivery log and the page
reflects it without a redeploy. Locally the endpoint returns `500` — `VERCEL_BYPASS_TOKEN`
lives in `process.env`, which Vite does not populate in dev, and there is no ISR cache to
purge anyway.

Which paths each document type purges, and the prerender rules that make this work at all,
are in [AGENTS.md](AGENTS.md#isr-revalidation).

## SEO, structured data and llms.txt

Four outputs, all driven from Sanity: the `<head>`, a schema.org `@graph`,
`/llms.txt` + `/llms-full.txt` for AI crawlers, and `/robots.txt`.

**What you fill, once per project** — in **Settings**:

- **Site identity** — `entityType` (organization or person), `name`, `logo`, `email`,
  `sameAs`. This becomes the `Organization` or `Person` node that the whole graph points
  at. **Leave `name` empty and there is no identity node at all**, so fill it first.
- **SEO & AI** — `fallbackSEO` for pages that leave a field blank, plus `aiContent`:
  a `summary` (the blockquote at the top of `llms.txt`) and `sections`, a generic list of
  `{ title, items[] }`. A studio fills _Services_, a portfolio fills _Expertise_, a
  corporate site fills _Markets_ — no schema change either way, and an unused section
  renders nothing.

Name a section `expertise` / `services` / `skills` and its items also feed `knowsAbout` in
the structured data; `awards` / `award` / `recognition` feed `award`. Any other title is
content only.

**Per page** — `seo` holds `metaTitle`, `metaDescription`, `ogImage` and `noIndex`. That
one boolean drives the `robots` meta, the sitemap and the `llms.txt` filter at once. There
is deliberately no canonical override: it is derived from the route, so nobody can
de-index a page by pasting the wrong URL.

`sameAs` is separate from the footer socials on purpose — socials are presentational and
can be internal, while `sameAs` holds the profiles that reconcile the entity. Both lists
are merged and deduped for you.

Nothing else needs configuring. How the graph is built, how stega is kept out of
machine-readable output and which routes are prerendered are in
[AGENTS.md](AGENTS.md#seo-json-ld-and-llmstxt).

## Video library

Images stay Sanity assets. **Videos do not**: their bytes live in an S3 or R2 bucket behind
a CDN, and a `video-asset` document describes each one — title, poster, duration,
dimensions, tags. A bucket alone cannot answer "what is this called" or "which pages use
it"; that is what the catalogue is for.

Uploads happen in the **Videos** tool in the Studio, never from a document field.

### Setting it up

1. Create the bucket, and a CDN in front of it (CloudFront, or R2's public domain).
2. Restrict the bucket's **CORS** to the origins that serve a Studio. Do not leave `*`.
3. Create an access key limited to that bucket.
4. Fill the storage block in `.env`, then `npm run check:storage` to verify the bucket end
   to end and `npm run check:media` for the API surface.

```sh
STORAGE_PROVIDER=s3     # or r2, then also set R2_ACCOUNT_ID
```

R2 speaks the S3 API, so that one switch is the whole difference.

If a Studio is served outside `/admin`, add its origin to `STUDIO_ORIGINS` as well — it
then calls the media API cross-origin.

### What to know

The credentials live on the server only. The plugin talks to `/api/media/*`, so **no AWS
key ever reaches the browser**.

The browser reads the duration and dimensions from an off-screen `<video>`, captures a
poster and a 10-frame storyboard, then PUTs the file straight to the bucket — it never
transits the server. The document is created last, and a failure deletes the object.

Storage keys are opaque and immutable (`videos/3f2a9c81-hero-cut.mp4`), which is what makes
renaming or moving an asset a metadata patch with no re-upload — and why every object is
stored with a one-year `immutable` Cache-Control.

After the original, the browser encodes 1920, 1280 and 640-wide copies (only those
smaller than the original) and stores them beside it. Pages choose one per breakpoint with
`<SanityVideo quality="1280 md:1920">`. Assets uploaded before this, or whose encode
failed, get theirs from **Generate renditions** in the Videos tool. Encoding uses
WebCodecs; a browser without an H.264/AAC encoder still uploads, just without renditions.

Deleting removes the document, the object, **and** the poster and storyboard images —
Sanity never collects unreferenced assets. A video referenced by a page cannot be deleted:
the reference is strong, so Sanity refuses and the bucket is left untouched.

The full architecture, the R2 checksum workaround and the presigned content-type rule are
in [AGENTS.md](AGENTS.md#video-library).

## Modal

A generic overlay in `src/components/modal/`. It wraps anything — a menu, a cart, a filter
panel — and **the content inside owns the height, position, background and padding**. The
component only supplies the dialog, the clip-path animation, the smooth scroll and the
accessibility.

```astro
<Modal name="menu" labelledby="menu-title">
  <div class="p-grid flex min-h-dvh flex-col bg-black text-white">
    <h2 id="menu-title">Menu</h2>
    <button type="button" data-modal-close>Close</button>
  </div>
</Modal>
```

```html
<button data-modal-open="menu">Menu</button>
```

That is the whole API. `nav.astro` uses it as the mobile menu.

It is a native `<dialog>` opened with `showModal()`, so focus is contained and returned to
the trigger, the page behind is genuinely inert, and Esc works — no `focus-trap`
dependency. Each modal has its own Lenis instance for scrolling inside, and the page behind
is frozen while it is open. Reasoning and the full API are in
[AGENTS.md](AGENTS.md#modal).

## Icons

SVG files in `src/icons/`, imported as components. This is Astro's own SVG support — no
dependency, nothing to configure:

```astro
---
import ArrowRight from "../icons/arrow-right.svg";
---

<ArrowRight class="w-16" aria-hidden="true" />
```

The SVG is inlined, so it inherits the text colour through `stroke="currentColor"` and CSS
or GSAP can animate individual paths. Any attribute you pass lands on the `<svg>`.

Three ship as working examples: `plus.svg` in the accordion, `arrow-right.svg` in the
footer and on the work page (rotated 180°, rather than a second file), and
`arrow-up-right.svg` for external links.

Drawing conventions and the case for `astro-icon` instead are in
[AGENTS.md](AGENTS.md#icons).

## Preloader

`src/scripts/classes/Preloader.ts` holds the page back until the assets you name are ready.

| Option   | Default              | Waits for                                                                 |
| :------- | :------------------- | :------------------------------------------------------------------------ |
| `images` | `true`               | every image in `document.body`, backgrounds included                      |
| `fonts`  | `true` \| `string[]` | each family via `FontFaceObserver` — `["Satoshi"]` unless you pass a list |
| `videos` | `false`              | `canplay` on every `video[data-src]` in the first viewport                |

`fonts` doubles as its own list, so **add a family there whenever you add one to
`public/fonts`** or the page reveals before it has swapped in.

`videos` is off by default because preloading would undo the lazy-loading the video block
relies on. Turn it on when a page opens on a video.

Three places to pass options, each overriding the previous:

```ts
new Preloader({ fonts: ["Satoshi", "Editorial"] }); // defaults, src/scripts/index.ts
this.preloader.preloadPage({ videos: true }); // first load only
this.preloader.loadPage({ images: false }); // after a swup navigation
```

Two further options rarely need touching: `webComponents` and `timeout`. Details in
[AGENTS.md](AGENTS.md#preloader).

## Going deeper

[DETAILED_README.md](DETAILED_README.md) is the long version: how a request renders end to
end, the type pipeline, the caching tiers, the front-end runtime, and the reasoning behind
the decisions that are not obvious from the code.

## Extending it

Adding a document type, an object or a page builder block each touch several registries,
in an order that matters. The checklists live in
**[AGENTS.md](AGENTS.md#sanity)** — one file, kept next to the rules it depends on, and
the one to hand an agent.

Two rules worth knowing before you start:

```sh
npx sanity schema deploy   # after ANY schema change — Presentation and MCP read this
npm run typegen            # regenerates sanity/sanity.types.ts
```

Skipping `typegen` does not fail loudly: `src/lib/sanity/types.ts` derives the page
builder union from the generated query results, so a stale file silently breaks the
dispatcher.

And when you type a component, derive from the **query result** (`PageBuilderBlockOf<"…">`),
never from the schema type. They diverge as soon as there is a projection, and GROQ returns
`null` where the schema says `undefined`.
