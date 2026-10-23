import type { SchemaTypeDefinition } from "sanity";

// singletons
import { aboutType } from "./singletons/about";
import { homeType } from "./singletons/home";
import { photoType } from "./singletons/photo";
import { settingsType } from "./singletons/settings";

// documents
import { videoAssetType } from "./documents/video-asset";
import { workType } from "./documents/work";

// objects
import { linkType } from "./objects/link";
import { seoType } from "./objects/seo";
import { videoType } from "./objects/video";

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [
    aboutType,
    homeType,
    photoType,
    settingsType,
    videoAssetType,
    workType,
    linkType,
    seoType,
    videoType,
  ],
};
