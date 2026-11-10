// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";
import { cacheCloudflare } from "@astrojs/cloudflare/cache";
import sitemap from "@astrojs/sitemap";
import sanity from "@sanity/astro";

import tailwindcss from "@tailwindcss/vite";

import { loadEnv } from "vite";

import { sitemapPages } from "./src/lib/sitemap";

const { PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET } = loadEnv(
  process.env.NODE_ENV ?? "development",
  process.cwd(),
  "",
);

// The canonical, the sitemap, robots.txt and llms.txt are all built from this.
const SITE_URL = "https://bozo-film.vercel.app";

// Insert the current date to access the latest version of the API.
const SANITY_API_VERSION = "2025-01-28";

// Every page renders on demand, so @astrojs/sitemap discovers the static routes but
// not the dynamic ones — it cannot enumerate `[slug]`. One build-time query fills
// both gaps: it lists every routable document, so repeatables become `customPages`
// and anything marked `seo.noIndex` is dropped by `filter`. It never throws: a
// sitemap short one route is recoverable, a red deploy is not.
const { customPages, excluded } = await sitemapPages({
  site: SITE_URL,
  projectId: PUBLIC_SANITY_PROJECT_ID,
  dataset: PUBLIC_SANITY_DATASET,
  apiVersion: SANITY_API_VERSION,
});

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,

  output: "static",

  // A few KiB in all: inlined, the CSS no longer blocks the first paint on
  // two extra requests.
  build: {
    inlineStylesheets: "always",
  },

  server: {
    port: 3000,
  },

  devToolbar: {
    enabled: false
  },

  // A Cloudflare Worker. Images come from Sanity's CDN, so Astro's image
  // service has nothing to do: passthrough skips the IMAGES binding. Left out
  // under Vitest, which reuses this config (vitest.config.ts) and would
  // otherwise run the tests inside workerd.
  adapter: process.env.VITEST
    ? undefined
    : cloudflare({
        imageService: "passthrough",
      }),

  // Nothing here uses Astro sessions: no KV namespace to provision.
  session: false,

  // Cloudflare's Workers Cache sits in front of the Worker. `src/middleware.ts`
  // decides what it keeps (every published page, until the Sanity webhook purges
  // it through `/api/revalidate`); anything else is sent `no-store` by the adapter.
  cache: {
    provider: cacheCloudflare(),
  },

  integrations: [
    sitemap({
      // /admin is an app, not content. `excluded` holds the noIndex pages.
      filter: (page) => !page.includes("/admin") && !excluded.has(page),
      customPages,
    }),
    sanity({
      // The integration's middleware builds a client on every request, so it needs
      // a syntactically valid id even when the project is not configured yet.
      // Nothing ever queries with it: loadQuery returns null without a real id.
      projectId: PUBLIC_SANITY_PROJECT_ID || "placeholder",
      dataset: PUBLIC_SANITY_DATASET || "production",
      // Leave this off: the CDN would keep serving stale content straight
      // after a revalidation.
      useCdn: false,
      apiVersion: SANITY_API_VERSION,
      // No project id yet: skip the Studio so the site runs without Sanity.
      ...(PUBLIC_SANITY_PROJECT_ID ? { studioBasePath: "/admin" } : {}),
      stega: {
        studioUrl: "/admin",
      },
    }),
    react(),
  ],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      // Reached only through components' lazy import(): bundled up front, or
      // finding them mid-session re-optimises and 504s ("Outdated Optimize
      // Dep"), and the custom element that needs them never loads.
      include: [
        "@sanity/visual-editing/react",
        "@sanity/mutate",
        "lenis/snap",
        "gsap/SplitText",
        "@swup/parallel-plugin",
      ],
    },
  },
});
