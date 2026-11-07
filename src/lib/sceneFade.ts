import { TRANSITION_FRAMES } from "../constants";
import { ease } from "./svgTransition";

/**
 * Part 13B: Intro ↔ Main বদলের নরম ক্রস-ফেড — বিশুদ্ধ হিসাব (React/DOM নেই, কখনো throw করে না, কিছু ছাপে না)।
 *
 * ছবি:  Intro নিজেই শেষ `min(12, intro × ২৫%)` ফ্রেমে ফেড-আউট হয় (opacity ১→০, স্কেল ১→১.০৪; Part 8)।
 *       Main শুরু হওয়ার প্রথম `mainFadeLength(...)` ফ্রেমে Main-এর পুরো সিন ফেড-ইন হয় (opacity ০→১, স্কেল ০.৯৭→১)।
 *       মাঝের ব্যাকগ্রাউন্ড (আকাশ/জোনাকি) সারাক্ষণ একই থাকে — ফলে হঠাৎ "লাফ" (SvgStage-এর glow হুট করে আসা) নেই।
 * Main → Outro: Outro নিজেই ১২ ফ্রেমে ফেড-ইন/আউট হয় (Part 12), তাই এখানে কিছু লাগে না।
 *
 * নিয়ম (fixed):
 *  (১) ফেড-ইনের দৈর্ঘ্য = `min(12, ⌊Main ÷ 3⌋)`; Intro ০ ফ্রেম হলে ০ (ভিডিও Main দিয়েই শুরু — প্রথম ফ্রেম পুরো দেখা যায়)।
 *  (২) ফেড-ইনের বাইরে `active = false` — তখন সিনের মোড়কে কোনো opacity/transform থাকে না
 *      (opacity < 1 / transform থাকলে ওই মোড়ক `backdrop-filter`-এর "backdrop root" হয়ে ক্যাপশনের ব্লার বদলে যেত; Part 13A নোট)।
 *  (৩) smoothstep (`ease` — 9L-এর একই ফাংশন); শুরুর ফ্রেমে opacity ০, ফেড-ইন শেষে ঠিক ১।
 *  (৪) ফ্রেম `NaN`/ঋণাত্মক → ০; অসীম → শেষ।
 */

/** Main-এর ফেড-ইনের সর্বোচ্চ দৈর্ঘ্য (ফ্রেম) — `TRANSITION_FRAMES = 12` */
export const MAIN_FADE_FRAMES = TRANSITION_FRAMES;
/** Main ফেড-ইনের শুরুর স্কেল (Intro শেষে ১.০৪ পর্যন্ত বড় হয়; Main সামান্য ছোট থেকে এসে ১-এ বসে) */
export const MAIN_FADE_SCALE_START = 0.97;

const toCount = (n: unknown): number =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;

/** Main-এর ফেড-ইনের দৈর্ঘ্য (ফ্রেম); ০ = ফেড নেই */
export function mainFadeLength(introFrames: number, mainFrames: number): number {
  if (toCount(introFrames) < 1) return 0;
  return Math.min(MAIN_FADE_FRAMES, Math.floor(toCount(mainFrames) / 3));
}

export type MainFadeLook = {
  /** ফেড চলছে কিনা (false হলে মোড়কে কোনো style দিও না) */
  active: boolean;
  opacity: number;
  scale: number;
  /** ফেড-ইনের দৈর্ঘ্য (ফ্রেম) */
  frames: number;
  /** ০…১ (ফেড না থাকলে ১) */
  progress: number;
};

/**
 * @param localFrame Main `<Sequence>`-এর নিজের ফ্রেম (০ থেকে শুরু; `useCurrentFrame()`)
 */
export function mainFadeIn(localFrame: number, introFrames: number, mainFrames: number): MainFadeLook {
  const frames = mainFadeLength(introFrames, mainFrames);
  if (frames < 1) return { active: false, opacity: 1, scale: 1, frames: 0, progress: 1 };

  let f = 0;
  if (typeof localFrame === "number" && !Number.isNaN(localFrame)) {
    f = localFrame === Number.POSITIVE_INFINITY ? frames : Math.max(0, localFrame);
  }
  if (f >= frames) return { active: false, opacity: 1, scale: 1, frames, progress: 1 };

  const progress = f / frames;
  const e = ease(progress);
  return {
    active: true,
    opacity: e,
    scale: MAIN_FADE_SCALE_START + (1 - MAIN_FADE_SCALE_START) * e,
    frames,
    progress,
  };
}

/** ভিডিওর তিন দৃশ্যের ফ্রেম-ভাগ: কোন দৃশ্য আঁকা হবে (০-ফ্রেমের `<Sequence>` কখনো নয় — Part 13 নিয়ম) */
export type ScenePlan = {
  intro: { from: number; frames: number } | null;
  main: { from: number; frames: number } | null;
  outro: { from: number; frames: number } | null;
};

export function planScenes(introFrames: number, mainFrames: number, outroFrames: number): ScenePlan {
  const i = toCount(introFrames);
  const m = toCount(mainFrames);
  const o = toCount(outroFrames);
  return {
    intro: i > 0 ? { from: 0, frames: i } : null,
    main: m > 0 ? { from: i, frames: m } : null,
    outro: o > 0 ? { from: i + m, frames: o } : null,
  };
}
