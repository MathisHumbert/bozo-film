import type { SchemaTypeDefinition } from "sanity";

// singletons
import { homeType } from "./singletons/home";
import { settingsType } from "./singletons/settings";

// documents
import { videoAssetType } from "./documents/video-asset";

// objects
import { linkType } from "./objects/link";
import { pageSettingsType } from "./objects/page-settings";
import { seoType } from "./objects/seo";
import { videoType } from "./objects/video";
import { wysiwygType } from "./objects/wysiwyg";

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [
    homeType,
    settingsType,
    videoAssetType,
    linkType,
    pageSettingsType,
    seoType,
    videoType,
    wysiwygType,
  ],
};
