import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import Scroll from "../../scripts/classes/Scroll";
import { device } from "../../scripts/classes/Device";
import { mattEasing } from "../../scripts/utils/easing";
import { mod } from "../../scripts/utils/math";
import {
  events,
  type Bounds,
  type Hero,
  type HomeLeave,
  type View,
} from "../../scripts/utils/events";

export type ListItem = {
  slug: string;
  isFeatured: boolean;
  $item: HTMLElement;
  $media: HTMLElement | null;
  $video: HTMLElement | null;
  $titles: HTMLElement[];
  top: number;
  height: number;
  videoWidth: number;
  videoHeight: number;
  videoX: number;
  videoY: number;
  scale: number;
};

const DURATION = {
  // Slides the nearest featured work to the centre before leaving.
  center: 0.8,
  // Slides a keyboard-focused item to the centre.
  focus: 1,
  // The view leaving, and the view arriving.
  fadeOut: 0.4,
  fadeIn: 0.6,
  // The video and the title travelling between the views.
  morph: 1.2,
  // Closes the gap between the halves, ahead of the morph.
  seal: 0.4,
};

const EASE = {
  center: "expo.out",
  fade: "power2.out",
  morph: mattEasing,
  seal: "power2.out",
};

export class HomeList extends HTMLElement {
  state: "visible" | "leaving" | "arriving" | "hidden" = "hidden";
  alpha = { value: 1 };
  hero: Hero | null = null;
  tl: gsap.core.Timeline | null = null;

  $list: HTMLElement | null;
  items: ListItem[];
  $gradient: HTMLElement | null;

  resizeObserver: ResizeObserver | null = null;
  height = 0;
  distance = 0;
  origin = 0;
  shift = { value: 0 };
  current = -1;
  lastScroll = 0;
  isFrozen = false;

  constructor() {
    super();

    this.$list = this.querySelector('[data-home-list="list"]');
    this.items = Array.from(
      this.querySelectorAll<HTMLElement>('[data-home-list="item"]'),
    ).map(($item) => ({
      slug: $item.dataset.slug ?? "",
      isFeatured: $item.hasAttribute("data-featured"),
      $item,
      $media: $item.querySelector<HTMLElement>('[data-home-list="media"]'),
      $video: $item.querySelector<HTMLElement>('[data-home-list="video"]'),
      $titles: Array.from(
        $item.querySelectorAll<HTMLElement>('[data-home-list="title"]'),
      ),
      top: 0,
      height: 0,
      videoWidth: 0,
      videoHeight: 0,
      videoX: 0,
      videoY: 0,
      scale: 0,
    }));
    this.$gradient = this.querySelector('[data-home-list="gradient"]');
  }

  connectedCallback() {
    if (!this.$list || !this.items.length) return;

    this.lastScroll = Scroll.scroll;

    this.resizeObserver = new ResizeObserver(this.measure);
    this.resizeObserver.observe(this.$list);

    this.bindEvents();
  }

  disconnectedCallback() {
    this.unbindEvents();

    this.resizeObserver?.disconnect();
    this.tl?.kill();
    gsap.killTweensOf(this.shift);
  }

  /**
   * Events.
   */
  bindEvents() {
    events.on("update", this.update);
    events.on("home:view", this.onView);
    events.on("home:leave", this.onLeave);

    this.addEventListener("focusin", this.onFocusIn);
  }

  unbindEvents() {
    events.off("update", this.update);
    events.off("home:view", this.onView);
    events.off("home:leave", this.onLeave);

    this.removeEventListener("focusin", this.onFocusIn);
  }

  onView = ({ view }: { view: View }) => {
    if (view === "wide" && this.state === "visible") {
      this.hide();
    }
  };

  onLeave = (leave: HomeLeave) => {
    if (leave.view === "list") {
      this.show(leave);
    }
  };

  onFocusIn = (event: FocusEvent) => {
    const $target = event.target as Element;

    if (!$target.matches(":focus-visible") || !this.height) return;

    const item = this.items.find(({ $item }) => $item.contains($target));

    if (item) {
      this.moveTo(item, device.reducedMotion ? 0 : DURATION.focus);
    }
  };

