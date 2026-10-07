import CustomEase from "gsap/CustomEase";
import gsap from "gsap";

gsap.registerPlugin(CustomEase);

export const mattEasing = CustomEase.create("mattEasing", "0.4, 0, 0, 1");
