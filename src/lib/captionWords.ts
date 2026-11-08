import { findActiveSegment, type FrameSegment, type FrameWord } from "./timing";

/**
 * Part 10: রঙিন অ্যানিমেটেড ক্যাপশনের বিশুদ্ধ হিসাব (React/DOM নেই, কখনো throw করে না, কিছু ছাপে না)।
 * Caption.tsx শুধু এই সংখ্যাগুলো আঁকে — তাই সব নিয়ম সাধারণ Node-এও যাচাই করা যায় (dev/captionCases.ts)।
 *
 * নিয়ম (সব ফ্রেম "পরম ভিডিও-ফ্রেম", Intro-সহ):
 *  ১. বাক্স (box): সেগমেন্টের শুরুতে নিচ থেকে উঠে আসে (slide up), শেষে মিলিয়ে যায় (fade out)।
 *     - আগের সেগমেন্ট ঠিক গায়ে-গায়ে (contiguous) থাকলে ফেড-ইন নেই (শুধু উঠে আসা) — নইলে প্রতি সেগমেন্টে বাক্স জ্বলে-নেভে।
 *     - পরের সেগমেন্ট ঠিক গায়ে-গায়ে থাকলে ফেড-আউট নেই।
 *     - ছোট সেগমেন্টে দৈর্ঘ্য ⌊সেগমেন্ট ÷ ৩⌋ পর্যন্ত ছোট হয়।
 *  ২. শব্দ তিন অবস্থায়: upcoming (ঝাপসা), active (রঙিন + pop + আন্ডারলাইন), read (মূল লেখার রঙ)।
 *     - active = শব্দের শুরু থেকে "release" পর্যন্ত; release = min(পরের শব্দের শুরু, শব্দের শেষ + ACTIVE_HOLD_FRAMES)
 *       (তাই শব্দের মাঝের ছোট ফাঁকে হাইলাইট নিভে যায় না; লম্বা বিরতিতে নিভে যায়)।
 *     - active শব্দের রঙ `captionColors` থেকে ঘুরে ঘুরে (সেগমেন্ট-ক্রম + শব্দ-ক্রম)।
 *  ৩. ফন্ট আঁটানো: বেস সাইজ থেকে নেমে, minSize-এর নিচে নয়; লাইন বেশি হলে ফন্ট ছোট। minSize-এও না আঁটলে ছাঁটা ("…")।
 */

// ---------- ধ্রুবক (সব সংখ্যা এখানে; Caption.tsx-এ হার্ডকোড নেই) ----------
export const ENTER_FRAMES = 10;
export const EXIT_FRAMES = 8;
/** নিচ থেকে উঠে আসার দূরত্ব = SLIDE_UNITS × unit px */
export const SLIDE_UNITS = 36;
/** upcoming শব্দের স্বচ্ছতা */
export const UPCOMING_OPACITY = 0.45;
/** শব্দ active হলে রঙ/স্বচ্ছতা পুরোপুরি আসতে কত ফ্রেম */
export const WORD_COLOR_FRAMES = 4;
/** আন্ডারলাইন বাড়তে কত ফ্রেম */
export const UNDERLINE_FRAMES = 6;
/** active শেষে pop/রঙ/আন্ডারলাইন নেমে আসতে কত ফ্রেম */
export const WORD_RELAX_FRAMES = 6;
/** শব্দ শেষ হওয়ার পরও এত ফ্রেম active থাকে (পরের শব্দ আগে শুরু না হলে) */
export const ACTIVE_HOLD_FRAMES = 6;
/** active শব্দের পপ স্কেল */
export const POP_SCALE = 1.15;
export const CAPTION_LINE_HEIGHT = 1.4;
/** লাইনের কত অংশ আসলে ভরে (শব্দ ভেঙে না পড়ার জন্য বাকিটা ফাঁকা ধরা হয়) */
// Part 14C-fix: ০.৯২ → ০.৮৬ — প্রতিটি শব্দ inline-block (দুই পাশে ০.০৫em) + pop, তাই আসল লাইন আন্দাজের চেয়ে বেশি হত (ক্যাপশনের উপর-নিচ কাটার কারণ)
export const LINE_FILL = 0.86;

// ---------- ছোট সহায়ক ----------
const finite = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

export const clamp01 = (x: number): number => Math.min(1, Math.max(0, finite(x, 0)));
export const smoothstep = (x: number): number => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
export const easeOutCubic = (x: number): number => {
  const t = clamp01(x);
  return 1 - Math.pow(1 - t, 3);
};

/**
 * স্প্রিং-পপ (বন্ধ সূত্র — remotion `spring()` লাগে না, তাই খাঁটি ও Node-এ যাচাইযোগ্য)।
 * 0 → 1, একটু ছাড়িয়ে (≈ ১৩%) স্থির হয়; t সেকেন্ডে। t ≤ 0 বা অসংখ্যা → 0।
 */
