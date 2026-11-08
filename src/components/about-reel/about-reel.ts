import gsap from "gsap";

import Scroll from "../../scripts/classes/Scroll";
import { device } from "../../scripts/classes/Device";
import { mattEasing } from "../../scripts/utils/easing";
import { attachSources } from "../../scripts/utils/video";

const INVIEW_EVENT = "about-reel:inview";

const DURATION = {
  expand: 1.2,
  fade: 0.6,
  intro: 1.2,
};

const EASE = {
  expand: mattEasing,
  fade: "power2.out",
  intro: mattEasing,
};

type ScrollCallDetail = {
  target: HTMLElement;
  way: "enter" | "leave";
  from: string;
};

// Where the thumbnail sits, as transforms of a fullscreen frame.
type Geometry = {
  x: number; // thumbnail centre - viewport centre
  y: number;
  scaleX: number; // thumbnail size / viewport size
  scaleY: number;
  width: number; // media box: the viewport's cover at the thumbnail ratio
  height: number;
  scale: number; // media box scale that matches the thumbnail
};

export class AboutReel extends HTMLElement {
  private $holder: HTMLElement | null;
  private $frame: HTMLElement | null;
  private $media: HTMLElement | null;
  private $main: HTMLVideoElement | null;
  private $mainWrapper: HTMLElement | null;
  private $toggle: HTMLButtonElement | null;
  private $label: HTMLElement | null;
  private $center: HTMLElement | null;
  private $lines: NodeListOf<HTMLElement>;

  private $nav: HTMLElement | null = null;

  private isPlaying = false;
  private tl: gsap.core.Timeline | null = null;

  // 0 = thumbnail, 1 = fullscreen. Tweened by play and pause, from wherever
  // it is, so toggling mid-animation simply turns around.
  private open = { progress: 0 };
  private geometry: Geometry | null = null;

  private isCollapsed = false;
  private intro: gsap.core.Timeline | null = null;

  constructor() {
    super();

    this.$holder = this.querySelector('[data-about-reel="holder"]');
    this.$frame = this.querySelector('[data-about-reel="frame"]');
    this.$media = this.querySelector('[data-about-reel="media"]');
    this.$main = this.querySelector('[data-about-reel="main"] video');
    this.$mainWrapper = this.querySelector('[data-about-reel="main"]');
    this.$toggle = this.querySelector('[data-about-reel="toggle"]');
    this.$label = this.querySelector('[data-about-reel="label"]');
    this.$center = this.querySelector('[data-about-reel="center"]');
    this.$lines = this.querySelectorAll('[data-about-reel="line"]');
  }

  /**
   * Lifecycle
   */
  connectedCallback() {
    if (!this.$frame || !this.$main || !this.$toggle) return;

    this.$nav = document.querySelector("[data-nav]");

    this.bindEvents();
    this.collapse();
  }

  disconnectedCallback() {
    this.unbindEvents();

    this.tl?.kill();
    this.intro?.kill();

    if (this.isPlaying) {
      Scroll.resume();
    }

    if (this.$nav) {
      gsap.killTweensOf(this.$nav);
      gsap.set(this.$nav, { autoAlpha: 1 });
    }
  }

  /**
   * Events
   */
  private bindEvents() {
    this.$toggle?.addEventListener("click", this.onToggle);
    this.$main?.addEventListener("ended", this.onEnded);

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("resize", this.onResize);
    window.addEventListener(INVIEW_EVENT, this.onInview);
  }

  private unbindEvents() {
    this.$toggle?.removeEventListener("click", this.onToggle);
    this.$main?.removeEventListener("ended", this.onEnded);

    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener(INVIEW_EVENT, this.onInview);
  }

  private onInview = (event: Event) => {
    const { target, way } = (event as CustomEvent<ScrollCallDetail>).detail;

    if (target !== this || way !== "enter") return;

    this.expand();
  };

  private onToggle = () => {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  };

