import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import type Lenis from "lenis";
import Snap from "lenis/snap";

import Scroll from "../../scripts/classes/Scroll";
import { device } from "../../scripts/classes/Device";
import { mattEasing } from "../../scripts/utils/easing";
import { reveal } from "../../scripts/utils/reveal";
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
  $durations: HTMLElement[];
  $durationLines: HTMLElement[];
  $link: HTMLElement | null;
  split: { value: number };
};

const SCALE = 1.25;

const DURATION = {
  // Scrolls the stack onto a whole video before leaving, and when the user
  // lets go of the scroll.
  settle: 0.6,
  // The view leaving, and the view arriving.
  fadeOut: 0.4,
  fadeIn: 0.6,
  // The video and the title travelling between the views.
  morph: 1.2,
  // Closes the gap between the halves, ahead of the morph.
  seal: 0.4,
  // Page transitions: the current work's link slides through its line, like
  // the footer's text.
  linkShow: 0.8,
  linkHide: 0.4,
  // Share of one work's scroll the duration takes to roll out, or in.
  durationRoll: 0.7,
};

const EASE = {
  settle: mattEasing,
  fade: "power2.out",
  morph: mattEasing,
  seal: "power2.out",
  linkShow: "expo.out",
  linkHide: "expo.out",
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
  $cloneDurations: HTMLElement[];
  $cloneDurationLines: HTMLElement[] = [];
  $indexes: HTMLElement[];
  indexLines: HTMLElement[][] = [];

  stackTl: gsap.core.Timeline | null = null;
  current = 0;
  width = 0;
  height = 0;

  snap: Snap | null = null;
  snapLenis: Lenis | null = null;
  removeSnaps: (() => void)[] = [];

  linkSplits: SplitText[] = [];
  durationSplits: SplitText[] = [];

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
      $durations: Array.from(
        $item.querySelectorAll<HTMLElement>('[data-home-wide="duration"]'),
      ),
      $durationLines: [],
      $link: $item.querySelector("a"),
      split: { value: 0 },
    }));
    this.$clone = this.querySelector('[data-home-wide="clone"]');
    this.$cloneMedia = this.querySelector('[data-home-wide="clone-media"]');
    this.$cloneTexts = Array.from(
      this.querySelectorAll<HTMLElement>('[data-home-wide="clone-text"]'),
    );
    this.$cloneDurations = Array.from(
      this.querySelectorAll<HTMLElement>('[data-home-wide="clone-duration"]'),
    );
    this.$indexes = Array.from(
      this.querySelectorAll<HTMLElement>('[data-home-wide="index"]'),
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
    this.snap?.destroy();

    this.linkSplits.forEach((split) => split.revert());
    this.linkSplits = [];

    this.durationSplits.forEach((split) => split.revert());
    this.durationSplits = [];
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
    events.on("page:revealed", this.reveal);

    this.addEventListener("focusin", this.onFocusIn);
  }

  unbindEvents() {
    events.off("resize", this.onResize);
    events.off("home:view", this.onView);
    events.off("home:leave", this.onLeave);
    events.off("page:revealed", this.reveal);

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

  reveal = () => {
    if (!this.isEnabled) return;

    const { $texts, $durationLines } = this.items[this.current];

    reveal([
      ...$texts,
      ...$durationLines,
      ...(this.indexLines[this.current] ?? []),
    ]);
  };

  hideLink(tl: gsap.core.Timeline, index: number, position: number) {
    const speed = device.reducedMotion ? 0 : 1;

    tl.to(
      this.splitLink(index),
      {
        yPercent: 100,
        duration: DURATION.linkHide * speed,
        ease: EASE.linkHide,
      },
      position,
    );
  }

  showLink(tl: gsap.core.Timeline, index: number, position: number) {
    const speed = device.reducedMotion ? 0 : 1;

    tl.fromTo(
      this.splitLink(index),
      { yPercent: 100 },
      {
        yPercent: 0,
        duration: DURATION.linkShow * speed,
        ease: EASE.linkShow,
      },
      position,
    );
  }

  splitLink(index: number) {
    const isClone = index >= this.items.length;
    const $link = isClone ? this.$cloneTexts[1] : this.items[index].$link;

    if (!$link) return [];

    let split = this.linkSplits.find(
      (entry) => (entry.elements as HTMLElement[])[0] === $link,
    );

    if (!split) {
      split = SplitText.create($link, {
        type: "lines",
        mask: "lines",
        aria: "none",
      });
      this.linkSplits.push(split);
    }

    return split.lines as HTMLElement[];
  }

  splitDurations($durations: HTMLElement[]) {
    if (!$durations.length) return [];

    const split = SplitText.create($durations, {
      type: "lines",
      mask: "lines",
      aria: "none",
    });
    this.durationSplits.push(split);

    return split.lines as HTMLElement[];
  }

  async hide() {
    const speed = device.reducedMotion ? 0 : 1;

    Scroll.stop();
    this.snap?.stop();

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
    this.snap?.start();

    this.state = "visible";
    this.hero = null;

    events.emit("home:shown", { view: "wide" });
  }

  // Work to home: the page opens straight on a work, before it has a scroll
  // of its own, so the stack is set by hand until arrive().
  park(index: number) {
    const progress = index / this.items.length;

    this.stackTl?.scrollTrigger?.disable(false);
    this.stackTl?.progress(progress);
    this.setCurrent(progress);
  }

  // Once the page has its scroll: brought to the same work, nothing moves.
  arrive(index: number) {
    Scroll.resize();
    this.stackTl?.scrollTrigger?.enable(false);
    Scroll.scrollTo(this.getScroll(index), { immediate: true, force: true });
    ScrollTrigger.update();

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
        onRefresh: ({ progress }) => {
          this.setCurrent(progress);
          this.createSnap();
        },
      },
    });

    gsap.set(this.items[0].$media, { scale: SCALE });

    this.items.forEach((item) => {
      item.$durationLines = this.splitDurations(item.$durations);
    });
    this.$cloneDurationLines = this.splitDurations(this.$cloneDurations);
    this.indexLines = this.$indexes.map(($index) =>
      this.splitDurations([$index]),
    );

    this.items.forEach((item, index) => {
      const { $item, $media, $texts, $durationLines, split } = item;
      const next = this.items[index + 1];
      const $next = next ? next.$item : this.$clone;
      const $nextMedia = next ? next.$media : this.$cloneMedia;
      const $nextTexts = next ? next.$texts : this.$cloneTexts;
      const $nextDurationLines = next
        ? next.$durationLines
        : this.$cloneDurationLines;

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

      this.stackTl!.to(
        [...$durationLines, ...(this.indexLines[index] ?? [])],
        { yPercent: -100, duration: DURATION.durationRoll },
        index,
      );
      this.stackTl!.fromTo(
        [...$nextDurationLines, ...(this.indexLines[index + 1] ?? [])],
        { yPercent: 100 },
        { yPercent: 0, duration: DURATION.durationRoll },
        index + 1 - DURATION.durationRoll,
      );
    });
  }

  createSnap() {
    const lenis = Scroll.lenis;

    if (!lenis) return;

    if (this.snapLenis !== lenis) {
      this.snap?.destroy();
      this.snap = new Snap(lenis, {
        type: "mandatory",
        duration: device.reducedMotion ? 0 : DURATION.settle,
        easing: EASE.settle,
        debounce: 200,
      });
      this.snapLenis = lenis;
      this.removeSnaps = [];
    }

    const snap = this.snap!;

    this.removeSnaps.forEach((remove) => remove());

    this.removeSnaps = [...this.items, null].map((_, index) =>
      snap.add(this.getScroll(index)),
    );

    if (this.isEnabled) {
      snap.start();
    } else {
      snap.stop();
    }
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
