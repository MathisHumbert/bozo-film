import { CogIcon } from "@sanity/icons/Cog";
import { DocumentIcon } from "@sanity/icons/Document";
import { EarthGlobeIcon } from "@sanity/icons/EarthGlobe";
import { TiersIcon } from "@sanity/icons/Tiers";
import { defineArrayMember, defineField, defineType } from "sanity";

export const homeType = defineType({
  name: "home",
  title: "Home",
  type: "document",
  icon: DocumentIcon,
  groups: [
    { name: "content", title: "Content", icon: TiersIcon, default: true },
    { name: "seo", title: "SEO", icon: EarthGlobeIcon },
    { name: "settings", title: "Settings", icon: CogIcon },
  ],
  fields: [
    defineField({
      name: "content",
      title: "Content",
      type: "array",
      group: "content",
      of: [
        defineArrayMember({ type: "video" }),
        defineArrayMember({ type: "wysiwyg" }),
      ],
    }),
    defineField({ name: "seo", title: "SEO", type: "seo", group: "seo" }),
    defineField({
      name: "settings",
      title: "Settings",
      type: "page-settings",
      group: "settings",
    }),
  ],
  preview: { prepare: () => ({ title: "Home" }) },
});
