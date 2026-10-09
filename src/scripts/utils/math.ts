import gsap from "gsap";

export function lerp(p1: number, p2: number, t: number) {
  return gsap.utils.interpolate(p1, p2, t);
}

export function map(
  valueToMap: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
) {
  return gsap.utils.mapRange(inMin, inMax, outMin, outMax, valueToMap);
}

export function interpolate(start: number, end: number, value: number) {
  return start * (1.0 - value) + end * value;
}

export function clamp(min: number, max: number, number: number) {
  return gsap.utils.clamp(min, max, number);
}

export function random(min: number, max: number) {
  return gsap.utils.random(min, max);
}

/** Modulo that stays positive: mod(-1, 4) is 3. */
export function mod(value: number, length: number) {
  return ((value % length) + length) % length;
}

export function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

export function delay(ms: number) {
  return new Promise<void>((res) => gsap.delayedCall(ms / 1000, res));
}

export function nextFrame() {
  return new Promise<void>((res) =>
    requestAnimationFrame(() => requestAnimationFrame(() => res())),
  );
}

export function smoothMin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;

  return Math.min(a, b) - (h * h * k) / 4;
}

export function smoothMax(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;

  return Math.max(a, b) + (h * h * k) / 4;
}
