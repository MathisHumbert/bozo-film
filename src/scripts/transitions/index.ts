import Swup, { type HookArguments, type Visit } from "swup";
import SwupHeadPlugin from "@swup/head-plugin";
import SwupParallelPlugin from "@swup/parallel-plugin";
import SwupPreloadPlugin from "@swup/preload-plugin";
import SwupScriptsPlugin from "@swup/scripts-plugin";
import { gsap } from "gsap";

import Scroll from "../classes/Scroll";
import { events, type TransitionType } from "../utils/events";
import type { Modal } from "../../components/modal/modal";

import WorkToWork from "./WorkToWork";
import HomeToWork from "./HomeToWork";
import WorkToHome from "./WorkToHome";

const isDev = import.meta.env.MODE === "development";

const INCOMING_CLASS = "is-incoming-container";

export type Containers = { previous: HTMLElement; next: HTMLElement };

function getModals() {
  return Array.from(document.querySelectorAll<Modal>("c-modal"));
}

function closeModals() {
  return Promise.all(getModals().map((modal) => modal.close()));
}

type PageTransition = {
  prepare: (link: HTMLAnchorElement) => Promise<string> | null;
  animateIn: (containers: Containers) => Promise<void>;
  arrive?: () => void;
};

type TransitionOptions = {
  onContentReplaced: () => void;
  onLoadPage: () => Promise<unknown>;
  releaseVideo: (slug: string) => HTMLVideoElement | null;
  adoptVideo: (slug: string, video: HTMLVideoElement) => void;
};

export default class Transition {
  private swup: Swup;
  private onContentReplaced: () => void;
  private onLoadPage: () => Promise<unknown>;

  private transitions: Record<
    Exclude<TransitionType, "default">,
    PageTransition
  >;

  private pendingType: TransitionType = "default";
  private type: TransitionType = "default";

  constructor({
    onContentReplaced,
    onLoadPage,
    releaseVideo,
    adoptVideo,
  }: TransitionOptions) {
    this.onContentReplaced = onContentReplaced;
    this.onLoadPage = onLoadPage;

    this.transitions = {
      "work-to-work": new WorkToWork(),
      "home-to-work": new HomeToWork({ releaseVideo }),
      "work-to-home": new WorkToHome({ adoptVideo }),
    };

    this.swup = this.createSwup();

    document.addEventListener("click", this.onClick, true);
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
   * Events
   */
  private onClick = async (event: MouseEvent) => {
    const isModified =
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

    if (event.defaultPrevented || event.button !== 0 || isModified) return;

    const link = (event.target as Element).closest<HTMLAnchorElement>(
      "a[data-transition]",
    );
    const type = link?.dataset.transition as TransitionType | undefined;

    if (!link || !type || type === "default") return;

    if (getModals().some((modal) => modal.isOpen)) {
      event.preventDefault();
      event.stopPropagation();

      await closeModals();

      const prepared = this.transitions[type]?.prepare(link);

      if (prepared) {
        this.pendingType = type;
      }

      this.swup.navigate(prepared ? await prepared : link.href);
      return;
    }

    const prepared = this.transitions[type]?.prepare(link);

    if (!prepared) return;

    event.preventDefault();
    event.stopPropagation();

    const href = await prepared;

    this.pendingType = type;
    this.swup.navigate(href);
  };

  /**
   * Hooks, in the order a visit runs them
   */
  private onVisitStart = async (visit: Visit) => {
    this.type = visit.history.popstate ? "default" : this.pendingType;
    this.pendingType = "default";

    if (!this.isParallel()) {
      visit.animation.parallel = false;
    } else {
      visit.scroll.reset = false;
    }

    await closeModals();
  };

  private onAnimationOutStart = async (visit: Visit) => {
    events.emit("transition:start", {
      from: new URL(visit.from.url, window.location.origin).pathname,
      to: new URL(visit.to.url, window.location.origin).pathname,
      type: this.type,
    });

    Scroll.stop();

    if (this.type === "default") {
      await this.animateOutDefault();
    }
  };

  private beforeContentInsert = (
    _visit: Visit,
    { containers }: HookArguments<"content:insert">,
  ) => {
    containers.forEach(({ next }) => next.classList.add(INCOMING_CLASS));
  };

  private onContentReplace = () => {
    if (this.isParallel()) return;

    Scroll.scrollTo(0, { immediate: true, force: true });
    Scroll.destroy();

    this.onContentReplaced();
  };

  private onAnimationInStart = async () => {
    await this.onLoadPage();

    if (this.type === "default") {
      Scroll.init();
      Scroll.start();

      events.emit("page:revealed");

      await this.animateInDefault();

      events.emit("transition:end");
      return;
    }

    const previous = document.querySelector<HTMLElement>(
      "#swup.is-previous-container",
    );
    const next = document.querySelector<HTMLElement>(`#swup.${INCOMING_CLASS}`);

    if (!previous || !next) {
      gsap.set(next, { autoAlpha: 1 });
      return;
    }

    await this.transitions[this.type].animateIn({ previous, next });
  };

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

    if (this.type !== "default") {
      this.transitions[this.type].arrive?.();
    }

    events.emit("transition:end");
  };

  private onVisitAbort = () => {
    events.emit("transition:end");
  };

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
}
