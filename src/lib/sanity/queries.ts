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
  "poster": thumbnail.asset->url,
  "posterLqip": thumbnail.asset->metadata.lqip
}`;

const contentProjection = `content[]{
  ...,
  _type == "video" => {
    asset-> ${videoAssetProjection}
  },
  _type == "wysiwyg" => {
    body[]{
      ...,
      _type == "image" => ${imageProjection}
    }
  }
}`;

const seoProjection = `seo{
  metaTitle,
  metaDescription,
  noIndex,
  ogImage ${imageProjection}
}`;

const settingsProjection = `settings{
  theme,
  showFooter,
  footerPage->{ _type, "slug": slug.current }
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
  ${contentProjection},
  ${seoProjection},
  ${settingsProjection}
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
  footer{
    heading,
    copyright,
    links[] ${linkProjection},
    socials[] ${linkProjection}
  },
  fallbackSEO{
    metaTitle,
    metaDescription,
    ogImage ${imageProjection}
  }
}`);

const blockTextProjection = `content[]{
  _type,
  _type == "video" => { caption, "videoTitle": asset->title },
  _type == "wysiwyg" => {
    "blocks": body[_type == "block"]{ style, listItem, "text": pt::text(@) }
  }
}`;

const llmsPageProjection = `{
  "type": _type,
  _updatedAt,
  seo{ metaTitle, metaDescription, noIndex },
  ${blockTextProjection}
}`;

export const llmsQuery = defineQuery(`{
  "settings": *[_type == "settings"][0]{
    siteIdentity{ entityType, name, jobTitle, email, sameAs },
    aiContent{ summary, sections[]{ title, items } },
    fallbackSEO{ metaTitle, metaDescription },
    footer{ socials[] ${linkProjection} }
  },
  "home": *[_type == "home"][0] ${llmsPageProjection}
}`);
