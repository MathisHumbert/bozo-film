import gsap from "gsap";
import {
  Mesh,
  Program,
  Texture,
  Transform,
  Vec2,
  type OGLRenderingContext,
  type Plane,
} from "ogl";

import fragment from "../../shaders/fragment.glsl?raw";
import vertex from "../../shaders/vertex.glsl?raw";
import { device } from "../../classes/Device";
import { responsive } from "../../classes/Responsive";
import { lerp } from "../../utils/math";
import { createMutedVideo, getSource, preloaded } from "../../utils/textures";
import type { Bounds, Frame, Hero } from "../../utils/events";
import type {
  HomeList,
  ListItem,
} from "../../../components/home-list/home-list";
import type { HomeWide } from "../../../components/home-wide/home-wide";

type MediaOptions = {
  item: ListItem;
  gl: OGLRenderingContext;
  geometry: Plane;
  scene: Transform;
};

type UpdateOptions = {
  wide: HomeWide | null;
  list: HomeList;
  slots: Frame[];
  hero: Hero | null;
};

// Only for changing page: the switch between the views is eased by
// c-home-wide and c-home-list, and read here every frame.
const DURATION = {
  // The videos appearing, and leaving with the page.
  fade: 0.6,
};

const EASE = {
  fade: "expo.out",
};

export default class Media {
  item: ListItem;
  element: HTMLElement;
  gl: OGLRenderingContext;
  geometry: Plane;
  scene: Transform;

  video!: HTMLVideoElement;
  texture!: Texture;
  material!: Program;
  mesh!: Mesh;

  bounds: Bounds = { top: 0, left: 0, width: 0, height: 0 };
  imageResolution = new Vec2(16, 9);
  hasFrame = false;
  uploadedTime = -1;

  constructor({ item, gl, geometry, scene }: MediaOptions) {
    this.item = item;
    this.element = item.$video!;
    this.gl = gl;
    this.geometry = geometry;
    this.scene = scene;

    this.createVideo();
    this.createTexture();
    this.createMaterial();
    this.createMesh();
  }

  /**
   * Create.
   */
  createVideo() {
    const src = getSource(this.element);

    // Taken out of the cache: destroy() empties it.
    this.video = preloaded.videos.get(src) ?? createMutedVideo();
    preloaded.videos.delete(src);
  }

  // Starts on the poster, until the video has a frame.
  createTexture() {
    this.texture = new Texture(this.gl, { generateMipmaps: false });

    const src = this.element.dataset.poster;

    if (!src) return;

    const image = preloaded.posters.get(src) ?? new Image();

    const onLoad = () => {
      if (this.hasFrame) return;

      this.texture.image = image;
      this.imageResolution.set(image.naturalWidth, image.naturalHeight);
    };

    if (image.complete && image.naturalWidth) {
      onLoad();
    } else {
      image.addEventListener("load", onLoad, { once: true });
    }

    if (!image.src) {
      image.crossOrigin = "anonymous";
      image.src = src;
    }
  }

