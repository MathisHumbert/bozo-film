import Text from "../animations/Text";

export default class AnimationManager {
  private animations: Text[] = [];

  create() {
    const textElements = document.querySelectorAll('[data-animation="text"]');

    textElements.forEach((element) => {
      const animation = new Text({
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
