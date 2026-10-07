import { Plane, Transform, type OGLRenderingContext } from "ogl";

import Media from "./Media";

import type { HomeList } from "../../../components/home-list/home-list";
import type { HomeWide } from "../../../components/home-wide/home-wide";

export default class Home {
  gl: OGLRenderingContext;
  group = new Transform();
  wide: HomeWide | null;
  list: HomeList;
  medias: Media[];

  constructor({ gl, scene }: { gl: OGLRenderingContext; scene: Transform }) {
    this.gl = gl;
    this.wide = document.querySelector<HomeWide>("c-home-wide");
    this.list = document.querySelector<HomeList>("c-home-list")!;

    this.group.setParent(scene);

    this.medias = this.createMedias();
  }

  /**
   * Create.
   */
  createMedias() {
    const geometry = new Plane(this.gl);

    return this.list.items
      .filter(({ $video }) => $video?.dataset.sources)
      .map(
        (item) => new Media({ item, gl: this.gl, geometry, scene: this.group }),
      );
  }

  /**
   * Animations.
   */
  show({ from, to }: { from: string | null; to: string }) {
    this.medias.forEach((media) => media.show());
  }

  hide(_: { from: string; to: string }) {
    return Promise.all(this.medias.map((media) => media.hide()));
  }

  /**
   * Loop.
   */
  update() {
    const { wide, list } = this;

    // Leaving, the video under the top one still shows through the gap.
    const slots =
      wide && (wide.state === "visible" || wide.state === "leaving")
        ? wide.getSlots()
        : [];

    this.medias.forEach((media) => {
      media.update({
        wide,
        list,
        slots,
        hero: wide?.hero ?? list.hero,
      });
    });
  }

  /**
   * Destroy.
   */
  destroy() {
    this.medias.forEach((media) => media.destroy());
    this.medias = [];

    this.group.setParent(null);
  }
}