  /**
   * Animations.
   */
  async hide() {
    const speed = device.reducedMotion ? 0 : 1;
    const featured = this.items.filter(({ isFeatured }) => isFeatured);

    // No featured work to go back to: stay on the list.
    if (!document.querySelector("c-home-wide") || !featured.length) {
      events.emit("home:shown", { view: "list" });
      return;
    }

    Scroll.stop();
    this.isFrozen = true;

    // Centre the nearest featured work before leaving.
    const offset = (entry: ListItem) =>
      Math.abs(
        this.getPosition(entry) + entry.height / 2 - window.innerHeight / 2,
      );
    const item = featured.reduce((nearest, entry) =>
      offset(entry) < offset(nearest) ? entry : nearest,
    );

    await this.moveTo(item, DURATION.center * speed);

    if (!this.isConnected) return;

    const bounds = this.getBounds(item);

    this.state = "leaving";

    // Created before the emit and padded to 1.2s, so it ends before the wide's.
    this.tl = gsap.timeline();
    this.tl
      .to(
        this,
        { autoAlpha: 0, duration: DURATION.fadeOut * speed, ease: EASE.fade },
        0,
      )
      .to(
        this.alpha,
        { value: 0, duration: DURATION.fadeOut * speed, ease: EASE.fade },
        0,
      )
      .add(() => {}, DURATION.morph * speed);

    events.emit("home:leave", {
      view: "wide",
      from: bounds && { slug: item.slug, bounds, split: 0, order: 0 },
      titles: item.$titles,
    });

    await this.tl;

    this.hidden = true;
    gsap.set(this, { clearProps: "opacity,visibility" });

    this.state = "hidden";
    this.alpha.value = 1;
    this.isFrozen = false;
    this.lastScroll = Scroll.scroll;
  }

  async show({ from, titles: $leaving }: HomeLeave) {
    const speed = device.reducedMotion ? 0 : 1;

    this.isFrozen = true;

    this.hidden = false;
    gsap.set(this, { autoAlpha: 0 });
    this.measure();

    const item = this.items.find(({ slug }) => slug === from?.slug);

    if (item) {
      this.moveTo(item, 0);
    }

    const bounds = item ? this.getBounds(item) : null;

    this.state = "arriving";
    this.hero =
      from && bounds
        ? { from, to: { ...from, bounds, split: 0 }, progress: 0, seal: 0 }
        : null;
    this.alpha.value = 0;

    const $arriving = item?.$titles ?? [];
    const $others = [
      ...this.items.filter((entry) => entry !== item).map(({ $item }) => $item),
      this.$gradient,
    ];

    this.tl = gsap.timeline();

    if (this.hero) {
      this.tl
        .to(
          this.hero,
          { progress: 1, duration: DURATION.morph * speed, ease: EASE.morph },
          0,
        )
        .to(
          this.hero,
          { seal: 1, duration: DURATION.seal * speed, ease: EASE.seal },
          0,
        );
    }

    // Fades in over the end of the morph.
    const fadeInAt = (DURATION.morph - DURATION.fadeIn) * speed;

    this.tl.to(
      this.alpha,
      { value: 1, duration: DURATION.fadeIn * speed, ease: EASE.fade },
      fadeInAt,
    );

    if ($leaving.length && $arriving.length) {
      gsap.set(this, { autoAlpha: 1 });
      gsap.set($others, { opacity: 0 });

      // Each title half starts over the wide's one and slides home.
      $arriving.forEach(($title, index) => {
        const start = $leaving[index].getBoundingClientRect();
        const end = $title.getBoundingClientRect();

        this.tl?.fromTo(
          $title,
          { x: start.left - end.left, y: start.top - end.top },
          { x: 0, y: 0, duration: DURATION.morph * speed, ease: EASE.morph },
          0,
        );
      });

      gsap.set($leaving, { opacity: 0 });

      this.tl.to(
        $others,
        { opacity: 1, duration: DURATION.fadeIn * speed, ease: EASE.fade },
        fadeInAt,
      );
    } else {
      this.tl.to(
        this,
        { autoAlpha: 1, duration: DURATION.fadeIn * speed, ease: EASE.fade },
        fadeInAt,
      );
    }

    await this.tl;

    gsap.set(this, { clearProps: "opacity,visibility" });
    gsap.set([...$others, ...$leaving], { clearProps: "opacity" });
    gsap.set($arriving, { clearProps: "transform" });

    Scroll.resize();
    Scroll.scrollTo(0, { immediate: true, force: true });
    this.isFrozen = false;
    this.lastScroll = Scroll.scroll;
    ScrollTrigger.refresh();
    Scroll.resume();

    this.state = "visible";
    this.hero = null;

    events.emit("home:shown", { view: "list" });
  }

