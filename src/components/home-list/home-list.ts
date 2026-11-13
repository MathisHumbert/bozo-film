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
  $heading: HTMLElement | null;
  $media: HTMLElement | null;
  $video: HTMLElement | null;
  $titles: HTMLElement[];
  stacked: boolean;
  extra: number;
  push: number;
  position: number;
  // What render() last wrote, so an unchanged item never touches the DOM.
  rendered: { y: number; scale: number; extra: number };
  top: number;
  height: number;
  videoWidth: number;
  videoHeight: number;
  // What the open video adds on each side, on top of the closed column gap.
  videoGap: number;
  // Stacked: the space above and below the open video. Cancelled while it is
  // closed, so the two lines keep the list's leading.
  rowGap: number;
  videoX: number;
  videoY: number;
  scale: number;
};

const DURATION = {
  // Slides the nearest featured work to the centre before leaving.
  center: 0.8,
  // Slides a keyboard-focused item to the centre.
  focus: 1,
  // Settles the nearest work at the centre once the scroll stops.
  snap: 0.8,
  // The view leaving, and the view arriving.
  fadeOut: 0.4,
  fadeIn: 0.6,
  // The video and the title travelling between the views.
  morph: 1.2,
  // Closes the gap between the halves, ahead of the morph.
  seal: 0.4,
};

