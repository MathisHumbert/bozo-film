import { EarthGlobeIcon } from "@sanity/icons/EarthGlobe";
import { ProjectsIcon } from "@sanity/icons/Projects";
import { TiersIcon } from "@sanity/icons/Tiers";
import { defineArrayMember, defineField, defineType } from "sanity";

export const workType = defineType({
  name: "work",
  title: "Work",
  type: "document",
  icon: ProjectsIcon,
  groups: [
    { name: "content", title: "Content", icon: TiersIcon, default: true },
    { name: "seo", title: "SEO", icon: EarthGlobeIcon },
  ],
  fields: [
    defineField({
      name: "title",
      title: "Title",
      description: "The work's name, shown on its page and in listings.",
      type: "string",
      group: "content",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "titleLeft",
      title: "Title Left",
      description:
        "The part of the title shown left of the preview video in listings.",
      type: "string",
      group: "content",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "titleRight",
      title: "Title Right",
      description:
        "The part of the title shown right of the preview video in listings.",
      type: "string",
      group: "content",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      description:
        "Builds the page's URL. Generated from the title. Edit it only if this work needs a different URL.",
      type: "slug",
      group: "content",
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "excerpt",
      title: "Excerpt",
      description: "Short description shown on the work's page.",
      type: "text",
      rows: 3,
      group: "content",
    }),
    defineField({
      name: "category",
      title: "Category",
      description:
        "Categories or services for this project, e.g. Fashion, Art Direction, Videography.",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      group: "content",
    }),
    defineField({
      name: "roles",
      title: "Roles",
      description:
        "Roles performed on this project, e.g. Direction, Art Direction, DOP.",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      group: "content",
    }),
    defineField({
      name: "previewVideo",
      title: "Preview Video",
      description:
        "Shown as a hover/thumbnail preview in listings. Keep it short and light, around 3-6 seconds and under 5MB, so it starts instantly on hover.",
      type: "reference",
      to: [{ type: "video-asset" }],
      group: "content",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "mainVideo",
      title: "Main Video",
      description:
        "The featured video on this work's page. Can be longer and heavier than the preview. Up to a minute or two and a few tens of MB is reasonable; avoid long, very high-bitrate files, they slow the page down.",
      type: "reference",
      to: [{ type: "video-asset" }],
      group: "content",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "media",
      title: "Media",
      description:
        "Additional images and videos for this work. Images go through Sanity's own upload and optimization, so size is not a concern. Videos are picked from the Video Library and are not compressed automatically. Keep each clip under ~30 seconds and ~20-30MB so the page stays fast.",
      type: "array",
      group: "content",
      of: [
        defineArrayMember({
          type: "image",
          title: "Image",
          options: { hotspot: true },
        }),
        defineArrayMember({ type: "video", title: "Video" }),
      ],
    }),
    defineField({ name: "seo", title: "SEO", type: "seo", group: "seo" }),
  ],
});
