import gsap from "gsap";

import { device } from "../../scripts/classes/Device";
import { responsive } from "../../scripts/classes/Responsive";
import { events } from "../../scripts/utils/events";
import { pad } from "../../scripts/utils/math";

const EASE = "none";

const CREEP = { value: 90, duration: 2 };
const FINISH = 0.4;

// The halves parting from the middle, like the home's wide view. The page
// reveals `reveal` seconds after they start.
const SPLIT = { duration: 0.8, ease: "expo.out", reveal: 0.1 };

// seconds between two faces
const FLASH = 0.25;

// rem between the faces and the %, once it has climbed up to them
const GAP = 2.4;

export class Preloader extends HTMLElement {
  private $panel: HTMLElement | null;
  private $count: HTMLElement | null;
  private $progress: HTMLElement | null;
  private $images: HTMLElement[];

  private progress = { value: 0 };
  private isLoaded = false;
  private onLoaded: (() => void) | null = null;

  private travel = 0;
  private face = 0;
  private flashTimer: number | null = null;

  constructor() {
    super();

    this.$panel = this.querySelector('[data-preloader="panel"]');
    this.$count = this.querySelector('[data-preloader="count"]');
    this.$progress = this.querySelector('[data-preloader="progress"]');
    this.$images = Array.from(
      this.querySelectorAll<HTMLElement>('[data-preloader="image"]'),
    );
  }

  /**
   * Lifecycle
   */
  connectedCallback() {
    this.bindEvents();

    this.measure();
    this.showFace(0);
    this.startFlash();
    this.creep();
  }

  disconnectedCallback() {
    this.unbindEvents();
    this.stopFlash();

    gsap.killTweensOf(this.progress);
    gsap.killTweensOf(this);
  }

  /**
   * Events
   */
  private bindEvents() {
    events.on("page:loaded", this.onPageLoaded);
  }

  private unbindEvents() {
    events.off("page:loaded", this.onPageLoaded);
  }

  /**
   * Methods
   */
  private onPageLoaded = () => {
    this.isLoaded = true;

    this.onLoaded?.();
  };

  private measure() {
    if (!this.$progress || !this.$images.length) return;

    const bottom = Math.max(
      ...this.$images.map(($image) => $image.getBoundingClientRect().bottom),
    );
    const gap = GAP * responsive.fontSize;

    this.travel = this.$progress.getBoundingClientRect().top - (bottom + gap);
  }

  private render = () => {
    const value = this.progress.value;

    if (this.$count) {
      this.$count.textContent = pad(Math.round(value));
    }

    if (this.$progress) {
      gsap.set(this.$progress, { y: (-this.travel * value) / 100 });
    }
  };

  private showFace(index: number) {
    this.face = index;

    this.$images.forEach(($image, i) => {
      $image.style.visibility = i === index ? "visible" : "hidden";
    });
  }

  private startFlash() {
    if (device.reducedMotion || this.$images.length < 2) return;

    this.flashTimer = window.setInterval(() => {
      this.showFace((this.face + 1) % this.$images.length);
    }, FLASH * 1000);
  }

  private stopFlash() {
    if (this.flashTimer === null) return;

    window.clearInterval(this.flashTimer);
    this.flashTimer = null;
  }

  // Copied once the count reads 100, so both halves show the same frame.
  private split(duration: number) {
    const $top = this.$panel;

    // The faces cycle through the count's last stretch, and freeze here.
    this.stopFlash();

    if (!$top) return Promise.resolve();

    // The page underneath is live from now on.
    this.style.pointerEvents = "none";

    const $bottom = $top.cloneNode(true) as HTMLElement;
    $bottom.setAttribute("aria-hidden", "true");
    this.append($bottom);

    gsap.set($top, { clipPath: "inset(0% 0% 50% 0%)" });
    gsap.set($bottom, { clipPath: "inset(50% 0% 0% 0%)" });

    return gsap
      .timeline({ defaults: { duration, ease: SPLIT.ease } })
      .to($top, { yPercent: -50 }, 0)
      .to($bottom, { yPercent: 50 }, 0);
  }

  private creep() {
    if (device.reducedMotion) return;

    gsap.to(this.progress, {
      value: CREEP.value,
      duration: CREEP.duration,
      ease: EASE,
      onUpdate: this.render,
    });
  }

  public play() {
    console.log(this.isLoaded);

    return new Promise<void>((resolve) => {
      const finish = () => {
        gsap.killTweensOf(this.progress);

        const duration = device.reducedMotion ? 0 : 2;

        gsap.to(this.progress, {
          value: 100,
          duration: FINISH * duration,
          ease: EASE,
          onUpdate: this.render,
          onComplete: async () => {
            // The page reveals while the halves part, not after.
            gsap.delayedCall(SPLIT.reveal * duration, resolve);

            await this.split(SPLIT.duration * duration);

            this.remove();
          },
        });
      };

      if (this.isLoaded) {
        finish();

        return;
      }

      this.onLoaded = finish;
    });
  }
}

if (!customElements.get("c-preloader")) {
  customElements.define("c-preloader", Preloader);
}
