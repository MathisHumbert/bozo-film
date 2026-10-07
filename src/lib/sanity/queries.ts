import { defineQuery } from "groq";

const imageProjection = `{
  ...,
  "width": asset->metadata.dimensions.width,
  "height": asset->metadata.dimensions.height,
  "lqip": asset->metadata.lqip,
}`;

const videoAssetProjection = `{
  "id": _id,
  title,
  altText,
  storageKey,
  duration,
  width,
  height,
  aspectRatio,
  "renditions": renditions[]{ width, storageKey },
  "poster": thumbnail.asset->url,
  "posterLqip": thumbnail.asset->metadata.lqip
}`;

const seoProjection = `seo{
  metaTitle,
  metaDescription,
  noIndex,
  ogImage ${imageProjection}
}`;

const linkProjection = `{
  label,
  "external": linkType == "external",
  "href": select(
    linkType == "external" => url,
    page->_type == "home" => "/",
    null
  )
}`;

export const homeQuery = defineQuery(`*[_type == "home"][0]{
  _updatedAt,
  title,
  featuredWork[]->{
    _type,
    title,
    "slug": slug.current,
    previewVideo-> ${videoAssetProjection},
    "mainDuration": mainVideo->duration
  },
  ${seoProjection}
}`);

export const allWorkQuery = defineQuery(
  `*[_type == "work"] | order(_createdAt desc){
    _type,
    title,
    titleLeft,
    titleRight,
    "slug": slug.current,
    previewVideo-> ${videoAssetProjection}
  }`,
);

const mediaProjection = `media[]{
  _type,
  _type == "image" => ${imageProjection},
  _type == "video" => {
    asset-> ${videoAssetProjection},
    caption,
    autoplay,
    loop,
    controls
  }
}`;

export const workBySlugQuery =
  defineQuery(`*[_type == "work" && slug.current == $slug][0]{
  _updatedAt,
  title,
  category,
  roles,
  previewVideo-> ${videoAssetProjection},
  mainVideo-> ${videoAssetProjection},
  ${mediaProjection},
  ${seoProjection}
}`);

export const aboutQuery = defineQuery(`*[_type == "about"][0]{
  _updatedAt,
  title,
  description,
  services,
  clients,
  socialLinks[] ${linkProjection},
  contact{ email, phone },
  images[] ${imageProjection},
  reel{
    textTop,
    preview-> ${videoAssetProjection},
    main-> ${videoAssetProjection},
    textBottom
  },
  ${seoProjection}
}`);

export const siteSettingsQuery = defineQuery(`*[_type == "settings"][0]{
  showPreloader,
  nav[] ${linkProjection},
  siteIdentity{
    entityType,
    name,
    alternateName,
    jobTitle,
    email,
    sameAs,
    logo{
      "url": asset->url,
      "width": asset->metadata.dimensions.width,
      "height": asset->metadata.dimensions.height
    }
  },
  aiContent{
    summary,
    sections[]{ title, items }
  },
  fallbackSEO{
    metaTitle,
    metaDescription,
    ogImage ${imageProjection}
  }
}`);

const llmsPageProjection = `{
  "type": _type,
  _updatedAt,
  title,
  seo{ metaTitle, metaDescription, noIndex }
}`;

export const llmsQuery = defineQuery(`{
  "settings": *[_type == "settings"][0]{
    siteIdentity{ entityType, name, jobTitle, email, sameAs },
    aiContent{ summary, sections[]{ title, items } },
    fallbackSEO{ metaTitle, metaDescription }
  },
  "home": *[_type == "home"][0] ${llmsPageProjection},
  "about": *[_type == "about"][0] ${llmsPageProjection}
}`);
