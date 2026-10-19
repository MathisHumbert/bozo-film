import { gsap } from "gsap";

import Scroll from "../classes/Scroll";
import { device } from "../classes/Device";
import { mattEasing } from "../utils/easing";
import type { Bounds, View } from "../utils/events";
import { nextFrame } from "../utils/math";
import { store } from "../utils/store";

import type { Video } from "../../components/video/video";
import type { HomeWide } from "../../components/home-wide/home-wide";
import type { HomeFooter } from "../../components/home-footer/home-footer";
import type { HomeList, ListItem } from "../../components/home-list/home-list";
import type { Containers } from ".";

const DURATION = {
  // Back to the hero before leaving.
  scroll: 1,
  // The hero's video and title travelling to the work's place on the home.
  morph: 1.2,
  // The hero's own UI leaving, the rest of the home arriving.
  fadeOut: 0.4,
  fadeIn: 0.6,
};

const EASE = {
  morph: mattEasing,
  fade: "power2.out",
};

const HERO_UI =
  '[data-work-hero="overlay"], [data-work-hero="duration"], [data-work-hero="toggle"]';

type Morph = {
  tl: gsap.core.Timeline;
  slug: string;
  screen: Bounds;
  start: DOMRect | undefined;
  speed: number;
};

export default class WorkToHome {
  adoptVideo: (slug: string, video: HTMLVideoElement) => void;

  arrival: { view: View; index: number } | null = null;

  constructor({
    adoptVideo,
  }: {
    adoptVideo: (slug: string, video: HTMLVideoElement) => void;
  }) {
    this.adoptVideo = adoptVideo;
  }

  prepare(link: HTMLAnchorElement) {
    if (!document.querySelector("c-work-hero")) return null;

    if (Scroll.scroll < 1) {
      return Promise.resolve(link.href);
    }

    return new Promise<string>((resolve) => {
      Scroll.scrollTo(0, {
        lock: true,
        duration: device.reducedMotion ? 0 : DURATION.scroll,
        immediate: device.reducedMotion,
        onComplete: () => resolve(link.href),
      });
    });
  }

  async animateIn({ previous, next }: Containers) {
    const $hero = previous.querySelector<HTMLElement>("c-work-hero");
    const slug = $hero?.dataset.slug;

    const wide = next.querySelector<HomeWide>("c-home-wide");
    const list = next.querySelector<HomeList>("c-home-list");

    const wideIndex = wide?.items.findIndex((item) => item.slug === slug) ?? -1;
    const listItem = list?.items.find((item) => item.slug === slug);

    if (!$hero || !slug || !list || !listItem) {
      gsap.set(next, { autoAlpha: 1 });
      return;
    }

    const view: View =
      store.homeView === "wide" && wide && wideIndex !== -1 ? "wide" : "list";

    const from = $hero.querySelector<Video>(
      '[data-work-hero="preview"] c-video',
    );

    const $heroTitle = $hero.querySelector<HTMLElement>(
      '[data-work-hero="title"]',
    );
    const $heroUi = $hero.querySelectorAll<HTMLElement>(HERO_UI);
    const footer = next.querySelector<HomeFooter>("c-home-footer");

    const morph: Morph = {
      tl: gsap.timeline({ paused: true }),
      slug,
      screen: {
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      },
      start: $heroTitle?.getBoundingClientRect(),
      speed: device.reducedMotion ? 0 : 1,
    };

    let $arriving: HTMLElement[];

    if (view === "wide" && wide) {
      $arriving = this.parkWide(wide, wideIndex, morph);
    } else {
      $arriving = this.parkList(list, listItem, wide, morph);
    }

    footer?.show(morph.tl, (DURATION.morph - DURATION.fadeIn) * morph.speed);

    gsap.set($arriving, { opacity: 0 });
    morph.tl.to(
      $arriving,
      { opacity: 1, duration: DURATION.fadeIn * morph.speed, ease: EASE.fade },
      (DURATION.morph - DURATION.fadeIn) * morph.speed,
    );

    this.arrival = { view, index: wideIndex };

    await gsap.to($heroUi, {
      opacity: 0,
      duration: DURATION.fadeOut * morph.speed,
      ease: EASE.fade,
    });

    const video = from?.release();

    if (video) {
      this.adoptVideo(slug, video);
    }

    await nextFrame();

    gsap.set(previous, { autoAlpha: 0 });
    gsap.set(next, { autoAlpha: 1 });

    await morph.tl.play();

    gsap.set($arriving, { clearProps: "opacity" });
  }

  parkWide(
    wide: HomeWide,
    index: number,
    { tl, slug, screen, start, speed }: Morph,
  ) {
    wide.park(index);

    const item = wide.items[index];
    const [$title] = item.$texts;

    wide.hero = {
      from: { slug, bounds: screen, split: 0, order: 3 },
      to: { slug, bounds: wide.getBounds(item.$media), split: 0, order: 3 },
      progress: 0,
      seal: 0,
    };

    tl.to(
      wide.hero,
      { progress: 1, duration: DURATION.morph * speed, ease: EASE.morph },
      0,
    );

    if (start && $title) {
      const end = $title.getBoundingClientRect();

      tl.fromTo(
        $title,
        { y: start.bottom - end.bottom },
        { y: 0, duration: DURATION.morph * speed, ease: EASE.morph },
        0,
      );
    }

    wide.showLink(tl, index, (DURATION.morph - DURATION.fadeIn) * speed);

    return [];
  }

  parkList(
    list: HomeList,
    item: ListItem,
    wide: HomeWide | null,
    { tl, slug, screen, start, speed }: Morph,
  ) {
    if (wide) {
      wide.hidden = true;
      wide.state = "hidden";
    }

    list.park(item);

    const bounds = list.getBounds(item);

    list.hero = bounds && {
      from: { slug, bounds: screen, split: 0, order: 3 },
      to: { slug, bounds, split: 0, order: 3 },
      progress: 0,
      seal: 0,
    };
    list.alpha.value = 0;

    if (list.hero) {
      tl.to(
        list.hero,
        { progress: 1, duration: DURATION.morph * speed, ease: EASE.morph },
        0,
      );
    }

    tl.to(
      list.alpha,
      { value: 1, duration: DURATION.fadeIn * speed, ease: EASE.fade },
      (DURATION.morph - DURATION.fadeIn) * speed,
    );

    const [$left, $right] = item.$titles;

    if (start && $left && $right) {
      const left = $left.getBoundingClientRect();
      const right = $right.getBoundingClientRect();
      const offsetY = (rect: DOMRect) =>
        start.top + start.height / 2 - (rect.top + rect.height / 2);

      tl.fromTo(
        $left,
        { x: start.left - left.left, y: offsetY(left) },
        { x: 0, y: 0, duration: DURATION.morph * speed, ease: EASE.morph },
        0,
      ).fromTo(
        $right,
        { x: start.right - right.right, y: offsetY(right) },
        { x: 0, y: 0, duration: DURATION.morph * speed, ease: EASE.morph },
        0,
      );
    }

    return [
      ...list.items.filter((entry) => entry !== item).map(({ $item }) => $item),
      ...(list.$gradient ? [list.$gradient] : []),
    ];
  }

  arrive() {
    const wide = document.querySelector<HomeWide>("c-home-wide");
    const list = document.querySelector<HomeList>("c-home-list");
    const arrival = this.arrival;

    this.arrival = null;

    if (!arrival) return;

    if (arrival.view === "wide" && wide) {
      wide.hero = null;
      wide.arrive(arrival.index);
    } else if (list) {
      list.hero = null;
      list.arrive();
    }
  }
}
