import { device } from "../../scripts/classes/Device";
import { events } from "../../scripts/utils/events";
import { attachSources } from "../../scripts/utils/video";

const INVIEW_EVENT = "video:inview";

type ScrollCallDetail = {
  target: HTMLElement;
  way: "enter" | "leave";
  from: string;
};

export class Video extends HTMLElement {
  private $video: HTMLVideoElement | null = null;

  private wantsAutoplay = false;
  private visible = false;

  constructor() {
    super();

    this.$video = this.querySelector("video");
    this.wantsAutoplay = this.hasAttribute("data-autoplay");
  }

  /**
   * Lifecycle
   */
  connectedCallback() {
    if (!this.$video) return;

    this.applyMotionPreference();

    window.addEventListener(INVIEW_EVENT, this.onInview);
    events.on("device:motion", this.onMotionPreferenceChange);

    if (this.classList.contains("is-inview")) {
      this.visible = true;
      this.load();
      this.play();
    }
  }

  disconnectedCallback() {
    window.removeEventListener(INVIEW_EVENT, this.onInview);
    events.off("device:motion", this.onMotionPreferenceChange);
  }

  /**
   * Events
   */
  onInview = (event: Event) => {
    const { target, way } = (event as CustomEvent<ScrollCallDetail>).detail;

    if (target !== this || !this.$video) return;

    this.visible = way === "enter";

    if (this.visible) {
      this.load();
      this.play();

      return;
    }

    if (!this.$video.paused) {
      this.$video.pause();
    }
  };

  onMotionPreferenceChange = () => {
    this.applyMotionPreference();

    if (this.visible) {
      this.play();
    } else {
      this.$video?.pause();
    }
  };

  /**
   * Methods
   */
  load() {
    if (!this.$video) return;

    attachSources(this.$video);
  }

  play() {
    if (!this.$video || !this.autoplays()) return;

    this.$video.play().catch(() => undefined);
  }

  applyMotionPreference() {
    if (!this.$video) return;

    if (this.wantsAutoplay && device.reducedMotion) {
      this.$video.controls = true;
    }
  }

  autoplays() {
    return this.wantsAutoplay && !device.reducedMotion;
  }

  // gives up the <video> so another c-video can adopt it; this one then
  release() {
    const video = this.$video;

    this.$video = null;

    return video;
  }

  // the element is never detached long enough to pause or reload
  adopt(video: HTMLVideoElement) {
    if (!this.$video) return;

    video.className = this.$video.className;

    this.$video.replaceWith(video);
    this.$video = video;
    this.visible = true;

    this.play();
  }
}

customElements.define("c-video", Video);
