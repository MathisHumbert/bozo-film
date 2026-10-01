import { defineField, defineType } from "sanity";

export const linkType = defineType({
  name: "link",
  title: "Link",
  type: "object",
  fields: [
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "linkType",
      title: "Type",
      type: "string",
      options: {
        list: [
          { title: "Internal page", value: "internal" },
          { title: "External URL", value: "external" },
        ],
        layout: "radio",
      },
      initialValue: "internal",
    }),
    defineField({
      name: "page",
      title: "Page",
      type: "reference",
      to: [{ type: "home" }],
      options: { disableNew: true },
      hidden: ({ parent }) => parent?.linkType === "external",
    }),
    defineField({
      name: "url",
      title: "URL",
      type: "url",
      hidden: ({ parent }) => parent?.linkType !== "external",
    }),
  ],
  preview: {
    select: { title: "label", subtitle: "url", page: "page.title" },
    prepare({ title, subtitle, page }) {
      return { title, subtitle: subtitle || page || "Internal page" };
    },
  },
});