const SPRING_A = 9;
const SPRING_W = 14;
export function springValue(seconds: number): number {
  const t = finite(seconds, 0);
  if (t <= 0) return 0;
  return 1 - Math.exp(-SPRING_A * t) * (Math.cos(SPRING_W * t) + (SPRING_A / SPRING_W) * Math.sin(SPRING_W * t));
}

// ---------- ১. বাক্সের পরিকল্পনা ----------

export type CaptionPlan = {
  /** সেগমেন্টের array-অবস্থান */
  index: number;
  /** এই সেগমেন্টের শুরু থেকে ফ্রেম (০-ভিত্তিক) */
  localFrame: number;
  enterFrames: number;
  exitFrames: number;
  /** ফেড-ইন হবে কি (আগের সেগমেন্ট গায়ে-গায়ে হলে না) */
  fadeIn: boolean;
  /** ফেড-আউট হবে কি (পরের সেগমেন্ট গায়ে-গায়ে হলে না) */
  fadeOut: boolean;
  /** ০…১ (উঠে আসার অগ্রগতি, easeOutCubic) */
  enter: number;
  /** ০…১ (মিলিয়ে যাওয়ার অগ্রগতি, ০ = পুরো দৃশ্যমান) */
  exit: number;
  /** বাক্সের মোট স্বচ্ছতা ০…১ */
  opacity: number;
  /** এখনো কতটা নিচে (unit-এ; ০ = জায়গায় পৌঁছেছে) */
  slideUnits: number;
};

/** ছোট সেগমেন্টে transition-এর দৈর্ঘ্য: `min(max, ⌊n ÷ 3⌋)`; n < 3 হলে ০ */
export function captionTransitionLength(segmentFrames: number, max: number): number {
  const n = finite(segmentFrames, 0);
  if (n < 3) return 0;
  return Math.max(0, Math.min(max, Math.floor(n / 3)));
}

/** এই ফ্রেমে কোন সেগমেন্টের ক্যাপশন, আর তার বাক্স কেমন। ফাঁকে বা Main-এর বাইরে `null` (কিছু আঁকা হয় না) */
export function planCaption(segments: readonly FrameSegment[], absFrame: number): CaptionPlan | null {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const frame = finite(absFrame, NaN);
  if (!Number.isFinite(frame)) return null;
  const seg = findActiveSegment(segments as FrameSegment[], frame);
  if (!seg) return null;
  const index = segments.indexOf(seg);
  const prev = index > 0 ? segments[index - 1] : undefined;
  const next = index >= 0 && index < segments.length - 1 ? segments[index + 1] : undefined;

  const len = Math.max(1, seg.endFrame - seg.startFrame);
  const local = Math.max(0, Math.floor(frame - seg.startFrame));
  const enterFrames = captionTransitionLength(len, ENTER_FRAMES);
  const exitFrames = captionTransitionLength(len, EXIT_FRAMES);
  const fadeIn = !(prev && prev.endFrame >= seg.startFrame);
  const fadeOut = !(next && next.startFrame <= seg.endFrame);

  const enter = enterFrames > 0 ? easeOutCubic(local / enterFrames) : 1;
  const remaining = seg.endFrame - frame; // শেষ ফ্রেমে ১
  const exit = exitFrames > 0 && remaining <= exitFrames ? clamp01((exitFrames - remaining + 1) / exitFrames) : 0;

  const opacity = (fadeIn ? enter : 1) * (fadeOut ? 1 - smoothstep(exit) : 1);
  return {
    index,
    localFrame: local,
    enterFrames,
    exitFrames,
    fadeIn,
    fadeOut,
    enter,
    exit,
    opacity: clamp01(opacity),
    slideUnits: SLIDE_UNITS * (1 - enter),
  };
}

// ---------- ২. শব্দের অবস্থা ----------

export type WordState = "upcoming" | "active" | "read";

export type WordLook = {
  state: WordState;
  /** মূল লেখার রঙ (০) → active রঙ (১) মিশ্রণ */
  activeMix: number;
  opacity: number;
  /** স্প্রিং-পপ মান (০…≈১.১৩); স্কেল = 1 + (POP_SCALE − 1) × pop */
  pop: number;
  /** আন্ডারলাইনের দৈর্ঘ্য ০…১ */
  underline: number;
};

const UPCOMING: WordLook = { state: "upcoming", activeMix: 0, opacity: UPCOMING_OPACITY, pop: 0, underline: 0 };

/** শব্দটা কোন ফ্রেমে active থেকে নামতে শুরু করে (শুরুর অন্তত ১ ফ্রেম পরে) */
export function wordReleaseFrame(words: readonly FrameWord[], i: number): number {
  const w = words[i];
  if (!w) return 0;
  const nextStart = words[i + 1] ? words[i + 1].startFrame : Infinity;
  const hold = w.endFrame + ACTIVE_HOLD_FRAMES;
  return Math.max(w.startFrame + 1, Math.min(nextStart, hold));
}

