import { events } from "../../scripts/utils/events";

// Ctrl+G toggles the columns, Ctrl+H the rows.
class Grid extends HTMLElement {
  $columns!: HTMLElement;
  $rows!: HTMLElement;

  /**
   * Lifecycle
   */
  connectedCallback() {
    this.$columns = this.querySelector<HTMLElement>('[data-grid="columns"]')!;
    this.$rows = this.querySelector<HTMLElement>('[data-grid="rows"]')!;

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
    if (!e.ctrlKey) return;

    if (e.key === "g") {
      this.$columns.toggleAttribute("hidden");
    }

    if (e.key === "h") {
      this.$rows.toggleAttribute("hidden");
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

    this.$columns.innerHTML = "";

    for (let i = 0; i < count; i++) {
      const col = document.createElement("div");
      col.className = "grid__item";
      this.$columns.appendChild(col);
    }
  }
}

customElements.define("c-grid", Grid);
