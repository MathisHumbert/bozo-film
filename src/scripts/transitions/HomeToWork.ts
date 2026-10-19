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
};

const EASE = {
  settle: mattEasing,
  center: "expo.out",
  morph: mattEasing,
  fade: "power2.out",
};

const HERO_UI =
  '[data-work-hero="overlay"], [data-work-hero="duration"], [data-work-hero="toggle"]';

type Target = { slug: string; index: number };

type Morph = {
  tl: gsap.core.Timeline;
  target: Target;
  screen: Bounds;
  end: DOMRect | undefined;
  speed: number;
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
    const $heroUi = [...next.querySelectorAll<HTMLElement>(HERO_UI)];

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
      speed: device.reducedMotion ? 0 : 1,
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

    gsap.set($heroUi, { opacity: 0 });
    gsap.set(next, { autoAlpha: 1 });

    await gsap.to($heroUi, {
      opacity: 1,
      duration: DURATION.fadeIn * morph.speed,
      ease: EASE.fade,
      stagger: 0.05,
    });

    gsap.set($heroUi, { clearProps: "opacity" });
  }

  animateList(list: HomeList, { tl, target, screen, end, speed }: Morph) {
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

    const [$left, $right] = item.$titles;

    if (!end || !$left || !$right) return;

    const left = $left.getBoundingClientRect();
    const right = $right.getBoundingClientRect();
    const offsetY = (rect: DOMRect) =>
      end.top + end.height / 2 - (rect.top + rect.height / 2);

    tl.to(
      $left,
      {
        x: end.left - left.left,
        y: offsetY(left),
        duration: DURATION.morph * speed,
        ease: EASE.morph,
      },
      0,
    ).to(
      $right,
      {
        x: end.right - right.right,
        y: offsetY(right),
        duration: DURATION.morph * speed,
        ease: EASE.morph,
      },
      0,
    );
  }

  animateWide(wide: HomeWide, { tl, target, screen, end, speed }: Morph) {
    const isClone = target.index >= wide.items.length;
    const item = wide.items[target.index % wide.items.length];
    const $media = isClone ? wide.$cloneMedia : item.$media;
    const [$title] = isClone ? wide.$cloneTexts : item.$texts;

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
