import { Easing, interpolate } from "remotion";
import type { Infographic, InfographicType, TimestampFile } from "../types";
import { secondsToFrames, type Timing } from "./timing";

/**
 * ইনফোগ্রাফিক: timestamp JSON-এর `infographics` → ফ্রেম-ভিত্তিক তালিকা (Intro অফসেটসহ) + অ্যানিমেশনের হিসাব।
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

/** `compare`: item কোন পাশে যাবে (side না থাকলে একটা বাঁয়ে, একটা ডানে) */
export function compareSideOf(item: FrameInfographicItem, index: number): "left" | "right" {
  return item.side ?? (index % 2 === 0 ? "left" : "right");
}
