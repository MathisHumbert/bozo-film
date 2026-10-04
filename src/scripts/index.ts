import "./classes/WindowEvents";
import "./classes/Gsap";

import gsap from "gsap";

import Preloader from "./classes/Preloader";
import Transition from "./classes/Transition";
import AnimationManager from "./classes/AnimationManager";
import Scroll from "./classes/Scroll";

import { events } from "./utils/events";
import { nextFrame } from "./utils/math";

import type { Preloader as PreloaderElement } from "../components/preloader/preloader";

if (window.history.scrollRestoration) {
  window.history.scrollRestoration =
    import.meta.env.MODE === "development" ? "auto" : "manual";
}

class App {
  private preloader: Preloader;
  private animationManager: AnimationManager;

  constructor() {
    Scroll.init();

    this.preloader = new Preloader();
    this.animationManager = new AnimationManager();

    new Transition({
      onContentReplaced: this.onContentReplaced,
      onLoadPage: () => this.preloader.loadPage(),
    });

    this.preloader.preloadPage();

    events.on("page:loaded", this.onPreloaded);
  }

  onPreloaded = async () => {
    const page = document.getElementById("swup");

    gsap.set(document.documentElement, {
      background: page?.dataset.background,
      color: page?.dataset.color,
    });

    this.animationManager.create();

    await nextFrame();

    // optional participant: no element means no wait, and nothing else in the
    // app knows whether a preloader ran
    await document.querySelector<PreloaderElement>("c-preloader")?.play();

    document.documentElement.classList.add("is-ready");

    Scroll.start();
  };

  onContentReplaced = () => {
    const page = document.getElementById("swup");

    console.log(page);

    gsap.to(document.documentElement, {
      background: page?.dataset.background,
      color: page?.dataset.color,
      duration: 0.6,
      ease: "sine.out",
    });

    this.animationManager.reset();
  };
}

new App();