  moveTo(item: ListItem, duration: number) {
    gsap.killTweensOf(this.shift);

    const distance =
      this.getPosition(item) - (window.innerHeight - item.height) / 2;
    const value = this.shift.value + distance;

    if (!duration || Math.abs(distance) < 1) {
      this.shift.value = value;
      this.render();

      return Promise.resolve();
    }

    return gsap.to(this.shift, { value, duration, ease: EASE.center });
  }

  /**
   * List.
   */
  measure = () => {
    this.height = this.$list?.getBoundingClientRect().height ?? 0;

    this.items.forEach((item) => {
      item.top = item.$item.offsetTop;
      item.height = item.$item.offsetHeight;

      if (!item.$video) return;

      // Not offsetWidth: it rounds, and the plane would sit a pixel off.
      const style = getComputedStyle(item.$video);
      item.videoWidth = parseFloat(style.width) || 0;
      item.videoHeight = parseFloat(style.height) || 0;

      const itemRect = item.$item.getBoundingClientRect();
      const videoRect = item.$video.getBoundingClientRect();

      item.videoX = videoRect.left + videoRect.width / 2;
      item.videoY = videoRect.top + videoRect.height / 2 - itemRect.top;
    });

    const [first] = this.items;
    this.origin = first.top + first.height / 2 - window.innerHeight / 2;
  };

  render() {
    if (!this.height) return;

    const center = window.innerHeight / 2;
    const step = this.height / this.items.length;

    let current = this.current;
    let best = Infinity;

    this.items.forEach((item, index) => {
      const position = this.getPosition(item);
      const offset = Math.abs(position + item.height / 2 - center) / step;

      item.scale = Math.max(0, 1 - offset);
      item.$item.style.transform = `translate3d(0, ${position - item.top}px, 0)`;

      if (item.$media) {
        item.$media.style.width = `${item.scale * item.videoWidth}px`;
      }

      if (item.$video) {
        item.$video.style.scale = String(item.scale);
      }

      if (offset < best) {
        best = offset;
        current = index;
      }
    });

    if (current !== this.current) {
      this.items[this.current]?.$item.removeAttribute("data-active");
      this.items[current].$item.setAttribute("data-active", "");
      this.current = current;
    }
  }

  /**
   * Getters, also read by the WebGL canvas.
   */
  getPosition(item: ListItem) {
    const distance = this.distance + this.shift.value + this.origin;

    return mod(item.top - distance + item.height, this.height) - item.height;
  }

  // From the list position, not the layout: the list is fixed.
  getBounds(item: ListItem): Bounds | null {
    if (!this.height) return null;

    const width = item.videoWidth * item.scale;
    const height = item.videoHeight * item.scale;
    const centerY = this.getPosition(item) + item.videoY;

    return {
      top: centerY - height / 2,
      left: item.videoX - width / 2,
      width,
      height,
    };
  }

  /**
   * Loop.
   */
  update = () => {
    const scroll = Scroll.scroll;
    const limit = Scroll.limit;
    let delta = scroll - this.lastScroll;

    this.lastScroll = scroll;

    // Half the scroll, across the infinite scroll's loop.
    if (!this.isFrozen) {
      if (limit > 0 && delta > limit / 2) delta -= limit;
      if (limit > 0 && delta < -limit / 2) delta += limit;

      this.distance += delta * 0.5;
    }

    this.render();
  };
}

if (!customElements.get("c-home-list")) {
  customElements.define("c-home-list", HomeList);
}
