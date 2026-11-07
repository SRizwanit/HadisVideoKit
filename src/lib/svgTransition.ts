import { activeSegmentIndex, segmentLocalFrame } from "./svgStage";

/**
 * Part 9L: সেগমেন্ট বদলের cross-fade-এর বিশুদ্ধ হিসাব (React/DOM নেই, কখনো throw করে না, কিছু ছাপে না)।
 *
 * নিয়ম:
 *  - নতুন সেগমেন্ট শুরু হওয়ার ফ্রেম থেকে `transitionLength(নতুন সেগমেন্টের দৈর্ঘ্য)` ফ্রেম ধরে পুরনো SVG মিলিয়ে যায়, নতুনটা ফোটে।
 *    দৈর্ঘ্য = `min(TRANSITION_FRAMES, ⌊সেগমেন্টের দৈর্ঘ্য ÷ 3⌋)`; ০ হলে transition নেই (সরাসরি বদল)।
 *  - পাশাপাশি দুই সেগমেন্টে **একই SVG** (দুটোই `null`/fallback হলেও একই ধরা হয়) → transition নেই, অ্যানিমেশন **আবার শুরু হয় না**:
 *    একই SVG-র ধারাবাহিক সেগমেন্টের "run"-এর প্রথম সেগমেন্টের শুরু থেকে স্থানীয় ফ্রেম গোনা হয়।
 *  - transition চলার সময় **দুটো স্তর একসাথে** আঁকা হয়; পুরনোটার অ্যানিমেশন থামে না (নিজের run-এর শুরু থেকে ফ্রেম গুনতেই থাকে)।
 *  - ফাঁকে (gap) আগেরটাই থাকে (9K-1-এর নিয়ম); transition শুধু নতুন সেগমেন্টের শুরুর ফ্রেম থেকে।
 */

export const TRANSITION_FRAMES = 12;
/** ঝাপসার সর্বোচ্চ মান (px) = BLUR_UNITS × unit */
export const BLUR_UNITS = 6;
/** পুরনো স্তর ১ → এই স্কেলে বড় হয়; নতুন স্তর (২ − এটা) = ০.৯৪ থেকে ১-এ আসে */
export const SCALE_OUT = 1.06;
export const SCALE_IN_START = 0.94;

const finite = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

type SegLike = { startFrame: number; endFrame: number };

/** transition কত ফ্রেমের: `min(12, ⌊দৈর্ঘ্য ÷ 3⌋)`; সংখ্যা না হলে/ছোট হলে ০ */
export function transitionLength(segmentFrames: number): number {
  const n = finite(segmentFrames, 0);
  if (n <= 0) return 0;
  return Math.max(0, Math.min(TRANSITION_FRAMES, Math.floor(n / 3)));
}

/** পাশাপাশি একই নামের (বা দুটোই null) সেগমেন্টের "run"-এর প্রথম সেগমেন্টের array-অবস্থান */
export function runStartIndex(names: readonly (string | null)[], index: number): number {
  let i = Math.max(0, Math.min(names.length - 1, Math.floor(finite(index, 0))));
  while (i > 0 && (names[i - 1] ?? null) === (names[i] ?? null)) i -= 1;
  return i;
}

export type StageLayerPlan = {
  /** run-এর প্রথম সেগমেন্টের অবস্থান — React `key` ও prefix (`s<run>-`) এটা থেকে */
  run: number;
  /** সেগমেন্ট যেটা এই স্তরে দেখানো হয় (পুরনো স্তরের জন্য i − 1) */
  segment: number;
  name: string | null;
  /** এই স্তরের নিজের ফ্রেম = পরম ফ্রেম − run-এর শুরু */
  localFrame: number;
};

export type StagePlan = {
  /** সক্রিয় সেগমেন্টের অবস্থান (9K-1) */
  active: number;
  incoming: StageLayerPlan;
  /** transition না চললে `null` */
  outgoing: StageLayerPlan | null;
  /** ০ ≤ progress < ১ (transition না চললে ০) */
  progress: number;
  /** এই সেগমেন্টের transition-ফ্রেম (০ = নেই) */
  frames: number;
};

function layer(segments: readonly SegLike[], names: readonly (string | null)[], seg: number, abs: number): StageLayerPlan {
  const run = runStartIndex(names, seg);
  return {
    run,
    segment: seg,
    name: names[seg] ?? null,
    localFrame: segmentLocalFrame(abs, segments[run].startFrame),
  };
}

/**
 * এই ফ্রেমে কী কী স্তর আঁকতে হবে। সেগমেন্ট না থাকলে (বা `names`-এর দৈর্ঘ্য না মিললে) `null`।
 * `names` = `pickSvgNames`-এর ফল (সেগমেন্টের সমান দৈর্ঘ্য)।
 */
export function planStage(
  segments: readonly SegLike[],
  names: readonly (string | null)[],
  absoluteFrame: number,
): StagePlan | null {
  if (segments.length === 0 || names.length < segments.length) return null;
  const abs = finite(absoluteFrame, 0);
  const i = activeSegmentIndex(segments as never, abs);
  if (i < 0 || i >= segments.length) return null;

  const incoming = layer(segments, names, i, abs);
  let outgoing: StageLayerPlan | null = null;
  let progress = 0;
  let frames = 0;

  if (i > 0 && (names[i - 1] ?? null) !== (names[i] ?? null)) {
    const start = finite(segments[i].startFrame, 0);
    const len = finite(segments[i].endFrame, 0) - start;
    frames = transitionLength(len);
    const elapsed = abs - start;
    if (frames > 0 && elapsed >= 0 && elapsed < frames) {
      outgoing = layer(segments, names, i - 1, abs);
      progress = elapsed / frames;
    }
  }
  return { active: i, incoming, outgoing, progress, frames };
}

export type LayerLook = { opacity: number; scale: number; blur: number };

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** নরম গতি (শুরু-শেষে ধীর) */
export const ease = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/**
 * দুই স্তরের চেহারা। পুরনো: opacity ১→০, scale ১→১.০৬, blur ০→সর্বোচ্চ। নতুন: opacity ০→১, scale ০.৯৪→১, blur সর্বোচ্চ→০।
 * blur px = `BLUR_UNITS × unit × (…)` (4K-তে ঠিক ২×)।
 */
export function crossFadeLooks(progress: number, unit: number): { outgoing: LayerLook; incoming: LayerLook } {
  const e = ease(progress);
  const maxBlur = BLUR_UNITS * Math.max(0, finite(unit, 0));
  return {
    outgoing: { opacity: 1 - e, scale: 1 + (SCALE_OUT - 1) * e, blur: maxBlur * e },
    incoming: { opacity: e, scale: SCALE_IN_START + (1 - SCALE_IN_START) * e, blur: maxBlur * (1 - e) },
  };
}
