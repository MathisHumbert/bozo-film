import { events } from "../utils/events";

export type DeviceType = "phone" | "tablet" | "desktop";

const ua = navigator.userAgent;

const isIpadOs = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;

function getType(): DeviceType {
  if (/Mobi|iPhone|iPod/i.test(ua)) {
    return "phone";
  }

  if (/iPad/i.test(ua) || isIpadOs || /Android/i.test(ua)) {
    return "tablet";
  }

  return "desktop";
}

const queries = {
  reducedMotion: matchMedia("(prefers-reduced-motion: reduce)"),
  touch: matchMedia("(hover: none)"),
};

class Device {
  readonly type = getType();

  readonly isPhone = this.type === "phone";
  readonly isTablet = this.type === "tablet";
  readonly isMobile = this.type !== "desktop";
  readonly isDesktop = this.type === "desktop";

  readonly isWebkit = /^((?!chrome|android).)*safari/i.test(ua) || isIpadOs;

  readonly isAppBrowser =
    /FBAN|FBAV|Instagram|Twitter|LinkedInApp|TikTok/i.test(ua);

  reducedMotion = queries.reducedMotion.matches;
  isTouch = queries.touch.matches;

  private webgl: boolean | null = null;

  constructor() {
    queries.reducedMotion.addEventListener("change", this.onReducedMotion);
    queries.touch.addEventListener("change", this.onTouch);

    document.documentElement.classList.add(
      this.isMobile ? "mobile" : "desktop",
    );
  }

  get hasWebgl() {
    if (this.webgl === null) {
      const canvas = document.createElement("canvas");

      this.webgl = Boolean(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") || canvas.getContext("webgl")),
      );
    }

    return this.webgl;
  }

  private onReducedMotion = (event: MediaQueryListEvent) => {
    this.reducedMotion = event.matches;

    events.emit("device:motion", { reducedMotion: this.reducedMotion });
  };

  private onTouch = (event: MediaQueryListEvent) => {
    this.isTouch = event.matches;
  };
}

export const device = new Device();
