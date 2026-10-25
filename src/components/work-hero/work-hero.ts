import gsap from "gsap";

import Scroll from "../../scripts/classes/Scroll";
import { device } from "../../scripts/classes/Device";
import { responsive } from "../../scripts/classes/Responsive";
import { events } from "../../scripts/utils/events";
import { reveal } from "../../scripts/utils/reveal";
import { attachSources } from "../../scripts/utils/video";

const IDLE = 3500;

const EASE = "power2.out";
const FADE = 0.6;
const SCROLL = 1.2;

// rem left between the timestamps and the toggle once they have closed in on
// it: they follow the playback, from the edges at 0 to the toggle at the end
const GAP = 2.4;

// back to the edges once the video has ended
const RETURN = 1.2;

// iOS's own player, on HTMLVideoElement only: Safari on iPhone has no
// requestFullscreen.
type NativeVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

export class WorkHero extends HTMLElement {
  private $mainWrapper: HTMLElement | null;
  private $main: HTMLVideoElement | null;
  private $title: HTMLElement | null;
  private $duration: HTMLElement | null;
  private $toggle: HTMLButtonElement | null;
  private $label: HTMLElement | null;
  private $minutes: HTMLElement | null;
  private $seconds: HTMLElement | null;
  private $durationLines: HTMLElement[];
  private $toggleLines: HTMLElement[];

  private $nav: HTMLElement | null = null;

  // how far each timestamp travels to reach the toggle, in px
  private travel = { minutes: 0, seconds: 0 };

  private isPlaying = false;
  private isIdle = false;
  private idleTimer: number | null = null;

  constructor() {
    super();

    this.$mainWrapper = this.querySelector('[data-work-hero="main"]');
    this.$main = this.querySelector('[data-work-hero="main"] video');
    this.$title = this.querySelector('[data-work-hero="title"]');
    this.$duration = this.querySelector('[data-work-hero="duration"]');
    this.$toggle = this.querySelector('[data-work-hero="toggle"]');
    this.$label = this.querySelector('[data-work-hero="label"]');
    this.$minutes = this.querySelector('[data-work-hero="minutes"]');
    this.$seconds = this.querySelector('[data-work-hero="seconds"]');
    this.$durationLines = Array.from(
      this.querySelectorAll('[data-work-hero="duration-line"]'),
    );
    this.$toggleLines = Array.from(
      this.querySelectorAll('[data-work-hero="toggle-line"]'),
    );
  }

  /**
   * Lifecycle
   */
  connectedCallback() {
    this.$nav = document.querySelector("[data-nav]");

    this.bindEvents();
  }

  disconnectedCallback() {
    this.unbindEvents();
    this.clearIdle();

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
    this.$main?.addEventListener("webkitendfullscreen", this.onNativeExit);
    document.addEventListener("fullscreenchange", this.onNativeExit);

    window.addEventListener("keydown", this.onKeyDown);
    events.on("touchmove", this.onActivity);
    events.on("touchdown", this.onActivity);
    events.on("wheel", this.onActivity);
    events.on("update", this.update);
    events.on("resize", this.measure);
    events.on("page:revealed", this.reveal);
  }

  private unbindEvents() {
    this.$toggle?.removeEventListener("click", this.onToggle);
    this.$main?.removeEventListener("ended", this.onEnded);
    this.$main?.removeEventListener("webkitendfullscreen", this.onNativeExit);
    document.removeEventListener("fullscreenchange", this.onNativeExit);

    window.removeEventListener("keydown", this.onKeyDown);
    events.off("touchmove", this.onActivity);
    events.off("touchdown", this.onActivity);
    events.off("wheel", this.onActivity);
    events.off("update", this.update);
    events.off("resize", this.measure);
    events.off("page:revealed", this.reveal);
  }

  private onToggle = () => {
    // A touch screen hands the video to the device's own player.
    if (device.isTouch || device.isMobile) {
      this.playNative();
      return;
    }

    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  };

  private onEnded = () => {
    this.pause();
    this.reset();
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && this.isPlaying) {
      this.pause();
      return;
    }

