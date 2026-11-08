import { Easing, interpolate } from "remotion";
import type { Infographic, InfographicType, TimestampFile } from "../types";
import { secondsToFrames, type Timing } from "./timing";

/**
 * ইনফোগ্রাফিক (ছোট ছোট পয়েন্ট/পিল): timestamp JSON-এর `infographics` → ফ্রেম-ভিত্তিক তালিকা (Intro অফসেটসহ) + অ্যানিমেশনের হিসাব + পিল-স্ট্রিপের মাপ।
 * পিওর ফাংশন (ব্রাউজার/React ছাড়া) — `Infographic.tsx` এগুলো ব্যবহার করে।
 * - Main-এর বাইরে গেলে ছেঁটে Main-এর ভেতরে আনা হয় (segment-এর মতোই)
 * - item-এর `at` না থাকলে সময় সমান ভাগ: প্রথম item ৬ ফ্রেম পরে, বাকিরা কার্ডের সময়ের প্রথম ৭৫%-এর মধ্যে
 */

/** কার্ড ঢোকা/বেরোনোর সর্বোচ্চ ফ্রেম (ছোট কার্ডে `⌊দৈর্ঘ্য ÷ 3⌋`) */
export const INFOGRAPHIC_FADE_FRAMES = 12;
/** এক item ফুটতে কত ফ্রেম */
export const INFOGRAPHIC_ITEM_FRAMES = 10;
/** প্রথম item কার্ড শুরুর কত ফ্রেম পরে (অটো সময়ে) */
const FIRST_ITEM_DELAY = 6;

export type FrameInfographicItem = {
  text: string;
  side?: "left" | "right";
  /** ভিডিওর শুরু থেকে মাপা ফ্রেম (Intro-র অফসেটসহ) */
  startFrame: number;
};

export type FrameInfographic = {
  index: number;
  startFrame: number;
  endFrame: number;
  type: InfographicType;
  title?: string;
  leftTitle?: string;
  rightTitle?: string;
  items: FrameInfographicItem[];
};

export function buildFrameInfographics(
  file: Pick<TimestampFile, "infographics">,
  timing: Timing,
): FrameInfographic[] {
  const list: Infographic[] = file.infographics ?? [];
  if (list.length === 0) return [];
  const { fps, introFrames, mainFrames } = timing;
  const mainEnd = introFrames + mainFrames;
  const clampFrame = (secs: number) =>
    Math.min(mainEnd, Math.max(introFrames, introFrames + secondsToFrames(secs, fps)));

  return list.map((g, index) => {
    const startFrame = Math.min(clampFrame(g.start), mainEnd - 1);
    const endFrame = Math.max(startFrame + 1, clampFrame(g.end));
    const n = g.items.length;
    const first = startFrame + Math.min(FIRST_ITEM_DELAY, Math.max(0, endFrame - startFrame - 1));
    const revealSpan = Math.max(0, Math.round((endFrame - first) * 0.75));
    const items: FrameInfographicItem[] = g.items.map((it, i) => {
      const auto = first + Math.round((revealSpan * i) / n);
      const f = typeof it.at === "number" ? clampFrame(it.at) : auto;
      return {
        text: it.text,
        side: it.side,
        startFrame: Math.min(Math.max(startFrame, f), endFrame - 1),
      };
    });
    return {
      index,
      startFrame,
      endFrame,
      type: g.type,
      title: g.title,
      leftTitle: g.leftTitle,
      rightTitle: g.rightTitle,
      items,
    };
  });
}

/** বর্তমান (পরম) ফ্রেমে কোন ইনফোগ্রাফিক চলছে (না থাকলে null) */
export function findActiveInfographic(list: FrameInfographic[], frame: number): FrameInfographic | null {
  for (const g of list) {
    if (frame >= g.startFrame && frame < g.endFrame) return g;
  }
  return null;
}

/** কার্ড ঢোকা/বেরোনোর ফ্রেম-সংখ্যা: `min(১২, ⌊দৈর্ঘ্য ÷ ৩⌋)` */
export function infographicFadeFrames(g: Pick<FrameInfographic, "startFrame" | "endFrame">): number {
  return Math.max(0, Math.min(INFOGRAPHIC_FADE_FRAMES, Math.floor((g.endFrame - g.startFrame) / 3)));
}

