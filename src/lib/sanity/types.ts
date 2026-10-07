import type {
  HomeQueryResult,
  SiteSettingsQueryResult,
} from "../../../sanity/sanity.types";

export interface VideoAsset {
  id: string;
  title: string | null;
  altText: string | null;
  storageKey: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  renditions: { width: number | null; storageKey: string | null }[] | null;
  poster: string | null;
  posterLqip: string | null;
}

export type SeoFields = NonNullable<HomeQueryResult>["seo"];
export type SiteSettings = SiteSettingsQueryResult;
