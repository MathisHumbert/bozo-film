import Lenis from "lenis";
import { gsap } from "gsap";

import Scroll from "../../scripts/classes/Scroll";
import { device } from "../../scripts/classes/Device";
import { events } from "../../scripts/utils/events";

const CLOSED = "inset(0% 0% 100% 0%)";
const OPEN = "inset(0% 0% 0% 0%)";

export class Modal extends HTMLElement {
  private $dialog: HTMLDialogElement | null = null;
  private $scroll: HTMLElement | null = null;
  private $content: HTMLElement | null = null;

  private lenis: Lenis | null = null;
  private timeline: gsap.core.Timeline | null = null;

  get name() {
    return this.dataset.name ?? "";
  }

  get isOpen() {
    return this.$dialog?.open ?? false;
  }

  connectedCallback() {
    this.$dialog = this.querySelector("dialog");
    this.$scroll = this.querySelector('[data-modal="scroll"]');
    this.$content = this.querySelector('[data-modal="content"]');

    if (!this.$dialog || !this.$scroll || !this.$content) return;

    this.lenis = new Lenis({
      wrapper: this.$scroll,
      content: this.$content,
      lerp: device.reducedMotion ? 1 : 0.125,
      wheelMultiplier: 0.75,
      touchMultiplier: 0.75,
      // autoRaf: false,
    });

    this.$dialog.addEventListener("cancel", this.onCancel);
    this.addEventListener("click", this.onClick);

    document.addEventListener("click", this.onDocumentClick);

    events.on("modal:open", this.onRequestOpen);
    events.on("modal:close", this.onRequestClose);
    events.on("start-update", this.onUpdate);
    events.on("device:motion", this.onMotionChange);
  }

  disconnectedCallback() {
    this.$dialog?.removeEventListener("cancel", this.onCancel);
    this.removeEventListener("click", this.onClick);
    document.removeEventListener("click", this.onDocumentClick);

    events.off("modal:open", this.onRequestOpen);
    events.off("modal:close", this.onRequestClose);
    events.off("start-update", this.onUpdate);
    events.off("device:motion", this.onMotionChange);

    this.timeline?.kill();
    this.timeline = null;

    this.lenis?.destroy();
    this.lenis = null;

    if (this.isOpen) {
      this.$dialog?.close();
      Scroll.resume();
    }
  }

  /**
   * Events
   */
  onRequestOpen = ({ name }: { name: string }) => {
    if (name === this.name) {
      this.open();
    }
  };

  onRequestClose = ({ name }: { name: string }) => {
    if (name === this.name) {
      this.close();
    }
  };

  onCancel = (event: Event) => {
    event.preventDefault();
    this.close();
  };

  onClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;

    if (target?.closest("[data-modal-close]")) {
      this.close();
    }
  };

  onDocumentClick = (event: MouseEvent) => {
    const trigger = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      "[data-modal-open]",
    );

    if (trigger?.dataset.modalOpen === this.name) {
      this.open();
    }
  };

  onUpdate = ({ time }: { time: number }) => {
    // if (this.isOpen) {
    //   this.lenis?.raf(time);
    // }
  };

  onMotionChange = ({ reducedMotion }: { reducedMotion: boolean }) => {
    if (!this.lenis) return;

    this.lenis.options.lerp = reducedMotion ? 1 : 0.125;
  };

  /**
   * Methods
   */
  open() {
    if (!this.$dialog || this.isOpen) return;

    this.timeline?.kill();

    gsap.set(this.$dialog, { clipPath: CLOSED });

    this.$dialog.showModal();

    this.lenis?.resize();
    this.lenis?.scrollTo(0, { immediate: true });

    Scroll.stop();

    this.timeline = gsap.timeline({
      onComplete: () => events.emit("modal:opened", { name: this.name }),
    });

    this.timeline.to(this.$dialog, {
      clipPath: OPEN,
      duration: device.reducedMotion ? 0 : 0.9,
      ease: "expo.out",
    });
  }

  close() {
    if (!this.$dialog || !this.isOpen) return;

    this.timeline?.kill();

    this.timeline = gsap.timeline({
      onComplete: () => {
        this.$dialog?.close();
        Scroll.resume();
        events.emit("modal:closed", { name: this.name });
      },
    });

    this.timeline.to(this.$dialog, {
      clipPath: CLOSED,
      duration: device.reducedMotion ? 0 : 0.6,
      ease: "expo.out",
    });
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}

customElements.define("c-modal", Modal);
