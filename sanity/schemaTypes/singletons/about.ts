import { EarthGlobeIcon } from "@sanity/icons/EarthGlobe";
import { InfoOutlineIcon } from "@sanity/icons/InfoOutline";
import { TiersIcon } from "@sanity/icons/Tiers";
import { defineArrayMember, defineField, defineType } from "sanity";

export const aboutType = defineType({
  name: "about",
  title: "About",
  type: "document",
  icon: InfoOutlineIcon,
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
      name: "description",
      title: "Description",
      type: "text",
      rows: 4,
      group: "content",
    }),
    defineField({
      name: "services",
      title: "Services",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      group: "content",
    }),
    defineField({
      name: "clients",
      title: "Select Clients",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      group: "content",
    }),
    defineField({
      name: "socialLinks",
      title: "Follow",
      type: "array",
      of: [defineArrayMember({ type: "link" })],
      group: "content",
    }),
    defineField({
      name: "contact",
      title: "Contact",
      type: "object",
      group: "content",
      options: { collapsible: false },
      fields: [
        defineField({
          name: "email",
          title: "Email",
          type: "string",
          validation: (Rule) => Rule.email(),
        }),
        defineField({ name: "phone", title: "Phone", type: "string" }),
      ],
    }),
    defineField({
      name: "images",
      title: "Images",
      description:
        "Scrolls alongside the description, services, clients, follow and contact info as the page is scrolled.",
      type: "array",
      group: "content",
      of: [
        defineArrayMember({
          type: "image",
          title: "Image",
          options: { hotspot: true },
        }),
      ],
    }),
    defineField({
      name: "reel",
      title: "Reel",
      description:
        "The play-reel section: looping text above and below the reel button.",
      type: "object",
      group: "content",
      options: { collapsible: false },
      fields: [
        defineField({
          name: "textTop",
          title: "Text Top",
          description:
            'e.g. "Play through work". Line breaks are kept as typed.',
          type: "text",
          rows: 2,
        }),
        defineField({
          name: "preview",
          title: "Reel Preview",
          description:
            "Shown on the reel button. Keep it short and light, around 3-6 seconds and under 5MB, so it starts instantly.",
          type: "reference",
          to: [{ type: "video-asset" }],
        }),
        defineField({
          name: "main",
          title: "Reel Main",
          description:
            "Played when the reel button is clicked. Can be longer and heavier than the preview.",
          type: "reference",
          to: [{ type: "video-asset" }],
        }),
        defineField({
          name: "textBottom",
          title: "Text Bottom",
          description:
            'e.g. "Work through play". Line breaks are kept as typed.',
          type: "text",
          rows: 2,
        }),
      ],
    }),
    defineField({ name: "seo", title: "SEO", type: "seo", group: "seo" }),
  ],
  preview: { prepare: () => ({ title: "About" }) },
});
