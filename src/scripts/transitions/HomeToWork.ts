import { gsap } from "gsap";

import Scroll from "../classes/Scroll";
import { device } from "../classes/Device";
import { mattEasing } from "../utils/easing";
import type { Bounds } from "../utils/events";
import { store } from "../utils/store";

import type { Video } from "../../components/video/video";
import type { HomeWide } from "../../components/home-wide/home-wide";
import type { HomeList } from "../../components/home-list/home-list";
import type { HomeFooter } from "../../components/home-footer/home-footer";
import type { Containers } from ".";

const DURATION = {
  // Settles the wide stack on a whole video, centres a list row.
  settle: 0.6,
  center: 0.8,
  // The work's video and title travelling to the hero.
  morph: 1.2,
  // The home leaving, the hero's own UI arriving.
  fadeOut: 0.4,
  fadeIn: 0.6,
  // The centre label and the duration sliding through their line.
  rollOut: 0.4,
  rollIn: 0.8,
};

const EASE = {
  settle: mattEasing,
  center: "expo.out",
  morph: mattEasing,
  fade: "power2.out",
  roll: "expo.out",
};

type Target = { slug: string; index: number };

type Morph = {
  tl: gsap.core.Timeline;
  target: Target;
  screen: Bounds;
  end: DOMRect | undefined;
  halves: HTMLElement[];
  speed: number;
  // Wide shows the same duration in the same place: it stays, the hero's
  // only rolls in when coming from the list.
  keepsDuration: boolean;
};

export default class HomeToWork {
  releaseVideo: (slug: string) => HTMLVideoElement | null;

  target: Target | null = null;

  constructor({
    releaseVideo,
  }: {
    releaseVideo: (slug: string) => HTMLVideoElement | null;
  }) {
    this.releaseVideo = releaseVideo;
  }

  prepare(link: HTMLAnchorElement) {
    const speed = device.reducedMotion ? 0 : 1;
    const wide = document.querySelector<HomeWide>("c-home-wide");
    const list = document.querySelector<HomeList>("c-home-list");

    if (list && !list.hidden) {
      const item = list.items.find(({ $item }) => $item.contains(link));

      if (!item) return null;

      store.homeView = "list";
      this.target = { slug: item.slug, index: -1 };

      Scroll.stop();
      list.isFrozen = true;

      return Promise.resolve(list.moveTo(item, DURATION.center * speed)).then(
        () => link.href,
      );
    }

    if (wide) {
      const index = wide.isParted() ? wide.current + 1 : wide.current;
      const item = wide.items[index % wide.items.length];
      const href = item.$link?.getAttribute("href") ?? link.href;
      const scroll = wide.getScroll(index);

      store.homeView = "wide";
      this.target = { slug: item.slug, index };

      if (Math.abs(scroll - Scroll.scroll) < 1) {
        return Promise.resolve(href);
      }

      return new Promise<string>((resolve) => {
        Scroll.scrollTo(scroll, {
          lock: true,
          duration: DURATION.settle * speed,
          immediate: device.reducedMotion,
          onComplete: () => resolve(href),
        });
      });
    }

    return null;
  }

  async animateIn({ previous, next }: Containers) {
    const target = this.target;

    this.target = null;

    if (!target) {
      gsap.set(next, { autoAlpha: 1 });
      return;
    }

    const wide = previous.querySelector<HomeWide>("c-home-wide");
    const list = previous.querySelector<HomeList>("c-home-list");

    const to = next.querySelector<Video>('[data-work-hero="preview"] c-video');
    const $heroTitle = next.querySelector<HTMLElement>(
      '[data-work-hero="title"]',
    );
    const $overlay = next.querySelector<HTMLElement>(
      '[data-work-hero="overlay"]',
    );
    const $durationLines = [
      ...next.querySelectorAll<HTMLElement>('[data-work-hero="duration-line"]'),
    ];
    const $toggleLines = [
      ...next.querySelectorAll<HTMLElement>('[data-work-hero="toggle-line"]'),
    ];

    const morph: Morph = {
      tl: gsap.timeline(),
      target,
      screen: {
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      },
      end: $heroTitle?.getBoundingClientRect(),
      halves: [
        ...next.querySelectorAll<HTMLElement>('[data-work-hero="half"]'),
      ],
      speed: device.reducedMotion ? 0 : 1,
      keepsDuration: false,
    };

    if (list && !list.hidden) {
      this.animateList(list, morph);
    } else if (wide) {
      this.animateWide(wide, morph);
    }

    previous.querySelector<HomeFooter>("c-home-footer")?.hide(morph.tl, 0);

    await morph.tl;

    const video = this.releaseVideo(target.slug);

    if (video && to) to.adopt(video);

    const $rolling = morph.keepsDuration
      ? $toggleLines
      : [...$durationLines, ...$toggleLines];

    gsap.set($overlay, { opacity: 0 });
    gsap.set($rolling, { yPercent: 100 });
    gsap.set(next, { autoAlpha: 1 });

    await gsap
      .timeline()
      .to(
        $overlay,
        {
          opacity: 1,
          duration: DURATION.fadeIn * morph.speed,
          ease: EASE.fade,
        },
        0,
      )
      .to(
        $rolling,
        {
          yPercent: 0,
          duration: DURATION.rollIn * morph.speed,
          ease: EASE.roll,
          stagger: 0.05,
        },
        0,
      );

    gsap.set([$overlay, ...$rolling], { clearProps: "opacity,transform" });
  }

