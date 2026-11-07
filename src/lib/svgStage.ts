import { getThemeColors, parseColor } from "../themes";
import type { ThemeId } from "../types";
import { findActiveSegment } from "./timing";
import type { FrameSegment } from "./timing";

/**
 * Part 9K-1: SVG স্টেজের শুদ্ধ হিসাব — React/DOM নেই, কখনো throw করে না, তাই সাধারণ Node-এও পরীক্ষা করা যায়।
 * (`SvgStage.tsx` 9K-2/9K-3-এ এগুলোই ব্যবহার করবে।)
 *
 *  - `activeSegmentIndex` : এখন কোন সেগমেন্টের SVG — দুই সেগমেন্টের ফাঁকে আগেরটাই থাকে, প্রথমের আগে প্রথমটা, শেষের পরে শেষটা
 *  - `segmentLocalFrame`  : প্রতিটা SVG-র নিজের ফ্রেম = ফ্রেম − সেগমেন্টের শুরু (নতুন SVG-র শুরুর অ্যানিমেশন সেগমেন্টের শুরুতেই মেলে)
 *  - `floatOffset`        : হালকা ভাসা, ±৬ ইউনিট × `unit`, ধীর sin
 *  - `stageGlow`          : SVG-র পেছনের নরম glow + হালকা ভেতরের ডিস্কের রঙ/ব্যাসার্ধ (দিনে ডিস্ক একটু গাঢ়, রাতে glow বেশি উজ্জ্বল)
 */

// ---------- ধ্রুবক ----------

/** ভাসার সর্বোচ্চ দূরত্ব (ইউনিট; আসল px = FLOAT_UNITS × `useLayout().unit`) */
export const FLOAT_UNITS = 6;
/** ভাসার পর্যায়কাল (ফ্রেম): ১২০ ফ্রেম = ৪ সেকেন্ড @30fps — ধীর */
export const FLOAT_PERIOD_FRAMES = 120;

/** glow-এর স্বচ্ছতা: দিনে কম, রাতে বেশি */
export const GLOW_ALPHA_DAY = 0.38;
export const GLOW_ALPHA_NIGHT = 0.72;
/** ভেতরের গাঢ় ডিস্কের স্বচ্ছতা: দিনে একটু গাঢ়, রাতে হালকা (হালকা সকালের আকাশে সাদা SVG-ও যেন ফোটে) */
export const DISC_ALPHA_DAY = 0.24;
export const DISC_ALPHA_NIGHT = 0.1;
/** ডিস্কের রঙ (গাঢ় সবুজাভ নীল; FallbackSvg-র রূপরেখার রঙের কাছাকাছি) */
export const DISC_RGB = "4, 30, 18";
/** glow-এর ব্যাসার্ধ = size × এই গুণক (বাক্সের অর্ধেক ০.৫-এর চেয়ে বড়, তাই বাক্সের বাইরেও নরম আলো ছড়ায়) */
export const GLOW_RADIUS_FACTOR = 0.78;
/** ভেতরের ডিস্কের ব্যাসার্ধ = size × এই গুণক (বাক্সের ভেতরেই থাকে) */
export const DISC_RADIUS_FACTOR = 0.46;

const FALLBACK_GLOW = "#f5c542";

// ---------- ছোট সহায়ক ----------

const finite = (n: unknown, fallback = 0): number =>
  typeof n === "number" && Number.isFinite(n) ? n : fallback;

const clamp01 = (n: unknown): number => Math.min(1, Math.max(0, finite(n, 0)));

// ---------- কোন সেগমেন্ট এখন ----------

/**
 * এই ফ্রেমে কোন সেগমেন্টের SVG দেখাতে হবে — `segments`-এর অ্যারে-অবস্থান (index), না থাকলে `-1`।
 *  - ফ্রেম কোনো সেগমেন্টের ভেতরে → সেটা (`findActiveSegment`, ফাঁক ছাড়া); দুই সেগমেন্ট ওভারল্যাপ করলে প্রথমটা
 *  - দুই সেগমেন্টের **ফাঁকে** → আগেরটাই থাকে (স্টেজ কখনো ফাঁকা হয় না)
 *  - প্রথম সেগমেন্টের আগে → প্রথমটা; শেষ সেগমেন্টের পরে → শেষটা
 *  - সেগমেন্ট নেই → `-1`; ফ্রেম সংখ্যা না হলে (NaN/Infinity/অ-সংখ্যা) ০ ধরা হয়
 * `segments` শুরুর ফ্রেম অনুযায়ী সাজানো ধরা হয় (`buildFrameSegments` তা-ই দেয়)।
 */
export function activeSegmentIndex(segments: readonly FrameSegment[], frame: number): number {
  if (!Array.isArray(segments) || segments.length === 0) return -1;
  const f = finite(frame, 0);
  const active = findActiveSegment(segments as FrameSegment[], f);
  if (active) {
    const at = segments.indexOf(active);
    if (at >= 0) return at;
  }
  // ফাঁক বা সীমার বাইরে: যে সেগমেন্ট ফ্রেমের আগে শেষ হয়েছে তার মধ্যে সবচেয়ে পরেরটা; না থাকলে প্রথমটা
  let previous = -1;
  for (let i = 0; i < segments.length; i++) {
    if (finite(segments[i].endFrame, 0) <= f) previous = i;
  }
  return previous >= 0 ? previous : 0;
}

