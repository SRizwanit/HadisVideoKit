import { FPS, TRANSITION_FRAMES } from "../constants";
import type { Box, Layout } from "./useLayout";

/**
 * Part 12A: Outro-র সব বিশুদ্ধ (pure) হিসাব — React/Remotion ছাড়া, তাই সাধারণ Node-এও চলে।
 * `PlayBadge` (12B–12C) ও `OutroScene` (12D) শুধু এখান থেকে সংখ্যা নেবে; নিজে কোনো সময়/মাপ হিসাব করবে না।
 *
 * - সব অ্যানিমেশন ফ্রেম থেকে হিসাব হয় (CSS animation / Math.random() / remotion `spring()` নেই) → রেন্ডারে নিরাপদ।
 * - সময়সূচি (`OUTRO_STEPS`) ১২০ ফ্রেম (৪ সেকেন্ড @ ৩০ fps) ধরে লেখা। Outro ১২০-র কম হলে পুরো ক্রম চেপে আসে;
 *   বেশি হলে ক্রম স্বাভাবিক গতিতে হয়ে বাকিটা স্থির থাকে (শুধু pulse/tap লুপ চলতে থাকে)। `IntroScene`-এর মতোই নিয়ম।
 * - Outro ০ ফ্রেম বা অবৈধ → `planOutro` `null` ফেরায় (কিছুই আঁকা হয় না)।
 * - খুব ছোট Outro (< `OUTRO_MIN_ANIMATED_FRAMES`) → অ্যানিমেশন ছাড়া পুরো তৈরি দৃশ্য (স্থির), ফেড নেই।
 */

// ---------- ছোট সহায়ক ----------
const finite = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const clamp01 = (x: number): number => Math.min(1, Math.max(0, finite(x, 0)));
const smoothstep = (x: number): number => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const easeOutCubic = (x: number): number => 1 - Math.pow(1 - clamp01(x), 3);
const TAU = Math.PI * 2;

// ---------- সময়সূচি ----------

/** পুরো ক্রমের পরিকল্পিত দৈর্ঘ্য (বেস ফ্রেম) = `DEFAULT_OUTRO_SECONDS` (৪) × ৩০ */
export const OUTRO_BASE_FRAMES = 120;
/** এর চেয়ে ছোট Outro-তে অ্যানিমেশন নেই — শেষ অবস্থার স্থির দৃশ্য */
export const OUTRO_MIN_ANIMATED_FRAMES = 6;

/** ক্রমের ধাপগুলো (বেস ফ্রেম; Outro ১২০ ফ্রেমের হিসাবে) */
export const OUTRO_STEPS = {
  /** লোগো স্কেল-ইন (স্প্রিং) + glow */
  logo: 0,
  /** অ্যাপের নামের প্রথম লাইন; পরের লাইন প্রতিবার `nameStep` পরে */
  nameFirst: 8,
  nameStep: 6,
  /** CTA লেখা টাইপ হওয়া শুরু; `textFrames` ফ্রেম ধরে */
  text: 20,
  textFrames: 28,
  /** ব্যাজ spring bounce-in শুরু */
  badge: 50,
  /** একবারের shine sweep */
  shine: 66,
  /** ধীর pulse শুরু = ব্যাজ স্থির হওয়ার ঠিক পর (badge + BADGE_BOUNCE_FRAMES) */
  pulse: 80,
  /** "ট্যাপ" ইঙ্গিত দেখা দেয় */
  tap: 86,
} as const;

/** স্প্রিং (logo, badge) এ ফ্রেমে ঠিক ১ হয়ে স্থির — এর পরে মান সবসময় হুবহু ১ */
export const SPRING_SETTLE_FRAMES = 30;
export const BADGE_BOUNCE_FRAMES = SPRING_SETTLE_FRAMES;
export const LOGO_SCALE_FROM = 0.15;
export const BADGE_SCALE_FROM = 0.5;
/** ব্যাজের opacity ০ → ১ হতে (বেস ফ্রেম) */
export const BADGE_FADE_FRAMES = 6;
export const NAME_LINE_FRAMES = 16;
/** নামের লাইন নিচ থেকে এত unit উঠে আসে */
export const NAME_RISE_UNITS = 24;
/** CTA লেখা নিচ থেকে এত unit উঠে আসে (slide) ও এত ফ্রেমে ভেসে ওঠে */
export const TEXT_RISE_UNITS = 20;
export const TEXT_FADE_FRAMES = 12;

