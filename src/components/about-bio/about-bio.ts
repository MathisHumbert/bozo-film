import { SplitText } from "gsap/SplitText";

import { events, type UpdateData } from "../../scripts/utils/events";
import { smoothMin, smoothMax } from "../../scripts/utils/math";

type Char = {
  $el: HTMLElement;
  x: number;
};

type Line = {
  top: number;
  height: number;
  chars: Char[];
  current: number;
  applied: number;
};

// space between the illustration and the nearest letter, in line heights
const GAP = 0.15;

// size of the diamond, relative to the illustration
const SIZE = 1;

// how fast a line catches up with its goal, higher is snappier
const EASE = 400;

// how gently the illustration lands on the centre of the screen and leaves
// it, in viewport heights of scroll: 0 is a hard stop, like position: sticky
const SOFT = 0.2;

export class AboutBio extends HTMLElement {
  private $text: HTMLElement | null;
  private $track: HTMLElement | null;
  private $anchor: HTMLElement | null;
  private $illustration: SVGElement | null;

  private split: SplitText | null = null;
  private lines: Line[] = [];
  private size = { width: 0, height: 0 };

  constructor() {
    super();

    this.$text = this.querySelector('[data-about-bio="text"]');
    this.$track = this.querySelector('[data-about-bio="track"]');
    this.$anchor = this.querySelector('[data-about-bio="anchor"]');
    this.$illustration = this.querySelector('[data-about-bio="illustration"]');
  }

  /**
   * Lifecycle
   */
  connectedCallback() {
    if (!this.$text || !this.$track || !this.$anchor || !this.$illustration)
      return;

    this.split = SplitText.create(this.$text, {
      type: "lines, words, chars",
      reduceWhiteSpace: false,
      autoSplit: true,
      onSplit: this.measure,
    });

    this.bindEvents();
  }

  disconnectedCallback() {
    this.unbindEvents();

    this.split?.revert();
    this.split = null;
    this.lines = [];
  }

  /**
   * Events
   */
  private bindEvents() {
    events.on("update", this.update);
  }

  private unbindEvents() {
    events.off("update", this.update);
  }

  /**
   * Methods
   */
  private measure = (self: SplitText) => {
    if (!this.$text || !this.$illustration) return;

    const origin = this.$text.getBoundingClientRect();
    const illustration = this.$illustration.getBoundingClientRect();
    const chars = self.chars as HTMLElement[];

    this.size = { width: illustration.width, height: illustration.height };

    // positions are stored relative to the paragraph, so they hold while
    // the page scrolls and only a new split changes them
    this.lines = (self.lines as HTMLElement[]).map(($line) => {
      const rect = $line.getBoundingClientRect();

      return {
        top: rect.top - origin.top,
        height: rect.height,
        chars: chars
          .filter(($char) => $line.contains($char))
          .map(($char) => {
            const box = $char.getBoundingClientRect();

            return { $el: $char, x: box.left + box.width / 2 - origin.left };
          }),
        current: 0,
        applied: 0,
      };
    });
  };

  update = ({ deltaTime }: UpdateData) => {
    if (!this.$text || !this.$track || !this.$anchor || !this.lines.length)
      return;

    const origin = this.$text.getBoundingClientRect();
    const track = this.$track.getBoundingClientRect();
    const illustration = this.size;

    // what position: sticky does, the centre of the screen clamped to the
    // track, but with a soft clamp so it eases in and out instead of
    // catching and dropping the illustration dead
    const soft = window.innerHeight * SOFT;
    const screen = window.innerHeight / 2 - track.top;
    const position = smoothMin(smoothMax(screen, 0, soft), track.height, soft);

    this.$anchor.style.transform = `translate3d(0, ${position}px, 0)`;

    const centerX = track.left + track.width / 2 - origin.left;
    const centerY = track.top + position - origin.top;

    const ease = 1 - Math.exp(-deltaTime * EASE);

    this.lines.forEach((line) => {
      // the gap follows a diamond around the illustration: its width shrinks
      // linearly from the middle to the tips, so a line crossing the centre
      // opens wide and one near the top or bottom barely moves
      const gap = line.height * GAP;
      const halfWidth = (illustration.width / 2) * SIZE + gap;
      const halfHeight = (illustration.height / 2) * SIZE + gap;
      const distance = Math.max(
        Math.abs(centerY - (line.top + line.height / 2)) - line.height / 2,
        0,
      );
      const goal = halfWidth * Math.max(1 - distance / halfHeight, 0);

      line.current += (goal - line.current) * ease;

      if (Math.abs(line.current - line.applied) < 0.01) return;

      line.applied = line.current;

      line.chars.forEach((char) => {
        const offset = char.x < centerX ? -line.current : line.current;

        char.$el.style.translate = `${offset}px 0`;
      });
    });
  };
}

if (!customElements.get("c-about-bio")) {
  customElements.define("c-about-bio", AboutBio);
}
