import { Camera, Renderer, Transform, type OGLRenderingContext } from "ogl";

import Home from "./Home";

import { device } from "../classes/Device";
import { responsive } from "../classes/Responsive";
import { events } from "../utils/events";

export default class Canvas {
  renderer!: Renderer;
  gl!: OGLRenderingContext;
  scene!: Transform;
  camera!: Camera;

  pathname: string | null = null;
  home: Home | null = null;
  isCleared = false;

  constructor() {
    this.createRenderer();
    this.createScene();
    this.createCamera();

    this.addEventListeners();
  }

  /**
   * OGL.
   */
  createRenderer() {
    this.renderer = new Renderer({
      alpha: true,
      dpr: this.getDpr(),
    });
    this.gl = this.renderer.gl;
    this.renderer.setSize(responsive.screen.width, responsive.screen.height);

    this.gl.canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(this.gl.canvas);
  }

  createScene() {
    this.scene = new Transform();
  }

  createCamera() {
    this.camera = new Camera(this.gl, {
      fov: 45,
      aspect: responsive.screen.width / responsive.screen.height,
      near: 0.1,
      far: 100,
    });
    this.camera.position.z = 20;

    responsive.setCamera(this.camera);
  }

  /**
   * Animations.
   */
  show(pathname: string) {
    const from = this.pathname;
    this.pathname = pathname;

    if (pathname === "/") {
      this.home = new Home({ gl: this.gl, scene: this.scene });
      this.home.show({ from, to: pathname });
    }
  }

  release(slug: string) {
    return this.home?.release(slug) ?? null;
  }

  adopt(slug: string, video: HTMLVideoElement) {
    this.home?.adopt(slug, video);
  }

  /**
   * Events.
   */
  // Leaving the home on the default transition, the videos stay on screen
  // until the curtain has closed over them, then go at once.
  onCovered = () => {
    this.home?.destroy();
    this.home = null;
  };

  onTransitionEnd = () => {
    if (this.pathname === "/" || !this.home) return;

    this.home.destroy();
    this.home = null;
  };

  // Full-screen video shows no difference past 1.5 on a phone, and the
  // fragment cost drops by almost half against 2.
  getDpr() {
    return Math.min(window.devicePixelRatio, device.isMobile ? 1.5 : 2);
  }

  onResize = () => {
    this.renderer.dpr = this.getDpr();
    this.renderer.setSize(responsive.screen.width, responsive.screen.height);
    this.camera.perspective({
      aspect: responsive.screen.width / responsive.screen.height,
    });

    // Responsive computed the viewport before the camera changed.
    responsive.setCamera(this.camera);
  };

  /**
   * Listeners.
   */
  addEventListeners() {
    events.on("resize", this.onResize);
    events.on("end-update", this.update);
    events.on("transition:covered", this.onCovered);
    events.on("transition:end", this.onTransitionEnd);
  }

  /**
   * Loop.
   */
  update = () => {
    this.home?.update();

    // Off the home the scene is empty: one last render clears the canvas,
    // then nothing is drawn until a mesh comes back.
    const isEmpty = !this.scene.children.length;

    if (isEmpty && this.isCleared) return;

    this.renderer.render({ scene: this.scene, camera: this.camera });
    this.isCleared = isEmpty;
  };
}
