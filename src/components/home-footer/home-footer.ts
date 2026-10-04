import { ScrollTrigger } from "gsap/ScrollTrigger";

import Scroll from "../../scripts/classes/Scroll";

export class HomeFooter extends HTMLElement {
  private $toggles: HTMLButtonElement[];
  private $year: HTMLElement | null;

  constructor() {
    super();

    this.$toggles = Array.from(
      this.querySelectorAll('[data-home-footer="toggle"]'),
    );
    this.$year = this.querySelector('[data-home-footer="year"]');
  }

  /**
   * Lifecycle
   */
  connectedCallback() {
    if (this.$year) {
      this.$year.textContent = String(new Date().getFullYear());
    }

    this.bindEvents();
  }

  disconnectedCallback() {
    this.unbindEvents();
  }

  /**
   * Events
   */
  private bindEvents() {
    this.$toggles.forEach(($toggle) =>
      $toggle.addEventListener("click", this.onToggle),
    );
  }

  private unbindEvents() {
    this.$toggles.forEach(($toggle) =>
      $toggle.removeEventListener("click", this.onToggle),
    );
  }

  private onToggle = (event: MouseEvent) => {
    const view = (event.currentTarget as HTMLElement).dataset.view;

    if (view) {
      this.show(view);
    }
  };

  /**
   * Methods
   */
  private show(view: string) {
    this.$toggles.forEach(($toggle) => {
      $toggle.setAttribute(
        "aria-pressed",
        String($toggle.dataset.view === view),
      );
    });

    document
      .querySelectorAll<HTMLElement>("[data-home-view]")
      .forEach(($view) => {
        $view.hidden = $view.dataset.homeView !== view;
      });

    Scroll.scrollTo(0, { immediate: true });
    ScrollTrigger.refresh();
  }
}

if (!customElements.get("c-home-footer")) {
  customElements.define("c-home-footer", HomeFooter);
}
