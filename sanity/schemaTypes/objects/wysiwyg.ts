import { defineArrayMember, defineField, defineType } from "sanity";

export const wysiwygType = defineType({
  name: "wysiwyg",
  title: "Wysiwyg",
  type: "object",
  fields: [
    defineField({
      name: "body",
      title: "Body",
      type: "array",
      of: [
        defineArrayMember({
          type: "block",
          styles: [
            { title: "Normal", value: "normal" },
            { title: "H1", value: "h1" },
            { title: "H2", value: "h2" },
            { title: "H3", value: "h3" },
            { title: "H4", value: "h4" },
            { title: "Quote", value: "blockquote" },
          ],
          lists: [{ title: "Bullet", value: "bullet" }],
          marks: {
            decorators: [
              { title: "Strong", value: "strong" },
              { title: "Emphasis", value: "em" },
            ],
            annotations: [
              {
                title: "URL",
                name: "link",
                type: "object",
                fields: [{ title: "URL", name: "href", type: "url" }],
              },
            ],
          },
        }),
        defineArrayMember({
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              type: "string",
              title: "Alternative Text",
            }),
          ],
        }),
      ],
      validation: (Rule) => Rule.required().min(1),
    }),
  ],
  preview: {
    select: { body: "body" },
    prepare({ body }) {
      const first = body?.find((block: any) => block._type === "block");
      const text = first?.children
        ?.map((child: any) => child.text)
        .join("")
        .slice(0, 60);
      return { title: "Wysiwyg", subtitle: text || "Empty" };
    },
  },
});