// On touch, below this speed (px per frame) the fling's tail counts as stopped.
const CRAWL_VELOCITY = 1;

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
  listSize = { width: 0, height: 0 };
  height = 0;
  distance = 0;
  origin = 0;
  shift = { value: 0 };
  current = -1;
  // The stacked items with an open video this frame, reused across frames.
  opening: ListItem[] = [];
  lastScroll = 0;
  isFrozen = false;
  isScrolling = false;

  constructor() {
    super();

    this.$list = this.querySelector('[data-home-list="list"]');
    this.items = Array.from(
      this.querySelectorAll<HTMLElement>('[data-home-list="item"]'),
    ).map(($item) => ({
      slug: $item.dataset.slug ?? "",
      isFeatured: $item.hasAttribute("data-featured"),
      $item,
      $heading: $item.querySelector<HTMLElement>('[data-home-list="heading"]'),
      $media: $item.querySelector<HTMLElement>('[data-home-list="media"]'),
      $video: $item.querySelector<HTMLElement>('[data-home-list="video"]'),
      $titles: Array.from(
        $item.querySelectorAll<HTMLElement>('[data-home-list="title"]'),
      ),
      stacked: false,
      extra: 0,
      push: 0,
      position: 0,
      rendered: { y: NaN, scale: NaN, extra: NaN },
      top: 0,
      height: 0,
      videoWidth: 0,
      videoHeight: 0,
      videoGap: 0,
      rowGap: 0,
      videoX: 0,
      videoY: 0,
      scale: 0,
    }));
    this.$gradient = this.querySelector('[data-home-list="gradient"]');
  }

  connectedCallback() {
    if (!this.$list || !this.items.length) return;

    this.lastScroll = Scroll.scroll;

    this.resizeObserver = new ResizeObserver(this.onListResize);
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
    // The centred work fades, the others part to the edges: show() in reverse.
    this.tl = gsap.timeline();
    this.tl
      .to(
        [item.$item, this.$gradient],
        { opacity: 0, duration: DURATION.fadeOut * speed, ease: EASE.fade },
        0,
      )
      .to(
        this.alpha,
        { value: 0, duration: DURATION.fadeOut * speed, ease: EASE.fade },
        0,
      )
      .add(() => {}, DURATION.morph * speed);

    this.getEdges(item).forEach(({ entries, y }) => {
      this.tl?.to(
        entries.map(({ $heading }) => $heading),
        { y, duration: DURATION.morph * speed, ease: EASE.morph },
        0,
      );
    });

    events.emit("home:leave", {
      view: "wide",
      from: bounds && { slug: item.slug, bounds, split: 0, order: 0 },
      titles: item.$titles,
    });

    await this.tl;

    this.hidden = true;
    gsap.set([item.$item, this.$gradient], { clearProps: "opacity" });
    gsap.set(
      this.items.map(({ $heading }) => $heading),
      { clearProps: "transform" },
    );

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

    if ($leaving.length && $arriving.length && item) {
      gsap.set(this, { autoAlpha: 1 });
      gsap.set(this.$gradient, { opacity: 0 });

      // The other works close in from both edges and land with the morph.
      this.getEdges(item).forEach(({ entries, y }) => {
        this.tl?.fromTo(
          entries.map(({ $heading }) => $heading),
          { y },
          {
            y: 0,
            duration: DURATION.morph * speed,
            ease: EASE.morph,
            clearProps: "transform",
          },
          0,
        );
      });

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
        this.$gradient,
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
    gsap.set([this.$gradient, ...$leaving], { clearProps: "opacity" });
    gsap.set($arriving, { clearProps: "transform" });

    Scroll.resize();
    Scroll.toTop();
    this.isFrozen = false;
    this.lastScroll = Scroll.scroll;
    ScrollTrigger.refresh();
    Scroll.resume();

    this.state = "visible";
    this.hero = null;

    events.emit("home:shown", { view: "list" });
  }

  // Work to home: the list opens straight on a work, centred, frozen until
  // arrive() hands it the page's scroll.
  park(item: ListItem) {
    this.isFrozen = true;
    this.hidden = false;
    this.state = "arriving";

    this.measure();
    this.moveTo(item, 0);
  }

  arrive() {
    Scroll.resize();
    Scroll.toTop();
    this.lastScroll = Scroll.scroll;
    this.isFrozen = false;
    ScrollTrigger.refresh();

    this.state = "visible";

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
  // The stacked items' negative margins are fractional, so an opening video
  // can move the list's height by a sub-pixel: not a resize.
  onListResize = ([entry]: ResizeObserverEntry[]) => {
    const { width, height } = entry.contentRect;

    if (
      Math.abs(width - this.listSize.width) < 1 &&
      Math.abs(height - this.listSize.height) < 1
    ) {
      return;
    }

    this.listSize = { width, height };
    this.measure();
  };

  measure = () => {
    // A title that would wrap once its video opens is stacked from the start:
    // halves above and below the video, which opens in height instead.
    const available = this.$list?.clientWidth ?? 0;

    this.items.forEach((item) => {
      // Measured closed, then reopened by the render() below.
      item.$item.style.marginBlock = "";
      if (item.$media) {
        item.$media.style.width = "";
        item.$media.style.height = "";
        item.$media.style.marginBlock = "";
      }
      item.rendered = { y: NaN, scale: NaN, extra: NaN };

      // Closed: a column gap between the halves. Open: a row gap each side.
      const $link = item.$item.querySelector("a");
      const linkStyle = $link ? getComputedStyle($link) : null;
      const gap = parseFloat(linkStyle?.rowGap ?? "") || 0;
      const space = parseFloat(linkStyle?.columnGap ?? "") || 0;

      item.videoGap = gap - space;
      const titles = item.$titles.reduce(
        (width, $title) => width + $title.getBoundingClientRect().width,
        0,
      );
      const video = item.$video
        ? parseFloat(getComputedStyle(item.$video).width) || 0
        : 0;

      item.stacked = titles + video + gap * 2 > available;
      item.$item.toggleAttribute("data-stacked", item.stacked);

      // The row gap either side of the closed media is taken back by its
      // margins, and given back by render() as the video opens.
      item.rowGap = item.stacked ? gap : 0;
      if (item.$media) {
        item.$media.style.marginBlock = item.stacked ? `${-gap}px` : "";
      }
    });

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
      // Minus the heading's slide, in case this runs mid-transition.
      const slide = item.$heading
        ? Number(gsap.getProperty(item.$heading, "y"))
        : 0;

      item.videoX = videoRect.left + videoRect.width / 2;
      item.videoY = videoRect.top + videoRect.height / 2 - itemRect.top - slide;
    });

    const [first] = this.items;
    this.origin = first.top + first.height / 2 - window.innerHeight / 2;

    // Reopens what was closed to measure, before the frame is painted.
    this.render();
  };

  render() {
    if (!this.height) return;

    const center = window.innerHeight / 2;
    const step = this.height / this.items.length;

    let current = this.current;
    let best = Infinity;

    const opening = this.opening;
    opening.length = 0;

    // The two works either side of the centre share the opening by distance.
    let above: ListItem | null = null;
    let below: ListItem | null = null;

    for (let index = 0; index < this.items.length; index++) {
      const item = this.items[index];
      item.position = this.getPosition(item);
      item.scale = 0;

      const middle = item.position + item.height / 2;
      const offset = Math.abs(middle - center);

      if (middle <= center) {
        if (!above || middle > above.position + above.height / 2) above = item;
      } else if (!below || middle < below.position + below.height / 2) {
        below = item;
      }

      if (offset < best) {
        best = offset;
        current = index;
      }
    }

    if (above && below) {
      const top = above.position + above.height / 2;
      const bottom = below.position + below.height / 2;

      above.scale = (bottom - center) / (bottom - top);
      below.scale = 1 - above.scale;
    } else {
      const only = above ?? below;

      if (only) {
        const offset = Math.abs(only.position + only.height / 2 - center);
        only.scale = Math.max(0, 1 - offset / step);
      }
    }

    for (const item of this.items) {
      item.extra = item.stacked
        ? item.scale * (item.videoHeight + item.rowGap * 2)
        : 0;

      if (item.extra) opening.push(item);
    }

    for (const item of this.items) {
      const { rendered } = item;

      // An opening stacked item grows around its centre, so its neighbours
      // make room: half its growth above it, half below.
      item.push = 0;

      for (const other of opening) {
        if (other === item) continue;

        item.push +=
          other.position < item.position ? other.extra / 2 : -other.extra / 2;
      }

      const y = item.position + item.push - item.top;

      if (y !== rendered.y) {
        item.$item.style.transform = `translate3d(0, ${y}px, 0)`;
        rendered.y = y;
      }

      if (item.scale !== rendered.scale) {
        if (item.$video) {
          item.$video.style.scale = String(item.scale);
        }

        if (item.$media && !item.stacked) {
          item.$media.style.width = `${item.scale * (item.videoWidth + item.videoGap * 2)}px`;
        }

        rendered.scale = item.scale;
      }

      // The negative margins keep its place in the flow, so the list's height
      // never changes and nothing reflows.
      if (item.stacked && item.extra !== rendered.extra) {
        item.$item.style.marginBlock = `${-item.extra / 2}px`;

        if (item.$media) {
          item.$media.style.height = `${item.extra}px`;
        }

        rendered.extra = item.extra;
      }
    }

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

  // The works on screen above and below the hero, each group with the offset
  // that pushes it just off its edge of the screen. Read after render().
  getEdges(item: ListItem) {
    const above: ListItem[] = [];
    const below: ListItem[] = [];

    this.items.forEach((entry) => {
      if (entry === item) return;

      const top = entry.position + entry.push;

      if (top + entry.height <= 0 || top >= window.innerHeight) return;

      (entry.position < item.position ? above : below).push(entry);
    });

    const lowest = Math.max(
      0,
      ...above.map((entry) => entry.position + entry.push + entry.height),
    );
    const highest = Math.min(
      window.innerHeight,
      ...below.map((entry) => entry.position + entry.push),
    );

    return [
      { entries: above, y: -lowest },
      { entries: below, y: window.innerHeight - highest },
    ].filter(({ entries }) => entries.length);
  }

  // From the list position, not the layout: the list is fixed.
  getBounds(item: ListItem): Bounds | null {
    if (!this.height) return null;

    const width = item.videoWidth * item.scale;
    const height = item.videoHeight * item.scale;
    const centerY = this.getPosition(item) + item.push + item.videoY;

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

    // Ignored, so the centring starts without a pause and nothing drifts it.
    const lenis = Scroll.lenis;
    const isCrawling =
      device.isTouch &&
      this.state === "visible" &&
      Boolean(lenis?.isScrolling) &&
      !lenis?.isTouching &&
      Math.abs(Scroll.velocity) < CRAWL_VELOCITY;

    // Half the scroll, across the infinite scroll's loop.
    if (!this.isFrozen && !isCrawling) {
      if (limit > 0 && delta > limit / 2) delta -= limit;
      if (limit > 0 && delta < -limit / 2) delta += limit;

      this.distance += delta * 0.5;
    }

    this.render();

    // Once the scroll stops, the nearest work slides to the centre, so only
    // one video is ever left open.
    if (this.isFrozen || this.state !== "visible") {
      // Not carried over, or a scroll cut short by a leave snaps on return.
      this.isScrolling = false;
      return;
    }

    const isScrolling = Boolean(lenis?.isScrolling) && !isCrawling;

    if (isScrolling && !this.isScrolling) {
      gsap.killTweensOf(this.shift);
    }

    if (!isScrolling && this.isScrolling && this.items[this.current]) {
      this.moveTo(
        this.items[this.current],
        device.reducedMotion ? 0 : DURATION.snap,
      );
    }

    this.isScrolling = isScrolling;
  };
}

if (!customElements.get("c-home-list")) {
  customElements.define("c-home-list", HomeList);
}
