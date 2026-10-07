import { CogIcon } from "@sanity/icons/Cog";
import { TiersIcon } from "@sanity/icons/Tiers";
import { VideoIcon } from "@sanity/icons/Video";
import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * A video stored on S3 or R2, described in Sanity.
 *
 * The bytes live in the bucket, everything that gives them meaning lives here:
 * title, poster, dimensions, tags, and later the folder they sit in. Because
 * `storageKey` is opaque and never changes, renaming or moving an asset is a
 * patch on this document — no re-upload, no CDN invalidation.
 *
 * `liveEdit` is on because these are not editorial documents: a caption fix
 * should not need publishing, and it keeps the tool from having to reason
 * about drafts when it patches metadata.
 */
export const videoAssetType = defineType({
  name: "video-asset",
  title: "Video Asset",
  type: "document",
  icon: VideoIcon,
  liveEdit: true,
  groups: [
    { name: "content", title: "Content", icon: TiersIcon, default: true },
    { name: "technical", title: "Technical", icon: CogIcon },
  ],
  fields: [
    defineField({
      name: "title",
      title: "Title",
      description: "Shown in the library. Free to change at any time.",
      type: "string",
      group: "content",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 3,
      group: "content",
    }),
    defineField({
      name: "altText",
      title: "Alternative Text",
      description: "Describes the video for assistive technology.",
      type: "string",
      group: "content",
    }),
    defineField({
      name: "thumbnail",
      title: "Poster",
      description: "Captured from the video on upload. Replace it if needed.",
      type: "image",
      options: { hotspot: true },
      group: "content",
    }),
    defineField({
      name: "storyboard",
      title: "Storyboard",
      description:
        "Grid of frames used to scrub through the video on hover in the library.",
      type: "image",
      group: "content",
      readOnly: true,
    }),
    // Stored per asset rather than read from the plugin config: changing the
    // sprite layout later must not break the assets already captured.
    defineField({
      name: "storyboardColumns",
      title: "Storyboard Columns",
      type: "number",
      group: "technical",
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: "storyboardRows",
      title: "Storyboard Rows",
      type: "number",
      group: "technical",
      readOnly: true,
      hidden: true,
    }),

    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      options: { layout: "tags" },
      group: "content",
    }),

    // Everything below is written by the upload pipeline. Editing it by hand
    // would only break the link with the stored object.
    defineField({
      name: "storageKey",
      title: "Storage Key",
      description: "Immutable object key in the bucket.",
      type: "string",
      group: "technical",
      readOnly: true,
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "filename",
      title: "Original Filename",
      type: "string",
      group: "technical",
      readOnly: true,
    }),
    defineField({
      name: "contentType",
      title: "Content Type",
      type: "string",
      group: "technical",
      readOnly: true,
    }),
    defineField({
      name: "size",
      title: "Size",
      description: "In bytes.",
      type: "number",
      group: "technical",
      readOnly: true,
    }),
    defineField({
      name: "duration",
      title: "Duration",
      description: "In seconds.",
      type: "number",
      group: "technical",
      readOnly: true,
    }),
    defineField({
      name: "width",
      title: "Width",
      type: "number",
      group: "technical",
      readOnly: true,
    }),
    defineField({
      name: "height",
      title: "Height",
      type: "number",
      group: "technical",
      readOnly: true,
    }),
    defineField({
      name: "aspectRatio",
      title: "Aspect Ratio",
      description:
        "Width divided by height. Known at build time, so the front end can reserve the right space and avoid layout shift.",
      type: "number",
      group: "technical",
      readOnly: true,
    }),
    defineField({
      name: "renditions",
      title: "Renditions",
      type: "array",
      group: "technical",
      readOnly: true,
      of: [
        defineArrayMember({
          name: "rendition",
          type: "object",
          fields: [
            defineField({ name: "width", type: "number" }),
            defineField({ name: "height", type: "number" }),
            defineField({
              name: "size",
              description: "In bytes.",
              type: "number",
            }),
            defineField({ name: "storageKey", type: "string" }),
          ],
          preview: {
            select: { width: "width", height: "height", size: "size" },
            prepare({ width, height, size }) {
              return {
                title: `${width}×${height}`,
                subtitle:
                  typeof size === "number"
                    ? `${(size / 1024 / 1024).toFixed(1)} MB`
                    : undefined,
              };
            },
          },
        }),
      ],
    }),
    defineField({
      name: "uploadedAt",
      title: "Uploaded At",
      type: "datetime",
      group: "technical",
      readOnly: true,
    }),
    defineField({
      name: "uploadedBy",
      title: "Uploaded By",
      type: "string",
      group: "technical",
      readOnly: true,
    }),
  ],
  preview: {
    select: {
      title: "title",
      media: "thumbnail",
      duration: "duration",
      width: "width",
      height: "height",
    },
    prepare({ title, media, duration, width, height }) {
      const parts = [];

      if (typeof duration === "number") {
        const minutes = Math.floor(duration / 60);
        const seconds = Math.round(duration % 60);
        parts.push(`${minutes}:${String(seconds).padStart(2, "0")}`);
      }

      if (width && height) {
        parts.push(`${width}×${height}`);
      }

      return {
        title: title || "Untitled video",
        subtitle: parts.join(" · ") || "No metadata yet",
        media,
      };
    },
  },
});
