import { EarthGlobeIcon } from "@sanity/icons/EarthGlobe";
import { ImagesIcon } from "@sanity/icons/Images";
import { TiersIcon } from "@sanity/icons/Tiers";
import { defineArrayMember, defineField, defineType } from "sanity";

export const photoType = defineType({
  name: "photo",
  title: "Photo",
  type: "document",
  icon: ImagesIcon,
  groups: [
    { name: "content", title: "Content", icon: TiersIcon, default: true },
    { name: "seo", title: "SEO", icon: EarthGlobeIcon },
  ],
  fields: [
    defineField({
      name: "title",
      title: "Title",
      description:
        "Rendered as the page's H1. Separate from the SEO meta title.",
      type: "string",
      group: "content",
    }),
    defineField({
      name: "images",
      title: "Images",
      description:
        "Shown in this order on the page. Drag to reorder. The count appears next to Photo in the menu.",
      type: "array",
      group: "content",
      options: { layout: "grid" },
      of: [
        defineArrayMember({
          type: "image",
          title: "Image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "Alternative text",
              description: "Describes the image for screen readers and search.",
              type: "string",
            }),
          ],
        }),
      ],
    }),
    defineField({ name: "seo", title: "SEO", type: "seo", group: "seo" }),
  ],
  preview: { prepare: () => ({ title: "Photo" }) },
});
