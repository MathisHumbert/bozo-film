import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { presentationTool } from "sanity/presentation";
import { media } from "sanity-plugin-media";

import { schema } from "./sanity/schemaTypes";
import { resolve } from "./sanity/lib/resolve";
import {
  cdnUrl,
  dataset,
  mediaApiBasePath,
  projectId,
  siteUrl,
} from "./sanity/lib/studio-env";
import { structure } from "./sanity/structure";
import { videoLibrary } from "./sanity/plugins/video-library";

export default defineConfig({
  title: "Astro Creative Boilerplate",
  projectId: projectId(),
  dataset: dataset(),
  plugins: [
    structureTool({ structure }),
    presentationTool({
      resolve,
      // The site's own origin when embedded at /admin, SANITY_STUDIO_SITE_URL
      // when the Studio is served on its own.
      previewUrl: siteUrl(),
    }),
    media(),
    videoLibrary({
      apiBasePath: mediaApiBasePath(),
      cdnUrl: cdnUrl(),
    }),
  ],
  schema,
  document: {
    // Video assets are created by the library tool, never by hand: one made
    // from this menu would have no stored object behind it.
    newDocumentOptions: (prev) =>
      prev.filter((item) => item.templateId !== "video-asset"),
  },
});
