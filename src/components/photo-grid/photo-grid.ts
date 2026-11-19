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

// Desktop only: share of the screen height a gap may sit from the middle and
// still take the split. Beyond it, the photo across the middle is cut.
const SNAP = 0.1;

interface Column {
  $window: HTMLElement;
  $column: HTMLElement;
  $set: HTMLElement;
  // Every photo in the column, set and copies, with its top in the column.
  $items: HTMLElement[];
  tops: number[];
  period: number;
  lag: number;
  position: number;
  // 0 at rest, 1 parted: the photos above the split off the top of the
  // screen, those below it off the bottom.
  part: number;
  // Where the column parts, in the column's own coordinates. Null at rest.
  split: number | null;
  // The photo across the split, cut in two: it keeps its upper half, and
  // $half, a copy laid over it, carries the lower one.
  $cut: HTMLElement | null;
  $half: HTMLElement | null;
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
          $items: [],
          tops: [],
          period: 0,
          lag: this.getLag(index, $windows.length),
          position: this.distance,
          part: 0,
          split: null,
          $cut: null,
          $half: null,
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
  reveal = ({ intro }: { intro: boolean }) => {
    reveal(this.$toggles, { intro });

    this.resetPhase();

    if (device.reducedMotion) return;

    const middle = (this.columns.length - 1) / 2;

    this.isRevealing = true;

    const tl = gsap.timeline({
      onUpdate: () => this.render(),
      onComplete: () => (this.isRevealing = false),
    });

    this.columns.forEach((column, index) => {
      tl.fromTo(
        column,
        { part: 1 },
        { part: 0, duration: REVEAL.duration, ease: REVEAL.ease },
        Math.abs(index - middle) * REVEAL.stagger,
      );
    });

    this.render();
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

        this.columns.forEach((column) => (column.part = 1));
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
          part: 1,
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

    // The photos move to the new columns: mend the one cut by the switch.
    this.columns.forEach((column) => this.unsplit(column));

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
        $items: [],
        tops: [],
        period: 0,
        lag: this.getLag(index, count),
        position: 0,
        part: 0,
        split: null,
        $cut: null,
        $half: null,
      };
    });

    this.resetPhase();

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

      // Clean before cloning, or the copies inherit a parted transform, or
      // a cut photo.
      this.unsplit(column);

      $column
        .querySelectorAll<HTMLElement>('[data-photo-grid="item"]')
        .forEach(($item) => ($item.style.transform = ""));

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

      column.$items = Array.from(
        $column.querySelectorAll<HTMLElement>('[data-photo-grid="item"]'),
      );
      column.tops = column.$items.map(
        ($item) => $item.offsetTop - $column.offsetTop,
      );
    });

    this.render();
  };

  // Columns have different periods: only distance 0 lines up every first
  // photo with the top padding.
  resetPhase() {
    this.distance = 0;
    this.lastScroll = Scroll.scroll;
    this.columns.forEach((column) => (column.position = 0));
    this.render();
  }

  getLag(index: number, count: number) {
    if (device.reducedMotion) return 0;

    const middle = (count - 1) / 2;

    // Half a step more on the right, so mirrored columns never share a lag.
    const side = index > middle ? 0.5 : 0;

    return LAG.base + (Math.abs(index - middle) + side) * LAG.scale;
  }

  render() {
    const middle = window.innerHeight / 2;

    this.columns.forEach((column) => {
      const { $column, $items, tops, period, position, part } = column;

      if (!period) return;

      // On screen, where the set ends and its first copy begins.
      const seam = mod(this.offset - position, period);
      const shift = seam - period - this.offset;

      $column.style.transform = `translate3d(0, ${shift}px, 0)`;

      if (!part) {
        if (column.split !== null) this.unsplit(column);
        return;
      }

      // Chosen once per transition: a scroll mid-way never makes it jump.
      column.split ??= this.cut(column, middle - shift);

      const splitTop = column.split;
      const split = splitTop + shift;
      const above = -part * Math.max(0, split);
      const below = part * Math.max(0, window.innerHeight - split);

      $items.forEach(($item, index) => {
        const y = tops[index] < splitTop ? above : below;

        $item.style.transform = `translate3d(0, ${y}px, 0)`;
      });

      // The cut photo travels up with its upper half: the lower one goes
      // down from there.
      if (column.$half) {
        column.$half.style.transform = `translate3d(0, ${below - above}px, 0)`;
      }
    });
  }

  // The halves meet in the middle of the screen, like the home's. A gap close
  // enough to it takes the split, so no photo is cut; otherwise the photo
  // across the middle is, as the home's halves cut its video. Returns the
  // split, in the column's coordinates.
  cut(column: Column, middle: number) {
    const { $items, tops } = column;

    let gap = middle;
    let nearest = Infinity;

    tops.forEach((top) => {
      const distance = Math.abs(top - middle);

      if (distance < nearest) {
        nearest = distance;
        gap = top;
      }
    });

    // Mobile keeps the nearest gap whatever its distance: it already reads
    // as meeting in the middle, and no photo is ever cut there.
    const isNarrow = window.innerWidth < responsive.breakpoints.desktop;

    if (isNarrow || nearest <= window.innerHeight * SNAP) return gap;

    const index = tops.findIndex(
      (top, i) => top < middle && middle < top + $items[i].offsetHeight,
    );

    // The middle falls in a gap after all.
    if (index === -1) return middle;

    const $item = $items[index];
    const $pieces = Array.from($item.children) as HTMLElement[];
    const offset = middle - tops[index];

    const $half = document.createElement("div");
    $half.setAttribute("aria-hidden", "true");
    $half.style.cssText = `position: absolute; inset: 0; clip-path: inset(${offset}px 0 0 0)`;
    $half.append(...$pieces.map(($piece) => $piece.cloneNode(true)));

    $pieces.forEach(($piece) => {
      $piece.style.clipPath = `inset(0 0 calc(100% - ${offset}px) 0)`;
    });

    $item.style.position = "relative";
    $item.append($half);

    column.$cut = $item;
    column.$half = $half;

    return middle;
  }

  unsplit(column: Column) {
    column.$items.forEach(($item) => ($item.style.transform = ""));

    column.$half?.remove();

    if (column.$cut) {
      column.$cut.style.position = "";

      Array.from(column.$cut.children as HTMLCollectionOf<HTMLElement>).forEach(
        ($piece) => ($piece.style.clipPath = ""),
      );
    }

    column.split = null;
    column.$cut = null;
    column.$half = null;
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
      ({ position, part }) =>
        Math.abs(this.distance - position) < 0.01 && part < 0.0001,
    );

    if (!delta && isSettled) return;

    this.columns.forEach((column) => {
      if (!column.lag) {
        column.position = this.distance;
        column.part = 0;
        return;
      }

      const ease = 1 - Math.exp((-deltaTime * CATCH_UP) / column.lag);
      const land = 1 - Math.exp((-deltaTime * SWITCH.catchUp) / column.lag);

      column.position += (this.distance - column.position) * ease;

      // The reveal tweens part itself.
      if (!this.isRevealing) {
        column.part -= column.part * land;
        if (column.part < 0.0001) column.part = 0;
      }
    });

    this.render();
  };
}

if (!customElements.get("c-photo-grid")) {
  customElements.define("c-photo-grid", PhotoGrid);
}
