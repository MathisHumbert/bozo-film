import gsap from "gsap";

import { device } from "../../scripts/classes/Device";
import { responsive } from "../../scripts/classes/Responsive";
import Scroll from "../../scripts/classes/Scroll";
import { events, type UpdateData } from "../../scripts/utils/events";
import { mod } from "../../scripts/utils/math";
import { reveal } from "../../scripts/utils/reveal";
import { masonry } from "../../scripts/utils/dom";
import { mattEasing } from "../../scripts/utils/easing";

const LAG = { base: 0.5, scale: 0.2 };

const CATCH_UP = 5;

const SWITCH = { duration: 0.6, ease: "expo.in", stagger: 0.06, catchUp: 2.5 };

const REVEAL = { duration: 1.4, ease: mattEasing, stagger: 0.1 };

const MOBILE_COLUMNS = 3;

interface Column {
  $window: HTMLElement;
  $column: HTMLElement;
  $set: HTMLElement;
  period: number;
  lag: number;
  position: number;
  shift: number;
}

export class PhotoGrid extends HTMLElement {
  $grid: HTMLElement | null;
  $windowTemplate: HTMLElement | null;
  $columnTemplate: HTMLElement | null;
  $setTemplate: HTMLElement | null;
  $items: HTMLElement[];
  $toggles: HTMLButtonElement[];

  ratios: number[];
  columns: Column[] = [];

  offset = 0;
  distance = 0;
  lastScroll = 0;

  isSwitching = false;
  isRevealing = false;