// ---------- ব্যাজের গতি ----------
export const PULSE_MAX_SCALE = 1.06;
/** একটা pulse-এর দৈর্ঘ্য (বেস ফ্রেম): ১ → ১.০৬ → ১ */
export const PULSE_PERIOD_FRAMES = 40;
export const SHINE_FRAMES = 24;
/** আলোর ফালির প্রস্থ (ব্যাজের প্রস্থের ভগ্নাংশ) ও হেলানো কোণ */
export const SHINE_BAND = 0.22;
export const SHINE_ANGLE_DEG = 20;
export const SHINE_PEAK_OPACITY = 0.55;
/** "ট্যাপ" ইঙ্গিত চালু/বন্ধ — এক ধ্রুবকে বন্ধ করা যায় */
export const OUTRO_TAP_ENABLED = true;
export const TAP_PERIOD_FRAMES = 32;
/** ট্যাপ-তীর সর্বোচ্চ এত unit উপরে-নিচে দোলে */
export const TAP_BOB_UNITS = 14;
export const TAP_FADE_FRAMES = 8;

// ---------- সিনের ফেড ----------
export const OUTRO_FADE_IN = true;
export const OUTRO_FADE_OUT = true;
/** ফেড-আউটে সিন সামান্য (এত গুণ পর্যন্ত) বড় হয় — `IntroScene`-এর মতো */
export const OUTRO_FADE_OUT_SCALE = 1.04;
/** সিন ফেডের দৈর্ঘ্য: `min(TRANSITION_FRAMES, ⌊Outro × ২৫%⌋)`; ছোট Outro-তে ০ */
export function sceneFadeFrames(outroFrames: number): number {
  const n = finite(outroFrames, 0);
  if (n < OUTRO_MIN_ANIMATED_FRAMES) return 0;
  return Math.min(TRANSITION_FRAMES, Math.floor(n * 0.25));
}

/**
 * সময়-সংকোচন গুণক: Outro ১২০ ফ্রেমের কম হলে চেপে আসে, বেশি হলে ১; ০/অবৈধ → ০ (কিছু আঁকা হবে না)।
 */
export function outroSpeed(outroFrames: number): number {
  const n = finite(outroFrames, 0);
  if (n < 1) return 0;
  return n >= OUTRO_BASE_FRAMES ? 1 : Math.max(0.05, n / OUTRO_BASE_FRAMES);
}

// ---------- স্প্রিং (বন্ধ সূত্র; Part 10-এর `springValue`-এর মতোই) ----------
const SPRING_A = 9;
const SPRING_W = 14;
/** ০ → ১, ≈ ১৩% ছাড়িয়ে স্থির; t ≤ ০ বা অসংখ্যা → ০ */
function springRaw(seconds: number): number {
  const t = finite(seconds, 0);
  if (t <= 0) return 0;
  return 1 - Math.exp(-SPRING_A * t) * (Math.cos(SPRING_W * t) + (SPRING_A / SPRING_W) * Math.sin(SPRING_W * t));
}
/** `SPRING_SETTLE_FRAMES` বেস ফ্রেমের পর হুবহু ১ (অবশিষ্ট ≈ ১.৫×১০⁻⁴ ছেঁটে ফেলা হয়) */
export function settleSpring(baseFrames: number): number {
  const f = finite(baseFrames, 0);
  if (f <= 0) return 0;
  if (f >= SPRING_SETTLE_FRAMES) return 1;
  return springRaw(f / FPS);
}

// ---------- টাইপরাইটার (বাংলা কখনো ভাঙে না) ----------
const VIRAMAS = new Set(["\u094D", "\u09CD", "\u0A4D", "\u0ACD", "\u0B4D", "\u0BCD", "\u0C4D", "\u0CCD", "\u0D4D"]);
const ZWJ = "\u200D";
const ZWNJ = "\u200C";
const isMark = (ch: string): boolean => /^\p{M}$/u.test(ch);
const isLetter = (ch: string): boolean => /^\p{L}$/u.test(ch);
const isSpace = (ch: string): boolean => /^\s$/u.test(ch);
/** ইউনিট কি virama দিয়ে শেষ (শেষের ZWJ/ZWNJ বাদ দিয়ে)? তাহলে পরের অক্ষর জোড়ায় (যুক্তাক্ষর) ঢুকবে */
function endsWithVirama(unit: string): boolean {
  const chars = Array.from(unit);
  let i = chars.length - 1;
  while (i > 0 && (chars[i] === ZWJ || chars[i] === ZWNJ)) i--;
  return VIRAMAS.has(chars[i]);
}

/**
 * লেখাকে টাইপের একক (ইউনিট) এ ভাঙা: একটা মূল অক্ষর + তার সব চিহ্ন (স্বরচিহ্ন, হসন্ত, চন্দ্রবিন্দু…);
 * হসন্তের পরের ব্যঞ্জন একই ইউনিটে (যুক্তাক্ষর: "স্ট", "প্র", "ক্ষ", র-ফলা, য-ফলা); ZWJ/ZWNJ জোড়া থাকে।
 * নিজস্ব হিসাব — `Intl.Segmenter`-এর উপর নির্ভর করে না (পুরনো ইঞ্জিনে বাংলা যুক্তাক্ষর ভাঙে), তাই Node/Studio/রেন্ডার সবখানে একই ফল।
 * `units.join("") === text` সবসময়।
 */
