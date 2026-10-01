import { VideoIcon } from "@sanity/icons/Video";
import { definePlugin } from "sanity";

import { resolveConfig, type VideoLibraryConfig } from "./config";
import { VideoLibraryTool } from "./components/video-library-tool";

export type { VideoLibraryConfig } from "./config";

/**
 * A media library for video, sitting on object storage the app owns.
 *
 * Images and files stay Sanity assets. Video bytes live in S3 or R2 and are
 * served from a CDN, while every document in the `video-asset` type describes
 * one of those objects.
 */
export const videoLibrary = definePlugin<Partial<VideoLibraryConfig> | void>(
  (options) => {
    const config = resolveConfig(options ?? undefined);

    return {
      name: "video-library",
      tools: [
        {
          name: "video-library",
          title: "Videos",
          icon: VideoIcon,
          component: VideoLibraryTool,
          options: config,
        },
      ],
    };
  },
);
