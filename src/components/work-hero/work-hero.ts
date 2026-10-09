import gsap from "gsap";

import Scroll from "../../scripts/classes/Scroll";
import { device } from "../../scripts/classes/Device";
import { events } from "../../scripts/utils/events";
import { attachSources } from "../../scripts/utils/video";

const IDLE = 3500;

const EASE = "power2.out";
const FADE = 0.6;
const SCROLL = 1.2;

export class WorkHero extends HTMLElement {
  private $preview: HTMLVideoElement | null;
  private $mainWrapper: HTMLElement | null;
  private $main: HTMLVideoElement | null;
  private $title: HTMLElement | null;
  private $duration: HTMLElement | null;
  private $toggle: HTMLButtonElement | null;
  private $label: HTMLElement | null;

  private $nav: HTMLElement | null = null;

  private isPlaying = false;
  private isIdle = false;
  private idleTimer: number | null = null;

  constructor() {
    super();

    this.$preview = this.querySelector('[data-work-hero="preview"] video');
    this.$mainWrapper = this.querySelector('[data-work-hero="main"]');
    this.$main = this.querySelector('[data-work-hero="main"] video');
    this.$title = this.querySelector('[data-work-hero="title"]');
    this.$duration = this.querySelector('[data-work-hero="duration"]');
    this.$toggle = this.querySelector('[data-work-hero="toggle"]');
    this.$label = this.querySelector('[data-work-hero="label"]');
  }

  /**
   * Lifecycle
   */
  connectedCallback() {
    if (!this.$main || !this.$toggle) return;

    this.$nav = document.querySelector("[data-nav]");

    this.bindEvents();
  }

  disconnectedCallback() {
    this.unbindEvents();
    this.clearIdle();

    if (this.isPlaying) {
      Scroll.resume();
    }

    if (this.$nav) {
      gsap.killTweensOf(this.$nav);
      gsap.set(this.$nav, { autoAlpha: 1 });
    }
  }

  /**
   * Events
   */
  private bindEvents() {
    this.$toggle?.addEventListener("click", this.onToggle);
    this.$main?.addEventListener("ended", this.onEnded);

    window.addEventListener("keydown", this.onKeyDown);
    events.on("touchmove", this.onActivity);
    events.on("touchdown", this.onActivity);
    events.on("wheel", this.onActivity);
  }

  private unbindEvents() {
    this.$toggle?.removeEventListener("click", this.onToggle);
    this.$main?.removeEventListener("ended", this.onEnded);

    window.removeEventListener("keydown", this.onKeyDown);
    events.off("touchmove", this.onActivity);
    events.off("touchdown", this.onActivity);
    events.off("wheel", this.onActivity);
  }

  private onToggle = () => {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  };

  private onEnded = () => {
    this.pause();
    this.reset();
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && this.isPlaying) {
      this.pause();
      return;
    }

    this.onActivity();
  };

  private onActivity = () => {
    if (this.isPlaying) {
      this.wake();
    }
  };

  /**
   * Methods
   */
  private play() {
    if (!this.$main) return;

    this.isPlaying = true;
    this.setLabel("PAUSE");

    attachSources(this.$main);
    this.$main.play().catch(() => this.pause());
    this.$preview?.pause();

    if (Scroll.scroll > 0) {
      Scroll.scrollTo(0, {
        force: true,
        duration: this.duration(SCROLL),
        onComplete: () => Scroll.stop(),
      });
    }

    gsap.to(this.$mainWrapper, {
      autoAlpha: 1,
      duration: this.duration(FADE),
      ease: EASE,
    });

    gsap.to(this.$nav, {
      autoAlpha: 0,
      duration: this.duration(FADE),
      ease: EASE,
    });
    gsap.to(this.$title, {
      opacity: 0,
      duration: this.duration(FADE),
      ease: EASE,
    });

    this.wake();
  }

  private pause() {
    this.isPlaying = false;
    this.setLabel("WATCH");

    this.$main?.pause();

    Scroll.resume();

    gsap.to(this.$nav, {
      autoAlpha: 1,
      duration: this.duration(FADE),
      ease: EASE,
    });
    gsap.to(this.$title, {
      opacity: 1,
      duration: this.duration(FADE),
      ease: EASE,
    });

    this.wake();
  }

  private reset() {
    gsap.to(this.$mainWrapper, {
      autoAlpha: 0,
      duration: this.duration(FADE),
      ease: EASE,
      onComplete: () => {
        if (this.$main) {
          this.$main.currentTime = 0;
        }
      },
    });

    this.$preview?.play().catch(() => undefined);
  }

  private wake() {
    this.clearIdle();

    if (this.isIdle) {
      this.isIdle = false;
      this.style.cursor = "";

      gsap.to([this.$toggle, this.$duration], {
        opacity: 1,
        duration: this.duration(FADE / 2),
        ease: EASE,
      });
    }

    if (this.isPlaying) {
      this.idleTimer = window.setTimeout(this.sleep, IDLE);
    }
  }

  private sleep = () => {
    this.isIdle = true;
    this.style.cursor = "none";

    gsap.to([this.$toggle, this.$duration], {
      opacity: 0,
      duration: this.duration(FADE),
      ease: EASE,
    });
  };

  private clearIdle() {
    if (this.idleTimer === null) return;

    window.clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private setLabel(label: string) {
    if (this.$label) {
      this.$label.textContent = label;
    }
  }

  private duration(seconds: number) {
    return device.reducedMotion ? 0 : seconds;
  }
}

if (!customElements.get("c-work-hero")) {
  customElements.define("c-work-hero", WorkHero);
}