export function typewriterUnits(text: string): string[] {
  const chars = Array.from(typeof text === "string" ? text : "");
  const units: string[] = [];
  let i = 0;
  while (i < chars.length) {
    let unit = chars[i++];
    while (i < chars.length) {
      const next = chars[i];
      const joins =
        isMark(next) ||
        next === ZWJ ||
        next === ZWNJ ||
        (endsWithVirama(unit) && isLetter(next)) ||
        (unit.endsWith(ZWJ) && !isSpace(next));
      if (!joins) break;
      unit += next;
      i++;
    }
    units.push(unit);
  }
  return units;
}

/** `progress` (০…১) এ কয়টা ইউনিট দেখা যাবে — রৈখিক; ০ → ০, ১ → সব */
export function typewriterCount(unitCount: number, progress: number): number {
  const n = Math.max(0, Math.floor(finite(unitCount, 0)));
  if (n === 0) return 0;
  return Math.min(n, Math.max(0, Math.floor(clamp01(progress) * n + 1e-9)));
}

/** `progress`-এ দেখানোর লেখা (ইউনিট ধরে কাটা — যুক্তাক্ষর/স্বরচিহ্ন কখনো আলাদা হয় না) */
export function typewriterText(text: string, progress: number): string {
  const units = typewriterUnits(text);
  return units.slice(0, typewriterCount(units.length, progress)).join("");
}

// ---------- ব্যাজের চলমান মান ----------
export type ShineLook = {
  /** এখন আলো ফালি চলছে কি */
  active: boolean;
  /** ০…১: ০ = শুরুর পাশে, ১ = শেষ পাশে (ব্যাজের বাইরে দুই প্রান্তে) */
  position: number;
  /** ০…`SHINE_PEAK_OPACITY` */
  opacity: number;
};

/** pulse গুণক: ১ → `PULSE_MAX_SCALE` → ১, `PULSE_PERIOD_FRAMES` পরপর; আগে ও অবৈধ ইনপুটে ১ */
export function pulseScale(baseT: number): number {
  const t = finite(baseT, 0) - OUTRO_STEPS.pulse;
  if (t <= 0) return 1;
  return 1 + (PULSE_MAX_SCALE - 1) * ((1 - Math.cos((TAU * t) / PULSE_PERIOD_FRAMES)) / 2);
}

/** একবারের shine: `OUTRO_STEPS.shine` থেকে `SHINE_FRAMES` ফ্রেম; তার আগে-পরে নিষ্ক্রিয় */
export function shineLook(baseT: number): ShineLook {
  const s = (finite(baseT, 0) - OUTRO_STEPS.shine) / SHINE_FRAMES;
  if (!(s > 0 && s < 1)) return { active: false, position: s >= 1 ? 1 : 0, opacity: 0 };
  return { active: true, position: smoothstep(s), opacity: SHINE_PEAK_OPACITY * Math.sin(Math.PI * s) };
}

/** আলো ফালির কেন্দ্রের x (ব্যাজের প্রস্থের ভগ্নাংশ): ০ → `−band` (পুরো বাইরে বাঁয়ে), ১ → `1 + band` (পুরো বাইরে ডানে) */
export function shineCenter(position: number, band: number = SHINE_BAND): number {
  return -band + clamp01(position) * (1 + 2 * band);
}

export type TapLook = {
  opacity: number;
  /** ০…`TAP_BOB_UNITS` (unit-এ; scene × unit) */
  offsetUnits: number;
};

/** ট্যাপ-ইঙ্গিত: `enabled = false` হলে সবসময় অদৃশ্য */
export function tapLook(baseT: number, enabled: boolean = OUTRO_TAP_ENABLED): TapLook {
  const t = finite(baseT, 0) - OUTRO_STEPS.tap;
  if (!enabled || t <= 0) return { opacity: 0, offsetUnits: 0 };
  return {
    opacity: clamp01(t / TAP_FADE_FRAMES),
    offsetUnits: TAP_BOB_UNITS * ((1 - Math.cos((TAU * t) / TAP_PERIOD_FRAMES)) / 2),
  };
}

// ---------- হাতের ক্লিক-কার্সর (Play ব্যাজে ক্লিক) ----------
/** কার্সরের প্রথম চক্র শুরু (বেস ফ্রেম): ট্যাপ-ইঙ্গিতের ১০ ফ্রেম আগে, যাতে ফেড-আউটের (১০৮) আগেই একবার ক্লিক দেখা যায় */
export const CLICK_START = OUTRO_STEPS.tap - 10;
/** একটা পুরো চক্র (বেস ফ্রেম): নিচ থেকে আসা → ক্লিক → নেমে যাওয়া → বিরতি; Outro লম্বা হলে চক্র চলতে থাকে */
export const CLICK_PERIOD_FRAMES = 48;
/**
 * চক্রের ধাপের শেষ-ফ্রেম (চক্রের নিজের ফ্রেমে): আসা · ব্যাজের ওপর থামা (hover) · চাপ · ছাড়া · নামা।
 * Cursor-আপডেট২: `approach`→`hover` = ৩ ফ্রেম বিরতি (আঙুল ব্যাজের ওপর থেমে থাকে), তারপর `press` ফ্রেমে ক্লিক।
 */
