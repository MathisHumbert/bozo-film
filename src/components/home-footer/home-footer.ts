import gsap from "gsap";
import { SplitText } from "gsap/SplitText";

import { device } from "../../scripts/classes/Device";
import { events, type View } from "../../scripts/utils/events";
import { reveal } from "../../scripts/utils/reveal";

// Page transitions: the text slides through its line. The page appearing
// uses the shared reveal, see utils/reveal.
const DURATION = {
  show: 0.8,
  hide: 0.4,
};

const EASE = {
  show: "expo.out",
  hide: "expo.out",
};

export class HomeFooter extends HTMLElement {
  $toggles: HTMLButtonElement[];
  $year: HTMLElement | null;

  splits: SplitText[] = [];

  view: View = "wide";
  isTransitioning = false;

  constructor() {
    super();

    this.$toggles = Array.from(
      this.querySelectorAll('[data-home-footer="toggle"]'),
    );
    this.$year = this.querySelector('[data-home-footer="year"]');
  }

  connectedCallback() {
    this.splits = this.$items.map(($item) =>
      SplitText.create($item, {
        type: "lines",
        mask: "lines",
        aria: "none",
        autoSplit: true,
      }),
    );

    this.bindEvents();
  }

  disconnectedCallback() {
    this.unbindEvents();

    this.splits.forEach((split) => split.revert());
    this.splits = [];
  }

  /**
   * Getters.
   */
  get $items() {
    return [...this.$toggles, ...(this.$year ? [this.$year] : [])];
  }

  get $lines() {
    return this.splits.flatMap((split) => split.lines as HTMLElement[]);
  }

  /**
   * Events.
   */
  bindEvents() {
    this.$toggles.forEach(($toggle) =>
      $toggle.addEventListener("click", this.onToggle),
    );

    events.on("home:shown", this.onShown);
    events.on("page:revealed", this.reveal);
  }

  unbindEvents() {
    this.$toggles.forEach(($toggle) =>
      $toggle.removeEventListener("click", this.onToggle),
    );

    events.off("home:shown", this.onShown);
    events.off("page:revealed", this.reveal);
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
   * Animations.
   */
  reveal = () => {
    reveal(this.$items);
  };

  show(tl: gsap.core.Timeline, position: number) {
    const speed = device.reducedMotion ? 0 : 1;

    tl.fromTo(
      this.$lines,
      { yPercent: 100 },
      {
        yPercent: 0,
        duration: DURATION.show * speed,
        ease: EASE.show,
        stagger: 0.03,
      },
      position,
    );
  }

  hide(tl: gsap.core.Timeline, position: number) {
    const speed = device.reducedMotion ? 0 : 1;

    tl.to(
      this.$lines,
      { yPercent: 100, duration: DURATION.hide * speed, ease: EASE.hide },
      position,
    );
  }

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
