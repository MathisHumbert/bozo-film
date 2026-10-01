import gsap from "gsap";
import { CustomEase, ScrollTrigger, SplitText } from "gsap/all";

import Scroll from "./Scroll";

gsap.registerPlugin(CustomEase, ScrollTrigger, SplitText);

const isDev = import.meta.env.MODE === "development";

class GSAP {
  constructor() {
    gsap.defaults({ ease: "none" });
    gsap.ticker.lagSmoothing(0);

    if (!isDev) {
      ScrollTrigger.scrollerProxy("#scroll-wrapper", {
        scrollTop: (value?: number) => {
          if (value !== undefined) {
            Scroll.scrollTo(value);
          }
          return Scroll.scroll || 0;
        },

        getBoundingClientRect() {
          return {
            top: 0,
            left: 0,
            width: window.innerWidth,
            height: window.innerHeight,
          };
        },
      });

      ScrollTrigger.defaults({ scroller: "#scroll-wrapper" });
      ScrollTrigger.refresh();
    }
  }
}

new GSAP();
