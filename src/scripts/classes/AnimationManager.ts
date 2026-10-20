import Text from "../animations/Text";
import SplitHover from "../animations/SplitHover";
import Link from "../animations/Link";

export default class AnimationManager {
  private animations: (Text | SplitHover | Link)[] = [];

  create() {
    const textElements = document.querySelectorAll('[data-animation="text"]');

    textElements.forEach((element) => {
      const animation = new Text({
        element: element as unknown as HTMLElement,
      });
      this.animations.push(animation);
    });

    const splitHoverElements = document.querySelectorAll(
      '[data-animation="split-hover"]',
    );

    splitHoverElements.forEach((element) => {
      const animation = new SplitHover({
        element: element as unknown as HTMLElement,
      });
      this.animations.push(animation);
    });

    const linkElements = document.querySelectorAll('[data-animation="link"]');

    linkElements.forEach((element) => {
      const animation = new Link({
        element: element as unknown as HTMLElement,
      });
      this.animations.push(animation);
    });

    this.animations.forEach((animation) => animation.create());
  }

  destroy() {
    this.animations.forEach((animation) => animation.destroy());
    this.animations = [];
  }

  reset() {
    this.destroy();
    this.create();
  }
}