/** SVG-র নিজের (০ থেকে শুরু) ফ্রেম = ফ্রেম − সেগমেন্টের শুরু; ঋণাত্মক বা সংখ্যা না হলে ০ */
export function segmentLocalFrame(absoluteFrame: number, segmentStartFrame: number): number {
  const local = finite(absoluteFrame, 0) - finite(segmentStartFrame, 0);
  return local > 0 ? local : 0;
}

// ---------- ভাসা ----------

/**
 * হালকা ভাসা — উল্লম্ব সরণ (px): `FLOAT_UNITS × unit × sin(2π × ফ্রেম / FLOAT_PERIOD_FRAMES)`।
 * ফ্রেম ০-তে ০; একই ফ্রেম = একই ফল; `unit` ০/ঋণাত্মক/সংখ্যা না হলে ০।
 * ⚠️ সেগমেন্ট-বদলে লাফ এড়াতে এখানে ভিডিওর **পূর্ণ (absolute) ফ্রেম** দিন, সেগমেন্টের স্থানীয় ফ্রেম নয়।
 */
export function floatOffset(frame: number, unit: number): number {
  const u = finite(unit, 0);
  if (u <= 0) return 0;
  const f = finite(frame, 0);
  return FLOAT_UNITS * u * Math.sin((2 * Math.PI * f) / FLOAT_PERIOD_FRAMES);
}

// ---------- glow ও ডিস্ক ----------

export type StageGlow = {
  /** ধরা হওয়া (clamp করা) nightFactor, ০…১ */
  nightFactor: number;
  /** glow-এর মূল রঙ ("rgb(r, g, b)", থিমের `glow` থেকে) */
  glowColor: string;
  /** glow-এর কেন্দ্রের স্বচ্ছতা (দিন → রাতে বাড়ে) */
  glowAlpha: number;
  /** ভেতরের ডিস্কের স্বচ্ছতা (দিন → রাতে কমে) */
  discAlpha: number;
  /** glow-এর ব্যাসার্ধ (px) */
  glowRadius: number;
  /** ভেতরের ডিস্কের ব্যাসার্ধ (px) */
  discRadius: number;
  /** তৈরি CSS: `radial-gradient(circle closest-side, …)` — কেন্দ্র থেকে স্বচ্ছ কিনারা পর্যন্ত (blur নয়, তাই render-safe) */
  glowBackground: string;
  /** তৈরি CSS: ডিস্কের রঙ ("rgba(…)") */
  discBackground: string;
};

function glowRgb(theme: ThemeId, nightFactor: number): { r: number; g: number; b: number } {
  try {
    const c = parseColor(getThemeColors(theme, nightFactor).glow);
    return { r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) };
  } catch {
    const c = parseColor(FALLBACK_GLOW);
    return { r: c.r, g: c.g, b: c.b };
  }
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * SVG-র পেছনের glow + ভেতরের হালকা ডিস্ক।
 *  - রঙ থিম ও `nightFactor` থেকে (`getThemeColors(theme, nf).glow`); `nightFactor` ০…১-এ আটকানো (NaN → ০)
 *  - দিনে ডিস্ক একটু গাঢ় (`DISC_ALPHA_DAY` > `DISC_ALPHA_NIGHT`), রাতে glow বেশি উজ্জ্বল (`GLOW_ALPHA_NIGHT` > `GLOW_ALPHA_DAY`)
 *  - ব্যাসার্ধ `size`-এর সমানুপাতিক (4K-তে ঠিক ২×); `size` সংখ্যা না হলে বা ঋণাত্মক হলে ০
 */
export function stageGlow(theme: ThemeId, nightFactor: number, size: number): StageGlow {
  const nf = clamp01(nightFactor);
  const s = Math.max(0, finite(size, 0));
  const { r, g, b } = glowRgb(theme, nf);
  const glowAlpha = round3(GLOW_ALPHA_DAY + (GLOW_ALPHA_NIGHT - GLOW_ALPHA_DAY) * nf);
  const discAlpha = round3(DISC_ALPHA_DAY + (DISC_ALPHA_NIGHT - DISC_ALPHA_DAY) * nf);
  const edge = `rgba(${r}, ${g}, ${b}, 0)`;
  return {
    nightFactor: nf,
    glowColor: `rgb(${r}, ${g}, ${b})`,
    glowAlpha,
    discAlpha,
    glowRadius: s * GLOW_RADIUS_FACTOR,
    discRadius: s * DISC_RADIUS_FACTOR,
    glowBackground:
      `radial-gradient(circle closest-side, rgba(${r}, ${g}, ${b}, ${glowAlpha}) 0%, ` +
      `rgba(${r}, ${g}, ${b}, ${round3(glowAlpha * 0.45)}) 55%, ${edge} 100%)`,
    discBackground: `rgba(${DISC_RGB}, ${discAlpha})`,
  };
}