export const CLICK_PHASES = { approach: 12, hover: 15, press: 19, release: 23, retreat: 35 } as const;
/** ক্লিকের ঠিক মুহূর্ত (চক্রের নিজের ফ্রেমে) = চাপ পুরো হওয়ার ফ্রেম — tap SFX, রিং-ঢেউ ও glow এখান থেকে */
export const CLICK_FRAME = CLICK_PHASES.press;
/** রিং-ঢেউ শুরু ও দৈর্ঘ্য (চক্রের নিজের ফ্রেমে) */
export const CLICK_RIPPLE_START = CLICK_FRAME - 1;
export const CLICK_RIPPLE_FRAMES = 14;
export const CLICK_RIPPLE_PEAK_OPACITY = 0.7;
/** ক্লিকের মুহূর্তে হাত যত গুণ ছোট হয় (চাপ) */
export const CLICK_PRESS_SCALE = 0.88;
/** ক্লিকের মুহূর্তে ব্যাজ যত গুণ ছোট হয় (চাপের সাড়া; ছাড়লে ১-এ ফেরে) */
export const BADGE_PRESS_SCALE = 0.97;
/** আসা/নামার বাঁকা পথের (arc) বাইরের দিকে ফোলা — হাতের মাপের ভগ্নাংশ (০ = সোজা) */
export const CLICK_ARC = 0.24;
/** ক্লিকের পরের মুহূর্ত (glow + "ইনস্টল" লেখা ফুটে ওঠা, তারপর ফেড-আউট) কত ফ্রেম */
export const CLICK_AFTER_FRAMES = 18;
/** ক্লিকের পর ব্যাজের ওপর ফোটা লেখা */
export const OUTRO_INSTALL_LABEL = "ইনস্টল";
/** tap SFX-এর নাম (`public/sfx/tap.mp3` বা `.wav`; না থাকলে চুপচাপ বাদ) ও বন্ধ করার সুইচ */
export const CLICK_SFX_NAME = "tap";
export const CLICK_SFX_ENABLED = true;

export type ClickLook = {
  /** এখন হাত দেখা যাচ্ছে কি */
  active: boolean;
  /** ০…১ */
  opacity: number;
  /** ০ = বিশ্রামের জায়গা (ব্যাজের নিচে), ১ = আঙুলের ডগা ব্যাজের ওপর */
  approach: number;
  /** ০…১: আঙুল চাপছে (ক্লিকের মুহূর্তে ১) */
  press: number;
  /** রিং-ঢেউয়ের অগ্রগতি ০…১ (০ = শুরু হয়নি/শেষ) */
  ripple: number;
  /** রিং-ঢেউয়ের স্বচ্ছতা ০…`CLICK_RIPPLE_PEAK_OPACITY` */
  rippleOpacity: number;
  /** বাঁকা পথের বাইরের দিকে ফোলা ০…১ (`sin(π·approach)`; বিশ্রামে ও ব্যাজের ওপরে ০) */
  arc: number;
  /** ক্লিকের পরের glow ০…১ (ক্লিকের মুহূর্তে বাড়ে, তারপর কমে) */
  glow: number;
  /** "ইনস্টল" লেখার স্বচ্ছতা ০…১ (ফুটে ওঠে, তারপর ফেড-আউট) */
  label: number;
  /** "ইনস্টল" লেখার ওঠা ০…১ (০ = নিচে, ১ = ওপরে) */
  labelRise: number;
};

const NO_CLICK: ClickLook = {
  active: false,
  opacity: 0,
  approach: 0,
  press: 0,
  ripple: 0,
  rippleOpacity: 0,
  arc: 0,
  glow: 0,
  label: 0,
  labelRise: 0,
};

