import { events } from "../../scripts/utils/events";
import { reveal } from "../../scripts/utils/reveal";

export class Nav extends HTMLElement {
  $items: HTMLElement[];

  constructor() {
    super();

    this.$items = Array.from(
      this.querySelectorAll<HTMLElement>("[data-nav] a, [data-nav] button"),
    );
  }

  connectedCallback() {
    this.bindEvents();
  }

  disconnectedCallback() {
    this.unbindEvents();
  }

  /**
   * Events.
   */
  bindEvents() {
    events.on("page:revealed", this.reveal);
  }

  unbindEvents() {
    events.off("page:revealed", this.reveal);
  }

  /**
   * Animations.
   */
  reveal = () => {
    events.off("page:revealed", this.reveal);

    reveal(this.$items, { from: "top" });
  };
}

if (!customElements.get("c-nav")) {
  customElements.define("c-nav", Nav);
}
