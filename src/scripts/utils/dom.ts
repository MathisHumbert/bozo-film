export const findAncestor = (element: HTMLElement, selector: string) => {
  let current: HTMLElement | null = element;
  while ((current = current.parentElement)) {
    if (current.matches(selector)) {
      return current;
    }
  }
  return null;
};

export const getOffset = (element: Element, scroll = 0) => {
  const box = element.getBoundingClientRect();

  return {
    bottom: box.bottom,
    height: box.height,
    left: box.left,
    top: box.top + scroll,
    width: box.width,
  };
};

export function getIndex(node: Element) {
  let index = 0;
  let current: Element | null = node;

  while ((current = current.previousElementSibling)) {
    index++;
  }

  return index;
}
