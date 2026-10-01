import type {
  HomeQueryResult,
  SiteSettingsQueryResult,
} from "../../../sanity/sanity.types";

export type PageBuilder = NonNullable<NonNullable<HomeQueryResult>["content"]>;

export type PageBuilderBlock = PageBuilder[number];

export type PageBuilderBlockOf<T extends PageBuilderBlock["_type"]> = Extract<
  PageBuilderBlock,
  { _type: T }
>;

export type VideoAsset = NonNullable<PageBuilderBlockOf<"video">["asset"]>;

export type SeoFields = NonNullable<HomeQueryResult>["seo"];
export type PageSettings = NonNullable<HomeQueryResult>["settings"];
export type SiteSettings = SiteSettingsQueryResult;
