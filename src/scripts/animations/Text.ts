import { SplitText } from "gsap/SplitText";

export default class Text {
  private element: HTMLElement;
  private splitText: SplitText | null = null;

  constructor({ element }: { element: HTMLElement }) {
    this.element = element;
  }

  create() {
    const delay = this.element.dataset.delay ?? "0";

    // SplitText collapses white space by default, line breaks included: an
    // element that keeps them (whitespace-pre-line and the like) lost them.
    const keepsBreaks = getComputedStyle(this.element).whiteSpace.startsWith(
      "pre",
    );

    this.splitText = SplitText.create(this.element, {
      type: "lines",
      mask: "lines",
      autoSplit: true,
      reduceWhiteSpace: !keepsBreaks,
      onSplit: (self) => {
        const lines = self.lines as HTMLElement[];

        lines.forEach((line, index) => {
          line.style.setProperty("--index", String(index));
          line.style.setProperty("--delay", `${delay}s`);
        });

        lines.at(-1)?.addEventListener("transitionend", this.onEnd);
      },
    });
  }

  destroy() {
    this.splitText?.revert();
    this.splitText = null;
  }

  private onEnd = (event: TransitionEvent) => {
    if (event.propertyName !== "transform") return;
    if (event.target !== event.currentTarget) return;

    this.destroy();
  };
}
