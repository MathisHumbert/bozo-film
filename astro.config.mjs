// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import vercel from "@astrojs/vercel";
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

const SITE_URL = "https://astro-creative-boilerplate.vercel.app";

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

  server: {
    port: 3000,
  },

  adapter: vercel({
    isr: {
      // Read from process.env, not import.meta.env: this runs at build time.
      bypassToken: process.env.VERCEL_BYPASS_TOKEN,
      // An excluded route runs on every request. Without this the endpoints
      // would be cached like a page and never execute.
      exclude: [
        "/api/revalidate",
        "/api/media/sign-upload",
        "/api/media/delete",
        "/api/media/list",
        "/api/media/config",
      ],
    },
  }),

  integrations: [
    sitemap({
      // /admin is an app, not content. `excluded` holds the noIndex pages.
      filter: (page) => !page.includes("/admin") && !excluded.has(page),
      customPages,
    }),
    sanity({
      projectId: PUBLIC_SANITY_PROJECT_ID,
      dataset: PUBLIC_SANITY_DATASET,
      // Leave this off: the CDN would keep serving stale content straight
      // after a revalidation.
      useCdn: false,
      apiVersion: SANITY_API_VERSION,
      studioBasePath: "/admin",
      stega: {
        studioUrl: "/admin",
      },
    }),
    react(),
  ],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ["@sanity/visual-editing/react", "@sanity/mutate"],
    },
  },
});
