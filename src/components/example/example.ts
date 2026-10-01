const LABEL = { idle: "Click Me!", counting: "Again!" };

export class Example extends HTMLElement {
  private $button: HTMLElement | null;
  private $output: HTMLElement | null;

  private count = 0;

  constructor() {
    super();

    this.$button = this.querySelector('[data-example="button"]');
    this.$output = this.querySelector('[data-example="output"]');
  }

  /**
   * Lifecycle
   */
  connectedCallback() {
    this.bindEvents();
  }

  disconnectedCallback() {
    this.unbindEvents();
  }

  /**
   * Events
   */
  private bindEvents() {
    this.$button?.addEventListener("click", this.onClick);
  }

  private unbindEvents() {
    this.$button?.removeEventListener("click", this.onClick);
  }

  /**
   * Getters
   */
  private get label() {
    return this.count ? LABEL.counting : LABEL.idle;
  }

  /**
   * Methods
   */
  private onClick = () => {
    this.count += 1;

    this.render();
  };

  private render() {
    if (this.$output) {
      this.$output.textContent = String(this.count);
    }

    if (this.$button) {
      this.$button.textContent = this.label;
    }
  }

  public reset() {
    this.count = 0;

    this.render();
  }
}

if (!customElements.get("c-example")) {
  customElements.define("c-example", Example);
}
