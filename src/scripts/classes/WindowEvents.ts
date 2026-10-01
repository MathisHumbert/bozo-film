import gsap from "gsap";

import Scroll from "./Scroll";
import { responsive } from "./Responsive";
import { events } from "../utils/events";

class WindowEvents {
  constructor() {
    this.addEventListeners();
    gsap.ticker.add(this.update);
  }

  private addEventListeners() {
    window.addEventListener("resize", this.onResize, { passive: true });
    window.addEventListener("click", this.onClick, { passive: true });
    window.addEventListener("mousedown", this.onTouchDown, { passive: true });
    window.addEventListener("mousemove", this.onTouchMove, { passive: true });
    window.addEventListener("mouseup", this.onTouchUp, { passive: true });
    window.addEventListener("touchstart", this.onTouchDown, { passive: true });
    window.addEventListener("touchmove", this.onTouchMove, { passive: true });
    window.addEventListener("touchend", this.onTouchUp, { passive: true });
    window.addEventListener("wheel", this.onWheel, { passive: true });
  }

  onResize = () => {
    responsive.onResize();

    events.emit("resize", {
      screen: responsive.screen,
      viewport: responsive.viewport,
      fontSize: responsive.fontSize,
    });
  };

  onTouchDown = (event: MouseEvent | TouchEvent) => {
    events.emit("touchdown", event);
  };

  onTouchMove = (event: MouseEvent | TouchEvent) => {
    events.emit("touchmove", event);
  };

  onTouchUp = (event: MouseEvent | TouchEvent) => {
    events.emit("touchup", event);
  };

  onClick = (event: MouseEvent) => {
    events.emit("click", event);
  };

  onWheel = (event: WheelEvent) => {
    events.emit("wheel", event);
  };

  update = (time: number, deltaTime: number) => {
    const dt = deltaTime / 1000;

    events.emit("start-update", { time, deltaTime: dt });

    events.emit("update", {
      time,
      deltaTime: dt,
      scroll: Scroll.scroll,
      velocity: Scroll.velocity,
      direction: Scroll.direction,
    });

    events.emit("end-update", { time, deltaTime: dt });
  };
}

export const windowEvents = new WindowEvents();