/** হাতের ক্লিক-কার্সরের চলমান মান; `enabled = false` বা শুরুর আগে সবসময় অদৃশ্য। কখনো throw করে না */
export function clickLook(baseT: number, enabled: boolean = OUTRO_TAP_ENABLED): ClickLook {
  const t = finite(baseT, 0) - CLICK_START;
  if (!enabled || t <= 0) return NO_CLICK;
  const c = t % CLICK_PERIOD_FRAMES;
  const { approach: A, hover: H, press: P, release: R, retreat: B } = CLICK_PHASES;
  const approach = c < A ? easeOutCubic(c / A) : c < R ? 1 : c < B ? 1 - smoothstep((c - R) / (B - R)) : 0;
  const opacity = c < B ? Math.min(clamp01(c / 6), clamp01((B - c) / 6)) : 0;
  // A…H = ব্যাজের ওপর থামা (press ০); H…P চাপ; P…R ছাড়া
  const press = c < H ? 0 : c < P ? smoothstep((c - H) / (P - H)) : c < R ? 1 - smoothstep((c - P) / (R - P)) : 0;
  const rp = (c - CLICK_RIPPLE_START) / CLICK_RIPPLE_FRAMES;
  const rippling = rp > 0 && rp < 1;
  // ক্লিকের পরের মুহূর্ত: glow + লেখা
  const s = (c - CLICK_FRAME) / CLICK_AFTER_FRAMES;
  const after = s > 0 && s < 1;
  return {
    active: opacity > 0,
    opacity,
    approach,
    press,
    ripple: rippling ? rp : 0,
    rippleOpacity: rippling ? CLICK_RIPPLE_PEAK_OPACITY * (1 - rp) : 0,
    arc: Math.sin(Math.PI * approach),
    glow: after ? Math.sin(Math.PI * Math.min(1, s * 1.6)) * (1 - smoothstep((s - 0.35) / 0.65)) : 0,
    label: after ? Math.min(clamp01(s / 0.2), clamp01((1 - s) / 0.45)) : 0,
    labelRise: after ? easeOutCubic(s / 0.6) : 0,
  };
}

/**
 * প্রতিটা ক্লিকের মুহূর্তের আসল ফ্রেম (Outro সিনের নিজের ০-ভিত্তিক ফ্রেম) — tap SFX বসানোর জন্য।
 * স্থির দৃশ্য (< `OUTRO_MIN_ANIMATED_FRAMES`)/অবৈধ/ক্লিক বন্ধ → খালি তালিকা। সিনের শেষ ফ্রেমের আগেরগুলোই আসে।
 */
export function clickFrames(outroFrames: number, enabled: boolean = OUTRO_TAP_ENABLED): number[] {
  const frames = finite(outroFrames, 0);
  if (!enabled || frames < OUTRO_MIN_ANIMATED_FRAMES) return [];
  const speed = outroSpeed(frames);
  const out: number[] = [];
  for (let k = 0; k < 1000; k += 1) {
    const f = Math.round((CLICK_START + k * CLICK_PERIOD_FRAMES + CLICK_FRAME) * speed);
    if (f >= frames - 1) break;
    out.push(f);
  }
  return out;
}

/** ব্যাজের bounce-in-এর সর্বোচ্চ স্কেল (স্প্রিংয়ের ছাড়িয়ে যাওয়া সহ) — `BADGE_MAX_SCALE` ঠিক রাখতে */
export const BADGE_BOUNCE_PEAK = (() => {
  let peak = 0;
  for (let f = 0; f <= SPRING_SETTLE_FRAMES; f += 1) {
    peak = Math.max(peak, BADGE_SCALE_FROM + (1 - BADGE_SCALE_FROM) * settleSpring(f));
  }
  return peak;
})();

// ---------- পুরো পরিকল্পনা ----------
export type LineLook = { progress: number; opacity: number; offsetUnits: number };

export type OutroPlan = {
  /** স্থির দৃশ্য (ছোট Outro): অ্যানিমেশন নেই, সব শেষ অবস্থায় */
  isStatic: boolean;
  frames: number;
  /** ফ্রেম (≥ ০, অবৈধ → ০) */
  frame: number;
  speed: number;
  /** বেস-সময় (১২০ ফ্রেমের হিসাবে) */
  t: number;
  scene: { opacity: number; scale: number; fadeFrames: number };
  logo: { progress: number; scale: number; opacity: number };
  /** লোগোর glow-এর স্পন্দন ০.৮৫…১ (Intro-র মতো ২ সেকেন্ডে একবার; আসল ফ্রেম থেকে) */
  glow: number;
  /** অ্যাপের নামের দুই লাইন */
  name: [LineLook, LineLook];
  text: {
    /** টাইপের অগ্রগতি ০…১ → `typewriterCount(units, typed)` */
    typed: number;
    opacity: number;
    offsetUnits: number;
  };
  badge: {
    visible: boolean;
    /** bounce-in স্কেল (`BADGE_SCALE_FROM` … ছাড়িয়ে … ১) */
    scale: number;
    opacity: number;
  };
  /** pulse গুণক ১…`PULSE_MAX_SCALE` (ব্যাজের স্কেল = `badge.scale × pulse`) */
  pulse: number;
  shine: ShineLook;
  tap: TapLook;
  /** হাতের ক্লিক-কার্সর (Play ব্যাজে ক্লিক) */
  click: ClickLook;
};

/**
 * এই ফ্রেমে Outro-র সব মান। `frame` = Outro সিনের নিজের ফ্রেম (০-ভিত্তিক)।
 * `outroFrames` ০/অবৈধ → `null`। `frame` NaN/নেগেটিভ → ০; কখনো throw করে না।
 */
