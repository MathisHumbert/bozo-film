import gsap from "gsap";
import { mattEasing } from "../utils/easing";

const DURATION = {
  leave: 0.4,
  enter: 0.6,
  delay: 0.1,
};

const EASE = {
  swap: mattEasing,
};

export default class Link {
  private element: HTMLElement;
  private first: HTMLElement | null = null;
  private second: HTMLElement | null = null;
  private tl: gsap.core.Timeline | null = null;
  private isBlocked = false;

  constructor({ element }: { element: HTMLElement }) {
    this.element = element;
  }

  create() {
    this.first = this.element.querySelector('[data-link-line="first"]');
    this.second = this.element.querySelector('[data-link-line="second"]');

    if (!this.first || !this.second) return;

    this.element.addEventListener("pointerenter", this.onPointerEnter);
    this.element.addEventListener("pointerleave", this.onPointerLeave);
    this.element.addEventListener("pointerdown", this.onPointerDown);
  }

  destroy() {
    this.element.removeEventListener("pointerenter", this.onPointerEnter);
    this.element.removeEventListener("pointerleave", this.onPointerLeave);
    this.element.removeEventListener("pointerdown", this.onPointerDown);

    this.tl?.kill();
    this.tl = null;
  }

  onPointerDown = (event: PointerEvent) => {
    const isModified =
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

    if (event.button !== 0 || isModified) return;

    this.isBlocked = true;
    this.tl?.kill();
  };

  onPointerEnter = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || this.isBlocked) return;

    this.tl?.kill();
    gsap.killTweensOf([this.first, this.second]);

    const tl = gsap.timeline();

    tl.set(this.first, { transformOrigin: "right" })
      .to(
        this.first,
        { scaleX: 0, duration: DURATION.leave, ease: EASE.swap },
        0,
      )
      .set(this.second, { transformOrigin: "left" }, 0)
      .to(
        this.second,
        { scaleX: 1, duration: DURATION.enter, ease: EASE.swap },
        DURATION.delay,
      );

    this.tl = tl;
  };

  onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || this.isBlocked) return;

    this.tl?.kill();
    gsap.killTweensOf([this.first, this.second]);

    const tl = gsap.timeline();

    tl.set(this.second, { transformOrigin: "left" })
      .to(
        this.second,
        { scaleX: 0, duration: DURATION.leave, ease: EASE.swap },
        0,
      )
      .set(this.first, { transformOrigin: "right" }, 0)
      .to(
        this.first,
        { scaleX: 1, duration: DURATION.enter, ease: EASE.swap },
        DURATION.delay,
      );

    this.tl = tl;
  };
}
