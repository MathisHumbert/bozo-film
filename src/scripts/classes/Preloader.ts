import imagesLoaded from "imagesloaded";
import FontFaceObserver from "fontfaceobserver";

import { events } from "../utils/events";
import { attachSources } from "../utils/video";
import { createMutedVideo, getSource, preloaded } from "../utils/textures";

export interface PreloaderOptions {
  images?: boolean;
  fonts?: boolean | string[];
  videos?: boolean;
  textures?: boolean;
  webComponents?: boolean;
  timeout?: number;
}

await Promise.allSettled([...document.images].map((img) => img.decode()));

const DEFAULT_FONTS = ["Feature Display Condensed"];

const PRELOAD_DEFAULTS: Required<PreloaderOptions> = {
  images: true,
  fonts: true,
  videos: false,
  textures: true,
  webComponents: true,
  timeout: 5000,
};

const LOAD_DEFAULTS: Required<PreloaderOptions> = {
  ...PRELOAD_DEFAULTS,
};

export default class Preloader {
  private options: PreloaderOptions;

  constructor(options: PreloaderOptions = {}) {
    this.options = options;
  }

  preloadPage(options: PreloaderOptions = {}) {
    return this.run({ ...PRELOAD_DEFAULTS, ...this.options, ...options }).then(
      () => {
        events.emit("page:loaded");
      },
    );
  }

  loadPage(options: PreloaderOptions = {}) {
    return this.run({ ...LOAD_DEFAULTS, ...this.options, ...options });
  }

  private run(options: Required<PreloaderOptions>) {
    const tasks: Promise<unknown>[] = [];

    if (options.images) {
      tasks.push(this.loadImages());
    }

    if (options.fonts) {
      tasks.push(this.loadFonts(options));
    }

    if (options.videos) {
      tasks.push(this.loadVideos(options));
    }

    if (options.textures) {
      tasks.push(this.loadTextures(options));
    }

    if (options.webComponents) {
      tasks.push(this.loadWebComponents(options));
    }

    return Promise.all(tasks);
  }

  private loadImages() {
    return new Promise<void>((resolve) => {
      imagesLoaded(document.body, { background: true }, () => resolve());
    });
  }

  private loadFonts({ fonts, timeout }: Required<PreloaderOptions>) {
    const families = Array.isArray(fonts) ? fonts : DEFAULT_FONTS;

    return Promise.all(
      families.map((family) =>
        new FontFaceObserver(family).load(null, timeout).catch(() => {
          console.warn(`Font "${family}" failed to load within ${timeout}ms`);
        }),
      ),
    );
  }

  private loadVideos({ timeout }: Required<PreloaderOptions>) {
    const videos = Array.from(
      document.querySelectorAll<HTMLVideoElement>(
        "video:has(> source[data-src])",
      ),
    ).filter((video) => video.getBoundingClientRect().top < window.innerHeight);

    if (videos.length === 0) {
      return Promise.resolve();
    }

    return Promise.race([
      Promise.all(videos.map((video) => this.loadVideo(video))),
      new Promise((resolve) => setTimeout(resolve, timeout)),
    ]);
  }

  private loadVideo(video: HTMLVideoElement) {
    return new Promise<void>((resolve) => {
      if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        resolve();
        return;
      }

      const done = () => {
        video.removeEventListener("canplay", done);
        video.removeEventListener("error", done);
        resolve();
      };

      video.addEventListener("canplay", done, { once: true });
      video.addEventListener("error", done, { once: true });

      attachSources(video);
    });
  }

  // `[data-preload]` boxes the WebGL canvas draws into: their poster, and up
  // to the first frame of their video for "video". Cached as soon as created,
  // so the canvas reuses them even if the timeout wins.
  private loadTextures({ timeout }: Required<PreloaderOptions>) {
    const elements = document.querySelectorAll<HTMLElement>("[data-preload]");
    const tasks: Promise<void>[] = [];

    elements.forEach((element) => {
      const poster = element.dataset.poster;

      if (poster && !preloaded.posters.has(poster)) {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = poster;

        preloaded.posters.set(poster, image);
        tasks.push(image.decode().catch(() => undefined));
      }

      const src = getSource(element);

      if (
        element.dataset.preload === "video" &&
        src &&
        !preloaded.videos.has(src)
      ) {
        const video = createMutedVideo();
        video.preload = "auto";
        video.src = src;

        preloaded.videos.set(src, video);
        tasks.push(
          new Promise<void>((resolve) => {
            video.addEventListener("loadeddata", () => resolve(), {
              once: true,
            });
            video.addEventListener("error", () => resolve(), { once: true });
            video.load();
          }),
        );
      }
    });

    if (tasks.length === 0) {
      return Promise.resolve();
    }

    return Promise.race([
      Promise.all(tasks),
      new Promise((resolve) => setTimeout(resolve, timeout)),
    ]);
  }

  private loadWebComponents({ timeout }: Required<PreloaderOptions>) {
    const tags = new Set(
      Array.from(document.querySelectorAll(":not(:defined)"), (el) =>
        el.tagName.toLowerCase(),
      ),
    );

    if (tags.size === 0) {
      return Promise.resolve();
    }

    return Promise.race([
      Promise.all(Array.from(tags, (tag) => customElements.whenDefined(tag))),
      new Promise((resolve) => setTimeout(resolve, timeout)),
    ]);
  }
}