export function planOutro(frame: number, outroFrames: number): OutroPlan | null {
  const frames = finite(outroFrames, 0);
  if (frames < 1) return null;
  const f = Math.max(0, finite(frame, 0));
  const isStatic = frames < OUTRO_MIN_ANIMATED_FRAMES;
  const speed = outroSpeed(frames);
  const t = isStatic ? OUTRO_BASE_FRAMES - 1 : f / speed;

  // সিনের ফেড (আসল ফ্রেমে)
  const fadeFrames = sceneFadeFrames(frames);
  const fadeIn = OUTRO_FADE_IN && fadeFrames > 0 ? smoothstep(f / fadeFrames) : 1;
  const fadeOut = OUTRO_FADE_OUT && fadeFrames > 0 ? smoothstep((frames - f) / fadeFrames) : 1;
  const scene = { opacity: fadeIn * fadeOut, scale: 1 + (OUTRO_FADE_OUT_SCALE - 1) * (1 - fadeOut), fadeFrames };

  // লোগো
  const lp = settleSpring(t - OUTRO_STEPS.logo);
  const logo = { progress: lp, scale: LOGO_SCALE_FROM + (1 - LOGO_SCALE_FROM) * lp, opacity: Math.min(1, lp * 1.4) };
  const glow = 0.85 + 0.15 * Math.sin((f / FPS) * (TAU / 2));

  // নাম (দুই লাইন)
  const line = (i: number): LineLook => {
    const p = easeOutCubic((t - (OUTRO_STEPS.nameFirst + OUTRO_STEPS.nameStep * i)) / NAME_LINE_FRAMES);
    return { progress: p, opacity: p, offsetUnits: NAME_RISE_UNITS * (1 - p) };
  };
  const name: [LineLook, LineLook] = [line(0), line(1)];

  // CTA লেখা
  const textIn = easeOutCubic((t - OUTRO_STEPS.text) / TEXT_FADE_FRAMES);
  const text = {
    typed: clamp01((t - OUTRO_STEPS.text) / OUTRO_STEPS.textFrames),
    opacity: textIn,
    offsetUnits: TEXT_RISE_UNITS * (1 - textIn),
  };

  // ব্যাজ
  const b = t - OUTRO_STEPS.badge;
  const bp = settleSpring(b);
  const badge = {
    visible: b >= 0,
    scale: b >= 0 ? BADGE_SCALE_FROM + (1 - BADGE_SCALE_FROM) * bp : BADGE_SCALE_FROM,
    opacity: b >= 0 ? clamp01(b / BADGE_FADE_FRAMES) : 0,
  };

  return {
    isStatic,
    frames,
    frame: f,
    speed,
    t,
    scene,
    logo,
    glow,
    name,
    text,
    badge,
    pulse: isStatic ? 1 : pulseScale(t),
    shine: isStatic ? { active: false, position: 1, opacity: 0 } : shineLook(t),
    tap: isStatic ? { opacity: 0, offsetUnits: 0 } : tapLook(t),
    click: isStatic ? NO_CLICK : clickLook(t),
  };
}

// ---------- ব্যাজের মাপ ও clear space ----------

/** `src/google-play-badge.png`-এর আসল মাপ (পিক্সেল) — আস্পেক্ট রেশিও ও ধার (sharpness) যাচাইয়ের জন্য */
export const BADGE_PNG_WIDTH = 1600;
export const BADGE_PNG_HEIGHT = 474;
/** ব্যাজের আস্পেক্ট রেশিও (প্রস্থ ÷ উচ্চতা) = ফাইলের রেশিও; কখনো বিকৃত হয় না */
export const BADGE_ASPECT = BADGE_PNG_WIDTH / BADGE_PNG_HEIGHT;
/**
 * Google-এর অফিসিয়াল নিয়ম (Android Developers → "Google Play badges"): ব্যাজের চারপাশে ফাঁকা জায়গা
 * = ব্যাজের উচ্চতার এক-চতুর্থাংশ। ফাইলটিতে নিজের ভেতরে কোনো ফাঁকা ধার নেই (alpha-ট্রিম করলেও ১৬০০×৪৭৪) → পুরোটা আমরা যোগ করি।
 */
export const CLEAR_SPACE_RATIO = 0.25;
/** bounce ও pulse মিলিয়ে ব্যাজ কখনো এর বেশি বড় হয় না (`outer` বাক্সে এর জন্য জায়গা রাখা আছে) */
export const BADGE_MAX_SCALE = 1.07;
/** ব্যাজের প্রস্থ (unit-এ; 4K-তে ×২) — ৪K-তেও PNG-এর (১৬০০ px) চেয়ে বড় হয় না, তাই ঝাপসা হয় না */
export const BADGE_WIDTH_UNITS = { portrait: 640, landscape: 560 } as const;

export type BadgeSize = { width: number; height: number; clear: number };

/** প্রস্থ থেকে ব্যাজের উচ্চতা (আস্পেক্ট ঠিক রেখে) ও clear space; অবৈধ → সব ০ */
export function badgeSize(width: number, aspect: number = BADGE_ASPECT): BadgeSize {
  const w = finite(width, 0);
  const a = finite(aspect, BADGE_ASPECT);
  if (w <= 0 || a <= 0) return { width: 0, height: 0, clear: 0 };
  const height = w / a;
  return { width: w, height, clear: height * CLEAR_SPACE_RATIO };
}

