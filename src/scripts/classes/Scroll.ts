import { ScrollTrigger } from "gsap/ScrollTrigger";
import LocomotiveScroll from "locomotive-scroll";
import type { VirtualScrollData } from "lenis";
import gsap from "gsap";

import { events } from "../utils/events";

import { device } from "./Device";

const isDev = import.meta.env.MODE === "development";

// Replaces syncTouch's fling, which brakes on release: this one starts at the
// finger's speed and fades like a native one.
const FLING = {
  // fade time constant, in s (iOS ~0.5)
  decay: 0.4,
  // speed measured over the last moves, in ms
  window: 100,
  // held still this long before lifting, nothing is thrown, in ms
  rest: 60,
};

export default class Scroll {
  private static loco: LocomotiveScroll | null = null;
  static isActive = false;

  private static moves: { time: number; delta: number }[] = [];

  // Lets a page pick where a fling stops (the home's stack).
  static landing: ((target: number, from: number) => number) | null = null;

  static init() {
    const infinite = Boolean(document.querySelector("[data-scroll-infinite]"));
    // Lenis only loops the scroll it drives: a native touch scroll stops at
    // the bottom of the page, so on touch it has to take over too.
    const syncTouch = infinite && !isDev;

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
        // touchMultiplier: 0.75,
        infinite,
        syncTouch,
        virtualScroll: syncTouch ? this.onVirtualScroll : undefined,
      },
    });

    this.loco.stop();

    this.loco.lenisInstance?.on("scroll", ScrollTrigger.update);
    this.loco.lenisInstance?.on("scroll", (e: unknown) =>
      events.emit("lenis", e),
    );
  }

  private static onVirtualScroll = ({ deltaY, event }: VirtualScrollData) => {
    const lenis = this.lenis;
    const now = event.timeStamp;

    if (!lenis || !event.type.startsWith("touch")) return true;

    if (event.type === "touchstart") {
      this.moves = [];
    } else if (event.type === "touchmove") {
      this.moves.push({ time: now, delta: deltaY });
      this.moves = this.moves.filter(({ time }) => now - time <= FLING.window);
    } else if (event.type === "touchend") {
      // The first move only marks the start of the span.
      const [first, ...rest] = this.moves;
      const last = rest.at(-1);
      const isThrown = last && now - last.time < FLING.rest;
      const velocity = isThrown
        ? rest.reduce((sum, { delta }) => sum + delta, 0) /
          Math.max(last.time - first.time, 8)
        : 0;

      const from = lenis.targetScroll;

      this.moves = [];

      // Runs after Lenis starts its own fling, and overrides it.
      queueMicrotask(() => {
        const target = from + velocity * 1000 * FLING.decay;

        lenis.scrollTo(this.landing?.(target, from) ?? target, {
          lerp: 1 / (60 * FLING.decay),
          programmatic: false,
        });
      });
    }

    return true;
  };

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

  // Back to the top, for the wrapper and for Lenis alike. scrollTo(0) alone
  // is skipped when Lenis already counts itself at 0 (infinite wraps limit
  // to 0), and the wrapper can still be elsewhere: anything measured against
  // the scroll would then be a whole wrap off.
  static toTop() {
    const wrapper = this.lenis?.rootElement;

    if (wrapper) wrapper.scrollTop = 0;

    this.scrollTo(0, { immediate: true, force: true });
  }

  static get lenis() {
    return this.loco?.lenisInstance ?? null;
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
