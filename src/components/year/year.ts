import { toRoman } from "../../scripts/utils/roman";

export class Year extends HTMLElement {
  /**
   * Lifecycle
   */
  connectedCallback() {
    // The page is served from the ISR cache, so the year rendered on the
    // server can be stale: refresh it on the client.
    const year = new Date().getFullYear();

    this.textContent =
      this.dataset.format === "roman" ? toRoman(year) : String(year);
  }
}

if (!customElements.get("c-year")) {
  customElements.define("c-year", Year);
}