/** ব্যাজ কি আসল PNG-র পিক্সেলের মধ্যে আঁকা হচ্ছে (বড় করতে হচ্ছে না → ঝাপসা নয়)? */
export const badgeIsSharp = (displayWidthPx: number): boolean =>
  finite(displayWidthPx, Infinity) <= BADGE_PNG_WIDTH;

/** বাক্সকে নিজের কেন্দ্র ধরে `s` গুণ বড়/ছোট করা */
export function scaledBox(box: Box, s: number): Box {
  const k = finite(s, 1);
  const w = box.width * k;
  const h = box.height * k;
  return { x: box.x + (box.width - w) / 2, y: box.y + (box.height - h) / 2, width: w, height: h };
}

export type BadgeBox = Box & {
  aspect: number;
  /** clear space (px) = উচ্চতা ÷ ৪ */
  clear: number;
  /** ব্যাজ + clear space + bounce/pulse-এর বাড়তি জায়গা (`BADGE_MAX_SCALE`) — অন্য কিছু এর ভেতরে বসবে না */
  outer: Box;
};

function makeBadge(x: number, y: number, width: number, aspect: number): BadgeBox {
  const s = badgeSize(width, aspect);
  const mx = s.clear * BADGE_MAX_SCALE + (s.width * (BADGE_MAX_SCALE - 1)) / 2;
  const my = s.clear * BADGE_MAX_SCALE + (s.height * (BADGE_MAX_SCALE - 1)) / 2;
  return {
    x,
    y,
    width: s.width,
    height: s.height,
    aspect: finite(aspect, BADGE_ASPECT),
    clear: s.clear,
    outer: { x: x - mx, y: y - my, width: s.width + 2 * mx, height: s.height + 2 * my },
  };
}

// ---------- Outro-র লেআউট ----------

export type OutroLayout = {
  isPortrait: boolean;
  unit: number;
  /** সব কিছুর পেছনের আধা-স্বচ্ছ গাঢ় প্যানেল (`panelBg`) */
  panel: Box;
  panelRadius: number;
  logo: { x: number; y: number; size: number };
  /** অ্যাপের নাম (দুই লাইন) */
  name: Box;
  /** CTA লেখার বাক্স (`FitText`) */
  text: Box;
  badge: BadgeBox;
  /** "ট্যাপ" ইঙ্গিতের বাক্স (ব্যাজের `outer`-এর নিচে — clear space-এর ভেতরে নয়) */
  tap: Box;
  fonts: { name: number; text: number };
};

/** লেআউটের base unit-মাপ (১০৮০-ভিত্তিক) */
export const OUTRO_LAYOUT_UNITS = {
  panelPad: 56,
  panelRadius: 44,
  portrait: { logo: 300, gapLogoName: 30, nameFont: 60, gapNameText: 52, gapTextBadge: 36, tap: 90 },
  landscape: { logo: 260, gapLogoName: 28, nameFont: 54, gapTextBadge: 36, tap: 80, leftW: 560, rightW: 760, gapCol: 72 },
  /** লাইন-উচ্চতা: নাম ১.২৫, CTA লেখা ১.৩ (দুই লাইন ধরে) */
  nameLineHeight: 1.25,
  textLineHeight: 1.3,
  tapGap: 6,
} as const;

const SAFE_FALLBACK: Layout["safe"] = { top: 0, bottom: 0, left: 0, right: 0 };

/**
 * `computeLayout(width, height)`-এর ফল থেকে Outro-র সব বাক্স। পোর্ট্রেট = এক কলাম (লোগো → নাম → লেখা → ব্যাজ → ইঙ্গিত);
 * ল্যান্ডস্কেপ = দুই কলাম (বাঁয়ে লোগো + নাম; ডানে লেখা + ব্যাজ + ইঙ্গিত)। সব মাপ `unit`-এর গুণিতক → 4K = ঠিক ২×।
 * প্যানেল নিরাপদ এলাকার (`safe.top` … `height − safe.bottom`) মাঝখানে। অবৈধ/অদ্ভুত মাপে throw করে না।
 */
