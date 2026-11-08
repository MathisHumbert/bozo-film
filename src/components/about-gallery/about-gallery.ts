import { ScrollTrigger } from "gsap/ScrollTrigger";

export class AboutGallery extends HTMLElement {
  private $images: HTMLElement[] = [];
  private trigger: ScrollTrigger | null = null;
  private active = 0;

  /**
   * Lifecycle
   */
  connectedCallback() {
    const $grid = this.parentElement;

    this.$images = [
      ...this.querySelectorAll<HTMLElement>('[data-about-gallery="image"]'),
    ];

    if (!$grid || this.$images.length < 2) return;

    // The scroll picks one image, like a gif. Every image up to it stays shown,
    // so each fades in over the last with no dip to black.
    this.trigger = ScrollTrigger.create({
      trigger: $grid,
      start: () => `top ${parseFloat(getComputedStyle(this).top)}px`,
      end: () =>
        `bottom ${parseFloat(getComputedStyle(this).top) + this.offsetHeight}px`,
      invalidateOnRefresh: true,
      onUpdate: ({ progress }) => {
        const count = this.$images.length;
        const active = Math.min(Math.floor(progress * count), count - 1);

        if (active === this.active) return;

        this.active = active;
        this.$images.forEach(($image, index) => {
          $image.toggleAttribute("data-shown", index <= active);
        });
      },
    });
  }

  disconnectedCallback() {
    this.trigger?.kill();
    this.trigger = null;
  }
}

if (!customElements.get("c-about-gallery")) {
  customElements.define("c-about-gallery", AboutGallery);
}