  animateList(list: HomeList, { tl, target, screen, halves, speed }: Morph) {
    const item = list.items.find(({ slug }) => slug === target.slug);
    const bounds = item && list.getBounds(item);

    if (!item || !bounds) return;

    list.hero = {
      from: { slug: item.slug, bounds, split: 0, order: 3 },
      to: { slug: item.slug, bounds: screen, split: 0, order: 3 },
      progress: 0,
      seal: 0,
    };

    const $others = [
      ...list.items.filter((entry) => entry !== item).map(({ $item }) => $item),
      list.$gradient,
    ];

    tl.to(
      list.hero,
      { progress: 1, duration: DURATION.morph * speed, ease: EASE.morph },
      0,
    )
      .to(
        list.alpha,
        { value: 0, duration: DURATION.fadeOut * speed, ease: EASE.fade },
        0,
      )
      .to(
        $others,
        { opacity: 0, duration: DURATION.fadeOut * speed, ease: EASE.fade },
        0,
      );

    // Each half onto the hero's own: stacked or not, on one line or two.
    if (halves.length !== item.$titles.length) {
      tl.to(
        item.$titles,
        { opacity: 0, duration: DURATION.fadeOut * speed, ease: EASE.fade },
        0,
      );
      return;
    }

    item.$titles.forEach(($title, index) => {
      const start = $title.getBoundingClientRect();
      const end = halves[index].getBoundingClientRect();

      tl.to(
        $title,
        {
          x: end.left - start.left,
          y: end.top - start.top,
          duration: DURATION.morph * speed,
          ease: EASE.morph,
        },
        0,
      );
    });
  }

  animateWide(wide: HomeWide, morph: Morph) {
    const { tl, target, screen, end, speed } = morph;
    const isClone = target.index >= wide.items.length;
    const item = wide.items[target.index % wide.items.length];
    const $media = isClone ? wide.$cloneMedia : item.$media;
    const [$title] = isClone ? wide.$cloneTexts : item.$texts;

    morph.keepsDuration = isClone
      ? wide.$cloneDurationLines.length > 0
      : item.$durationLines.length > 0;

    // "( I )" leaves its line; "( WATCH )" takes it once the hero is in.
    tl.to(
      wide.indexLines[target.index] ?? [],
      { yPercent: -100, duration: DURATION.rollOut * speed, ease: EASE.roll },
      0,
    );

    if ($media) {
      wide.hero = {
        from: {
          slug: target.slug,
          bounds: wide.getBounds($media),
          split: 0,
          order: 3,
        },
        to: { slug: target.slug, bounds: screen, split: 0, order: 3 },
        progress: 0,
        seal: 0,
      };

      tl.to(
        wide.hero,
        { progress: 1, duration: DURATION.morph * speed, ease: EASE.morph },
        0,
      ).to(
        wide.alpha,
        { value: 0, duration: DURATION.fadeOut * speed, ease: EASE.fade },
        0,
      );
    }

    wide.hideLink(tl, target.index, 0);

    if (end && $title) {
      const start = $title.getBoundingClientRect();

      tl.to(
        $title,
        {
          y: end.bottom - start.bottom,
          duration: DURATION.morph * speed,
          ease: EASE.morph,
        },
        0,
      );
    }
  }
}