  private onEnded = () => {
    if (this.$main) {
      this.$main.currentTime = 0;
    }

    this.pause();
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && this.isPlaying) {
      this.pause();
    }
  };

  private onResize = () => {
    if (this.isCollapsed) {
      this.pinLines();
    }

    // Open, the media box follows the window.
    if (this.isPlaying && !this.tl?.isActive()) {
      this.setOpenLayout();
      this.render();
    }
  };

  /**
   * Getters
   */
  private get $preview() {
    return this.querySelector<HTMLVideoElement>(
      '[data-about-reel="preview"] video',
    );
  }

  /**
   * Intro
   */

  // Thumbnail scaled to 0, lines pulled over its centre, until the section
  // reaches the middle of the screen. Transforms only, so nothing below moves.
  private collapse() {
    if (device.reducedMotion || !this.$holder || !this.$frame) return;

    this.isCollapsed = true;

    gsap.set(this.$frame, { scale: 0 });
    this.pinLines();

    // Line heights change once the fonts swap in.
    document.fonts.ready.then(() => {
      if (this.isCollapsed) this.pinLines();
    });
  }

  private pinLines() {
    if (!this.$holder) return;

    gsap.set(this.$lines, { clearProps: "transform" });

    const holder = this.$holder.getBoundingClientRect();
    const centre = holder.top + holder.height / 2;

    // All reads before any write, so the layout is computed once.
    const offsets = [...this.$lines].map(($line) => {
      const rect = $line.getBoundingClientRect();
      return rect.top < centre ? centre - rect.bottom : centre - rect.top;
    });

    this.$lines.forEach(($line, index) => gsap.set($line, { y: offsets[index] }));
  }

  // Lines and scale share one timeline, so the gaps grow in step.
  private expand() {
    if (!this.isCollapsed || !this.$frame) return;

    this.isCollapsed = false;

    const tl = gsap.timeline({
      defaults: { duration: DURATION.intro, ease: EASE.intro },
      onComplete: () => {
        gsap.set(this.$lines, { clearProps: "transform" });
        gsap.set(this.$frame, { clearProps: "transform" });
      },
    });

    tl.to(this.$lines, { y: 0 }, 0).to(this.$frame, { scale: 1 }, 0);

    this.intro = tl;
  }

  /**
   * Open / close
   *
   * The frame is fixed fullscreen and scaled onto the thumbnail, transforms
   * only. The media and the label get the inverse scale so neither squashes.
   */
  private measure(): Geometry | null {
    if (!this.$holder) return null;

    const rect = this.$holder.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const ratio = rect.width / rect.height;

    const width = Math.max(viewportWidth, viewportHeight * ratio);
    const height = width / ratio;

    return {
      x: rect.left + rect.width / 2 - viewportWidth / 2,
      y: rect.top + rect.height / 2 - viewportHeight / 2,
      scaleX: rect.width / viewportWidth,
      scaleY: rect.height / viewportHeight,
      width,
      height,
      scale: rect.width / width,
    };
  }

  // Set once per open / close, not per frame.
  private setOpenLayout() {
    this.geometry = this.measure();

    if (!this.geometry) return;

    gsap.set(this.$frame, { position: "fixed", zIndex: 10 });
    gsap.set(this.$media, {
      width: this.geometry.width,
      height: this.geometry.height,
      left: (window.innerWidth - this.geometry.width) / 2,
      top: (window.innerHeight - this.geometry.height) / 2,
    });
  }

  // Runs every frame of the open / close: plain style writes, no gsap.set,
  // which would allocate a tween per element per frame.
  private render = () => {
    const geometry = this.geometry;

    if (!geometry || !this.$frame || !this.$media || !this.$center) return;

    const { progress } = this.open;

    // Linear from thumbnail to fullscreen, so the media's scale stays uniform.
    const x = gsap.utils.interpolate(geometry.x, 0, progress);
    const y = gsap.utils.interpolate(geometry.y, 0, progress);
    const scaleX = gsap.utils.interpolate(geometry.scaleX, 1, progress);
    const scaleY = gsap.utils.interpolate(geometry.scaleY, 1, progress);
    const scale = gsap.utils.interpolate(geometry.scale, 1, progress);

    this.$frame.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scaleX}, ${scaleY})`;
    this.$media.style.transform = `scale(${scale / scaleX}, ${scale / scaleY})`;
    this.$center.style.transform = `scale(${1 / scaleX}, ${1 / scaleY})`;
  };

  // Back in the page flow, exactly where the thumbnail was.
  private resetOpenLayout() {
    this.geometry = null;

    gsap.set(this.$frame, { clearProps: "position,zIndex,transform" });
    gsap.set(this.$media, { clearProps: "width,height,left,top,transform" });
    gsap.set(this.$center, { clearProps: "transform" });
  }

  private play() {
    if (!this.$frame || !this.$main) return;

    // Before or mid-intro (the button is reachable by keyboard while scaled
    // to 0): finish it so the thumbnail is measured unscaled.
    this.expand();
    this.intro?.progress(1);

    const speed = device.reducedMotion ? 0 : 1;

    this.isPlaying = true;
    this.setLabel("Pause Reel");

    Scroll.stop();

    attachSources(this.$main);
    this.$main.play().catch(() => this.pause());

    this.tl?.kill();

    this.setOpenLayout();
    this.render();

    const tl = gsap.timeline({
      onComplete: () => {
        this.render();
        this.$preview?.pause();
      },
    });

    tl.to(
      this.open,
      {
        progress: 1,
        duration: DURATION.expand * speed,
        ease: EASE.expand,
        onUpdate: this.render,
      },
      0,
    )
      .to(
        this.$mainWrapper,
        {
          autoAlpha: 1,
          duration: DURATION.fade * speed,
          ease: EASE.fade,
        },
        0,
      )
      .to(
        this.$nav,
        {
          autoAlpha: 0,
          duration: DURATION.fade * speed,
          ease: EASE.fade,
        },
        0,
      );

    this.tl = tl;
  }

  private pause() {
    if (!this.$frame) return;

    const speed = device.reducedMotion ? 0 : 1;

    this.isPlaying = false;
    this.setLabel("Play Reel");

    this.$main?.pause();
    this.$preview?.play().catch(() => undefined);

    this.tl?.kill();

    this.setOpenLayout();
    this.render();

    const tl = gsap.timeline({
      onComplete: () => {
        this.resetOpenLayout();

        Scroll.resume();
      },
    });

    tl.to(
      this.open,
      {
        progress: 0,
        duration: DURATION.expand * speed,
        ease: EASE.expand,
        onUpdate: this.render,
      },
      0,
    )
      .to(
        this.$mainWrapper,
        {
          autoAlpha: 0,
          duration: DURATION.fade * speed,
          ease: EASE.fade,
        },
        (DURATION.expand - DURATION.fade) * speed,
      )
      .to(
        this.$nav,
        {
          autoAlpha: 1,
          duration: DURATION.fade * speed,
          ease: EASE.fade,
        },
        (DURATION.expand - DURATION.fade) * speed,
      );

    this.tl = tl;
  }

  private setLabel(label: string) {
    if (!this.$label) return;

    const $halves = this.$label.querySelectorAll("[data-split-half]");

    if ($halves.length) {
      $halves.forEach(($half) => ($half.textContent = label));
    } else {
      this.$label.textContent = label;
    }
  }
}

if (!customElements.get("c-about-reel")) {
  customElements.define("c-about-reel", AboutReel);
}
