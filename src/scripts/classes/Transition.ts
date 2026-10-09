import Swup, { type HookArguments, type Visit } from "swup";
import SwupHeadPlugin from "@swup/head-plugin";
import SwupParallelPlugin from "@swup/parallel-plugin";
import SwupPreloadPlugin from "@swup/preload-plugin";
import SwupScriptsPlugin from "@swup/scripts-plugin";
import { gsap } from "gsap";

import Scroll from "../classes/Scroll";
import { device } from "../classes/Device";
import { events } from "../utils/events";

import type { Video } from "../../components/video/video";

const isDev = import.meta.env.MODE === "development";

// one per page transition, named from-to. "default" is the fade every visit
// gets unless a link asks for another; the others are parallel, both pages on
// screen at once
type TransitionType =
  "default" | "work-to-work" | "home-to-work" | "work-to-home";

// work-to-work: the next block's own UI, and the hero's, swapped over the
// shared video
const WORK_NEXT_UI = '[data-work-next="ui"]';
const WORK_HERO_UI =
  '[data-work-hero="title"], [data-work-hero="duration"], [data-work-hero="toggle"]';

// see main.css: positions the incoming page during a parallel visit only
const INCOMING_CLASS = "is-incoming-container";

type TransitionOptions = {
  onContentReplaced: () => void;
  onLoadPage: () => Promise<unknown>;
};

export default class Transition {
  private swup: Swup;
  private onContentReplaced: () => void;
  private onLoadPage: () => Promise<unknown>;

  // armed by a click that asks for a transition, turned into the running
  // visit's type by visit:start
  private pendingType: TransitionType = "default";
  private type: TransitionType = "default";

