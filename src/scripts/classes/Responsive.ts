type Screen = { width: number; height: number };
type Viewport = { width: number; height: number };
type Breakpoints = { desktop: number; mobile: number };
type Sizes = { desktop: number; mobile: number };

type Camera = {
  fov: number;
  aspect: number;
  position: { z: number };
};

class Responsive {
  multiplier: number;
  fontSize: number;
  screen: Screen;
  viewport: Viewport;
  camera: Camera | null;
  breakpoints: Breakpoints;
  sizes: Sizes;

  constructor() {
    this.multiplier = 10;
    this.fontSize = 0;
    this.screen = { width: 0, height: 0 };
    this.viewport = { width: 0, height: 0 };
    this.camera = null;

    const styles = getComputedStyle(document.documentElement);
    const read = (name: string) => parseInt(styles.getPropertyValue(name));

    this.breakpoints = {
      desktop: read("--breakpoint-md"),
      mobile: 0,
    };
    this.sizes = {
      desktop: read("--sizes-desktop"),
      mobile: read("--sizes-mobile"),
    };

    this.onResize();
  }

  setCamera(camera: Camera) {
    this.camera = camera;
    this.calculateViewport();
  }

  onResize() {
    this.screen = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    this.fontSize = parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );

    if (this.camera) {
      this.calculateViewport();
    }
  }

  private calculateViewport() {
    if (!this.camera) return;

    const fov = this.camera.fov * (Math.PI / 180);
    const height = 2 * Math.tan(fov / 2) * this.camera.position.z;
    const width = height * this.camera.aspect;

    this.viewport = { width, height };
  }
}

export const responsive = new Responsive();
