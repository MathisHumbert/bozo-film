import gsap from "gsap";

import { device } from "../classes/Device";
import { responsive } from "../classes/Responsive";
import { introEasing } from "./easing";

export const REVEAL = {
  distance: 7.5,
  duration: 1.2,
  ease: "expo.out",
  stagger: 0,
};

// The first load: the preloader's halves part on this curve, and every reveal
// follows them a beat in, so it plays out in view rather than behind them.
export const INTRO = {
  delay: 0.1,
  ease: introEasing,
};

export function revealTiming(intro = false) {
  if (device.reducedMotion) {
    return { duration: 0, delay: 0, ease: REVEAL.ease };
  }

  return {
    duration: REVEAL.duration,
    delay: intro ? INTRO.delay : 0,
    ease: intro ? INTRO.ease : REVEAL.ease,
  };
}

export function reveal(
  targets: gsap.TweenTarget,
  {
    from = "bottom",
    intro = false,
    delay = 0,
  }: { from?: "top" | "bottom"; intro?: boolean; delay?: number } = {},
) {
  const distance = REVEAL.distance * responsive.fontSize;
  const timing = revealTiming(intro);

  return gsap.from(targets, {
    y: `${from === "top" ? "-=" : "+="}${distance}`,
    ...timing,
    delay: device.reducedMotion ? 0 : timing.delay + delay,
    stagger: REVEAL.stagger,
  });
}
