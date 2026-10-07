import { events, type View } from "../../scripts/utils/events";

export class HomeFooter extends HTMLElement {
  $toggles: HTMLButtonElement[];

  view: View = "wide";
  isTransitioning = false;

  constructor() {
    super();

    this.$toggles = Array.from(
      this.querySelectorAll('[data-home-footer="toggle"]'),
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
    this.$toggles.forEach(($toggle) =>
      $toggle.addEventListener("click", this.onToggle),
    );

    events.on("home:shown", this.onShown);
  }

  unbindEvents() {
    this.$toggles.forEach(($toggle) =>
      $toggle.removeEventListener("click", this.onToggle),
    );

    events.off("home:shown", this.onShown);
  }

  onToggle = (event: MouseEvent) => {
    const view = (event.currentTarget as HTMLElement).dataset.view as View;

    if (this.isTransitioning || view === this.view) return;

    this.isTransitioning = true;
    this.press(view);

    // c-home-wide and c-home-list run the switch; the footer only asks.
    events.emit("home:view", { view });
  };

  /** Also when a switch was refused: the button follows what is shown. */
  onShown = ({ view }: { view: View }) => {
    this.isTransitioning = false;
    this.view = view;
    this.press(view);
  };

  /**
   * Methods.
   */
  press(view: View) {
    this.$toggles.forEach(($toggle) => {
      $toggle.setAttribute(
        "aria-pressed",
        String($toggle.dataset.view === view),
      );
    });
  }
}

if (!customElements.get("c-home-footer")) {
  customElements.define("c-home-footer", HomeFooter);
}
