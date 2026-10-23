import gsap from "gsap";

export class AboutGallery extends HTMLElement {
  private tween: gsap.core.Tween | null = null;

  /**
   * Lifecycle
   */
  connectedCallback() {
    const $grid = this.parentElement;

    if (!$grid) return;

    this.tween = gsap.fromTo(
      $grid,
      { "--progress": 0 },
      {
        "--progress": 1,
        ease: "none",
        scrollTrigger: {
          trigger: $grid,
          start: "top top",
          end: () =>
            `bottom ${parseFloat(getComputedStyle(this).top) + this.offsetHeight}px`,
          scrub: true,
          invalidateOnRefresh: true,
        },
      },
    );
  }

  disconnectedCallback() {
    this.tween?.scrollTrigger?.kill();
    this.tween?.kill();
    this.tween = null;
  }
}

if (!customElements.get("c-about-gallery")) {
  customElements.define("c-about-gallery", AboutGallery);
}
