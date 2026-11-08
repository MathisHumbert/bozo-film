import CustomEase from "gsap/CustomEase";
import gsap from "gsap";

gsap.registerPlugin(CustomEase);

export const mattEasing = CustomEase.create("mattEasing", "0.4, 0, 0, 1");
export const introEasing = CustomEase.create("introEasing", "1, 0, 0.25, 1");
