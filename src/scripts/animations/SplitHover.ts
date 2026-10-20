import gsap from "gsap";

import { device } from "../classes/Device";

const DURATION = {
  out: 0.2,
  in: 0.8,
};

const EASE = {
  out: "power1.in",
  in: "expo.out",
};

const SPILL = "-25%";
const SIDE = "-10%";

const TOP = {
  shown: `inset(${SPILL} ${SIDE} 50% ${SIDE})`,
  edge: `inset(50% ${SIDE} 50% ${SIDE})`,
  center: `inset(0% ${SIDE} 100% ${SIDE})`,
};

const BOTTOM = {
  shown: `inset(50% ${SIDE} ${SPILL} ${SIDE})`,
  edge: `inset(50% ${SIDE} 50% ${SIDE})`,
  center: `inset(100% ${SIDE} 0% ${SIDE})`,
};

const BLUR = {
  shown: "blur(0em)",
  hidden: "blur(0.12em)",
};

export default class SplitHover {
  private element: HTMLElement;
  private trigger: HTMLElement | null = null;
  private top: HTMLElement | null = null;
  private bottom: HTMLElement | null = null;
  private tl: gsap.core.Timeline | null = null;

  constructor({ element }: { element: HTMLElement }) {
    this.element = element;
  }

  create() {
    this.trigger = this.element.closest<HTMLElement>("a, button");
    this.trigger?.addEventListener("pointerenter", this.onPointerEnter);
  }

  destroy() {
    this.trigger?.removeEventListener("pointerenter", this.onPointerEnter);
    this.trigger = null;

    this.tl?.kill();
    this.tl = null;

    this.unbuild();
  }

  onPointerEnter = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || device.reducedMotion) return;

    this.animate();
  };

  build() {
    if (this.top?.isConnected && this.bottom?.isConnected) return;

    this.top = document.createElement("span");
    this.top.dataset.splitHalf = "top";
    this.top.style.display = "block";
    this.top.append(...this.element.childNodes);

    this.bottom = this.top.cloneNode(true) as HTMLElement;
    this.bottom.dataset.splitHalf = "bottom";
    this.bottom.setAttribute("aria-hidden", "true");
    this.bottom.style.position = "absolute";
    this.bottom.style.inset = "0";

    this.element.style.position = "relative";
    this.element.style.display = "inline-block";
    this.element.append(this.top, this.bottom);

    gsap.set(this.top, { clipPath: TOP.shown });
    gsap.set(this.bottom, { clipPath: BOTTOM.shown });
  }

  unbuild() {
    if (this.top?.isConnected) {
      this.element.append(...this.top.childNodes);
    }

    this.top?.remove();
    this.bottom?.remove();
    this.top = null;
    this.bottom = null;

    this.element.style.position = "";
    this.element.style.display = "";
  }

  animate() {
    if (this.tl?.isActive()) return;

    this.build();

    const top = this.top!;
    const bottom = this.bottom!;

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set([top, bottom], { clearProps: "filter" });
      },
    });

    tl.fromTo(
      top,
      { yPercent: 0, clipPath: TOP.shown, filter: BLUR.shown },
      {
        yPercent: -50,
        clipPath: TOP.edge,
        filter: BLUR.hidden,
        duration: DURATION.out,
        ease: EASE.out,
      },
      0,
    )
      .fromTo(
        bottom,
        { yPercent: 0, clipPath: BOTTOM.shown, filter: BLUR.shown },
        {
          yPercent: 50,
          clipPath: BOTTOM.edge,
          filter: BLUR.hidden,
          duration: DURATION.out,
          ease: EASE.out,
        },
        0,
      )
      .fromTo(
        top,
        { yPercent: 50, clipPath: TOP.center, filter: BLUR.hidden },
        {
          yPercent: 0,
          clipPath: TOP.shown,
          filter: BLUR.shown,
          duration: DURATION.in,
          ease: EASE.in,
          immediateRender: false,
        },
      )
      .fromTo(
        bottom,
        { yPercent: -50, clipPath: BOTTOM.center, filter: BLUR.hidden },
        {
          yPercent: 0,
          clipPath: BOTTOM.shown,
          filter: BLUR.shown,
          duration: DURATION.in,
          ease: EASE.in,
          immediateRender: false,
        },
        "<",
      );

    this.tl = tl;
  }
}