  createMaterial() {
    this.material = new Program(this.gl, {
      fragment,
      vertex,
      uniforms: {
        uAlpha: { value: 0 },
        uOpacity: { value: 1 },
        uSplit: { value: 0 },
        uTexture: { value: this.texture },
        uResolution: { value: new Vec2(1, 1) },
        uImageResolution: { value: this.imageResolution },
      },
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
  }

  createMesh() {
    this.mesh = new Mesh(this.gl, {
      geometry: this.geometry,
      program: this.material,
    });
    this.mesh.visible = false;
    this.mesh.setParent(this.scene);
  }

  /**
   * Animations.
   */
  show() {
    return gsap.set(this.material.uniforms.uAlpha, { value: 1 });
  }

  hide() {
    return gsap.to(this.material.uniforms.uAlpha, {
      value: 0,
      duration: DURATION.fade,
      ease: EASE.fade,
    });
  }

  /**
   * Playback.
   */
  play() {
    if (!this.video.getAttribute("src")) {
      this.video.preload = "auto";
      this.video.src = getSource(this.element);
      this.video.load();
    }

    if (device.reducedMotion) {
      this.video.pause();
    } else if (this.video.paused) {
      this.video.play().catch(() => undefined);
    }
  }

  pause() {
    if (!this.video.paused) this.video.pause();
  }

  /**
   * Update.
   */
  updateTexture() {
    if (this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    if (!this.hasFrame) {
      this.hasFrame = true;
      this.texture.image = this.video;
      this.imageResolution.set(
        this.video.videoWidth || 16,
        this.video.videoHeight || 9,
      );
    }

    // Only when the frame changed: a paused video costs no upload.
    if (this.video.currentTime !== this.uploadedTime) {
      this.uploadedTime = this.video.currentTime;
      this.texture.needsUpdate = true;
    }
  }

  updateScale() {
    this.mesh.scale.x =
      (responsive.viewport.width * this.bounds.width) / responsive.screen.width;
    this.mesh.scale.y =
      (responsive.viewport.height * this.bounds.height) /
      responsive.screen.height;

    this.material.uniforms.uResolution.value.set(
      this.mesh.scale.x,
      this.mesh.scale.y,
    );
  }

  updateX() {
    this.mesh.position.x =
      -responsive.viewport.width / 2 +
      this.mesh.scale.x / 2 +
      (this.bounds.left / responsive.screen.width) * responsive.viewport.width;
  }

  updateY() {
    this.mesh.position.y =
      responsive.viewport.height / 2 -
      this.mesh.scale.y / 2 -
      (this.bounds.top / responsive.screen.height) * responsive.viewport.height;
  }

  /**
   * Loop.
   */
  update({ wide, list, slots, hero }: UpdateOptions) {
    const slug = this.item.slug;

    let frame: Frame | null = null;
    let opacity = 0;
    let isPlaying = false;

    const slot = slots.find((entry) => entry.slug === slug);

    if (wide && slot) {
      frame = { ...slot, order: slot.order + 1 };
      opacity = wide.alpha.value;
      isPlaying = true;
    }

    const bounds = list.state === "hidden" ? null : list.getBounds(this.item);

    if (
      bounds &&
      bounds.width > 1 &&
      bounds.top + bounds.height > 0 &&
      bounds.top < responsive.screen.height
    ) {
      frame = { slug, bounds, split: 0, order: 0 };
      opacity = list.alpha.value;
      isPlaying ||= list.state === "visible" || list.state === "arriving";
    }

    // The travelling work, drawn over both views.
    if (hero && hero.from.slug === slug) {
      const { from, to, progress, seal } = hero;

      frame = {
        slug,
        bounds: {
          top: lerp(from.bounds.top, to.bounds.top, progress),
          left: lerp(from.bounds.left, to.bounds.left, progress),
          width: lerp(from.bounds.width, to.bounds.width, progress),
          height: lerp(from.bounds.height, to.bounds.height, progress),
        },
        split: lerp(from.split, to.split, seal),
        order: 3,
      };
      opacity = 1;
      isPlaying = true;
    }

    this.updateTexture();

    this.mesh.visible = Boolean(
      frame &&
      this.texture.image &&
      opacity > 0 &&
      frame.bounds.width > 1 &&
      frame.bounds.height > 1,
    );

    if (frame && this.mesh.visible) {
      this.bounds = frame.bounds;

      this.updateScale();
      this.updateX();
      this.updateY();

      this.mesh.renderOrder = frame.order;
      this.material.uniforms.uOpacity.value = opacity;
      this.material.uniforms.uSplit.value = frame.split / frame.bounds.height;
    }

    if (isPlaying) {
      this.play();
    } else {
      this.pause();
    }
  }

  /**
   * Destroy.
   */
  destroy() {
    gsap.killTweensOf(this.material.uniforms.uAlpha);

    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();

    this.mesh.setParent(null);
    this.material.remove();
    this.gl.deleteTexture(this.texture.texture);
  }
}