    this.onActivity();
  };

  private onActivity = () => {
    if (this.isPlaying) {
      this.wake();
    }
  };

  // Out of the device's player, by its close button or by the video ending:
  // fullscreenchange also fires on the way in, hence the check.
  private onNativeExit = () => {
    if (!this.$main || document.fullscreenElement === this.$main) return;
    if (this.$main.controls === false) return;

    this.$main.pause();
    this.$main.controls = false;
    this.$main.setAttribute("playsinline", "");

    gsap.set(this.$mainWrapper, { autoAlpha: 0 });

    this.$preview?.play().catch(() => undefined);
  };

  /**
   * Animations
   */
  private reveal = () => {
    events.off("page:revealed", this.reveal);

    reveal([this.$title, ...this.$durationLines, ...this.$toggleLines]);
  };

  /**
   * Getters
   */
  private get $preview() {
    return this.querySelector<HTMLVideoElement>(
      '[data-work-hero="preview"] video',
    );
  }

  /**
   * Methods
   */
  private play() {
    if (!this.$main) return;

    this.isPlaying = true;
    this.setLabel("PAUSE");

    // After the label: PAUSE is not as wide as WATCH.
    this.measure();

    attachSources(this.$main);
    this.$main.play().catch(() => this.pause());
    this.$preview?.pause();

    // The page holds still while the video plays: back to the top first if
    // it has to, locked so a wheel cannot cut in, then stopped.
    if (Scroll.scroll > 0) {
      Scroll.scrollTo(0, {
        force: true,
        lock: true,
        duration: this.duration(SCROLL),
        onComplete: () => {
          if (this.isPlaying) Scroll.stop();
        },
      });
    } else {
      Scroll.stop();
    }

    gsap.to(this.$mainWrapper, {
      autoAlpha: 1,
      duration: this.duration(FADE),
      ease: EASE,
    });

    gsap.to(this.$nav, {
      autoAlpha: 0,
      duration: this.duration(FADE),
      ease: EASE,
    });
    gsap.to(this.$title, {
      opacity: 0,
      duration: this.duration(FADE),
      ease: EASE,
    });

    this.wake();
  }

  // Nothing of the inline player: no scroll lock, no idle, no timestamps.
  // The device draws its own controls and closes on its own.
  private playNative() {
    const video = this.$main as NativeVideo | null;

    if (!video) return;

    attachSources(video);

    // Without playsinline, an iPhone plays it in its own player by itself.
    video.removeAttribute("playsinline");
    video.controls = true;
    video.play().catch(() => undefined);

    this.$preview?.pause();

    // Visible: a fullscreen element still inherits its wrapper's
    // visibility, and Android shows the element itself.
    gsap.set(this.$mainWrapper, { autoAlpha: 1 });

    try {
      if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      } else {
        video.requestFullscreen?.().catch(() => undefined);
      }
    } catch {
      // Not ready yet on some iPads: it keeps playing inline, with controls.
    }
  }

  private pause() {
    this.isPlaying = false;
    this.setLabel("WATCH");

    this.$main?.pause();

    Scroll.resume();

    gsap.to(this.$nav, {
      autoAlpha: 1,
      duration: this.duration(FADE),
      ease: EASE,
    });
    gsap.to(this.$title, {
      opacity: 1,
      duration: this.duration(FADE),
      ease: EASE,
    });

    this.wake();
  }

  private reset() {
    gsap.to([this.$minutes, this.$seconds], {
      x: 0,
      duration: this.duration(RETURN),
      ease: EASE,
    });

    gsap.to(this.$mainWrapper, {
      autoAlpha: 0,
      duration: this.duration(FADE),
      ease: EASE,
      onComplete: () => {
        if (this.$main) {
          this.$main.currentTime = 0;
        }
      },
    });

    this.$preview?.play().catch(() => undefined);
  }

  private wake() {
    this.clearIdle();

    if (this.isIdle) {
      this.isIdle = false;
      this.style.cursor = "";

      gsap.to([this.$toggle, this.$duration], {
        opacity: 1,
        duration: this.duration(FADE / 2),
        ease: EASE,
      });
    }

    if (this.isPlaying) {
      this.idleTimer = window.setTimeout(this.sleep, IDLE);
    }
  }

  private sleep = () => {
    this.isIdle = true;
    this.style.cursor = "none";

    gsap.to([this.$toggle, this.$duration], {
      opacity: 0,
      duration: this.duration(FADE),
      ease: EASE,
    });
  };

  private clearIdle() {
    if (this.idleTimer === null) return;

    window.clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  // Measured where they rest, without the travel already done, so a resize
  // mid-video keeps them at the same point of their way.
  private measure = () => {
    if (!this.$minutes || !this.$seconds || !this.$toggle) return;

    const toggle = this.$toggle.getBoundingClientRect();
    const minutes = this.$minutes.getBoundingClientRect();
    const seconds = this.$seconds.getBoundingClientRect();
    const gap = GAP * responsive.fontSize;

    const minutesX = Number(gsap.getProperty(this.$minutes, "x")) || 0;
    const secondsX = Number(gsap.getProperty(this.$seconds, "x")) || 0;

    this.travel = {
      minutes: toggle.left - gap - (minutes.right - minutesX),
      seconds: toggle.right + gap - (seconds.left - secondsX),
    };
  };

  // Follows the video's own clock, so a pause holds them and a stall waits.
  private update = () => {
    if (!this.isPlaying || !this.$main) return;

    const { currentTime, duration } = this.$main;

    if (!Number.isFinite(duration) || duration <= 0) return;

    const progress = Math.min(currentTime / duration, 1);

    gsap.set(this.$minutes, { x: this.travel.minutes * progress });
    gsap.set(this.$seconds, { x: this.travel.seconds * progress });
  };

  private setLabel(label: string) {
    if (!this.$label) return;

    const $halves = this.$label.querySelectorAll("[data-split-half]");

    if ($halves.length) {
      $halves.forEach(($half) => ($half.textContent = label));
    } else {
      this.$label.textContent = label;
    }
  }

  private duration(seconds: number) {
    return device.reducedMotion ? 0 : seconds;
  }
}

if (!customElements.get("c-work-hero")) {
  customElements.define("c-work-hero", WorkHero);
}