/** active শব্দের মান, শুরুর t ফ্রেম পরে */
function activeAt(t: number, fps: number): { mix: number; opacity: number; pop: number; underline: number } {
  const mix = smoothstep(t / WORD_COLOR_FRAMES);
  return {
    mix,
    opacity: UPCOMING_OPACITY + (1 - UPCOMING_OPACITY) * mix,
    pop: springValue(t / fps),
    underline: easeOutCubic(t / UNDERLINE_FRAMES),
  };
}

/** i-তম শব্দ এই ফ্রেমে দেখতে কেমন (সব সংখ্যা এখান থেকে) */
export function wordLook(words: readonly FrameWord[], i: number, frame: number, fps = 30): WordLook {
  const w = words[i];
  const f = finite(frame, NaN);
  if (!w || !Number.isFinite(f)) return UPCOMING;
  const start = w.startFrame;
  const release = wordReleaseFrame(words, i);
  if (f < start) return UPCOMING;
  if (f < release) {
    const a = activeAt(f - start, fps);
    return { state: "active", activeMix: a.mix, opacity: a.opacity, pop: a.pop, underline: a.underline };
  }
  // read: নামার সময় active-এর শেষ মান থেকে মসৃণভাবে ০-তে
  const a0 = activeAt(release - 1 - start, fps);
  const relax = smoothstep((f - release) / WORD_RELAX_FRAMES);
  return {
    state: "read",
    activeMix: a0.mix * (1 - relax),
    opacity: a0.opacity + (1 - a0.opacity) * relax,
    pop: a0.pop * (1 - relax),
    underline: a0.underline * (1 - relax),
  };
}

/** এই ফ্রেমে active শব্দের অবস্থান (একাধিক হলে সবচেয়ে পরেরটা); নেই → -1 */
export function activeWordIndex(words: readonly FrameWord[], frame: number, fps = 30): number {
  let found = -1;
  for (let i = 0; i < words.length; i += 1) {
    if (wordLook(words, i, frame, fps).state === "active") found = i;
  }
  return found;
}

/** active শব্দের রঙের অবস্থান: সেগমেন্ট-ক্রম + শব্দ-ক্রম ঘুরিয়ে (পরপর সেগমেন্ট একই রঙে শুরু হয় না) */
export function wordColorIndex(segmentIndex: number, wordIndex: number, colorCount: number): number {
  const n = Math.floor(finite(colorCount, 0));
  if (n <= 0) return 0;
  const k = Math.floor(finite(segmentIndex, 0)) + Math.floor(finite(wordIndex, 0));
  return ((k % n) + n) % n;
}

/** pop-এর স্কেল (১ বা তার বেশি) */
export const popScale = (pop: number): number => 1 + (POP_SCALE - 1) * Math.max(0, finite(pop, 0));

// ---------- ৩. ফন্ট আঁটানো ----------

export type CaptionFitInput = {
  /** বেস সাইজে পুরো লেখা এক লাইনে কত চওড়া (px) */
  naturalWidth: number;
  baseSize: number;
  minSize: number;
  /** লেখার জায়গার ভেতরের প্রস্থ ও উচ্চতা (px) */
  maxWidth: number;
  maxHeight: number;
  lineHeight?: number;
};

export type CaptionFit = {
  fontSize: number;
  /** আন্দাজ করা লাইন সংখ্যা (ছাঁটা না হলে) */
  lines: number;
  /** minSize-এও জায়গায় না আঁটলে true — তখন `maxLines` লাইনের বেশি "…" দিয়ে ছাঁটা */
  clipped: boolean;
  maxLines: number;
};

/**
 * সবচেয়ে বড় ফন্ট (১ px ধাপে, base → min) যাতে `লাইন × ফন্ট × lineHeight ≤ maxHeight`।
 * লাইন = ⌈প্রস্থ × (ফন্ট ÷ base) ÷ (maxWidth × LINE_FILL)⌉।
 */
export function fitCaption(input: CaptionFitInput): CaptionFit {
  const base = Math.max(1, finite(input.baseSize, 1));
  const min = Math.min(base, Math.max(1, finite(input.minSize, base)));
  const lh = finite(input.lineHeight, CAPTION_LINE_HEIGHT) > 0 ? finite(input.lineHeight, CAPTION_LINE_HEIGHT) : CAPTION_LINE_HEIGHT;
  const natural = finite(input.naturalWidth, 0);
  const width = finite(input.maxWidth, 0);
  const height = finite(input.maxHeight, 0);

  // মাপ অসম্ভব (০/NaN) → বেস সাইজ, এক লাইন
  if (!(natural > 0) || !(width > 0)) return { fontSize: base, lines: 1, clipped: false, maxLines: Math.max(1, Math.floor(height / (base * lh))) };

  const linesAt = (s: number) => Math.max(1, Math.ceil((natural * (s / base)) / (width * LINE_FILL)));
  for (let s = base; s >= min; s -= 1) {
    const lines = linesAt(s);
    if (lines * s * lh <= height) return { fontSize: s, lines, clipped: false, maxLines: lines };
  }
  const maxLines = Math.max(1, Math.floor(height / (min * lh)));
  return { fontSize: min, lines: linesAt(min), clipped: true, maxLines };
}
