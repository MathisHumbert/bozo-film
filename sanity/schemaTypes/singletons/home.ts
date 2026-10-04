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
  ],
  fields: [
    defineField({
      name: "title",
      title: "Title",
      description:
        "Rendered as the page's H1. Separate from the SEO meta title.",
      type: "string",
      group: "content",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "featuredWork",
      title: "Featured Works",
      description:
        "The projects shown in the home page's wide view, in this order. The list view always shows every work, like selects versus the full archive.",
      type: "array",
      group: "content",
      of: [
        defineArrayMember({
          type: "reference",
          to: [{ type: "work" }],
          options: { disableNew: true },
        }),
      ],
      validation: (Rule) => Rule.unique(),
    }),
    defineField({ name: "seo", title: "SEO", type: "seo", group: "seo" }),
  ],
  preview: { prepare: () => ({ title: "Home" }) },
});
