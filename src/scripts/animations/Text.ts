import { SplitText } from "gsap/SplitText";

export default class Text {
  private element: HTMLElement;
  private splitText: SplitText | null = null;

  constructor({ element }: { element: HTMLElement }) {
    this.element = element;
  }

  create() {
    const delay = this.element.dataset.delay ?? "0";

    this.splitText = SplitText.create(this.element, {
      type: "lines",
      mask: "lines",
      autoSplit: true,
    });

    (this.splitText.lines as HTMLElement[]).forEach((line, index) => {
      line.style.setProperty("--index", String(index));
      line.style.setProperty("--delay", `${delay}s`);
    });
  }

  destroy() {
    this.splitText?.revert();
  }
}