export function outroLayout(layout: Layout, aspect: number = BADGE_ASPECT): OutroLayout {
  const W = finite(layout?.width, 1080) > 0 ? finite(layout?.width, 1080) : 1080;
  const H = finite(layout?.height, 1920) > 0 ? finite(layout?.height, 1920) : 1920;
  const isPortrait = H >= W;
  const u = finite(layout?.unit, Math.min(W, H) / 1080) > 0 ? finite(layout?.unit, Math.min(W, H) / 1080) : Math.min(W, H) / 1080;
  const safe = layout?.safe ?? SAFE_FALLBACK;
  const padding = finite(layout?.padding, W * 0.05);
  const L = OUTRO_LAYOUT_UNITS;
  const pad = L.panelPad * u;
  const textFont = finite(layout?.fontSizes?.outroText, (isPortrait ? 56 : 52) * u);
  const safeTop = finite(safe.top, 0);
  const safeBottom = finite(safe.bottom, 0);
  const availTop = safeTop;
  const availH = Math.max(0, H - safeTop - safeBottom);
  const cx = W / 2;

  if (isPortrait) {
    const P = L.portrait;
    const nameFont = P.nameFont * u;
    const logoSize = P.logo * u;
    const nameH = 2 * nameFont * L.nameLineHeight;
    const textH = 2 * textFont * L.textLineHeight;
    const panelW = Math.max(0, W - 2 * padding);
    const inner = Math.max(0, panelW - 2 * pad);
    const bw = Math.min(BADGE_WIDTH_UNITS.portrait * u, inner);
    const probe = makeBadge(0, 0, bw, aspect);
    const outerH = probe.outer.height;
    const tapH = P.tap * u;

    const contentH = logoSize + P.gapLogoName * u + nameH + P.gapNameText * u + textH + P.gapTextBadge * u + outerH + L.tapGap * u + tapH;
    const panelH = contentH + 2 * pad;
    const panelY = availTop + Math.max(0, (availH - panelH) / 2);
    let y = panelY + pad;

    const logo = { x: cx - logoSize / 2, y, size: logoSize };
    y += logoSize + P.gapLogoName * u;
    const name: Box = { x: cx - inner / 2, y, width: inner, height: nameH };
    y += nameH + P.gapNameText * u;
    const text: Box = { x: cx - inner / 2, y, width: inner, height: textH };
    y += textH + P.gapTextBadge * u;
    const badge = makeBadge(cx - bw / 2, y - probe.outer.y, bw, aspect);
    y = badge.outer.y + badge.outer.height + L.tapGap * u;
    const tap: Box = { x: cx - tapH / 2, y, width: tapH, height: tapH };
    return {
      isPortrait,
      unit: u,
      panel: { x: cx - panelW / 2, y: panelY, width: panelW, height: panelH },
      panelRadius: L.panelRadius * u,
      logo,
      name,
      text,
      badge,
      tap,
      fonts: { name: nameFont, text: textFont },
    };
  }

  // Landscape: দুই কলাম
  const P = L.landscape;
  const k = Math.min(1, Math.max(0, W - 2 * padding) / ((2 * L.panelPad + P.leftW + P.gapCol + P.rightW) * u));
  const leftW = P.leftW * u * k;
  const rightW = P.rightW * u * k;
  const gapCol = P.gapCol * u * k;
  const nameFont = P.nameFont * u;
  const logoSize = P.logo * u * Math.min(1, k);
  const nameH = 2 * nameFont * L.nameLineHeight;
  const textH = 2 * textFont * L.textLineHeight;
  const bw = Math.min(BADGE_WIDTH_UNITS.landscape * u, rightW);
  const probe = makeBadge(0, 0, bw, aspect);
  const tapH = P.tap * u;

  const leftH = logoSize + P.gapLogoName * u + nameH;
  const rightH = textH + P.gapTextBadge * u + probe.outer.height + L.tapGap * u + tapH;
  const contentH = Math.max(leftH, rightH);
  const panelW = 2 * pad + leftW + gapCol + rightW;
  const panelH = contentH + 2 * pad;
  const panelX = cx - panelW / 2;
  const panelY = availTop + Math.max(0, (availH - panelH) / 2);
  const colTop = panelY + pad;
  const leftX = panelX + pad;
  const rightX = leftX + leftW + gapCol;

  let ly = colTop + (contentH - leftH) / 2;
  const logo = { x: leftX + (leftW - logoSize) / 2, y: ly, size: logoSize };
  ly += logoSize + P.gapLogoName * u;
  const name: Box = { x: leftX, y: ly, width: leftW, height: nameH };

  let ry = colTop + (contentH - rightH) / 2;
  const text: Box = { x: rightX, y: ry, width: rightW, height: textH };
  ry += textH + P.gapTextBadge * u;
  const badge = makeBadge(rightX + (rightW - bw) / 2, ry - probe.outer.y, bw, aspect);
  ry = badge.outer.y + badge.outer.height + L.tapGap * u;
  const tap: Box = { x: rightX + (rightW - tapH) / 2, y: ry, width: tapH, height: tapH };
  return {
    isPortrait,
    unit: u,
    panel: { x: panelX, y: panelY, width: panelW, height: panelH },
    panelRadius: L.panelRadius * u,
    logo,
    name,
    text,
    badge,
    tap,
    fonts: { name: nameFont, text: textFont },
  };
}

/** ব্যাজের বাক্স (আস্পেক্ট ঠিক, clear space সহ) — `outroLayout(layout, aspect).badge` */
export const badgeBox = (layout: Layout, aspect: number = BADGE_ASPECT): BadgeBox => outroLayout(layout, aspect).badge;
