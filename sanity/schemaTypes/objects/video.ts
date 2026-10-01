import { defineField, defineType } from "sanity";

/**
 * A video from the Video Library, placed on a page.
 *
 * `asset` is a reference rather than an inlined value: it is what makes the
 * usage check possible (`*[references($id)]`), lets a poster or a corrected
 * duration reach every page that uses the video, and keeps one source of
 * truth for the stored object.
 */
export const videoType = defineType({
  name: "video",
  title: "Video",
  type: "object",
  fields: [
    defineField({
      name: "asset",
      title: "Video",
      type: "reference",
      to: [{ type: "video-asset" }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "caption",
      title: "Caption",
      description: "Shown under the video. Leave empty for none.",
      type: "string",
    }),
    defineField({
      name: "autoplay",
      title: "Autoplay",
      description:
        "Browsers only allow autoplay when the video is muted, so turning this on mutes it.",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "loop",
      title: "Loop",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "controls",
      title: "Show controls",
      type: "boolean",
      initialValue: false,
    }),
  ],
  preview: {
    select: {
      title: "asset.title",
      filename: "asset.filename",
      duration: "asset.duration",
      media: "asset.thumbnail",
    },
    prepare({ title, filename, duration, media }) {
      const parts = ["Video"];

      if (typeof duration === "number") {
        const minutes = Math.floor(duration / 60);
        const seconds = Math.round(duration % 60);
        parts.push(`${minutes}:${String(seconds).padStart(2, "0")}`);
      }

      return {
        title: title || filename || "No video selected",
        subtitle: parts.join(" · "),
        media,
      };
    },
  },
});
