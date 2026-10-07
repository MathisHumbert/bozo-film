import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import Scroll from "../../scripts/classes/Scroll";
import { device } from "../../scripts/classes/Device";
import { mattEasing } from "../../scripts/utils/easing";
import {
  events,
  type Bounds,
  type Frame,
  type Hero,
  type HomeLeave,
  type View,
} from "../../scripts/utils/events";

type WideItem = {
  slug: string;
  $item: HTMLElement;
  $media: HTMLElement;
  $texts: HTMLElement[];
  $titles: HTMLElement[];
  $link: HTMLElement | null;
  split: { value: number };
};

const SCALE = 1.25;

const DURATION = {
  // Scrolls the stack onto a whole video before leaving.
  settle: 0.6,
  // The view leaving, and the view arriving.
  fadeOut: 0.4,
  fadeIn: 0.6,
  // The video and the title travelling between the views.
  morph: 1.2,
  // Closes the gap between the halves, ahead of the morph.
  seal: 0.4,
};

const EASE = {
  settle: mattEasing,
  fade: "power2.out",
  morph: mattEasing,
  seal: "power2.out",
};

export class HomeWide extends HTMLElement {
  state: "visible" | "leaving" | "arriving" | "hidden" = "visible";
  alpha = { value: 1 };
  hero: Hero | null = null;
  tl: gsap.core.Timeline | null = null;

  $section: HTMLElement | null;
  items: WideItem[];
  $clone: HTMLElement | null;
  $cloneMedia: HTMLElement | null;
  $cloneTexts: HTMLElement[];

  stackTl: gsap.core.Timeline | null = null;
  current = 0;
  width = 0;
  height = 0;

  constructor() {
    super();

    this.$section = this.querySelector('[data-home-wide="section"]');
    this.items = Array.from(
      this.querySelectorAll<HTMLElement>('[data-home-wide="item"]'),
    ).map(($item) => ({
      slug: $item.dataset.slug ?? "",
      $item,
      $media: $item.querySelector<HTMLElement>('[data-home-wide="media"]')!,
      $texts: Array.from(
        $item.querySelectorAll<HTMLElement>('[data-home-wide="text"]'),
      ),
      $titles: Array.from(
        $item.querySelectorAll<HTMLElement>('[data-home-wide="title"]'),
      ),
      $link: $item.querySelector("a"),
      split: { value: 0 },
    }));
    this.$clone = this.querySelector('[data-home-wide="clone"]');
    this.$cloneMedia = this.querySelector('[data-home-wide="clone-media"]');
    this.$cloneTexts = Array.from(
      this.querySelectorAll<HTMLElement>('[data-home-wide="clone-text"]'),
    );
  }

  connectedCallback() {
    if (!this.items.length) return;

    this.measure();
    this.createStack();
    this.setCurrent(0);
    this.bindEvents();
  }

  disconnectedCallback() {
    this.unbindEvents();

    this.stackTl?.scrollTrigger?.kill();
    this.stackTl?.kill();
    this.tl?.kill();
  }

  get isEnabled() {
    return this.state === "visible" || this.state === "arriving";
  }

  /**
   * Events.
   */
  bindEvents() {
    events.on("resize", this.onResize);
    events.on("home:view", this.onView);
    events.on("home:leave", this.onLeave);

    this.addEventListener("focusin", this.onFocusIn);
  }

  unbindEvents() {
    events.off("resize", this.onResize);
    events.off("home:view", this.onView);
    events.off("home:leave", this.onLeave);

    this.removeEventListener("focusin", this.onFocusIn);
  }

  onResize = () => {
    if (this.isEnabled) {
      this.measure();
    }
  };

  onView = ({ view }: { view: View }) => {
    if (view === "list" && this.state === "visible") {
      this.hide();
    }
  };

  onLeave = (leave: HomeLeave) => {
    if (leave.view === "wide") {
      this.show(leave);
    }
  };

  onFocusIn = (event: FocusEvent) => {
    const $target = event.target as Element;

    if (!$target.matches(":focus-visible")) return;

    const index = this.items.findIndex(({ $item }) => $item.contains($target));

    if (index === -1) return;

    Scroll.scrollTo(this.getScroll(index), {
      immediate: device.reducedMotion,
    });
  };

