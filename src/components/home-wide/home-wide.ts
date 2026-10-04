import gsap from "gsap";

import { device } from "../../scripts/classes/Device";
import Scroll from "../../scripts/classes/Scroll";
import { events } from "../../scripts/utils/events";

interface HomeWideItem {
  $item: Element;
  $video: HTMLVideoElement;
  $topHalf: HTMLCanvasElement;
  $bottomHalf: HTMLCanvasElement;
  $texts: HTMLElement[];
  contexts: Array<CanvasRenderingContext2D | null>;
}

export class HomeWide extends HTMLElement {
  private $section: HTMLElement | null;
  private items: HomeWideItem[];
  private $clone: HTMLCanvasElement | null;
  private cloneCtx: CanvasRenderingContext2D | null;
  private $cloneTexts: HTMLElement[];

  private tl: gsap.core.Timeline | null = null;
  private playing = new Set<number>();

  constructor() {
    super();

    this.$section = this.querySelector('[data-home-wide="section"]');
    this.items = Array.from(
      this.querySelectorAll('[data-home-wide="item"]'),
    ).flatMap(($item) => {
      const $video = $item.querySelector<HTMLVideoElement>(
        '[data-home-wide="video"]',
      );
      const $topHalf = $item.querySelector<HTMLCanvasElement>(
        '[data-home-wide="top-half"]',
      );
      const $bottomHalf = $item.querySelector<HTMLCanvasElement>(
        '[data-home-wide="bottom-half"]',
      );

      if (!$video || !$topHalf || !$bottomHalf) return [];

      return [
        {
          $item,
          $video,
          $topHalf,
          $bottomHalf,
          $texts: Array.from(
            $item.querySelectorAll<HTMLElement>('[data-home-wide="text"]'),
          ),
          contexts: [$topHalf.getContext("2d"), $bottomHalf.getContext("2d")],
        },
      ];
    });
    this.$clone = this.querySelector('[data-home-wide="clone"] canvas');
    this.cloneCtx = this.$clone?.getContext("2d") ?? null;
    this.$cloneTexts = Array.from(
      this.querySelectorAll<HTMLElement>('[data-home-wide="clone-text"]'),
    );
  }

  /**
   * Lifecycle
   */
  connectedCallback() {
    if (!this.items.length) return;

    this.initAnimation();
    this.setActive(0);
    this.bindEvents();
  }

  disconnectedCallback() {
    this.unbindEvents();

    this.items.forEach(({ $video }) => $video.pause());
    this.playing.clear();

    this.tl?.scrollTrigger?.kill();
    this.tl?.kill();
    this.tl = null;
  }

  /**
   * Events
   */
  private bindEvents() {
    gsap.ticker.add(this.onTick);
    events.on("device:motion", this.onMotionPreferenceChange);
    this.addEventListener("focusin", this.onFocusIn);
  }

  private unbindEvents() {
    gsap.ticker.remove(this.onTick);
    events.off("device:motion", this.onMotionPreferenceChange);
    this.removeEventListener("focusin", this.onFocusIn);
  }

  private onFocusIn = (event: FocusEvent) => {
    const $target = event.target as Element;

    if (!$target.matches(":focus-visible")) return;

    const st = this.tl?.scrollTrigger;
    const $item = $target.closest('[data-home-wide="item"]');
    const index = this.items.findIndex((item) => item.$item === $item);

    if (!st || index === -1) return;

    Scroll.scrollTo(
      st.start + ((st.end - st.start) * index) / this.items.length,
      {
        immediate: device.reducedMotion,
      },
    );
  };

  private onTick = () => {
    this.playing.forEach((index) => {
      const item = this.items[index];

      item.contexts.forEach((ctx) => this.paint(item.$video, ctx));

      if (index === 0) {
        this.paint(item.$video, this.cloneCtx);
      }
    });
  };

  private onMotionPreferenceChange = () => {
    this.playing.forEach((index) => this.play(this.items[index].$video));
  };

  /**
   * Methods
   */
  private initAnimation() {
    const tl = gsap.timeline({
      defaults: { duration: 1, ease: "none" },
      scrollTrigger: {
        trigger: this.$section,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: ({ progress }) => this.setActive(progress),
        onRefresh: ({ progress }) => this.setActive(progress),
      },
    });

    const scale = 1.25;

    const [first] = this.items;
    gsap.set([first.$topHalf, first.$bottomHalf], { scale });

    this.items.forEach(({ $topHalf, $bottomHalf, $texts }, index) => {
      tl.to($topHalf, { yPercent: -50 }, index).to(
        $bottomHalf,
        { yPercent: 50 },
        index,
      );

      if ($texts.length) {
        tl.to($texts, { y: () => $bottomHalf.offsetHeight / 2 }, index);
      }

      const next = this.items[index + 1];
      const $nextMedia = next
        ? [next.$topHalf, next.$bottomHalf]
        : [this.$clone];

      tl.fromTo($nextMedia, { scale: 1 }, { scale }, index);

      const $nextTexts = next ? next.$texts : this.$cloneTexts;

      if ($nextTexts.length) {
        tl.fromTo(
          $nextTexts,
          { scale: 0.9, yPercent: 50 },
          { scale: 1, yPercent: 0 },
          index,
        );
      }
    });

    this.tl = tl;
  }

  private setActive(progress: number) {
    const count = this.items.length;
    const current = Math.min(Math.floor(progress * count), count - 1);
    const next = new Set([current, (current + 1) % count]);

    this.items.forEach(({ $item, $video }, index) => {
      $item.toggleAttribute("data-active", index === current);

      if (next.has(index)) {
        this.play($video);
      } else if (!$video.paused) {
        $video.pause();
      }
    });

    this.playing = next;
  }

  private play($video: HTMLVideoElement) {
    if (!$video.src && $video.dataset.src) {
      $video.src = $video.dataset.src;
      $video.load();
    }

    if (device.reducedMotion) {
      $video.pause();
      return;
    }

    if ($video.paused) {
      $video.play().catch(() => undefined);
    }
  }

  private paint(
    $video: HTMLVideoElement,
    ctx: CanvasRenderingContext2D | null,
  ) {
    if (!ctx || $video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    ctx.drawImage($video, 0, 0, ctx.canvas.width, ctx.canvas.height);
  }
}

if (!customElements.get("c-home-wide")) {
  customElements.define("c-home-wide", HomeWide);
}
