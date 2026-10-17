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
  // The next block's link leaving, the hero's own UI arriving.
  fadeOut: 0.4,
  fadeIn: 0.6,
};

const EASE = {
  morph: mattEasing,
  fade: "power2.out",
};

const NEXT_UI = '[data-work-next="ui"]';
const HERO_UI = '[data-work-hero="duration"], [data-work-hero="toggle"]';

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

    const $heroUi = next.querySelectorAll<HTMLElement>(HERO_UI);
    const $nextTitle = previous.querySelector<HTMLElement>(
      '[data-work-next="title"]',
    );
    const $heroTitle = next.querySelector<HTMLElement>(
      '[data-work-hero="title"]',
    );

    const speed = device.reducedMotion ? 0 : 1;
    const tl = gsap.timeline();

    tl.to(
      previous.querySelectorAll(NEXT_UI),
      { autoAlpha: 0, duration: DURATION.fadeOut * speed, ease: EASE.fade },
      0,
    );

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

    gsap.set($heroUi, { opacity: 0 });
    gsap.set(next, { autoAlpha: 1 });

    await gsap.to($heroUi, {
      opacity: 1,
      duration: DURATION.fadeIn * speed,
      ease: EASE.fade,
      stagger: 0.05,
    });

    gsap.set($heroUi, { clearProps: "opacity" });
  }
}
