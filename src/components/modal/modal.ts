import Lenis from "lenis";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";

import Scroll from "../../scripts/classes/Scroll";
import { device } from "../../scripts/classes/Device";
import { events } from "../../scripts/utils/events";

const OPENING =
  "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%, 0% 100%, 100% 100%, 100% 100%, 0% 100%)";
const OPENED =
  "polygon(0% 0%, 100% 0%, 100% 50%, 0% 50%, 0% 50%, 100% 50%, 100% 100%, 0% 100%)";

const DURATION = {
  open: 0.9,
  lines: 1.2,
  linesAt: 0.3,
  underline: 0.7,
  underlineAt: 0.5,
  underlineOut: 0.4,
  close: 0.8,
};

const EASE = {
  open: "expo.out",
  lines: "expo.out",
  close: "expo.out",
};

export class Modal extends HTMLElement {
  private $dialog: HTMLDialogElement | null = null;
  private $scroll: HTMLElement | null = null;
  private $content: HTMLElement | null = null;
  private $half: HTMLElement | null = null;
  private lineSplits: SplitText[] = [];
  private splitWidth = 0;

  private lenis: Lenis | null = null;
  private timeline: gsap.core.Timeline | null = null;

  private closing: Promise<void> | null = null;
  private resolveClosing: (() => void) | null = null;

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
    this.unsplit();
    this.unsplitLines();

    this.lenis?.destroy();
    this.lenis = null;

    if (this.isOpen) {
      this.$dialog?.close();
      Scroll.resume();
    }

    this.settleClosing();
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
      return;
    }

    const $link = target?.closest<HTMLAnchorElement>("a[href]");

    if ($link && $link.origin === window.location.origin) {
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
    this.unsplit();

    this.$dialog.showModal();

    this.lenis?.resize();
    this.lenis?.scrollTo(0, { immediate: true });

    Scroll.stop();

    const speed = device.reducedMotion ? 0 : 1;
    const $panel = this.$scroll!;

    const lines = this.getLines();
    const $underlines = $panel.querySelectorAll('[data-link-line="first"]');

    gsap.set($panel, { clipPath: OPENING });
    gsap.set(lines, { yPercent: 100 });
    gsap.set($panel.querySelectorAll("[data-link-line]"), { scaleX: 0 });

    this.timeline = gsap.timeline({
      onComplete: () => {
        gsap.set($panel, { clearProps: "clipPath" });
        events.emit("modal:opened", { name: this.name });
      },
    });

    this.timeline
      .fromTo(
        $panel,
        { clipPath: OPENING },
        {
          clipPath: OPENED,
          duration: DURATION.open * speed,
          ease: EASE.open,
        },
        0,
      )
      .to(
        lines,
        {
          yPercent: 0,
          duration: DURATION.lines * speed,
          ease: EASE.lines,
        },
        DURATION.linesAt * speed,
      )
      .fromTo(
        $underlines,
        { scaleX: 0, transformOrigin: "left" },
        {
          scaleX: 1,
          duration: DURATION.underline * speed,
          ease: EASE.lines,
        },
        DURATION.underlineAt * speed,
      );
  }

  close() {
    if (this.closing) return this.closing;
    if (!this.$dialog || !this.isOpen) return Promise.resolve();

    this.timeline?.kill();
    this.unsplit();

    const $top = this.$scroll!;
    const $bottom = this.split();

    this.closing = new Promise<void>((resolve) => {
      this.resolveClosing = resolve;
    });

    this.timeline = gsap.timeline({
      defaults: {
        duration: device.reducedMotion ? 0 : DURATION.close,
        ease: EASE.close,
      },
      onComplete: () => {
        this.$dialog?.close();
        this.unsplit();
        Scroll.resume();
        events.emit("modal:closed", { name: this.name });
        this.settleClosing();
      },
    });

    this.timeline
      .to($top, { yPercent: -50 }, 0)
      .to($bottom, { yPercent: 50 }, 0)
      .to(
        this.$dialog.querySelectorAll("[data-link-line]"),
        {
          scaleX: 0,
          transformOrigin: "left",
          duration: device.reducedMotion ? 0 : DURATION.underlineOut,
        },
        0,
      );

    return this.closing;
  }

  settleClosing() {
    this.resolveClosing?.();
    this.resolveClosing = null;
    this.closing = null;
  }

  split() {
    const $top = this.$scroll!;
    const $bottom = $top.cloneNode(true) as HTMLElement;

    $bottom.setAttribute("aria-hidden", "true");
    $bottom.inert = true;
    $bottom
      .querySelectorAll("[id]")
      .forEach(($el) => $el.removeAttribute("id"));
    $bottom.style.position = "absolute";
    $bottom.style.inset = "0";

    this.$dialog!.append($bottom);
    $bottom.scrollTop = $top.scrollTop;

    gsap.set($top, { clipPath: "inset(0% 0% 50% 0%)" });
    gsap.set($bottom, { clipPath: "inset(50% 0% 0% 0%)" });

    this.$half = $bottom;

    return $bottom;
  }

  unsplit() {
    this.$half?.remove();
    this.$half = null;

    if (this.$scroll) {
      gsap.set(this.$scroll, { clearProps: "clipPath,transform" });
    }
  }

  getLines() {
    const width = this.$scroll?.clientWidth ?? 0;

    if (!this.lineSplits.length || width !== this.splitWidth) {
      this.unsplitLines();

      const $targets = Array.from(
        this.querySelectorAll<HTMLElement>("[data-modal-reveal]"),
      );

      this.lineSplits = $targets.map(($target) =>
        SplitText.create($target, {
          type: "lines",
          mask: "lines",
          aria: "none",
        }),
      );
      this.splitWidth = width;
    }

    return this.lineSplits.flatMap((split) => split.lines as HTMLElement[]);
  }

  unsplitLines() {
    this.lineSplits.forEach((split) => split.revert());
    this.lineSplits = [];
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