  constructor({ onContentReplaced, onLoadPage }: TransitionOptions) {
    this.onContentReplaced = onContentReplaced;
    this.onLoadPage = onLoadPage;

    this.swup = this.createSwup();

    // capture phase: runs before swup's own link handler, so the page can be
    // scrolled to the next block before the visit starts
    document.addEventListener("click", this.onWorkToWorkClick, true);
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
        new SwupParallelPlugin(),
      ],
    });

    swup.hooks.on("visit:start", this.onVisitStart);
    swup.hooks.on("animation:out:start", this.onAnimationOutStart);
    swup.hooks.before("content:insert", this.beforeContentInsert);
    swup.hooks.on("content:replace", this.onContentReplace);
    swup.hooks.on("animation:in:start", this.onAnimationInStart);
    swup.hooks.on("content:remove", this.onContentRemove);
    swup.hooks.on("visit:abort", this.onVisitAbort);

    return swup;
  }

  private isParallel() {
    return this.type !== "default";
  }

  /**
   * Hooks, in the order a visit runs them
   */

  // the plugin makes every visit parallel unless told otherwise: only a typed
  // transition keeps both pages, and never on back/forward
  private onVisitStart = (visit: Visit) => {
    this.type = visit.history.popstate ? "default" : this.pendingType;
    this.pendingType = "default";

    if (!this.isParallel()) {
      visit.animation.parallel = false;
      return;
    }

    // the old page has to stay where it is until it is removed
    visit.scroll.reset = false;
  };

  private onAnimationOutStart = async (visit: Visit) => {
    events.emit("transition:start", {
      from: new URL(visit.from.url, window.location.origin).pathname,
      to: new URL(visit.to.url, window.location.origin).pathname,
    });

    Scroll.stop();

    if (this.type === "default") {
      await this.animateOutDefault();
    }
  };

  // parallel only. The new container is inserted before the old one: laid
  // over the screen before it enters the DOM, so it never pushes the old
  // page down
  private beforeContentInsert = (
    _visit: Visit,
    { containers }: HookArguments<"content:insert">,
  ) => {
    containers.forEach(({ next }) => next.classList.add(INCOMING_CLASS));
  };

  private onContentReplace = () => {
    // parallel: the old page is still on screen, see onContentRemove
    if (this.isParallel()) return;

    Scroll.scrollTo(0, { immediate: true, force: true });
    Scroll.destroy();

    this.onContentReplaced();
  };

  private onAnimationInStart = async () => {
    await this.onLoadPage();

    switch (this.type) {
      case "work-to-work":
        await this.animateInWorkToWork();
        return;

      case "home-to-work":
        await this.animateInHomeToWork();
        return;

      case "work-to-home":
        await this.animateInWorkToHome();
        return;

      default:
        Scroll.init();
        Scroll.start();

        await this.animateInDefault();

        events.emit("transition:end");
    }
  };

  // parallel only, once the old container is gone: the new page goes back
  // into the flow, at the top, and gets its own scroll
  private onContentRemove = (
    _visit: Visit,
    { containers }: HookArguments<"content:remove">,
  ) => {
    Scroll.scrollTo(0, { immediate: true, force: true });
    Scroll.destroy();

    containers.forEach(({ next }) => {
      next.classList.remove(INCOMING_CLASS);
      gsap.set(next, { clearProps: "opacity,visibility" });
    });

    this.onContentReplaced();

    Scroll.init();
    Scroll.start();

    events.emit("transition:end");
  };

  private onVisitAbort = () => {
    events.emit("transition:end");
  };

  /**
   * Default: the old page fades out, the new one fades in
   */
  animateOutDefault() {
    return new Promise((resolve) => {
      gsap.to(".content", {
        opacity: 0,
        duration: 0.6,
        ease: "expo.out",
        onComplete: resolve,
      });
    });
  }

  animateInDefault() {
    return new Promise((resolve) => {
      gsap.to(document.documentElement, {
        background: document.documentElement.dataset.background,
        color: document.documentElement.dataset.color,
        duration: 0.6,
        ease: "sine.out",
      });

      gsap.to(".content", {
        opacity: 1,
        duration: 0.6,
        ease: "expo.out",
        onComplete: resolve,
      });
    });
  }

  /**
   * Work to work: the next block and the next hero both fill the screen with
   * the same video, so the video is moved across and only the text changes
   */
  private onWorkToWorkClick = (event: MouseEvent) => {
    // a modified click opens a new tab: leave it to the browser
    const isModified =
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

    if (event.defaultPrevented || event.button !== 0 || isModified) return;

    const link = (event.target as Element).closest<HTMLAnchorElement>(
      'a[data-transition="work-to-work"]',
    );

    if (!link) return;

    event.preventDefault();
    event.stopPropagation();

    const navigate = () => {
      this.pendingType = "work-to-work";
      this.swup.navigate(link.href);
    };

    // the video only lines up with the next hero once its block fills the
    // screen: scroll there first if the click came early
    const section = link.closest<HTMLElement>("c-work-next");
    const top = section?.getBoundingClientRect().top ?? 0;

    if (!section || Math.abs(top) < 2) {
      navigate();
      return;
    }

    Scroll.scrollTo(section, {
      lock: true,
      duration: device.reducedMotion ? 0 : 1,
      onComplete: navigate,
    });
  };

  async animateInWorkToWork() {
    const previous = document.querySelector<HTMLElement>(
      "#swup.is-previous-container",
    );
    const next = document.querySelector<HTMLElement>(`#swup.${INCOMING_CLASS}`);

    if (!previous || !next) {
      gsap.set(next, { autoAlpha: 1 });
      return;
    }

    const from = previous.querySelector<Video>("c-work-next c-video");
    const to = next.querySelector<Video>('[data-work-hero="preview"] c-video');
    const heroUi = next.querySelectorAll<HTMLElement>(WORK_HERO_UI);

    const duration = device.reducedMotion ? 0 : 1;

    await gsap.to(previous.querySelectorAll(WORK_NEXT_UI), {
      autoAlpha: 0,
      duration: duration * 0.4,
      ease: "power2.out",
    });

    const video = from?.release();

    if (video && to) to.adopt(video);

    gsap.set(heroUi, { opacity: 0 });
    gsap.set(next, { autoAlpha: 1 });

    await gsap.to(heroUi, {
      opacity: 1,
      duration: duration * 0.6,
      ease: "power2.out",
      stagger: 0.05,
    });

    // work-hero tweens the title's opacity itself from here on
    gsap.set(heroUi, { clearProps: "opacity" });
  }

  /**
   * Home to work: the clicked work's video grows from its place on the home
   * (wide stack or list row) to fill the screen, where the work's hero waits
   * for it. Armed by a click on a home link setting pendingType
   */
  async animateInHomeToWork() {}

  /**
   * Work to home: the hero's video shrinks back to the work's place on the
   * home, which fades in around it. Armed by a click on a link to "/" from a
   * work setting pendingType
   */
  async animateInWorkToHome() {}
}
