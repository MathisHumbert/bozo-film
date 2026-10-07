import { Camera, Renderer, Transform, type OGLRenderingContext } from "ogl";

import Home from "./Home";

import { responsive } from "../classes/Responsive";
import { events } from "../utils/events";

export default class Canvas {
  renderer!: Renderer;
  gl!: OGLRenderingContext;
  scene!: Transform;
  camera!: Camera;

  pathname: string | null = null;
  home: Home | null = null;

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
      dpr: Math.min(window.devicePixelRatio, 2),
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

  hide = async ({ from, to }: { from: string; to: string }) => {
    if (from === "/" && this.home) {
      // Nulled first: show() may create the next one before this resolves.
      const home = this.home;
      this.home = null;

      await home.hide({ from, to });
      home.destroy();
    }
  };

  /**
   * Events.
   */
  onResize = () => {
    this.renderer.dpr = Math.min(window.devicePixelRatio, 2);
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
    events.on("transition:start", this.hide);
  }

  /**
   * Loop.
   */
  update = () => {
    this.home?.update();

    this.renderer.render({ scene: this.scene, camera: this.camera });
  };
}
