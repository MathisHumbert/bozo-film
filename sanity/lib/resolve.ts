import { defineLocations } from "sanity/presentation";
import type { PresentationPluginOptions } from "sanity/presentation";

import { hrefFor } from "../../src/lib/routes";

export const resolve: PresentationPluginOptions["resolve"] = {
  locations: {
    home: defineLocations({
      locations: [{ title: "Home", href: hrefFor({ _type: "home" })! }],
    }),
  },
};
