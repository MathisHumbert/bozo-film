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

export function masonry(ratios: number[], columns: number): number[][] {
  const groups: number[][] = Array.from({ length: columns }, () => []);
  const heights = new Array<number>(columns).fill(0);

  ratios.forEach((ratio, index) => {
    const shortest = heights.indexOf(Math.min(...heights));

    groups[shortest].push(index);
    heights[shortest] += ratio;
  });

  return groups;
}
