export class WorkNext extends HTMLElement {
  constructor() {
    super();
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
  private bindEvents() {}

  private unbindEvents() {}
}

if (!customElements.get("c-work-next")) {
  customElements.define("c-work-next", WorkNext);
}
