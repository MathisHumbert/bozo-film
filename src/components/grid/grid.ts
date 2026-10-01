import { events } from "../../scripts/utils/events";

class Grid extends HTMLElement {
  private isVisible: boolean = false;

  /**
   * Lifecycle
   */
  connectedCallback() {
    this.buildColumns();
    this.bindEvents();
  }

  disconnectedCallback() {
    this.unbindEvents();
  }

  /**
   * Events
   */
  bindEvents() {
    document.addEventListener("keydown", this.onKeyDown);
    events.on("resize", this.onResize);
  }

  unbindEvents() {
    document.removeEventListener("keydown", this.onKeyDown);
    events.off("resize", this.onResize);
  }

  /**
   * Methods
   */
  onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === "g") {
      this.isVisible = !this.isVisible;
      this.style.display = this.isVisible ? "flex" : "none";
    }
  };

  onResize = () => {
    this.buildColumns();
  };

  buildColumns() {
    const count = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--grid-count",
      ),
    );

    this.innerHTML = "";

    for (let i = 0; i < count; i++) {
      const col = document.createElement("div");
      col.className = "grid__item";
      this.appendChild(col);
    }
  }
}

customElements.define("c-grid", Grid);
