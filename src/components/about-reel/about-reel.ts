import gsap from "gsap";

import Scroll from "../../scripts/classes/Scroll";
import { device } from "../../scripts/classes/Device";
import { mattEasing } from "../../scripts/utils/easing";
import { attachSources } from "../../scripts/utils/video";

const DURATION = {
  expand: 1.2,
  fade: 0.6,
};

const EASE = {
  expand: mattEasing,
  fade: "power2.out",
};

export class AboutReel extends HTMLElement {
  private $frame: HTMLElement | null;
  private $main: HTMLVideoElement | null;
  private $mainWrapper: HTMLElement | null;
  private $toggle: HTMLButtonElement | null;
  private $label: HTMLElement | null;

  private $nav: HTMLElement | null = null;

  private isPlaying = false;
  private tl: gsap.core.Timeline | null = null;

  constructor() {
    super();

    this.$frame = this.querySelector('[data-about-reel="frame"]');
    this.$main = this.querySelector('[data-about-reel="main"] video');
    this.$mainWrapper = this.querySelector('[data-about-reel="main"]');
    this.$toggle = this.querySelector('[data-about-reel="toggle"]');
    this.$label = this.querySelector('[data-about-reel="label"]');
  }

  /**
   * Lifecycle
   */
  connectedCallback() {
    if (!this.$frame || !this.$main || !this.$toggle) return;

    this.$nav = document.querySelector("[data-nav]");

    this.bindEvents();
  }

  disconnectedCallback() {
    this.unbindEvents();

    this.tl?.kill();

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
    window.addEventListener("resize", this.onResize);
  }

  private unbindEvents() {
    this.$toggle?.removeEventListener("click", this.onToggle);
    this.$main?.removeEventListener("ended", this.onEnded);

    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("resize", this.onResize);
  }

  private onToggle = () => {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  };

  private onEnded = () => {
    if (this.$main) {
      this.$main.currentTime = 0;
    }

    this.pause();
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && this.isPlaying) {
      this.pause();
    }
  };

  // Open, the frame follows the window.
  private onResize = () => {
    if (!this.isPlaying || this.tl?.isActive()) return;

    gsap.set(this.$frame, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
  };

  /**
   * Getters
   */
  private get $preview() {
    return this.querySelector<HTMLVideoElement>(
      '[data-about-reel="preview"] video',
    );
  }

  /**
   * Methods
   */
  private play() {
    if (!this.$frame || !this.$main) return;

    const speed = device.reducedMotion ? 0 : 1;
    const rect = this.$frame.getBoundingClientRect();

    this.isPlaying = true;
    this.setLabel("Pause Reel");

    Scroll.stop();

    attachSources(this.$main);
    this.$main.play().catch(() => this.pause());

    this.tl?.kill();

    gsap.set(this.$frame, {
      position: "fixed",
      zIndex: 10,
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });

    const tl = gsap.timeline({
      onComplete: () => this.$preview?.pause(),
    });

    tl.to(
      this.$frame,
      {
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        duration: DURATION.expand * speed,
        ease: EASE.expand,
      },
      0,
    )
      .to(
        this.$mainWrapper,
        {
          autoAlpha: 1,
          duration: DURATION.fade * speed,
          ease: EASE.fade,
        },
        0,
      )
      .to(
        this.$nav,
        {
          autoAlpha: 0,
          duration: DURATION.fade * speed,
          ease: EASE.fade,
        },
        0,
      );

    this.tl = tl;
  }

  private pause() {
    if (!this.$frame) return;

    const speed = device.reducedMotion ? 0 : 1;
    const rect = this.getBoundingClientRect();

    this.isPlaying = false;
    this.setLabel("Play Reel");

    this.$main?.pause();
    this.$preview?.play().catch(() => undefined);

    this.tl?.kill();

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(this.$frame, {
          clearProps: "position,zIndex,top,left,width,height",
        });

        Scroll.resume();
      },
    });

    tl.to(
      this.$frame,
      {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        duration: DURATION.expand * speed,
        ease: EASE.expand,
      },
      0,
    )
      .to(
        this.$mainWrapper,
        {
          autoAlpha: 0,
          duration: DURATION.fade * speed,
          ease: EASE.fade,
        },
        (DURATION.expand - DURATION.fade) * speed,
      )
      .to(
        this.$nav,
        {
          autoAlpha: 1,
          duration: DURATION.fade * speed,
          ease: EASE.fade,
        },
        (DURATION.expand - DURATION.fade) * speed,
      );

    this.tl = tl;
  }

  private setLabel(label: string) {
    if (!this.$label) return;

    const $halves = this.$label.querySelectorAll("[data-split-half]");

    if ($halves.length) {
      $halves.forEach(($half) => ($half.textContent = label));
    } else {
      this.$label.textContent = label;
    }
  }
}

if (!customElements.get("c-about-reel")) {
  customElements.define("c-about-reel", AboutReel);
}
