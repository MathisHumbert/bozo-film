import { defineField, defineType } from "sanity";

export const pageSettingsType = defineType({
  name: "page-settings",
  title: "Page Settings",
  type: "object",
  fields: [
    defineField({
      name: "theme",
      title: "Theme",
      type: "string",
      options: {
        list: [
          { title: "Light", value: "light" },
          { title: "Dark", value: "dark" },
        ],
      },
      initialValue: "light",
    }),
    defineField({
      name: "showFooter",
      title: "Show Footer",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "footerPage",
      title: "Footer Link Page",
      type: "reference",
      to: [{ type: "home" }],
      hidden: ({ parent }) => !parent?.showFooter,
      options: { disableNew: true },
    }),
  ],
});
