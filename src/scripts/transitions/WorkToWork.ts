import { gsap } from "gsap";

import Scroll from "../classes/Scroll";
import { device } from "../classes/Device";
import { mattEasing } from "../utils/easing";

import type { Video } from "../../components/video/video";
import type { Containers } from ".";

const DURATION = {
  // Brings the next block onto the whole screen before leaving.
  scroll: 1,
  // The next block's title travelling to the hero's.
  morph: 1.2,
  // "( Next Project )" leaving its line, "( WATCH )" taking it.
  rollOut: 0.4,
  rollIn: 0.8,
};

const EASE = {
  morph: mattEasing,
  roll: "expo.out",
};

export default class WorkToWork {
  prepare(link: HTMLAnchorElement) {
    const section = link.closest<HTMLElement>("c-work-next");
    const top = section?.getBoundingClientRect().top ?? 0;

    if (!section || Math.abs(top) < 2) {
      return Promise.resolve(link.href);
    }

    return new Promise<string>((resolve) => {
      Scroll.scrollTo(section, {
        lock: true,
        duration: device.reducedMotion ? 0 : DURATION.scroll,
        onComplete: () => resolve(link.href),
      });
    });
  }

  async animateIn({ previous, next }: Containers) {
    const from = previous.querySelector<Video>("c-work-next c-video");
    const to = next.querySelector<Video>('[data-work-hero="preview"] c-video');

    // The duration is the same, in the same place: it stays through the swap.
    const $toggleLines = next.querySelectorAll<HTMLElement>(
      '[data-work-hero="toggle-line"]',
    );
    const $nextTitle = previous.querySelector<HTMLElement>(
      '[data-work-next="title"]',
    );
    const $heroTitle = next.querySelector<HTMLElement>(
      '[data-work-hero="title"]',
    );

    const speed = device.reducedMotion ? 0 : 1;
    const tl = gsap.timeline();

    tl.to(
      previous.querySelectorAll('[data-work-next="line"]'),
      { yPercent: -100, duration: DURATION.rollOut * speed, ease: EASE.roll },
      0,
    );

    // Zoomed in while it waited (work-next.astro): back to the hero's scale,
    // so the <video> it hands over below lands at the size it shows.
    if (from) {
      tl.to(
        from,
        { scale: 1, duration: DURATION.morph * speed, ease: EASE.morph },
        0,
      );
    }

    // Straight down, from bottom-58 to the hero's bottom-grid: both are
    // centred the same way, so only the bottoms differ.
    if ($nextTitle && $heroTitle) {
      const start = $nextTitle.getBoundingClientRect();
      const end = $heroTitle.getBoundingClientRect();

      tl.to(
        $nextTitle,
        {
          y: end.bottom - start.bottom,
          duration: DURATION.morph * speed,
          ease: EASE.morph,
        },
        0,
      );
    }

    await tl;

    const video = from?.release();

    if (video && to) {
      to.adopt(video);
    }

    gsap.set($toggleLines, { yPercent: 100 });
    gsap.set(next, { autoAlpha: 1 });

    await gsap.to($toggleLines, {
      yPercent: 0,
      duration: DURATION.rollIn * speed,
      ease: EASE.roll,
    });

    gsap.set($toggleLines, { clearProps: "transform" });
  }
}
