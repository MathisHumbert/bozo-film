import { device } from "../../scripts/classes/Device";
import { events } from "../../scripts/utils/events";
import { attachSources } from "../../scripts/utils/video";

const INVIEW_EVENT = "video:inview";

type ScrollCallDetail = {
  target: HTMLElement;
  way: "enter" | "leave";
  from: string;
};

class Video extends HTMLElement {
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
}

customElements.define("c-video", Video);
