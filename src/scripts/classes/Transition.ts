import Swup from "swup";
import SwupHeadPlugin from "@swup/head-plugin";
import SwupPreloadPlugin from "@swup/preload-plugin";
import SwupScriptsPlugin from "@swup/scripts-plugin";
import { gsap } from "gsap";

import Scroll from "../classes/Scroll";
import { events } from "../utils/events";
import { delay } from "../utils/math";

const isDev = import.meta.env.MODE === "development";

type TransitionOptions = {
  onContentReplaced: () => void;
  onLoadPage: () => Promise<unknown>;
};

export default class Transition {
  private swup: Swup;
  private onContentReplaced: () => void;
  private onLoadPage: () => Promise<unknown>;

  constructor({ onContentReplaced, onLoadPage }: TransitionOptions) {
    this.onContentReplaced = onContentReplaced;
    this.onLoadPage = onLoadPage;

    this.swup = this.createSwup();
  }

  private createSwup() {
    const swup = new Swup({
      animateHistoryBrowsing: true,
      plugins: [
        new SwupHeadPlugin({
          persistAssets: true,
          awaitAssets: true,
        }),
        new SwupPreloadPlugin({
          preloadHoveredLinks: true,
          preloadInitialPage: !isDev,
        }),
        new SwupScriptsPlugin(),
      ],
    });

    swup.hooks.on("animation:out:start", async () => {
      events.emit("transition:start");

      Scroll.stop();

      document.documentElement.classList.remove("is-ready");

      await delay(500);
    });

    swup.hooks.on("content:replace", () => {
      Scroll.scrollTo(0, { immediate: true, force: true });
      Scroll.destroy();

      this.onContentReplaced();
    });

    swup.hooks.on("animation:in:start", async () => {
      await this.onLoadPage();

      document.documentElement.classList.add("is-ready");

      Scroll.init();
      Scroll.start();

      events.emit("transition:end");
    });

    swup.hooks.on("visit:abort", () => {
      events.emit("transition:end");
    });

    return swup;
  }

  animateOut() {
    return new Promise((resolve) => {
      gsap.to(".content", {
        opacity: 0,
        duration: 0.6,
        ease: "expo.out",
        onComplete: resolve,
      });
    });
  }

  animateIn() {
    return new Promise((resolve) => {
      gsap.to(".content", {
        opacity: 1,
        duration: 0.6,
        ease: "expo.out",
        onComplete: resolve,
      });
    });
  }
}