  /**
   * Animations.
   */
  async hide() {
    const speed = device.reducedMotion ? 0 : 1;

    Scroll.stop();

    // Settle the stack on a whole video before leaving.
    const scroll = { value: Scroll.scroll };
    const settled = this.getScroll(
      this.isParted() ? this.current + 1 : this.current,
    );

    if (Math.abs(settled - scroll.value) >= 1) {
      await gsap.to(scroll, {
        value: settled,
        duration: DURATION.settle * speed,
        ease: EASE.settle,
        onUpdate: () =>
          Scroll.scrollTo(scroll.value, { immediate: true, force: true }),
      });
    }

    if (!this.isConnected) return;

    const [top, under] = this.getSlots();
    const from = this.isParted() ? under : top;
    const item = this.items.find(({ slug }) => slug === from.slug);

    this.state = "leaving";

    // Created before the emit and padded to 1.2s, so it ends before the list's.
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
      view: "list",
      from,
      titles: item?.$titles ?? [],
    });

    await this.tl;

    this.hidden = true;
    gsap.set(this, { clearProps: "opacity,visibility" });

    this.state = "hidden";
    this.alpha.value = 1;
  }

  async show({ from, titles: $leaving }: HomeLeave) {
    const speed = device.reducedMotion ? 0 : 1;

    const index = Math.max(
      this.items.findIndex(({ slug }) => slug === from?.slug),
      0,
    );
    const item = from ? this.items[index] : null;

    this.hidden = false;
    gsap.set(this, { autoAlpha: 0 });

    Scroll.resize();
    ScrollTrigger.refresh();
    Scroll.scrollTo(this.getScroll(index), { immediate: true, force: true });
    ScrollTrigger.update();

    this.state = "arriving";
    this.measure();
    this.setCurrent(this.stackTl?.scrollTrigger?.progress ?? 0);

    const to = this.getSlot(index, 1);
    this.hero = from ? { from, to, progress: 0, seal: 0 } : null;

    const $arriving = item?.$titles ?? [];
    const $link = item?.$link ?? null;

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

    if ($leaving.length && $arriving.length) {
      gsap.set(this, { autoAlpha: 1 });

      // Each title half starts over the list's one and slides home.
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

      if ($link) {
        this.tl.fromTo(
          $link,
          { opacity: 0 },
          { opacity: 1, duration: DURATION.fadeIn * speed, ease: EASE.fade },
          fadeInAt,
        );
      }
    } else {
      this.tl.to(
        this,
        { autoAlpha: 1, duration: DURATION.fadeIn * speed, ease: EASE.fade },
        fadeInAt,
      );
    }

    await this.tl;

    gsap.set(this, { clearProps: "opacity,visibility" });
    gsap.set($leaving, { clearProps: "opacity" });
    gsap.set($arriving, { clearProps: "transform" });

    if ($link) {
      gsap.set($link, { clearProps: "opacity" });
    }

    Scroll.resize();
    ScrollTrigger.refresh();
    Scroll.resume();

    this.state = "visible";
    this.hero = null;

    events.emit("home:shown", { view: "wide" });
  }

  /**
   * Stack.
   */
  createStack() {
    this.stackTl = gsap.timeline({
      defaults: { duration: 1, ease: "none" },
      scrollTrigger: {
        trigger: this.$section,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: ({ progress }) => this.setCurrent(progress),
        onRefresh: ({ progress }) => this.setCurrent(progress),
      },
    });

    gsap.set(this.items[0].$media, { scale: SCALE });

    this.items.forEach(({ $item, $media, $texts, split }, index) => {
      const next = this.items[index + 1];
      const $next = next ? next.$item : this.$clone;
      const $nextMedia = next ? next.$media : this.$cloneMedia;
      const $nextTexts = next ? next.$texts : this.$cloneTexts;

      // The next item's text shows only in the gap between the parting halves.
      this.stackTl!.fromTo(
        $next,
        { clipPath: "inset(50% 0% 50% 0%)" },
        { clipPath: "inset(0% 0% 0% 0%)" },
        index,
      );

      if (next) {
        this.stackTl!.set(
          $item,
          { clipPath: "inset(50% 0% 50% 0%)" },
          index + 1,
        );
      }

      this.stackTl!.to(split, { value: 0.5 }, index);
      this.stackTl!.to($texts, { y: () => $media.offsetHeight / 2 }, index);
      this.stackTl!.fromTo($nextMedia, { scale: 1 }, { scale: SCALE }, index);
      this.stackTl!.fromTo(
        $nextTexts,
        { scale: 0.9, yPercent: 50 },
        { scale: 1, yPercent: 0 },
        index,
      );
    });
  }

  setCurrent(progress: number) {
    if (!this.isEnabled) return;

    const count = this.items.length;
    this.current = Math.min(Math.floor(progress * count), count - 1);

    this.items.forEach(({ $item }, index) => {
      $item.toggleAttribute("data-active", index === this.current);
    });
  }

  measure() {
    this.width = this.items[0].$media.offsetWidth;
    this.height = this.items[0].$media.offsetHeight;
  }

  /**
   * Getters, also read by the WebGL canvas.
   */
  // From the GSAP scale, not the layout: the stack is always pinned.
  getBounds($media: HTMLElement): Bounds {
    const scale = Number(gsap.getProperty($media, "scale"));
    const width = this.width * scale;
    const height = this.height * scale;

    return {
      top: (this.height - height) / 2,
      left: (this.width - width) / 2,
      width,
      height,
    };
  }

  getSlot(index: number, order: number): Frame {
    const item = this.items[index];

    return {
      slug: item.slug,
      bounds: this.getBounds(item.$media),
      split: item.split.value * this.height,
      order,
    };
  }

  getSlots(): Frame[] {
    const slots = [this.getSlot(this.current, 1)];

    if (this.items[this.current + 1]) {
      slots.push(this.getSlot(this.current + 1, 0));
    } else if (this.$cloneMedia && this.items.length > 1) {
      slots.push({
        slug: this.items[0].slug,
        bounds: this.getBounds(this.$cloneMedia),
        split: 0,
        order: 0,
      });
    }

    return slots;
  }

  isParted() {
    const [, under] = this.getSlots();

    return Boolean(under) && this.items[this.current].split.value > 0.25;
  }

  getScroll(index: number) {
    const st = this.stackTl?.scrollTrigger;

    if (!st) return 0;

    return st.start + ((st.end - st.start) * index) / this.items.length;
  }
}

if (!customElements.get("c-home-wide")) {
  customElements.define("c-home-wide", HomeWide);
}
