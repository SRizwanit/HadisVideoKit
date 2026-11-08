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
 *  ৩. ফন্ট আঁটানো (পুরোনো, এখন Caption.tsx ব্যবহার করে না — পরীক্ষার জন্য রাখা): বেস সাইজ থেকে নেমে, minSize-এর নিচে নয়।
 *  ৪. (ক্যাপশন-ফিক্স) পেজিং: লম্বা সেগমেন্ট শব্দ ধরে "পেজ"-এ ভাগ — প্রতি পেজে সর্বোচ্চ ২ লাইন, ফন্ট স্থির (বেস সাইজ)।
 *     পেজ বদলায় ঠিক সেই পেজের প্রথম শব্দ শুরু হওয়ার ফ্রেমে (পেজ ০ সেগমেন্টের শুরু থেকে); হাইলাইট আগের মতো শব্দ ধরে।
 *     লাইন ভাঙা হয় আগে মাপা শব্দ-প্রস্থ দিয়ে (greedy) — তাই DOM-এ লাইন ঠিক যা হিসাব হয়েছে তা-ই (বাড়তি লাইন আসে না)।
 *  ৫. (ক্যাপশন-ফিক্স) নিরাপদ মার্জিন: `clampBoxToSafe` বাক্সকে layout.safe-এর ভেতরে রাখে (এখনকার layout-এ বাক্স আগে থেকেই ভেতরে, তাই কিছু বদলায় না)।
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

// ---------- ৪. পেজিং: শব্দ ধরে, প্রতি পেজে সর্বোচ্চ ২ লাইন ----------

/** এক পেজে সর্বোচ্চ লাইন */
export const CAPTION_MAX_LINES = 2;
/** নতুন পেজের লেখা আসতে কত ফ্রেম (শুরুতে PAGE_FADE_FROM স্বচ্ছতা থেকে) */
export const PAGE_FADE_FRAMES = 6;
export const PAGE_FADE_FROM = 0.3;
/** অতি লম্বা একটা শব্দ বাক্সে আঁটাতে ফন্ট বেসের এর নিচে নামে না (তখনো না আঁটলে overflow = true) */
export const MIN_PAGE_SCALE = 0.3;

export type CaptionLine = { start: number; end: number };
export type CaptionPage = {
  /** সেগমেন্টের শব্দ-তালিকায় এই পেজের প্রথম শব্দ (সূচক) */
  start: number;
  /** শেষ শব্দের পরের সূচক (exclusive) */
  end: number;
  /** এই পেজের লাইনগুলো (≤ maxLines); প্রতিটা [start, end) */
  lines: CaptionLine[];
};
export type CaptionPaging = {
  /** বেস ফন্টের গুণক (১ = বেস সাইজ); ফন্ট = baseSize × scale */
  scale: number;
  pages: CaptionPage[];
  /** একটা শব্দই বাক্সের প্রস্থের চেয়ে চওড়া (scale-এর সর্বনিম্নেও) — তখন বাক্সে ছাঁটা পড়ে */
  overflow: boolean;
};

export type CaptionPagingInput = {
  /** প্রতিটা শব্দের প্রস্থ (px), **বেস ফন্টে** মাপা (inline-block + padding সহ) */
  wordWidths: readonly number[];
  /** দুই শব্দের মাঝের ফাঁক (px), বেস ফন্টে */
  spaceWidth: number;
  /** লেখার জায়গার ভেতরের প্রস্থ ও উচ্চতা (px) */
  maxWidth: number;
  maxHeight: number;
  baseSize: number;
  lineHeight?: number;
  maxLines?: number;
};

/**
 * শব্দগুলোকে পেজে ভাগ করে (greedy)। প্রতি পেজ সর্বোচ্চ `maxLines` (ডিফল্ট ২) লাইন।
 * - ফন্ট বেসেই থাকে; শুধু (ক) `maxLines` লাইন উচ্চতায় না আঁটলে, বা (খ) একটা শব্দই লাইনের চেয়ে চওড়া হলে সামান্য কমে।
 * - লাইনের ধারণক্ষমতা = maxWidth × LINE_FILL (pop-স্কেল/glow-এর জন্য ফাঁকা রাখা)।
 * - শেষ পেজে একটামাত্র শব্দ পড়ে থাকলে আগের পেজ থেকে শেষ শব্দটা নিয়ে আসা হয় (একলা শব্দের পেজ এড়াতে)।
 * - কখনো throw করে না; শব্দ না থাকলে `pages = []`।
 */
