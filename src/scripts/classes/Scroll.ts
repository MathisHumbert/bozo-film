import { ScrollTrigger } from "gsap/ScrollTrigger";
import LocomotiveScroll from "locomotive-scroll";
import gsap from "gsap";

import { events } from "../utils/events";

import { device } from "./Device";

const isDev = import.meta.env.MODE === "development";

export default class Scroll {
  private static loco: LocomotiveScroll | null = null;
  static isActive = false;

  static init() {
    this.loco = new LocomotiveScroll({
      autoStart: false,
      initCustomTicker: (render) => {
        gsap.ticker.add(render, false, true);
      },
      destroyCustomTicker: (render) => {
        gsap.ticker.remove(render);
      },
      lenisOptions: {
        wrapper: isDev
          ? window
          : (document.getElementById("scroll-wrapper") ?? undefined),
        content: isDev
          ? document.documentElement
          : (document.getElementById("scroll-content") ?? undefined),
        lerp: device.reducedMotion ? 1 : 0.125,
        wheelMultiplier: 0.75,
        touchMultiplier: 0.75,
        infinite: Boolean(document.querySelector("[data-scroll-infinite]")),
      },
    });

    this.loco.stop();

    this.loco.lenisInstance?.on("scroll", ScrollTrigger.update);
    this.loco.lenisInstance?.on("scroll", (e: unknown) =>
      events.emit("lenis", e),
    );
  }

  static start() {
    this.isActive = true;
    this.loco?.resize();
    this.loco?.start();

    ScrollTrigger.refresh();
  }

  static stop() {
    this.isActive = false;
    this.loco?.stop();
  }

  static resume() {
    this.isActive = true;
    this.loco?.start();
  }

  static resize() {
    this.loco?.lenisInstance?.resize();
    this.loco?.resize();
  }

  static destroy() {
    this.loco?.destroy();
  }

  static scrollTo(
    target: number | string | HTMLElement,
    options?: Record<string, unknown>,
  ) {
    this.loco?.scrollTo(target, options);
  }

  static get scroll() {
    return this.loco?.lenisInstance?.scroll ?? 0;
  }

  static get limit() {
    return this.loco?.lenisInstance?.limit ?? 0;
  }

  static get velocity() {
    return this.loco?.lenisInstance?.velocity ?? 0;
  }

  static get direction() {
    return this.loco?.lenisInstance?.direction ?? 0;
  }
}
