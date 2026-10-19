import gsap from "gsap";

import { device } from "../classes/Device";
import { responsive } from "../classes/Responsive";

export const REVEAL = {
  distance: 5,
  duration: 1.2,
  ease: "expo.out",
  stagger: 0,
};

export function reveal(
  targets: gsap.TweenTarget,
  { from = "bottom" }: { from?: "top" | "bottom" } = {},
) {
  const distance = REVEAL.distance * responsive.fontSize;

  return gsap.from(targets, {
    y: `${from === "top" ? "-=" : "+="}${distance}`,
    duration: device.reducedMotion ? 0 : REVEAL.duration,
    ease: REVEAL.ease,
    stagger: REVEAL.stagger,
  });
}
