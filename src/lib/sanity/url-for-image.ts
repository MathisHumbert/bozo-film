import {
  createImageUrlBuilder,
  type SanityImageSource,
} from "@sanity/image-url";

export const imageBuilder = createImageUrlBuilder({
  projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID ?? "",
  dataset: import.meta.env.PUBLIC_SANITY_DATASET ?? "",
});

export function urlForImage(source: SanityImageSource) {
  return imageBuilder.image(source);
}
