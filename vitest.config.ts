/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

// Astro's own Vite config, so `astro:*` modules and import.meta.env resolve as
// they do in the app.
export default getViteConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
