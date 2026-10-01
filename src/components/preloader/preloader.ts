import gsap from "gsap";

import { device } from "../../scripts/classes/Device";
import { events } from "../../scripts/utils/events";
import { pad } from "../../scripts/utils/math";

const EASE = "expo.out";

const CREEP = { value: 90, duration: 8 };
const FINISH = 0.4;
const FADE = 0.6;

export class Preloader extends HTMLElement {
  private $count: HTMLElement | null;

  private progress = { value: 0 };
  private isLoaded = false;
  private onLoaded: (() => void) | null = null;

  constructor() {
    super();

    this.$count = this.querySelector('[data-preloader="count"]');
  }

  /**
   * Lifecycle
   */
  connectedCallback() {
    this.bindEvents();

    this.creep();
  }

  disconnectedCallback() {
    this.unbindEvents();

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

  private render = () => {
    if (this.$count) {
      this.$count.textContent = pad(Math.round(this.progress.value));
    }
  };

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
    return new Promise<void>((resolve) => {
      const finish = () => {
        gsap.killTweensOf(this.progress);

        const duration = device.reducedMotion ? 0 : 2;

        gsap
          .timeline({
            onComplete: () => {
              resolve();

              this.remove();
            },
          })
          .to(this.progress, {
            value: 100,
            duration: FINISH * duration,
            ease: EASE,
            onUpdate: this.render,
          })
          .to(this, {
            opacity: 0,
            duration: FADE * duration,
            ease: "sine.out",
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
