import { MenuIcon } from "@sanity/icons/Menu";
import { CogIcon } from "@sanity/icons/Cog";
import { EarthGlobeIcon } from "@sanity/icons/EarthGlobe";
import { UsersIcon } from "@sanity/icons/Users";
import { defineArrayMember, defineField, defineType } from "sanity";

export const settingsType = defineType({
  name: "settings",
  title: "Settings",
  type: "document",
  icon: CogIcon,
  groups: [
    { name: "general", title: "General", icon: CogIcon, default: true },
    { name: "nav", title: "Navigation", icon: MenuIcon },
    { name: "seo", title: "SEO & AI", icon: EarthGlobeIcon },
    { name: "identity", title: "Site identity", icon: UsersIcon },
  ],
  fields: [
    defineField({
      name: "showPreloader",
      title: "Show preloader",
      description: "Covers the page until fonts and images are ready",
      type: "boolean",
      group: "general",
      initialValue: false,
    }),
    defineField({
      name: "nav",
      title: "Navigation",
      type: "array",
      group: "nav",
      of: [defineArrayMember({ type: "link" })],
    }),
    defineField({
      name: "siteIdentity",
      title: "Site identity",
      description:
        "Describes who this site belongs to. Feeds the structured data every page carries, and the header of llms.txt.",
      type: "object",
      group: "identity",
      options: { collapsible: false },
      fields: [
        defineField({
          name: "entityType",
          title: "This site represents",
          type: "string",
          options: {
            list: [
              { title: "An organisation", value: "organization" },
              { title: "A person", value: "person" },
            ],
            layout: "radio",
          },
          initialValue: "organization",
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: "name",
          title: "Name",
          description: "The studio, brand or person this site is about",
          type: "string",
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: "alternateName",
          title: "Alternate name",
          description: "A legal name, a short name, or a former name",
          type: "string",
        }),
        defineField({
          name: "logo",
          title: "Logo",
          description:
            "Square or wide, at least 112px tall. Used by search engines, never rendered on the site.",
          type: "image",
        }),
        defineField({
          name: "jobTitle",
          title: "Job title",
          type: "string",
          hidden: ({ parent }) => parent?.entityType !== "person",
        }),
        defineField({
          name: "email",
          title: "Email",
          type: "string",
          validation: (Rule) => Rule.email(),
        }),
        defineField({
          name: "sameAs",
          title: "Profile URLs",
          description:
            "Canonical profiles that identify this entity elsewhere: LinkedIn, Instagram, Wikidata, Crunchbase.",
          type: "array",
          of: [defineArrayMember({ type: "url" })],
        }),
      ],
    }),
    defineField({
      name: "fallbackSEO",
      title: "Fallback SEO",
      description: "Used when pages don't have their own SEO data",
      type: "object",
      group: "seo",
      fields: [
        defineField({
          name: "metaTitle",
          title: "Meta Title",
          type: "string",
          validation: (Rule) =>
            Rule.max(60).warning("Keep under 60 characters"),
        }),
        defineField({
          name: "metaDescription",
          title: "Meta Description",
          type: "text",
          rows: 3,
          validation: (Rule) =>
            Rule.max(160).warning("Keep under 160 characters"),
        }),
        defineField({
          name: "ogImage",
          title: "Open Graph Image",
          type: "image",
          options: { hotspot: true },
          fields: [{ name: "alt", title: "Alt Text", type: "string" }],
        }),
      ],
    }),
    defineField({
      name: "aiContent",
      title: "Content for AI",
      description:
        "What an AI assistant should know about this site. Published at /llms.txt, which ChatGPT, Perplexity and Google's AI surfaces read.",
      type: "object",
      group: "seo",
      options: { collapsible: false },
      fields: [
        defineField({
          name: "summary",
          title: "Summary",
          description:
            "One paragraph, written to be quoted. Lead with what this site is, then the detail.",
          type: "text",
          rows: 4,
          validation: (Rule) =>
            Rule.max(400).warning("Keep it quotable — under 400 characters"),
        }),
        defineField({
          name: "sections",
          title: "Sections",
          description:
            "Free-form lists, rendered in order. Name them for what this project actually has: Services, Clients, Expertise, Awards, Markets. A section titled Expertise, Services or Skills also becomes the entity's knowsAbout, and one titled Awards becomes its award.",
          type: "array",
          of: [
            defineArrayMember({
              type: "object",
              name: "ai-section",
              fields: [
                defineField({
                  name: "title",
                  title: "Title",
                  type: "string",
                  validation: (Rule) => Rule.required(),
                }),
                defineField({
                  name: "items",
                  title: "Items",
                  type: "array",
                  of: [defineArrayMember({ type: "string" })],
                  options: { layout: "tags" },
                  validation: (Rule) => Rule.required().min(1),
                }),
              ],
              preview: {
                select: { title: "title", items: "items" },
                prepare({ title, items }) {
                  const count = items?.length ?? 0;

                  return {
                    title: title || "Untitled section",
                    subtitle: `${count} item${count === 1 ? "" : "s"}`,
                  };
                },
              },
            }),
          ],
        }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: "Settings" }) },
});