  constructor() {
    super();

    this.$grid = this.querySelector('[data-photo-grid="grid"]');
    this.$toggles = Array.from(
      this.querySelectorAll('[data-photo-grid="toggle"]'),
    );

    this.$items = Array.from(
      this.querySelectorAll<HTMLElement>('[data-photo-grid="item"]'),
    ).sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index));
    this.ratios = this.$items.map(($item) => Number($item.dataset.ratio) || 1);

    const $window = this.querySelector('[data-photo-grid="window"]');
    const $column = this.querySelector('[data-photo-grid="column"]');
    const $set = this.querySelector('[data-photo-grid="set"]');
    this.$windowTemplate = $window
      ? ($window.cloneNode(false) as HTMLElement)
      : null;
    this.$columnTemplate = $column
      ? ($column.cloneNode(false) as HTMLElement)
      : null;
    this.$setTemplate = $set ? ($set.cloneNode(false) as HTMLElement) : null;

    if (this.$grid) {
      this.columns = Array.from(
        this.$grid.querySelectorAll<HTMLElement>('[data-photo-grid="window"]'),
      ).map(($window, index, $windows) => {
        const $column = $window.querySelector<HTMLElement>(
          '[data-photo-grid="column"]',
        )!;

        return {
          $window,
          $column,
          $set: $column.querySelector<HTMLElement>('[data-photo-grid="set"]')!,
          period: 0,
          lag: this.getLag(index, $windows.length),
          position: this.distance,
          shift: 0,
        };
      });
    }
  }

  /**
   * Lifecycle
   */
  connectedCallback() {
    if (!this.$grid || !this.$items.length) return;

    this.lastScroll = Scroll.scroll;

    if (!this.fit()) {
      this.measure();
    }

    this.bindEvents();
  }

  disconnectedCallback() {
    this.unbindEvents();
  }

  /**
   * Events
   */
  bindEvents() {
    this.$toggles.forEach(($toggle) =>
      $toggle.addEventListener("click", this.onToggle),
    );

    events.on("update", this.update);
    events.on("resize", this.onResize);
    events.on("page:revealed", this.reveal);
  }

  unbindEvents() {
    this.$toggles.forEach(($toggle) =>
      $toggle.removeEventListener("click", this.onToggle),
    );

    events.off("update", this.update);
    events.off("resize", this.onResize);
    events.off("page:revealed", this.reveal);
  }

  onResize = () => {
    if (!this.fit()) {
      this.measure();
    }
  };

  onToggle = (event: MouseEvent) => {
    const $toggle = event.currentTarget as HTMLButtonElement;

    if (
      this.isSwitching ||
      this.isRevealing ||
      $toggle.getAttribute("aria-pressed") === "true"
    ) {
      return;
    }

    this.switch(Number($toggle.dataset.columns));
  };

  /**
   * Animations
   */
  reveal = () => {
    reveal(this.$toggles);

    if (device.reducedMotion) return;

    const middle = (this.columns.length - 1) / 2;

    this.isRevealing = true;

    const tl = gsap.timeline({
      onComplete: () => (this.isRevealing = false),
    });

    this.columns.forEach(({ $column }, index) => {
      const $visible = Array.from(
        $column.querySelectorAll<HTMLElement>('[data-photo-grid="item"]'),
      ).filter(($item) => {
        const rect = $item.getBoundingClientRect();

        return rect.bottom > 0 && rect.top < window.innerHeight;
      });

      if (!$visible.length) return;

      const top = Math.max(
        0,
        Math.min(...$visible.map(($item) => $item.getBoundingClientRect().top)),
      );

      tl.from(
        $visible,
        {
          y: window.innerHeight - top,
          duration: REVEAL.duration,
          ease: REVEAL.ease,
          clearProps: "transform",
        },
        Math.abs(index - middle) * REVEAL.stagger,
      );
    });
  };

  switch(count: number) {
    if (device.reducedMotion) {
      this.layout(count);
      return;
    }

    this.isSwitching = true;
    Scroll.stop();

    const middle = (this.columns.length - 1) / 2;

    const tl = gsap.timeline({
      onUpdate: () => this.render(),
      onComplete: () => {
        this.layout(count);

        this.columns.forEach((column) => (column.shift = window.innerHeight));
        this.render();

        this.isSwitching = false;
        this.lastScroll = Scroll.scroll;
        Scroll.resume();
      },
    });

    this.columns.forEach((column, index) => {
      tl.to(
        column,
        {
          shift: -window.innerHeight,
          duration: SWITCH.duration,
          ease: SWITCH.ease,
        },
        Math.abs(index - middle) * SWITCH.stagger,
      );
    });
  }

  /**
   * Methods
   */
  fit() {
    const isNarrow = window.innerWidth < responsive.breakpoints.desktop;

    if (
      this.isSwitching ||
      !isNarrow ||
      this.columns.length <= MOBILE_COLUMNS
    ) {
      return false;
    }

    this.layout(MOBILE_COLUMNS);

    return true;
  }

  layout(count: number) {
    if (
      !this.$grid ||
      !this.$windowTemplate ||
      !this.$columnTemplate ||
      !this.$setTemplate
    ) {
      return;
    }

    this.columns = masonry(this.ratios, count).map((indexes, index) => {
      const $window = this.$windowTemplate!.cloneNode(false) as HTMLElement;
      const $column = this.$columnTemplate!.cloneNode(false) as HTMLElement;
      const $set = this.$setTemplate!.cloneNode(false) as HTMLElement;

      $set.append(...indexes.map((index) => this.$items[index]));
      $column.append($set);
      $window.append($column);

      return {
        $window,
        $column,
        $set,
        period: 0,
        lag: this.getLag(index, count),
        position: this.distance,
        shift: 0,
      };
    });

    this.$grid.replaceChildren(...this.columns.map(({ $window }) => $window));

    this.$toggles.forEach(($toggle) => {
      $toggle.setAttribute(
        "aria-pressed",
        String(Number($toggle.dataset.columns) === count),
      );
    });

    this.measure();
  }

  measure = () => {
    const [first] = this.columns;

    if (!first) return;

    this.offset = parseFloat(getComputedStyle(first.$column).paddingTop) || 0;

    this.columns.forEach((column) => {
      const { $column, $set } = column;

      column.period = $set.offsetHeight;

      const copies = column.period
        ? Math.ceil(window.innerHeight / column.period)
        : 0;

      while ($column.children.length - 1 > copies) {
        $column.lastElementChild?.remove();
      }

      while ($column.children.length - 1 < copies) {
        const $copy = $set.cloneNode(true) as HTMLElement;

        $copy.setAttribute("aria-hidden", "true");
        $copy.querySelectorAll("img").forEach(($img) => ($img.alt = ""));
        $column.append($copy);
      }
    });

    this.render();
  };

  getLag(index: number, count: number) {
    if (device.reducedMotion) return 0;

    const middle = (count - 1) / 2;

    return LAG.base + Math.abs(index - middle) * LAG.scale;
  }

  render() {
    this.columns.forEach(({ $window, $column, period, position, shift }) => {
      $window.style.transform = `translate3d(0, ${shift}px, 0)`;

      if (!period) return;

      const y = mod(this.offset - position, period) - period - this.offset;

      $column.style.transform = `translate3d(0, ${y}px, 0)`;
    });
  }

  /**
   * Loop
   */
  update = ({ deltaTime }: UpdateData) => {
    if (this.isSwitching) return;

    const scroll = Scroll.scroll;
    const limit = Scroll.limit;
    let delta = scroll - this.lastScroll;

    this.lastScroll = scroll;

    if (limit > 0 && delta > limit / 2) {
      delta -= limit;
    }
    if (limit > 0 && delta < -limit / 2) {
      delta += limit;
    }

    this.distance += delta;

    const isSettled = this.columns.every(
      ({ position, shift }) =>
        Math.abs(this.distance - position) < 0.01 && Math.abs(shift) < 0.01,
    );

    if (!delta && isSettled) return;

    this.columns.forEach((column) => {
      if (!column.lag) {
        column.position = this.distance;
        column.shift = 0;
        return;
      }

      const ease = 1 - Math.exp((-deltaTime * CATCH_UP) / column.lag);
      const land = 1 - Math.exp((-deltaTime * SWITCH.catchUp) / column.lag);

      column.position += (this.distance - column.position) * ease;
      column.shift -= column.shift * land;
    });

    this.render();
  };
}

if (!customElements.get("c-photo-grid")) {
  customElements.define("c-photo-grid", PhotoGrid);
}
