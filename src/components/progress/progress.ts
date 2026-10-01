import gsap from "gsap";
import CustomEase from "gsap/CustomEase";

import { events } from "../../scripts/utils/events";

// same curve as the --ease-expo-out token, not gsap's exponential "expo.out"
const EASE = CustomEase.create("progressExpoOut", "0.19, 1, 0.22, 1");

const CREEP = { scaleX: 0.9, duration: 8 };
const FINISH = 0.2;
const RETRACT = 0.6;

const MIN_VISIBLE = 0.6;

export class Progress extends HTMLElement {
  private $bar: HTMLElement | null;

  private isRunning = false;
  private startedAt = 0;
  private pending: gsap.core.Tween | null = null;

  constructor() {
    super();

    this.$bar = this.querySelector('[data-progress="bar"]');
  }

  /**
   * Lifecycle
   */
  connectedCallback() {
    this.bindEvents();

    this.start();
  }

  disconnectedCallback() {
    this.unbindEvents();

    this.pending?.kill();
    gsap.killTweensOf(this.$bar);
  }

  /**
   * Events
   */
  private bindEvents() {
    events.on("page:loaded", this.complete);
    events.on("transition:start", this.start);
    events.on("transition:end", this.complete);
  }

  private unbindEvents() {
    events.off("page:loaded", this.complete);
    events.off("transition:start", this.start);
    events.off("transition:end", this.complete);
  }

  /**
   * Methods
   */
  private start = () => {
    if (this.isRunning || !this.$bar) return;

    this.isRunning = true;
    this.startedAt = performance.now();

    this.pending?.kill();
    gsap.killTweensOf(this.$bar);
    gsap.set(this.$bar, { transformOrigin: "0% 50%", scaleX: 0 });
    gsap.to(this.$bar, { ...CREEP, ease: EASE });
  };

  private complete = () => {
    if (!this.isRunning || !this.$bar) return;

    this.isRunning = false;

    const elapsed = (performance.now() - this.startedAt) / 1000;

    this.pending = gsap.delayedCall(Math.max(MIN_VISIBLE - elapsed, 0), () => {
      gsap.killTweensOf(this.$bar);

      gsap
        .timeline()
        .to(this.$bar, { scaleX: 1, duration: FINISH, ease: EASE })
        .set(this.$bar, { transformOrigin: "100% 50%" })
        .to(this.$bar, { scaleX: 0, duration: RETRACT, ease: EASE });
    });
  };
}

if (!customElements.get("c-progress")) {
  customElements.define("c-progress", Progress);
}
