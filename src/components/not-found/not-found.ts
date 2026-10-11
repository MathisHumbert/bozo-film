import Scroll from "../../scripts/classes/Scroll";
import { events } from "../../scripts/utils/events";

// how far past the screen a mouth grows before it counts as gone: the opening
// sits inside the shape, so its box has to be well beyond the viewport
const OVERSHOOT = 3.5;

// scroll it takes for one mouth to go from scale 1 to gone, in viewport heights
const SPEED = 1;

export class NotFound extends HTMLElement {
  private $mouths: HTMLElement | null;
  private $mouth: SVGElement[];

  private count: number;
  private lastScroll = 0;
  private progress = 0;
  private ratio = 0;

  constructor() {
    super();

    this.$mouths = this.querySelector('[data-not-found="mouths"]');
    this.$mouth = Array.from(
      this.querySelectorAll<SVGElement>('[data-not-found="mouth"]'),
    );

    this.count = this.$mouth.length;
  }

  /**
   * Lifecycle
   */
  connectedCallback() {
    if (!this.$mouths || !this.count) return;

    this.lastScroll = Scroll.scroll;

    this.measure();
    this.render();

    this.bindEvents();
  }

  disconnectedCallback() {
    this.unbindEvents();
  }

  /**
   * Events
   */
  private bindEvents() {
    events.on("resize", this.measure);
    events.on("update", this.update);
  }

  private unbindEvents() {
    events.off("resize", this.measure);
    events.off("update", this.update);
  }

  /**
   * Methods
   */
  private measure = () => {
    const width = this.$mouths?.offsetWidth ?? 0;
    const diagonal = Math.hypot(window.innerWidth, window.innerHeight);

    const max = width ? Math.max(2, (diagonal / width) * OVERSHOOT) : 1;

    this.ratio = Math.log(max);
  };

  private render() {
    this.$mouth.forEach(($mouth, index) => {
      const t = (((this.progress + index / this.count) % 1) + 1) % 1;

      const scale = Math.exp((t * this.count - (this.count - 1)) * this.ratio);

      $mouth.style.scale = String(scale);
      $mouth.style.zIndex = String(Math.floor((1 - t) * this.count));
    });
  }

  /**
   * Loop
   */
  private update = () => {
    const scroll = Scroll.scroll;
    const limit = Scroll.limit;
    let delta = scroll - this.lastScroll;

    this.lastScroll = scroll;

    if (limit > 0 && delta > limit / 2) {
      delta -= limit;
    }
    if (limit > 0 && delta < -limit / 2) {
      delta += limit;
    }

    this.progress += delta / (window.innerHeight * SPEED * this.count);

    this.render();
  };
}

if (!customElements.get("c-not-found")) {
  customElements.define("c-not-found", NotFound);
}