export function paginateCaption(rawInput: CaptionPagingInput): CaptionPaging {
  const input: Partial<CaptionPagingInput> = rawInput ?? {};
  const base = Math.max(1, finite(input.baseSize, 1));
  const lh = finite(input.lineHeight, CAPTION_LINE_HEIGHT) > 0 ? finite(input.lineHeight, CAPTION_LINE_HEIGHT) : CAPTION_LINE_HEIGHT;
  const maxLines = Math.max(1, Math.floor(finite(input.maxLines, CAPTION_MAX_LINES)));
  const width = Math.max(0, finite(input.maxWidth, 0));
  const height = finite(input.maxHeight, 0);
  const space = Math.max(0, finite(input.spaceWidth, 0));
  const widths = (Array.isArray(input.wordWidths) ? input.wordWidths : []).map((w) => Math.max(0, finite(w, 0)));
  const n = widths.length;
  if (n === 0) return { scale: 1, pages: [], overflow: false };

  // ফন্ট-গুণক: উচ্চতায় maxLines লাইন আঁটা চাই; আর সবচেয়ে চওড়া শব্দ এক লাইনে আঁটা চাই
  const widest = widths.reduce((m, w) => Math.max(m, w), 0);
  const capAtOne = width * LINE_FILL;
  const sHeight = height > 0 ? height / (maxLines * lh * base) : 1;
  const sWidth = widest > 0 && capAtOne > 0 ? capAtOne / widest : 1;
  let scale = Math.min(1, sHeight, Math.max(MIN_PAGE_SCALE, sWidth));
  if (!(scale > 0)) scale = MIN_PAGE_SCALE;
  const overflow = width > 0 ? widest * scale > width + 1e-6 : false;

  const cap = Math.max(1, capAtOne);
  const wAt = (i: number) => widths[i] * scale;
  const gap = space * scale;

  /** [from, limit) থেকে এক লাইন: যতগুলো শব্দ আঁটে (অন্তত ১টা) */
  const takeLine = (from: number, limit: number): CaptionLine => {
    let end = from + 1;
    let used = wAt(from);
    while (end < limit && used + gap + wAt(end) <= cap) {
      used += gap + wAt(end);
      end += 1;
    }
    return { start: from, end };
  };
  const layoutRange = (from: number, to: number): CaptionLine[] => {
    const lines: CaptionLine[] = [];
    let i = from;
    while (i < to) {
      const ln = takeLine(i, to);
      lines.push(ln);
      i = ln.end;
    }
    return lines;
  };

  const ranges: { start: number; end: number }[] = [];
  let i = 0;
  while (i < n) {
    const start = i;
    for (let k = 0; k < maxLines && i < n; k += 1) i = takeLine(i, n).end;
    ranges.push({ start, end: i });
  }

  // একলা শব্দের শেষ পেজ এড়ানো
  if (ranges.length > 1) {
    const last = ranges[ranges.length - 1];
    const prev = ranges[ranges.length - 2];
    if (last.end - last.start === 1 && prev.end - prev.start >= 3) {
      prev.end -= 1;
      last.start -= 1;
    }
  }

  const pages: CaptionPage[] = ranges.map((r) => {
    let lines = layoutRange(r.start, r.end);
    if (lines.length > maxLines) {
      // (প্রায় অসম্ভব) নিরাপত্তা: বাড়তি লাইন শেষ লাইনে জুড়ে দেওয়া — তবু ≤ maxLines
      const head = lines.slice(0, maxLines - 1);
      lines = [...head, { start: head.length ? head[head.length - 1].end : r.start, end: r.end }];
    }
    return { start: r.start, end: r.end, lines };
  });
  return { scale, pages, overflow };
}

/**
 * এই ফ্রেমে কোন পেজ দেখাবে: পেজ k (k ≥ ১) তার প্রথম শব্দের startFrame থেকে। পেজ ০ সেগমেন্টের শুরু থেকেই।
 * পেজ-তালিকা খালি → -১।
 */
export function pageIndexAt(pages: readonly CaptionPage[], words: readonly FrameWord[], frame: number): number {
  if (!Array.isArray(pages) || pages.length === 0) return -1;
  const f = finite(frame, NaN);
  let idx = 0;
  if (!Number.isFinite(f)) return idx;
  for (let k = 1; k < pages.length; k += 1) {
    const w = words[pages[k].start];
    if (w && f >= w.startFrame) idx = k;
  }
  return idx;
}

/** পেজের লেখার স্বচ্ছতা: পেজ ০ = ১ (বাক্সের নিজের enter দেখে); পরের পেজ শুরুতে PAGE_FADE_FROM → ১ */
export function pageTextOpacity(pageIndex: number, pageStartFrame: number, frame: number): number {
  if (pageIndex <= 0) return 1;
  const t = clamp01((finite(frame, 0) - finite(pageStartFrame, 0)) / PAGE_FADE_FRAMES);
  return PAGE_FADE_FROM + (1 - PAGE_FADE_FROM) * easeOutCubic(t);
}

// ---------- ৫. নিরাপদ মার্জিন ----------

export type RectLike = { x: number; y: number; width: number; height: number };

/** বাক্সকে canvas-এর নিরাপদ এলাকার (safe: top/bottom/left/right মার্জিন) ভেতরে আনে; ভেতরে থাকলে হুবহু একই মান। */
export function clampBoxToSafe(
  rawBox: RectLike,
  rawSafe: { top: number; bottom: number; left: number; right: number },
  rawCanvas: { width: number; height: number },
): RectLike {
  const box: Partial<RectLike> = rawBox ?? {};
  const safe: Partial<{ top: number; bottom: number; left: number; right: number }> = rawSafe ?? {};
  const canvas: Partial<{ width: number; height: number }> = rawCanvas ?? {};
  const minX = Math.max(0, finite(safe.left, 0));
  const maxX = Math.max(minX + 1, finite(canvas.width, 0) - Math.max(0, finite(safe.right, 0)));
  const minY = Math.max(0, finite(safe.top, 0));
  const maxY = Math.max(minY + 1, finite(canvas.height, 0) - Math.max(0, finite(safe.bottom, 0)));
  const x0 = Math.min(maxX - 1, Math.max(minX, finite(box.x, minX)));
  const y0 = Math.min(maxY - 1, Math.max(minY, finite(box.y, minY)));
  const x1 = Math.min(maxX, Math.max(x0 + 1, finite(box.x, minX) + finite(box.width, 1)));
  const y1 = Math.min(maxY, Math.max(y0 + 1, finite(box.y, minY) + finite(box.height, 1)));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}