/** পুরো কার্ডের দৃশ্যমানতা ০–১ (শুরুতে ফোটে, শেষে মিলিয়ে যায়) */
export function infographicVisibility(g: FrameInfographic, frame: number): number {
  const fade = infographicFadeFrames(g);
  if (fade <= 0) return 1;
  const inP = interpolate(frame, [g.startFrame, g.startFrame + fade], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const outP = interpolate(frame, [g.endFrame - fade, g.endFrame], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  return Math.min(inP, outP);
}

/** এক item-এর ফোটার অগ্রগতি ০–১ */
export function infographicItemProgress(item: FrameInfographicItem, frame: number): number {
  return interpolate(frame, [item.startFrame, item.startFrame + INFOGRAPHIC_ITEM_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
}

/** বাংলা লেখার গড় অক্ষর-প্রস্থ (ফন্ট-সাইজের ভগ্নাংশ) — পিলের প্রস্থ আন্দাজে */
export const PILL_CHAR_EM = 0.55;

export type PillPart =
  | { kind: "pill"; item: number; text: string; w: number }
  | { kind: "arrow"; /** যে item-এর সাথে ফোটে (তীরের পরের পিল) */ item: number; w: number }
  | { kind: "divider"; w: number };

export type PillPlan = {
  /** পিলের উচ্চতা */
  pillH: number;
  fontSize: number;
  gap: number;
  padX: number;
  border: number;
  parts: PillPart[];
  /** সব অংশ মিলিয়ে মোট প্রস্থ (gap সহ) */
  totalW: number;
};

/**
 * পিল-স্ট্রিপের মাপ (পিওর): `W×H` বক্সে ২–৩টা ছোট পয়েন্ট এক সারিতে।
 *  - steps → পিল, তীর, পিল …;  list → পিল, ফোঁটা, পিল …;  compare → বাঁ-পিলগুলো, বিভাজক, ডান-পিলগুলো
 *  - ফন্ট `pillH × 0.46` থেকে শুরু; সারি বক্সের প্রস্থের চেয়ে লম্বা হলে ফন্ট কমে (সর্বনিম্ন `pillH × 0.26`)
 */
export function planInfographicPills(g: Pick<FrameInfographic, "type" | "items">, W: number, H: number): PillPlan {
  const pillH = Math.max(1, Math.min(H * 0.8, W * 0.1));
  const gap = pillH * 0.16;
  const padX = pillH * 0.3;
  const border = Math.max(2, pillH * 0.035);
  const joinW = pillH * 0.62; // তীর/ফোঁটা/বিভাজকের প্রস্থ

  // দেখানোর ক্রম: compare-এ আগে বাঁ, পরে ডান
  let order = g.items.map((_, i) => i);
  if (g.type === "compare") {
    const left = order.filter((i) => compareSideOf(g.items[i], i) === "left");
    const right = order.filter((i) => compareSideOf(g.items[i], i) === "right");
    order = [...left, ...right];
  }

  const chars = order.map((i) => Math.max(2, Array.from(g.items[i].text.trim()).length));
  const joins = Math.max(0, order.length - 1);
  const fixed = order.length * padX * 2 + joins * joinW + (order.length - 1 + joins) * gap;
  const sumChars = chars.reduce((a, b) => a + b, 0);
  const maxFont = pillH * 0.46;
  const minFont = pillH * 0.26;
  const fit = (W - fixed) / (sumChars * PILL_CHAR_EM);
  const fontSize = Math.max(minFont, Math.min(maxFont, fit));

  const parts: PillPart[] = [];
  order.forEach((i, k) => {
    if (k > 0) {
      // steps → তীর; list/compare → ছোট বিভাজক (compare-এ বাঁ/ডান দুই দলের মাঝে একই বিভাজক)
      parts.push(g.type === "steps" ? { kind: "arrow", item: i, w: joinW } : { kind: "divider", w: joinW });
    }
    parts.push({ kind: "pill", item: i, text: g.items[i].text, w: chars[k] * fontSize * PILL_CHAR_EM + padX * 2 });
  });
  const totalW = parts.reduce((a, p) => a + p.w, 0) + Math.max(0, parts.length - 1) * gap;
  return { pillH, fontSize, gap, padX, border, parts, totalW };
}

/** `compare`: item কোন পাশে যাবে (side না থাকলে একটা বাঁয়ে, একটা ডানে) */
export function compareSideOf(item: FrameInfographicItem, index: number): "left" | "right" {
  return item.side ?? (index % 2 === 0 ? "left" : "right");
}

/** পাশাপাশি দুই কার্ডের মাঝের ফাঁক এর চেয়ে ছোট (ফ্রেম) হলে লেআউট ছোটই থাকে — SVG বারবার লাফায় না */
export const INFOGRAPHIC_MERGE_GAP_FRAMES = 45;

/**
 * লেআউট কতটা "ইনফোগ্রাফিক-মোডে" (০ = স্বাভাবিক, ১ = SVG ছোট/ক্যাপশন ছোট)।
 * কাছাকাছি কার্ডগুলো (ফাঁক ≤ `INFOGRAPHIC_MERGE_GAP_FRAMES`) এক দল ধরা হয়; দলের শুরুতে মসৃণ ছোট হয়, শেষে মসৃণ বড় হয়।
 * কোনো কার্ড না থাকলে সবসময় ০ — তাই `infographics` ছাড়া ভিডিও আগের মতোই।
 */
export function infographicLayoutMix(list: FrameInfographic[], frame: number): number {
  if (list.length === 0) return 0;
  let gStart = list[0].startFrame;
  let gEnd = list[0].endFrame;
  const groups: Array<[number, number]> = [];
  for (let i = 1; i < list.length; i++) {
    const g = list[i];
    if (g.startFrame - gEnd <= INFOGRAPHIC_MERGE_GAP_FRAMES) {
      gEnd = Math.max(gEnd, g.endFrame);
    } else {
      groups.push([gStart, gEnd]);
      gStart = g.startFrame;
      gEnd = g.endFrame;
    }
  }
  groups.push([gStart, gEnd]);

  for (const [a, b] of groups) {
    if (frame < a || frame >= b) continue;
    const fade = Math.max(0, Math.min(INFOGRAPHIC_FADE_FRAMES, Math.floor((b - a) / 3)));
    if (fade <= 0) return 1;
    const inP = interpolate(frame, [a, a + fade], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    });
    const outP = interpolate(frame, [b - fade, b], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    });
    return Math.min(inP, outP);
  }
  return 0;
}
