import { events } from "../../scripts/utils/events";
import { reveal } from "../../scripts/utils/reveal";

// The preloader's top half clears the top of the screen last: on the first
// load the links wait for it, or their reveal is over before they are in view.
// The logo is tall enough to show early, so it keeps the plain timing.
const INTRO_DELAY = 0.2;

export class Nav extends HTMLElement {
  $logo: HTMLElement | null;
  $links: HTMLElement[];

  constructor() {
    super();

    this.$logo = this.querySelector<HTMLElement>("[data-nav-logo]");
    this.$links = Array.from(
      this.querySelectorAll<HTMLElement>(
        "[data-nav] a:not([data-nav-logo]), [data-nav] button",
      ),
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
  reveal = ({ intro }: { intro: boolean }) => {
    events.off("page:revealed", this.reveal);

    if (this.$logo) reveal(this.$logo, { from: "top", intro });

    // Links are block, not inline: a transform does nothing on an inline box.
    reveal(this.$links, {
      from: "top",
      intro,
      delay: intro ? INTRO_DELAY : 0,
    });
  };
}

if (!customElements.get("c-nav")) {
  customElements.define("c-nav", Nav);
}
