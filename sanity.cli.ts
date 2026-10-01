import { defineCliConfig } from "sanity/cli";

import { dataset, projectId } from "./sanity/lib/studio-env";

export default defineCliConfig({
  api: {
    projectId: projectId(),
    dataset: dataset(),
  },

  // The Studio's Vite build only exposes SANITY_STUDIO_* to the browser by
  // default. Adding PUBLIC_ lets it read the same variables Astro reads, so
  // nothing has to be declared twice.
  vite: (config) => ({
    ...config,
    envPrefix: ["SANITY_STUDIO_", "PUBLIC_"],
  }),

  schemaExtraction: {
    path: "./sanity/schema.json",
  },
  typegen: {
    path: ["./src/**/*.{ts,tsx,js,jsx,astro}", "./sanity/**/*.ts"],
    schema: "./sanity/schema.json",
    generates: "./sanity/sanity.types.ts",
  },
});
