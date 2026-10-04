import gsap from "gsap";

import { device } from "../../scripts/classes/Device";
import Scroll from "../../scripts/classes/Scroll";

interface HomeListItem {
  $item: HTMLElement;
  $media: HTMLElement | null;
  $video: HTMLElement | null;
  top: number;
  height: number;
  videoWidth: number;
}

const mod = (value: number, length: number) =>
  ((value % length) + length) % length;

export class HomeList extends HTMLElement {
  private $list: HTMLElement | null;
  private items: HomeListItem[];

  private resizeObserver: ResizeObserver | null = null;

  private height = 0;
  private distance = 0;
  private lastScroll = 0;

  private origin = 0;

  private focusShift = { shift: 0 };

  constructor() {
    super();

    this.$list = this.querySelector('[data-home-list="list"]');
    this.items = Array.from(
      this.querySelectorAll<HTMLElement>('[data-home-list="item"]'),
    ).map(($item) => ({
      $item,
      $media: $item.querySelector<HTMLElement>('[data-home-list="media"]'),
      $video: $item.querySelector<HTMLElement>('[data-home-list="video"]'),
      top: 0,
      height: 0,
      videoWidth: 0,
    }));
  }

  /**
   * Lifecycle
   */
  connectedCallback() {
    if (!this.$list || !this.items.length) return;

    this.lastScroll = Scroll.scroll;

    this.resizeObserver = new ResizeObserver(this.onResize);
    this.resizeObserver.observe(this.$list);

    this.bindEvents();
  }

  disconnectedCallback() {
    this.unbindEvents();
    this.resizeObserver?.disconnect();
  }

  /**
   * Events
   */
  private bindEvents() {
    gsap.ticker.add(this.onTick);
    this.addEventListener("focusin", this.onFocusIn);
  }

  private unbindEvents() {
    gsap.ticker.remove(this.onTick);
    this.removeEventListener("focusin", this.onFocusIn);
    gsap.killTweensOf(this.focusShift);
  }

  private onFocusIn = (event: FocusEvent) => {
    const $target = event.target as Element;

    if (!$target.matches(":focus-visible") || !this.height) return;

    const item = this.items.find(({ $item }) => $item.contains($target));

    if (!item) return;

    const center = (window.innerHeight - item.height) / 2;
    const shift = this.focusShift.shift + this.positionOf(item) - center;

    gsap.to(this.focusShift, {
      shift,
      duration: device.reducedMotion ? 0 : 1,
      ease: "expo.out",
      overwrite: true,
    });
  };

  private onTick = () => {
    this.follow();
    this.render();
  };

  private onResize = () => {
    this.height = this.$list?.getBoundingClientRect().height ?? 0;

    this.items.forEach((item) => {
      item.top = item.$item.offsetTop;
      item.height = item.$item.offsetHeight;
      item.videoWidth = item.$video?.offsetWidth ?? 0;
    });

    const [first] = this.items;
    this.origin = first.top + first.height / 2 - window.innerHeight / 2;
  };

  /**
   * Methods
   */
  private follow() {
    const scroll = Scroll.scroll;
    const limit = Scroll.limit;
    let delta = scroll - this.lastScroll;

    if (limit > 0) {
      if (delta > limit / 2) {
        delta -= limit;
      }

      if (delta < -limit / 2) {
        delta += limit;
      }
    }

    this.distance += delta * 0.5;
    this.lastScroll = scroll;
  }

  private render() {
    if (!this.height) return;

    const center = window.innerHeight / 2;
    const step = this.height / this.items.length;

    this.items.forEach((item) => {
      const position = this.positionOf(item);

      item.$item.style.transform = `translate3d(0, ${position - item.top}px, 0)`;

      const offset = Math.abs(position + item.height / 2 - center) / step;
      const scale = Math.max(0, 1 - offset);

      if (item.$media) {
        item.$media.style.width = `${scale * item.videoWidth}px`;
      }

      if (item.$video) {
        item.$video.style.scale = String(scale);
      }
    });
  }

  private positionOf(item: HomeListItem) {
    const distance = this.distance + this.focusShift.shift + this.origin;

    return mod(item.top - distance + item.height, this.height) - item.height;
  }
}

if (!customElements.get("c-home-list")) {
  customElements.define("c-home-list", HomeList);
}
