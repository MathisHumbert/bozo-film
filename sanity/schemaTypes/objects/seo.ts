import { defineField, defineType } from "sanity";

export const seoType = defineType({
  name: "seo",
  title: "SEO",
  type: "object",
  fields: [
    defineField({
      name: "metaTitle",
      title: "Meta Title",
      type: "string",
      description: "50-60 characters recommended",
      validation: (Rule) =>
        Rule.max(60).warning("Keep under 60 characters for optimal SEO"),
    }),
    defineField({
      name: "metaDescription",
      title: "Meta Description",
      type: "text",
      rows: 3,
      description: "150-160 characters recommended",
      validation: (Rule) =>
        Rule.max(160).warning("Keep under 160 characters for optimal SEO"),
    }),
    defineField({
      name: "ogImage",
      title: "Open Graph Image",
      type: "image",
      description: "1200x630px recommended",
      options: { hotspot: true },
      fields: [{ name: "alt", title: "Alt Text", type: "string" }],
    }),
    defineField({
      name: "noIndex",
      title: "Hide from search engines",
      description:
        "Sets noindex, and removes the page from the sitemap and from llms.txt",
      type: "boolean",
      initialValue: false,
    }),
  ],
});
