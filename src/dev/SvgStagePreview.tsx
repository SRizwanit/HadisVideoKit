import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, getRemotionEnvironment } from "remotion";
import { Background } from "../components/Background";
import { SvgStage } from "../components/SvgStage";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { computeNightFactor } from "../lib/dayNight";
import { loadTimestamp } from "../lib/loadHadis";
import { floatOffset, FLOAT_UNITS, stageGlow } from "../lib/svgStage";
import { crossFadeLooks } from "../lib/svgTransition";
import { computeTiming, type Timing } from "../lib/timing";
import { computeLayout } from "../lib/useLayout";
import { getThemeColors, skyGradient, type Palette } from "../themes";
import type { ThemeId } from "../types";
import { runStageCases, STAGE_CASE_COUNT } from "./svgStageCases";
import { runTransitionCases, TRANSITION_CASE_COUNT } from "./svgTransitionCases";

/**
 * Part 9K-4 (dev টুল): `SvgStage` যাচাইয়ের ছবি।
 *  - নিচে ১৪টা ঘর (আসল `Background` + আসল `SvgStage`, `frame`/`size` prop দিয়ে স্থির মুহূর্ত):
 *      Portrait ৬টা (emerald ৩ সেগমেন্টে, navy, greenDayNight উজ্জ্বল দিন ও রাত),
 *      Landscape ৪টা (emerald ২, greenDayNight দিন ও রাত),
 *      বাড়তি ৪টা: **গ্যাপ** (আগেরটা থাকে), **শেষ সেগমেন্টের পরে** (শেষটা থাকে), **Intro** ও **Outro** (কিছু আঁকা হয় না)।
 *    প্রতিটা ঘরে বক্স আঁকা (হেডার হলুদ, SVG আকাশি, ক্যাপশন গোলাপি — ফিকে) আর উপরে লেবেল + ✅/❌।
 *  - উপরে ৮টা স্বয়ংক্রিয় ✅/❌ সারি — **ছবি আঁকা শেষ হওয়ার পর DOM পড়ে** (`data-svg`, `data-segment`, `data-float`,
 *    `data-stage-glow`, `data-stage-disc`): ঠিক SVG, গ্যাপ/শেষের নিয়ম, Main-এর বাইরে কিছু নয়, বাক্স = `svgBox`, ভাসা, glow/ডিস্ক,
 *    দিন-রাতের স্বচ্ছতা, Portrait মাঝে / Landscape নিচে-বাঁয়ে।
 *  - সবার নিচে 9K-1-এর ২৪টা বিশুদ্ধ কেস (`runStageCases()`) সারি হিসেবে।
 *  - মাথায় "সব ✅ · n/total" (১৪ + ২৪ = ৩৮)।
 * Part 9K-5 (যোগ): ৬টা নতুন স্বয়ংক্রিয় সারি (৯–১৪) + দুটো নতুন ঘর-অংশ (১৪ ঘরের পরে, 9K-1-এর কেস-সারির আগে):
 *    ▸ **খালি ফোল্ডার** — ৩টা ঘরে `SvgStage`-এ `inventory={{ names: [], ready: true }}` (আপনার ফাইল না মুছেই N = 0): fallback আইকন + glow,
 *      আর গোটা পাতায় ঠিক **একটা** "কোনো SVG পাওয়া যায়নি" সতর্কতা (console.warn ধরে গোনা)।
 *    ▸ **৪ সাইজ** — ১০৮০×১৯২০, ১৯২০×১০৮০, ২১৬০×৩৮৪০, ৩৮৪০×২১৬০ (ছোট করে আঁকা আসল ঘর) + হিসাবের সারি: SVG-বাক্স (ভাসা-সহ) কম্পোজিশনের ভেতরে ও
 *      হেডার/ক্যাপশন বক্স থেকে আলাদা, 4K = ঠিক ২× HD, glow-এর নাগাল (`0.28 × size` বাক্সের বাইরে) স্পষ্ট লেখা।
 * Part 9L (যোগ): ৬টা নতুন স্বয়ংক্রিয় সারি (১৫–২০) + ৮টা cross-fade ঘর (১৪ ঘরের পর, খালি-ফোল্ডার/৪-সাইজ অংশের পরে) + `svgTransition.ts`-এর ১৩ বিশুদ্ধ কেস (সবার নিচে):
 *    মাঝামাঝি (ফ্রেম 156, দুই স্তর আধা-স্বচ্ছ; Portrait + Landscape, emerald + greenDayNight), শুরুর কাছে (151), শেষ (162, পরিষ্কার ১ স্তর),
 *    পাশাপাশি একই SVG (`hadis0000same`, ফ্রেম 153 → স্থানীয় ফ্রেম 63, transition নেই), ছোট সেগমেন্ট (ফ্রেম 212 → transition 4 ফ্রেম)।
 *    ⚠️ 9K-4-এর p2/p3/p4/l2 ঘরের ফ্রেম transition-জানালার বাইরে সরানো (160→175, 215→230) — নইলে সেগমেন্ট শুরুর ১২ ফ্রেমের মধ্যে পড়ে দুই স্তর আঁকা হতো।
 * নমুনা ডেটা: `hadis0000` (৩ সেগমেন্ট, ৬ সেকেন্ড; Intro ৩ সেকেন্ড, Outro ৪ সেকেন্ড ধরা) এবং গ্যাপ-নমুনা `hadis0000gap_timestamp.json`
 * (শুধু JSON — `SvgStage` .wav পড়ে না)। কোনো একটা না থাকলে `calculateMetadata` `[HADIS_DATA]` এরর দেয়, `check.mjs` কম্পোজিশনটা ⚠️ বাদ দেয়, রান সবুজ থাকে।
 * `npm run check` এটাকে নিজে ধরে `out/check-SvgStagePreview.png` বানায়।
 */

// ---------- নমুনা ডেটা ও টাইমিং ----------

const MAIN_ID = "0000";
const GAP_ID = "0000gap";
/** Part 9L: `hadis0000same` — seg 1–2 দুটোতেই `svg1` (পাশাপাশি একই SVG), seg 3 ছোট (0.4 s = 12 ফ্রেম) `svg2` */
const SAME_ID = "0000same";

/** `hadis0000`: Intro ৩ সেকেন্ড (৯০ ফ্রেম), Main ৬ সেকেন্ড (১৮০), Outro ৪ সেকেন্ড (১২০) */
const TIMING_MAIN: Timing = computeTiming({ introSeconds: 3, outroSeconds: 4, audioSeconds: 6 });
/** `hadis0000gap`: Main ৪ সেকেন্ড (১২০ ফ্রেম); সেগমেন্ট ০–১.৫ s, গ্যাপ, ২–৩.৫ s, তারপর ০.৫ s খালি */
const TIMING_GAP: Timing = computeTiming({ introSeconds: 3, outroSeconds: 4, audioSeconds: 4 });

/** `hadis0000same`: Main 4.4 সেকেন্ড (132 ফ্রেম); সেগমেন্ট 90–150, 150–210, 210–222 (ছোট) */
const TIMING_SAME: Timing = computeTiming({ introSeconds: 3, outroSeconds: 4, audioSeconds: 4.4 });

const TIMING_OF: Record<string, Timing> = { [MAIN_ID]: TIMING_MAIN, [GAP_ID]: TIMING_GAP, [SAME_ID]: TIMING_SAME };

/** Root.tsx-এর `calculateMetadata` এটা ডাকে: দুই নমুনা-JSON না থাকলে `[HADIS_DATA]` এরর → check.mjs কম্পোজিশনটা বাদ দেয় (⚠️) */
export async function ensureStagePreviewData(): Promise<void> {
  await Promise.all([loadTimestamp(MAIN_ID), loadTimestamp(GAP_ID), loadTimestamp(SAME_ID)]);
}

// ---------- ঘরের তালিকা ----------

type CellDef = {
  key: string;
  /** ঘরের উপরের লেবেল (ছোট) */
  label: string;
  hadisId: string;
  theme: ThemeId;
  /** ভিডিওর পরম ফ্রেম (Intro-সহ) */
  frame: number;
  landscape: boolean;
  /** `null` → কিছু আঁকা হওয়ার কথা নয় (Main-এর বাইরে) */
  expectSvg: string | null;
  /** প্রত্যাশিত সেগমেন্ট (array-এর অবস্থান, ০ থেকে); `null` হলে দেখা হয় না */
  expectSegment: number | null;
  /** সংক্ষেপে কেন এই SVG */
  why: string;
  /** Part 9K-5: Landscape/Portrait-এর ডিফল্ট সাইজ না চাইলে নিজের কম্পোজিশন-সাইজ (px) */
  fullW?: number;
  fullH?: number;
  /** Part 9K-5: `true` হলে `SvgStage` পায় `inventory={{ names: [], ready: true }}` (খালি ফোল্ডার, N = 0) */
  emptyFolder?: boolean;
  /** Part 9L: cross-fade ঘরের প্রত্যাশা (`expectSvg` = নতুন/সক্রিয় স্তরের নাম) */
  fade?: {
    layers: 1 | 2;
    /** পুরনো স্তরের নাম (layers = 2 হলে) */
    out?: string;
    /** প্রত্যাশিত `data-transition` (০…১) */
    progress: number;
    /** প্রত্যাশিত `data-transition-frames` */
    frames: number;
    /** প্রত্যাশিত নতুন স্তরের স্থানীয় ফ্রেম (`data-local`) — দিলে মেলানো হয় */
    local?: number;
  };
};

/**
 * ⚠️ প্রত্যাশা নমুনা-ডেটা থেকে হাতে লেখা: সেগমেন্ট ১ লেখা `svg1`; সেগমেন্ট ২ কিছু লেখা নেই → ঘূর্ণনে `svg1` = আগেরটা, তাই `svg2`;
 * সেগমেন্ট ৩ লেখা `svg2`। (`public/svg/`-এ `svg1`, `svg2` আছে ধরে — নমুনা ফাইলগুলো; আরও SVG যোগ করলেও এই ফল বদলায় না।)
 */
const CELLS: CellDef[] = [
  { key: "p1", label: "emerald · ফ্রেম 100", hadisId: MAIN_ID, theme: "emerald", frame: 100, landscape: false, expectSvg: "svg1", expectSegment: 0, why: "সেগমেন্ট ১ (লেখা svg1)" },
  { key: "p2", label: "emerald · ফ্রেম 175", hadisId: MAIN_ID, theme: "emerald", frame: 175, landscape: false, expectSvg: "svg2", expectSegment: 1, why: "সেগমেন্ট ২ (ঘূর্ণন → svg2)" },
  { key: "p3", label: "emerald · ফ্রেম 230", hadisId: MAIN_ID, theme: "emerald", frame: 230, landscape: false, expectSvg: "svg2", expectSegment: 2, why: "সেগমেন্ট ৩ (লেখা svg2)" },
  { key: "p4", label: "navy · ফ্রেম 175", hadisId: MAIN_ID, theme: "navy", frame: 175, landscape: false, expectSvg: "svg2", expectSegment: 1, why: "সেগমেন্ট ২ (গাঢ় নীল আকাশ)" },
  { key: "p5", label: "greenDayNight · ফ্রেম 100", hadisId: MAIN_ID, theme: "greenDayNight", frame: 100, landscape: false, expectSvg: "svg1", expectSegment: 0, why: "উজ্জ্বল সকাল (হালকা আকাশ)" },
  { key: "p6", label: "greenDayNight · ফ্রেম 260", hadisId: MAIN_ID, theme: "greenDayNight", frame: 260, landscape: false, expectSvg: "svg2", expectSegment: 2, why: "রাত (গাঢ় আকাশ)" },
  { key: "l1", label: "emerald · Landscape · ফ্রেম 100", hadisId: MAIN_ID, theme: "emerald", frame: 100, landscape: true, expectSvg: "svg1", expectSegment: 0, why: "সেগমেন্ট ১" },
  { key: "l2", label: "emerald · Landscape · ফ্রেম 230", hadisId: MAIN_ID, theme: "emerald", frame: 230, landscape: true, expectSvg: "svg2", expectSegment: 2, why: "সেগমেন্ট ৩" },
  { key: "l3", label: "greenDayNight · Landscape · দিন (100)", hadisId: MAIN_ID, theme: "greenDayNight", frame: 100, landscape: true, expectSvg: "svg1", expectSegment: 0, why: "উজ্জ্বল সকাল" },
  { key: "l4", label: "greenDayNight · Landscape · রাত (260)", hadisId: MAIN_ID, theme: "greenDayNight", frame: 260, landscape: true, expectSvg: "svg2", expectSegment: 2, why: "রাত" },
  { key: "e1", label: "গ্যাপ · ফ্রেম 142", hadisId: GAP_ID, theme: "greenDayNight", frame: 142, landscape: false, expectSvg: "svg1", expectSegment: 0, why: "গ্যাপে আগেরটা (svg1) থাকে" },
  { key: "e2", label: "শেষের পরে · ফ্রেম 202", hadisId: GAP_ID, theme: "greenDayNight", frame: 202, landscape: false, expectSvg: "svg2", expectSegment: 1, why: "শেষ সেগমেন্টের পরে শেষটা (svg2)" },
  { key: "e3", label: "Intro · ফ্রেম 45", hadisId: MAIN_ID, theme: "emerald", frame: 45, landscape: false, expectSvg: null, expectSegment: null, why: "Intro-তে কিছু নয়" },
  { key: "e4", label: "Outro · ফ্রেম 280", hadisId: MAIN_ID, theme: "emerald", frame: 280, landscape: false, expectSvg: null, expectSegment: null, why: "Outro-তে কিছু নয়" },
  // Part 9K-5: খালি ফোল্ডার (N = 0) — `SvgStage`-এ inventory = { names: [], ready: true }; সেগমেন্ট ১-এ `svg1` লেখা থাকলেও ফোল্ডার খালি → fallback
  { key: "z1", label: "খালি ফোল্ডার · emerald · 100", hadisId: MAIN_ID, theme: "emerald", frame: 100, landscape: false, expectSvg: "fallback", expectSegment: 0, why: "N = 0 → fallback (লেখা svg1-ও নেই)", emptyFolder: true },
  { key: "z2", label: "খালি · greenDayNight · দিন 100", hadisId: MAIN_ID, theme: "greenDayNight", frame: 100, landscape: false, expectSvg: "fallback", expectSegment: 0, why: "উজ্জ্বল সকালেও আইকন স্পষ্ট", emptyFolder: true },
  { key: "z3", label: "খালি · greenDayNight · রাত 260", hadisId: MAIN_ID, theme: "greenDayNight", frame: 260, landscape: false, expectSvg: "fallback", expectSegment: 2, why: "রাতের গাঢ় আকাশেও আইকন স্পষ্ট", emptyFolder: true },
  // Part 9K-5: ৪ আউটপুট সাইজ (আসল ঘর, ছোট করে আঁকা); আসল ইনভেন্টরি (svg1/svg2), সেগমেন্ট ১ → svg1
  { key: "s1", label: "1080×1920 · emerald", hadisId: MAIN_ID, theme: "emerald", frame: 100, landscape: false, expectSvg: "svg1", expectSegment: 0, why: "Portrait HD", fullW: 1080, fullH: 1920 },
  { key: "s2", label: "1920×1080 · emerald", hadisId: MAIN_ID, theme: "emerald", frame: 100, landscape: true, expectSvg: "svg1", expectSegment: 0, why: "Landscape HD", fullW: 1920, fullH: 1080 },
  { key: "s3", label: "2160×3840 · emerald", hadisId: MAIN_ID, theme: "emerald", frame: 100, landscape: false, expectSvg: "svg1", expectSegment: 0, why: "Portrait 4K", fullW: 2160, fullH: 3840 },
  { key: "s4", label: "3840×2160 · emerald", hadisId: MAIN_ID, theme: "emerald", frame: 100, landscape: true, expectSvg: "svg1", expectSegment: 0, why: "Landscape 4K", fullW: 3840, fullH: 2160 },
  // Part 9L: cross-fade (সেগমেন্ট ২ শুরু ফ্রেম 150, TRANSITION_FRAMES = 12 → মাঝামাঝি ফ্রেম 156)
  { key: "t1", label: "cross-fade মাঝে · emerald · 156", hadisId: MAIN_ID, theme: "emerald", frame: 156, landscape: false, expectSvg: "svg2", expectSegment: 1, why: "পুরনো svg1 ↘ নতুন svg2, ০.৫", fade: { layers: 2, out: "svg1", progress: 0.5, frames: 12 } },
  { key: "t2", label: "cross-fade মাঝে · greenDayNight · 156", hadisId: MAIN_ID, theme: "greenDayNight", frame: 156, landscape: false, expectSvg: "svg2", expectSegment: 1, why: "হালকা আকাশে দুই আধা-স্বচ্ছ স্তর", fade: { layers: 2, out: "svg1", progress: 0.5, frames: 12 } },
  { key: "t3", label: "cross-fade শুরুর কাছে · emerald · 151", hadisId: MAIN_ID, theme: "emerald", frame: 151, landscape: false, expectSvg: "svg2", expectSegment: 1, why: "১/১২: পুরনোটা বেশি স্পষ্ট", fade: { layers: 2, out: "svg1", progress: 1 / 12, frames: 12 } },
  { key: "u1", label: "cross-fade মাঝে · emerald · Landscape · 156", hadisId: MAIN_ID, theme: "emerald", frame: 156, landscape: true, expectSvg: "svg2", expectSegment: 1, why: "Landscape মাঝামাঝি", fade: { layers: 2, out: "svg1", progress: 0.5, frames: 12 } },
  { key: "u2", label: "cross-fade মাঝে · greenDayNight · Landscape · 156", hadisId: MAIN_ID, theme: "greenDayNight", frame: 156, landscape: true, expectSvg: "svg2", expectSegment: 1, why: "Landscape, হালকা আকাশ", fade: { layers: 2, out: "svg1", progress: 0.5, frames: 12 } },
  { key: "v1", label: "একই SVG পাশাপাশি · ফ্রেম 153 (0000same)", hadisId: SAME_ID, theme: "emerald", frame: 153, landscape: false, expectSvg: "svg1", expectSegment: 1, why: "transition নেই, ফ্রেম 63 (run শুরু 90 থেকে), আবার শুরু নয়", fade: { layers: 1, progress: 0, frames: 0, local: 63 } },
  { key: "v2", label: "ছোট সেগমেন্ট · ফ্রেম 212 (0000same)", hadisId: SAME_ID, theme: "emerald", frame: 212, landscape: false, expectSvg: "svg2", expectSegment: 2, why: "12 ফ্রেমের সেগমেন্ট → transition 4 ফ্রেম, ০.৫", fade: { layers: 2, out: "svg1", progress: 0.5, frames: 4 } },
  { key: "v3", label: "transition শেষ · emerald · 162", hadisId: MAIN_ID, theme: "emerald", frame: 162, landscape: false, expectSvg: "svg2", expectSegment: 1, why: "১ স্তর, পরিষ্কার (ঝাপসা/ফেড নেই), ফ্রেম 12", fade: { layers: 1, progress: 0, frames: 12, local: 12 } },
];

/** Part 9K-5: যাচাইয়ের চার আউটপুট সাইজ (px) */
const SIZES: { w: number; h: number }[] = [
  { w: 1080, h: 1920 },
  { w: 1920, h: 1080 },
  { w: 2160, h: 3840 },
  { w: 3840, h: 2160 },
];

// ---------- মাপ ও অবস্থান ----------

const PAD = 36;
const GAP = 12;
const HEAD_H = 84;
const SEC_H = 46;
const ROW_H = 62;
const ROW_PITCH = 70;
const N_AUTO = 20;
const CONTENT_W = 1080 - PAD * 2; // 1008

const PW = 328;
const PH = Math.round((PW * 1920) / 1080);
const LW = 498;
const LH = Math.round((LW * 1080) / 1920);
const EW = 243;
const EH = Math.round((EW * 1920) / 1080);

const CELLS_H = 2 * (PH + GAP) + 2 * (LH + GAP) + EH;
/** Part 9K-5: খালি-ফোল্ডার অংশ = ৩টা Portrait ঘর এক সারিতে */
const EMPTY_H = PH;
/** Part 9K-5: ৪-সাইজ অংশ = ৪টা ঘর এক সারিতে (Portrait ঘরের উচ্চতা EH, Landscape ঘর আরও ছোট) */
const SIZES_H = EH;
/** Part 9L: cross-fade অংশ = ৩ Portrait (t1–t3) + ২ Landscape (u1–u2) + ৩ Portrait (v1–v3), তিন সারি */
const FADE_H = PH + GAP + (LH + GAP) + PH;

/** ছবির উচ্চতা (Root.tsx এটা পড়ে): মাথা + ২০ স্বয়ংক্রিয় সারি + ১৪ ঘর + ৩ খালি-ফোল্ডার ঘর + ৪ সাইজ-ঘর + ৮ cross-fade ঘর + ২৪ ও ১৩ কেস-সারি */
export const SVG_STAGE_PREVIEW_HEIGHT =
  PAD * 2 +
  HEAD_H +
  (SEC_H + N_AUTO * ROW_PITCH) +
  (SEC_H + CELLS_H) +
  (SEC_H + EMPTY_H) +
  (SEC_H + SIZES_H) +
  (SEC_H + FADE_H) +
  (SEC_H + STAGE_CASE_COUNT * ROW_PITCH) +
  (SEC_H + TRANSITION_CASE_COUNT * ROW_PITCH) +
  30;

type Placed = {
  def: CellDef;
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  fullW: number;
  fullH: number;
  /** কোন অংশে আঁকা হয় */
  group: "main" | "empty" | "sizes" | "fade";
};

const fullSizeOf = (def: CellDef): { fullW: number; fullH: number } => ({
  fullW: def.fullW ?? (def.landscape ? 1920 : 1080),
  fullH: def.fullH ?? (def.landscape ? 1080 : 1920),
});

/** ঘরগুলোর অবস্থান (নিজ নিজ অংশের এলাকার ভেতরে, উপর-বাম থেকে)। ক্রম = `CELLS`-এর ক্রম (`index` = CELLS-এর অবস্থান) */
function placeCells(): Placed[] {
  const out: Placed[] = [];
  let y = 0;
  const put = (defs: CellDef[], w: number, h: number, perRow: number, group: Placed["group"]) => {
    defs.forEach((def, k) => {
      const col = k % perRow;
      const row = Math.floor(k / perRow);
      const { fullW, fullH } = fullSizeOf(def);
      out.push({
        def,
        index: CELLS.indexOf(def),
        x: col * (w + GAP),
        y: y + row * (h + GAP),
        w,
        // সাইজ-অংশে প্রতিটা ঘরের উচ্চতা তার নিজের অনুপাত থেকে (চওড়া একই)
        h: group === "sizes" || group === "fade" ? Math.round((w * fullH) / fullW) : h,
        fullW,
        fullH,
        group,
      });
    });
    y += Math.ceil(defs.length / perRow) * (h + GAP);
  };
  const byKey = (c: string) => CELLS.filter((d) => d.key.startsWith(c));
  put(byKey("p"), PW, PH, 3, "main");
  put(byKey("l"), LW, LH, 2, "main");
  put(byKey("e"), EW, EH, 4, "main");
  y = 0;
  put(byKey("z"), PW, PH, 3, "empty");
  y = 0;
  put(byKey("s"), EW, EH, 4, "sizes");
  y = 0;
  put(byKey("t"), PW, PH, 3, "fade");
  put(byKey("u"), LW, LH, 2, "fade");
  put(byKey("v"), PW, PH, 3, "fade");
  // CELLS-এর ক্রমে সাজানো (p, l, e, z, s — CELLS-ও এই ক্রমে লেখা)
  return out.sort((a, b) => a.index - b.index);
}

const PLACED = placeCells();
const PLACED_MAIN = PLACED.filter((p) => p.group === "main");
const PLACED_EMPTY = PLACED.filter((p) => p.group === "empty");
const PLACED_SIZES = PLACED.filter((p) => p.group === "sizes");
const PLACED_FADE = PLACED.filter((p) => p.group === "fade");

// ---------- DOM থেকে পড়া ----------

type CellInfo = {
  drawn: boolean;
  svg: string | null;
  segment: number | null;
  /** `data-float` (px) */
  float: number | null;
  /** SVG-বাক্সের wrapper — ঘরের লেআউট-px (স্কেলের আগে) */
  box: { x: number; y: number; w: number; h: number } | null;
  /** ভেতরের <svg> কতটা চওড়া (লেআউট-px; স্কেল ফিরিয়ে) */
  svgW: number | null;
  glow: { w: number; alpha: number | null } | null;
  disc: { w: number; alpha: number | null } | null;
  /** glow → ডিস্ক → ভাসা-স্তর এই ক্রমে DOM-এ (অর্থাৎ glow/ডিস্ক পেছনে) */
  order: boolean;
  overflowVisible: boolean;
  /** Part 9L: stage-এর `data-transition` / `data-transition-frames` / `data-local` */
  transition: number | null;
  tFrames: number | null;
  local: number | null;
  /** Part 9L: প্রতিটা `[data-stage-layer]` (DOM ক্রমে: পুরনো আগে, নতুন পরে) */
  layers: LayerInfo[];
  /** glow/ডিস্কের computed opacity (ফেড হওয়ার কথা নয় → 1) */
  glowOpacity: number | null;
  discOpacity: number | null;
};

type LayerInfo = {
  kind: string;
  name: string;
  prefix: string;
  opacity: number | null;
  scale: number | null;
  blur: number | null;
  cOpacity: number;
  filter: string;
  transform: string;
  /** স্তরটা ভাসা-wrapper-এর (stage-এর শেষ সন্তান) সরাসরি ভেতরে */
  inFloat: boolean;
};

const EMPTY_INFO: CellInfo = {
  drawn: false,
  svg: null,
  segment: null,
  float: null,
  box: null,
  svgW: null,
  glow: null,
  disc: null,
  order: false,
  overflowVisible: false,
  transition: null,
  tFrames: null,
  local: null,
  layers: [],
  glowOpacity: null,
  discOpacity: null,
};

const alphaOf = (css: string): number | null => {
  const m = /rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/.exec(css);
  return m ? Number(m[1]) : null;
};

function readCell(root: HTMLElement, scale: number): CellInfo {
  const stage = root.querySelector<HTMLElement>("[data-svg-stage]");
  if (!stage) return EMPTY_INFO;
  const glowEl = stage.querySelector<HTMLElement>("[data-stage-glow]");
  const discEl = stage.querySelector<HTMLElement>("[data-stage-disc]");
  const floatEl = stage.lastElementChild;
  const svgEl = stage.querySelector("svg");
  const follows = (a: Node | null, b: Node | null) =>
    a !== null && b !== null && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  const num = (v: string | null) => (v === null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
  return {
    drawn: true,
    svg: stage.getAttribute("data-svg"),
    segment: num(stage.getAttribute("data-segment")),
    float: num(stage.getAttribute("data-float")),
    box: { x: stage.offsetLeft, y: stage.offsetTop, w: stage.offsetWidth, h: stage.offsetHeight },
    svgW: svgEl ? svgEl.getBoundingClientRect().width / scale : null,
    glow: glowEl ? { w: glowEl.offsetWidth, alpha: alphaOf(getComputedStyle(glowEl).backgroundImage) } : null,
    disc: discEl ? { w: discEl.offsetWidth, alpha: alphaOf(getComputedStyle(discEl).backgroundColor) } : null,
    order: follows(glowEl, discEl) && follows(discEl, floatEl),
    overflowVisible: getComputedStyle(stage).overflow === "visible",
    transition: num(stage.getAttribute("data-transition")),
    tFrames: num(stage.getAttribute("data-transition-frames")),
    local: num(stage.getAttribute("data-local")),
    layers: Array.from(stage.querySelectorAll<HTMLElement>("[data-stage-layer]")).map((el) => {
      const cs = getComputedStyle(el);
      return {
        kind: el.getAttribute("data-stage-layer") ?? "",
        name: el.getAttribute("data-name") ?? "",
        prefix: el.getAttribute("data-prefix") ?? "",
        opacity: num(el.getAttribute("data-opacity")),
        scale: num(el.getAttribute("data-scale")),
        blur: num(el.getAttribute("data-blur")),
        cOpacity: Number(cs.opacity),
        filter: cs.filter,
        transform: cs.transform,
        inFloat: el.parentElement === floatEl,
      };
    }),
    glowOpacity: glowEl ? Number(getComputedStyle(glowEl).opacity) : null,
    discOpacity: discEl ? Number(getComputedStyle(discEl).opacity) : null,
  };
}

/**
 * ঘরগুলো আঁকা শেষ হওয়া পর্যন্ত অপেক্ষা (প্রতি ৬০ms দেখে), তারপর DOM পড়ে।
 *  - যে ঘরে SVG আঁকার কথা, তাতে `[data-svg-stage]` ও ভেতরে `<svg>` আসা চাই।
 *  - "কিছু আঁকার কথা নয়" ঘরগুলো (Intro/Outro) তাড়াতাড়ি পড়লে ভুল ✅ আসতে পারত (স্টেজ তখনো লোড হচ্ছে) — তাই বাকি সব ঘর তৈরি হওয়ার পর
 *    আরও ৪০০ms অপেক্ষা করে তবেই পড়ে।
 *  - নিজের `delayRender` ধরে, পড়া commit হওয়ার পরে ছাড়ে; ২০ সেকেন্ডে না হলে যা আছে তা-ই পড়ে (তখন সারিগুলো ❌ দেখাবে) — আটকে থাকে না।
 */
function useCellInfos(refs: React.RefObject<(HTMLDivElement | null)[]>): CellInfo[] | null {
  const [infos, setInfos] = useState<CellInfo[] | null>(null);
  const [handle] = useState(() => delayRender("SvgStagePreview: ঘরগুলো আঁকা হচ্ছে"));
  const released = useRef(false);

  useEffect(() => {
    let alive = true;
    const started = Date.now();
    let readyAt: number | null = null;

    const drawable = (p: Placed) => p.def.expectSvg !== null;
    const isReady = (p: Placed): boolean => {
      const el = refs.current[p.index];
      if (!el) return false;
      if (!drawable(p)) return true;
      const want = p.def.fade?.layers ?? 1;
      return el.querySelector("[data-svg-stage]") !== null && el.querySelectorAll("[data-svg-stage] svg").length >= want;
    };

    const finish = () => {
      if (!alive) return;
      setInfos(
        PLACED.map((p) => {
          const el = refs.current[p.index];
          return el ? readCell(el, p.w / p.fullW) : EMPTY_INFO;
        }),
      );
    };

    const timer = window.setInterval(() => {
      if (!alive) return;
      const now = Date.now();
      if (now - started > 20000) {
        window.clearInterval(timer);
        finish();
        return;
      }
      if (PLACED.every(isReady)) {
        if (readyAt === null) readyAt = now;
        if (now - readyAt >= 400) {
          window.clearInterval(timer);
          finish();
        }
      } else {
        readyAt = null;
      }
    }, 60);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [refs]);

  useLayoutEffect(() => {
    if (infos !== null && !released.current) {
      released.current = true;
      continueRender(handle);
    }
  }, [infos, handle]);

  return infos;
}

// ---------- console.warn গোনা (Part 9K-5) ----------

/**
 * "খালি ফোল্ডারে ঠিক একটা সতর্কতা" যাচাইয়ের জন্য এই পাতার `console.warn` ডাকগুলো জমানো হয় (আসল `console.warn`-ও আগের মতো চলে)।
 * কম্পোনেন্টের প্রথম রেন্ডারে (ঘরগুলো আঁকার আগে) শুরু, আনমাউন্টে ফেরত। একই সময়ে একটাই capture (দুবার ডাকলেও একই)।
 */
type WarnCapture = { messages: string[] };
let activeCapture: { capture: WarnCapture; original: typeof console.warn } | null = null;

function startWarnCapture(): WarnCapture {
  if (activeCapture) return activeCapture.capture;
  const original = console.warn;
  const capture: WarnCapture = { messages: [] };
  console.warn = (...args: unknown[]) => {
    try {
      capture.messages.push(args.map((a) => (typeof a === "string" ? a : String(a))).join(" "));
    } catch {
      // জমানো ব্যর্থ হলেও আসল warn চলবে
    }
    original.apply(console, args as []);
  };
  activeCapture = { capture, original };
  return capture;
}

function stopWarnCapture(): void {
  if (!activeCapture) return;
  console.warn = activeCapture.original;
  activeCapture = null;
}

/** খালি ফোল্ডার (N = 0) — `SvgStage`-এর `inventory` override; একই অবজেক্ট (প্রতি রেন্ডারে নতুন নয়) */
const EMPTY_INVENTORY = { names: [] as readonly string[], ready: true } as const;

// ---------- স্বয়ংক্রিয় সারি ----------

type Row = { title: string; ok: boolean; note: string };

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

type CellEval = { name: boolean; box: boolean; float: boolean; glow: boolean; pos: boolean; fade: boolean };

/** Part 9L: cross-fade ঘরের প্রত্যাশা (stage-এর data-* ও স্তরগুলো থেকে); `fade` না থাকা ঘরে সবসময় ✓ */
function evalFade(def: CellDef, info: CellInfo, unit: number): { ok: boolean; why: string[] } {
  const f = def.fade;
  if (!f) return { ok: true, why: [] };
  const why: string[] = [];
  if (info.layers.length !== f.layers) why.push(`স্তর ${info.layers.length} (চাই ${f.layers})`);
  const inL = info.layers.find((l) => l.kind === "in");
  const outL = info.layers.find((l) => l.kind === "out");
  if (!inL || inL.name !== def.expectSvg) why.push(`নতুন স্তর ${inL?.name ?? "নেই"} (চাই ${def.expectSvg})`);
  if (f.layers === 2) {
    if (!outL || outL.name !== f.out) why.push(`পুরনো স্তর ${outL?.name ?? "নেই"} (চাই ${f.out})`);
    if (inL && outL && inL.prefix === outL.prefix) why.push("দুই স্তরের prefix এক");
  } else if (outL) why.push("পুরনো স্তর আছে (চাই নেই)");
  if (info.transition === null || !near(info.transition, f.progress, 0.002)) why.push(`progress ${info.transition} (চাই ${f.progress.toFixed(3)})`);
  if (info.tFrames !== f.frames) why.push(`transition-ফ্রেম ${info.tFrames} (চাই ${f.frames})`);
  if (f.local !== undefined && info.local !== f.local) why.push(`স্থানীয় ফ্রেম ${info.local} (চাই ${f.local})`);
  const looks = crossFadeLooks(f.progress, unit);
  if (f.layers === 2 && inL && outL) {
    const chk = (tag: string, l: typeof inL, w: { opacity: number; scale: number; blur: number }) => {
      if (l.opacity === null || !near(l.opacity, w.opacity, 0.002) || !near(l.cOpacity, w.opacity, 0.002)) why.push(`${tag} opacity`);
      if (l.scale === null || !near(l.scale, w.scale, 0.002)) why.push(`${tag} scale`);
      if (l.blur === null || !near(l.blur, w.blur, 0.01)) why.push(`${tag} blur`);
      if (w.blur > 0.01 && !l.filter.includes("blur(")) why.push(`${tag} filter নেই`);
      if (l.transform === "none") why.push(`${tag} transform নেই`);
    };
    chk("নতুন", inL, looks.incoming);
    chk("পুরনো", outL, looks.outgoing);
  } else if (inL) {
    if (!near(inL.cOpacity, 1, 1e-6) || inL.filter !== "none" || inL.transform !== "none") why.push(`পরিষ্কার নয় (opacity ${inL.cOpacity}, filter ${inL.filter}, transform ${inL.transform})`);
  }
  if (!info.layers.every((l) => l.inFloat)) why.push("স্তর ভাসা-wrapper-এর বাইরে");
  if (info.glowOpacity === null || !near(info.glowOpacity, 1, 1e-6) || info.discOpacity === null || !near(info.discOpacity, 1, 1e-6)) why.push("glow/ডিস্ক ফেড হয়েছে");
  return { ok: why.length === 0, why };
}

function evalCell(p: Placed, info: CellInfo): CellEval {
  const { def } = p;
  const L = computeLayout(p.fullW, p.fullH);
  const nf = computeNightFactor({
    frame: def.frame,
    introFrames: TIMING_OF[def.hadisId].introFrames,
    mainFrames: TIMING_OF[def.hadisId].mainFrames,
    outroFrames: TIMING_OF[def.hadisId].outroFrames,
  });

  if (def.expectSvg === null) {
    const none = !info.drawn;
    return { name: none, box: none, float: none, glow: none, pos: none, fade: none };
  }
  if (!info.drawn || !info.box) return { name: false, box: false, float: false, glow: false, pos: false, fade: false };

  const name = info.svg === def.expectSvg && (def.expectSegment === null || info.segment === def.expectSegment);

  const box =
    near(info.box.x, L.svgBox.x, 1.5) &&
    near(info.box.y, L.svgBox.y, 1.5) &&
    near(info.box.w, L.svgBox.size, 1.5) &&
    near(info.box.h, L.svgBox.size, 1.5) &&
    // দুই স্তর চলার সময় প্রথম <svg> scale/ঝাপসায় (পুরনো স্তর ×১.০৬) আঁকা — তার মাপ মেলানোর কথা নয়; wrapper-এর মাপই যথেষ্ট
    (def.fade?.layers === 2 || (info.svgW !== null && near(info.svgW, L.svgBox.size, 2.5)));

  const wantFloat = floatOffset(def.frame, L.unit);
  const float =
    info.float !== null &&
    near(info.float, wantFloat, 0.002) &&
    Math.abs(info.float) <= FLOAT_UNITS * L.unit + 0.001;

  const g = stageGlow(def.theme, nf, L.svgBox.size);
  const glow =
    info.glow !== null &&
    info.disc !== null &&
    near(info.glow.w, g.glowRadius * 2, 1.5) &&
    near(info.disc.w, g.discRadius * 2, 1.5) &&
    info.order &&
    info.overflowVisible;

  const pos = def.landscape
    ? info.box.x + L.svgBox.size / 2 < p.fullW / 2 && info.box.y + L.svgBox.size <= p.fullH + 0.5
    : near(info.box.x * 2 + L.svgBox.size, p.fullW, 2);

  return { name, box, float, glow, pos, fade: evalFade(def, info, L.unit).ok };
}

function buildRows(infos: CellInfo[], warns: readonly string[]): Row[] {
  const rows: Row[] = [];
  const evals = PLACED.map((p) => evalCell(p, infos[p.index] ?? EMPTY_INFO));
  // 9K-4-এর আট সারি আগের মতোই ১৪ মূল ঘর নিয়ে (খালি-ফোল্ডার ও সাইজ ঘর আলাদা সারিতে)
  const pick = (pred: (p: Placed) => boolean) => PLACED_MAIN.filter(pred);
  const fails = (list: Placed[], f: (e: CellEval) => boolean) =>
    list.filter((p) => !f(evals[PLACED.indexOf(p)])).map((p) => p.def.label);
  const summary = (n: number, bad: string[], okText: string) =>
    bad.length === 0 ? okText : `${n - bad.length}/${n} — ❌ ${bad.join("; ")}`;

  const drawable = pick((p) => p.def.expectSvg !== null);

  // 1. ঠিক SVG
  const main = pick((p) => p.def.expectSvg !== null && p.def.key[0] !== "e");
  const badName = fails(main, (e) => e.name);
  rows.push({
    title: "প্রতিটা মুহূর্তে ঠিক SVG ও ঠিক সেগমেন্ট (data-svg / data-segment)",
    ok: badName.length === 0,
    note: summary(main.length, badName, `${main.length}/${main.length} ঘর — ${main.map((p) => `${p.def.frame}→${p.def.expectSvg}`).join(" · ")}`),
  });

  // 2. গ্যাপ ও শেষের পরে
  const edge = pick((p) => p.def.key === "e1" || p.def.key === "e2");
  const badEdge = fails(edge, (e) => e.name);
  rows.push({
    title: "গ্যাপে আগেরটাই থাকে; শেষ সেগমেন্টের পরে শেষটাই থাকে",
    ok: badEdge.length === 0,
    note: summary(edge.length, badEdge, "ফ্রেম 142 (গ্যাপ) → সেগমেন্ট ১ (svg1) · ফ্রেম 202 (শেষের পরে) → সেগমেন্ট ২ (svg2)"),
  });

  // 3. Main-এর বাইরে
  const outside = pick((p) => p.def.expectSvg === null);
  const badOut = fails(outside, (e) => e.name);
  rows.push({
    title: "Main-এর বাইরে (Intro ফ্রেম 45, Outro ফ্রেম 280) কিছু আঁকা হয় না",
    ok: badOut.length === 0,
    note: summary(outside.length, badOut, "দুই ঘরেই [data-svg-stage] নেই"),
  });

  // 4. বাক্স
  const badBox = fails(drawable, (e) => e.box);
  rows.push({
    title: "SVG-বাক্স ঠিক layout.svgBox-এ; ভেতরের <svg> বাক্স ভরে (±1.5px / ±2.5px)",
    ok: badBox.length === 0,
    note: summary(drawable.length, badBox, `${drawable.length}/${drawable.length} ঘর (Portrait ${computeLayout(1080, 1920).svgBox.size.toFixed(0)}px, Landscape ${computeLayout(1920, 1080).svgBox.size.toFixed(0)}px)`),
  });

  // 5. ভাসা
  const badFloat = fails(drawable, (e) => e.float);
  rows.push({
    title: `ভাসা: data-float = floatOffset(পরম ফ্রেম, unit) এবং ±${FLOAT_UNITS} × unit-এর ভেতরে`,
    ok: badFloat.length === 0,
    note: summary(
      drawable.length,
      badFloat,
      drawable
        .slice(0, 3)
        .map((p) => `ফ্রেম ${p.def.frame}: ${(infos[p.index]?.float ?? 0).toFixed(3)}px`)
        .join(" · ") + " …",
    ),
  });

  // 6. glow ও ডিস্ক
  const badGlow = fails(drawable, (e) => e.glow);
  rows.push({
    title: "glow ও ডিস্ক আছে, SVG-র পেছনে (DOM ক্রমে), মাপ = 2 × ব্যাসার্ধ, ছাঁটা হয় না",
    ok: badGlow.length === 0,
    note: summary(drawable.length, badGlow, `${drawable.length}/${drawable.length} ঘর — wrapper-এ overflow: visible`),
  });

  // 7. দিন/রাতের স্বচ্ছতা
  const day = PLACED.find((p) => p.def.key === "p5");
  const night = PLACED.find((p) => p.def.key === "p6");
  let dnOk = false;
  let dnNote = "greenDayNight-এর দিন/রাত ঘর পাওয়া যায়নি";
  if (day && night) {
    const di = infos[day.index] ?? EMPTY_INFO;
    const ni = infos[night.index] ?? EMPTY_INFO;
    const timing = TIMING_OF[MAIN_ID];
    const nfOf = (f: number) =>
      computeNightFactor({ frame: f, introFrames: timing.introFrames, mainFrames: timing.mainFrames, outroFrames: timing.outroFrames });
    const size = computeLayout(1080, 1920).svgBox.size;
    const gd = stageGlow("greenDayNight", nfOf(day.def.frame), size);
    const gn = stageGlow("greenDayNight", nfOf(night.def.frame), size);
    const a = [di.disc?.alpha, ni.disc?.alpha, di.glow?.alpha, ni.glow?.alpha];
    if (a.every((v): v is number => typeof v === "number")) {
      const [dd, nd, dg, ng] = a as number[];
      dnOk =
        dd > nd &&
        ng > dg &&
        near(dd, gd.discAlpha, 0.01) &&
        near(nd, gn.discAlpha, 0.01) &&
        near(dg, gd.glowAlpha, 0.01) &&
        near(ng, gn.glowAlpha, 0.01);
      dnNote = `ডিস্ক দিন ${dd.toFixed(2)} > রাত ${nd.toFixed(2)} · glow দিন ${dg.toFixed(2)} < রাত ${ng.toFixed(2)} (stageGlow-এর সাথে মেলে)`;
    } else {
      dnNote = "ঘরের glow/ডিস্কের স্বচ্ছতা DOM থেকে পড়া যায়নি";
    }
  }
  rows.push({ title: "ডিস্ক দিনে গাঢ়, glow রাতে উজ্জ্বল (greenDayNight দিন বনাম রাত, DOM থেকে পড়া)", ok: dnOk, note: dnNote });

  // 8. অবস্থান
  const badPos = fails(drawable, (e) => e.pos);
  rows.push({
    title: "Portrait-এ SVG মাঝখানে; Landscape-এ নিচে-বাঁয়ে (কম্পোজিশনের ভেতরে)",
    ok: badPos.length === 0,
    note: summary(drawable.length, badPos, "Portrait ঘরগুলো মাঝে, Landscape ঘরগুলো বাঁ-অর্ধে"),
  });

  // ───── Part 9K-5 ─────

  // 9. খালি ফোল্ডার: ৩ ঘরেই fallback আইকন + একই বাক্স/ভাসা/glow
  const badEmpty = PLACED_EMPTY.filter((p) => {
    const e = evals[PLACED.indexOf(p)];
    return !(e.name && e.box && e.float && e.glow && e.pos);
  }).map((p) => p.def.label);
  rows.push({
    title: "9K-5 · খালি ফোল্ডার (N = 0): fallback আইকন, একই বাক্স, ভাসা, glow + ডিস্ক পেছনে",
    ok: PLACED_EMPTY.length > 0 && badEmpty.length === 0,
    note: summary(
      PLACED_EMPTY.length,
      badEmpty,
      `${PLACED_EMPTY.length}/${PLACED_EMPTY.length} ঘর — data-svg = fallback (ফ্রেম ${PLACED_EMPTY.map((p) => p.def.frame).join(" · ")}), বাক্স = svgBox`,
    ),
  });

  // 10. ঠিক একটা "কোনো SVG পাওয়া যায়নি" সতর্কতা
  const marked = warns.filter((m) => m.includes("⚠️"));
  const noSvg = marked.filter((m) => m.includes("কোনো SVG পাওয়া যায়নি"));
  let studio = false;
  try {
    studio = getRemotionEnvironment().isStudio === true;
  } catch {
    studio = false;
  }
  const onceOk = noSvg.length === 1 && marked.length === 1;
  // Studio-তে পাতা আবার আঁকলে মডিউল-স্তরের "ছাপা-হয়েছে" সেট আগের ছাপা মনে রাখে → ০ আসতে পারে; সেটা ভুল নয় (check-এ নতুন পাতা, তাই সেখানে কড়া ১)
  const studioZero = studio && marked.length === 0;
  rows.push({
    title: "9K-5 · খালি ফোল্ডারে পুরো পাতায় ঠিক একটা \"কোনো SVG পাওয়া যায়নি\" সতর্কতা (console.warn গোনা)",
    ok: onceOk || studioZero,
    note: studioZero
      ? "Studio: এই পাতায় আগেই ছাপা হয়েছে (একবারই ছাপে) — `npm run check`-এ নতুন পাতায় ঠিক ১টা আসে"
      : `"কোনো SVG পাওয়া যায়নি" ${noSvg.length}টা · অন্য ⚠️ সতর্কতা ${marked.length - noSvg.length}টা (চাই ১ ও ০)`,
  });

  // 11. ৪ সাইজের ঘর (আসল ঘর, DOM থেকে)
  const badSize = PLACED_SIZES.filter((p) => {
    const e = evals[PLACED.indexOf(p)];
    return !(e.name && e.box && e.float && e.glow && e.pos);
  }).map((p) => `${p.fullW}×${p.fullH}`);
  rows.push({
    title: "9K-5 · ৪ সাইজের আসল ঘরে: ঠিক SVG, বাক্স = svgBox, ভাসা, glow + ডিস্ক, অবস্থান",
    ok: PLACED_SIZES.length === SIZES.length && badSize.length === 0,
    note: summary(PLACED_SIZES.length, badSize, SIZES.map((z) => `${z.w}×${z.h}`).join(" · ") + " — সব ✓"),
  });

  // 12. (হিসাব) SVG-বাক্স + সর্বোচ্চ ভাসা কম্পোজিশনের ভেতরে ও হেডার/ক্যাপশন বক্স থেকে আলাদা
  const sepY = (a0: number, a1: number, b0: number, b1: number) => a1 <= b0 + 1e-6 || b1 <= a0 + 1e-6;
  const sepX = (a0: number, a1: number, b0: number, b1: number) => a1 <= b0 + 1e-6 || b1 <= a0 + 1e-6;
  const geo = SIZES.map((z) => {
    const L = computeLayout(z.w, z.h);
    const f = FLOAT_UNITS * L.unit; // সর্বোচ্চ ভাসা (px)
    const b = L.svgBox;
    const x0 = b.x;
    const x1 = b.x + b.size;
    const y0 = b.y - f;
    const y1 = b.y + b.size + f;
    const inside = x0 >= 0 && y0 >= 0 && x1 <= z.w && y1 <= z.h;
    const hb = L.headerBox;
    const cb = L.captionBox;
    const apart =
      (sepX(x0, x1, hb.x, hb.x + hb.width) || sepY(y0, y1, hb.y, hb.y + hb.height)) &&
      (sepX(x0, x1, cb.x, cb.x + cb.width) || sepY(y0, y1, cb.y, cb.y + cb.height));
    // সবচেয়ে কাছের প্রতিবেশী থেকে ফাঁক (ভাসা-সহ)
    const gapHeader = Math.max(y0 - (hb.y + hb.height), hb.y - y1, x0 - (hb.x + hb.width), hb.x - x1);
    const gapCaption = Math.max(y0 - (cb.y + cb.height), cb.y - y1, x0 - (cb.x + cb.width), cb.x - x1);
    return { z, L, f, inside, apart, gapHeader, gapCaption, ok: inside && apart };
  });
  const badGeo = geo.filter((g) => !g.ok).map((g) => `${g.z.w}×${g.z.h}`);
  rows.push({
    title: "9K-5 · ৪ সাইজে SVG-বাক্স (সর্বোচ্চ ভাসা-সহ) কম্পোজিশনের ভেতরে, হেডার/ক্যাপশন বক্সে ঢোকে না",
    ok: badGeo.length === 0,
    note: summary(
      geo.length,
      badGeo,
      geo.map((g) => `${g.z.w}×${g.z.h}: ${g.L.svgBox.size.toFixed(0)}px ±${g.f.toFixed(0)} (হেডার ফাঁক ${Math.max(0, g.gapHeader).toFixed(0)})`).join(" · "),
    ),
  });

  // 13. (হিসাব) 4K = ঠিক ২× HD
  const pairs: [{ w: number; h: number }, { w: number; h: number }][] = [
    [SIZES[0], SIZES[2]],
    [SIZES[1], SIZES[3]],
  ];
  const bad4k: string[] = [];
  for (const [hd, k4] of pairs) {
    const a = computeLayout(hd.w, hd.h);
    const b = computeLayout(k4.w, k4.h);
    const ga = stageGlow("greenDayNight", 0.5, a.svgBox.size);
    const gb = stageGlow("greenDayNight", 0.5, b.svgBox.size);
    const twice: [string, number, number][] = [
      ["x", a.svgBox.x, b.svgBox.x],
      ["y", a.svgBox.y, b.svgBox.y],
      ["size", a.svgBox.size, b.svgBox.size],
      ["unit", a.unit, b.unit],
      ["ভাসা-সীমা", FLOAT_UNITS * a.unit, FLOAT_UNITS * b.unit],
      ["ভাসা@30", floatOffset(30, a.unit), floatOffset(30, b.unit)],
      ["glow", ga.glowRadius, gb.glowRadius],
      ["ডিস্ক", ga.discRadius, gb.discRadius],
    ];
    for (const [name, v1, v2] of twice) {
      if (!near(v1 * 2, v2, 1e-6)) bad4k.push(`${hd.w}×${hd.h}→${k4.w}×${k4.h} ${name}`);
    }
  }
  rows.push({
    title: "9K-5 · 4K-তে বাক্স, ভাসা, glow, ডিস্ক ঠিক ২× (1080×1920→2160×3840, 1920×1080→3840×2160)",
    ok: bad4k.length === 0,
    note: bad4k.length === 0 ? "x, y, size, unit, ভাসা-সীমা, ভাসা@ফ্রেম30, glow ব্যাসার্ধ, ডিস্ক ব্যাসার্ধ — সব ২× (±1e-6)" : `❌ ${bad4k.join("; ")}`,
  });

  // 14. (হিসাব) glow-এর নাগাল স্পষ্ট লেখা: বাক্সের বাইরে 0.28 × size; ডিস্ক বাক্সের ভেতরে; কম্পোজিশনের কিনারায় glow ফিকে
  const glowInfo = SIZES.map((z) => {
    const L = computeLayout(z.w, z.h);
    const g = stageGlow("greenDayNight", 0.5, L.svgBox.size);
    const cx = L.svgBox.x + L.svgBox.size / 2;
    const cy = L.svgBox.y + L.svgBox.size / 2;
    const reach = g.glowRadius - L.svgBox.size / 2;
    const reachOk = near(reach, 0.28 * L.svgBox.size, 1e-6);
    const discInside = g.discRadius * 2 <= L.svgBox.size + 1e-6;
    // কেন্দ্র থেকে কম্পোজিশনের সবচেয়ে কাছের কিনারা পর্যন্ত দূরত্ব ও সেখানে glow-এর আপেক্ষিক স্বচ্ছতা (কেন্দ্র = ১.০; ৫৫%-এ ০.৪৫; ১০০%-এ ০)
    const edgeDist = Math.min(cx, z.w - cx, cy, z.h - cy);
    const ratio = g.glowRadius > 0 ? edgeDist / g.glowRadius : 1;
    const rel = ratio >= 1 ? 0 : ratio <= 0.55 ? 1 - (ratio / 0.55) * 0.55 : 0.45 * (1 - (ratio - 0.55) / 0.45);
    // পাতার কিনারা ছাড়ানো (px): glow-বর্গের বাইরের রিম কতটা বেরোয়
    const over = Math.max(0, g.glowRadius - cx, g.glowRadius - (z.w - cx), g.glowRadius - cy, g.glowRadius - (z.h - cy));
    const faint = ratio >= 1 || rel <= 0.45 + 1e-9;
    return { z, reach, reachOk, discInside, rel, over, ok: reachOk && discInside && faint };
  });
  const badGlowInfo = glowInfo.filter((g) => !g.ok).map((g) => `${g.z.w}×${g.z.h}`);
  rows.push({
    title: "9K-5 · glow-এর নাগাল: বাক্সের বাইরে 0.28 × size; ডিস্ক বাক্সের ভেতরে; পাতার কিনারায় glow ফিকে (অক্ষত)",
    ok: badGlowInfo.length === 0,
    note: summary(
      glowInfo.length,
      badGlowInfo,
      glowInfo.map((g) => `${g.z.w}×${g.z.h}: নাগাল ${g.reach.toFixed(0)}px, কিনারা ছাড়ায় ${g.over.toFixed(0)}px (কিনারায় glow ${(g.rel * 100).toFixed(0)}%)`).join(" · "),
    ),
  });

  // ───── Part 9L ─────
  const unitOf = (p: Placed) => computeLayout(p.fullW, p.fullH).unit;
  const fadeBad = (list: Placed[]): string[] =>
    list
      .map((p) => ({ p, r: evalFade(p.def, infos[p.index] ?? EMPTY_INFO, unitOf(p)) }))
      .filter((x) => !x.r.ok)
      .map((x) => `${x.p.def.key}: ${x.r.why.slice(0, 2).join(", ")}`);
  const fadeOf = (keys: string[]) => PLACED_FADE.filter((p) => keys.includes(p.def.key));

  // 15. মাঝামাঝি: দুই স্তর, আধা-স্বচ্ছ, crossFadeLooks-এর সাথে মেলে
  const mid = fadeOf(["t1", "t2", "u1", "u2"]);
  const badMid = fadeBad(mid);
  const lk = crossFadeLooks(0.5, 1);
  rows.push({
    title: "9L · cross-fade মাঝে (ফ্রেম 156): দুই স্তর একসাথে — পুরনো svg1, নতুন svg2, দুটোই আধা-স্বচ্ছ, prefix আলাদা",
    ok: mid.length === 4 && badMid.length === 0,
    note: summary(
      mid.length,
      badMid,
      `${mid.length}/${mid.length} ঘর — প্রত্যেকে opacity ${lk.outgoing.opacity.toFixed(2)} / ${lk.incoming.opacity.toFixed(2)}, scale ${lk.outgoing.scale.toFixed(3)} / ${lk.incoming.scale.toFixed(3)}, ঝাপসা ${lk.outgoing.blur.toFixed(1)} / ${lk.incoming.blur.toFixed(1)}px (HD)`,
    ),
  });

  // 16. শুরুর কাছে: পুরনোটা বেশি স্পষ্ট
  const early = fadeOf(["t3"]);
  const ei = early[0] ? (infos[early[0].index] ?? EMPTY_INFO) : EMPTY_INFO;
  const eo = ei.layers.find((l) => l.kind === "out");
  const en = ei.layers.find((l) => l.kind === "in");
  const earlyOk = early.length === 1 && fadeBad(early).length === 0 && !!eo && !!en && eo.cOpacity > en.cOpacity;
  rows.push({
    title: "9L · cross-fade শুরুর কাছে (ফ্রেম 151, ১/১২): পুরনো স্তর নতুনের চেয়ে বেশি স্পষ্ট",
    ok: earlyOk,
    note: eo && en ? `পুরনো opacity ${eo.cOpacity.toFixed(3)} > নতুন ${en.cOpacity.toFixed(3)} (সরল ০.৫ নয়, ease-এর কারণে শুরুতে ধীর)` : "স্তর পড়া যায়নি",
  });

  // 17. শেষ: ১ স্তর, পরিষ্কার
  const done = fadeOf(["v3"]);
  const badDone = fadeBad(done);
  rows.push({
    title: "9L · transition শেষ (ফ্রেম 162): ১ স্তর, opacity ১, filter/transform নেই, ফ্রেম গোনা চলছে (12)",
    ok: done.length === 1 && badDone.length === 0,
    note: summary(done.length, badDone, "পুরনো স্তর সরে গেছে; নতুন স্তরে ঝাপসা/স্কেল কিছু বসে নেই; স্থানীয় ফ্রেম 12"),
  });

  // 18. একই SVG পাশাপাশি
  const same = fadeOf(["v1"]);
  const badSame = fadeBad(same);
  rows.push({
    title: "9L · পাশাপাশি একই SVG (svg1, svg1): transition নেই, ১ স্তর, অ্যানিমেশন আবার শুরু হয় না",
    ok: same.length === 1 && badSame.length === 0,
    note: summary(same.length, badSame, "ফ্রেম 153 (সেগমেন্ট ২ শুরু 150) → স্থানীয় ফ্রেম 63 = 153 − 90 (প্রথম সেগমেন্টের শুরু থেকে গোনা), 0 নয়"),
  });

  // 19. ছোট সেগমেন্ট
  const shortSeg = fadeOf(["v2"]);
  const badShort = fadeBad(shortSeg);
  rows.push({
    title: "9L · ছোট সেগমেন্ট (12 ফ্রেম): transition ⌊12 ÷ 3⌋ = 4 ফ্রেমে ছোট; ফ্রেম 212 → ০.৫",
    ok: shortSeg.length === 1 && badShort.length === 0,
    note: summary(shortSeg.length, badShort, "data-transition-frames = 4, progress 0.5, দুই স্তর (পুরনো svg1, নতুন svg2)"),
  });

  // 20. সব cross-fade ঘরের সামগ্রিক (বাক্স, ভাসা, glow স্থির, অবস্থান)
  const badFadeAll = PLACED_FADE.filter((p) => {
    const e = evals[PLACED.indexOf(p)];
    return !(e.name && e.box && e.float && e.glow && e.pos && e.fade);
  }).map((p) => p.def.key);
  rows.push({
    title: "9L · ৮ cross-fade ঘরেই: বাক্স = svgBox, ভাসা ঠিক, glow/ডিস্ক ফেড হয় না, স্তরগুলো ভাসা-wrapper-এর ভেতরে",
    ok: PLACED_FADE.length === 8 && badFadeAll.length === 0,
    note: summary(PLACED_FADE.length, badFadeAll, "glow/ডিস্কের opacity 1 (শুধু SVG-স্তর ফেড), data-svg/data-segment = সক্রিয় সেগমেন্ট"),
  });

  return rows;
}

// ---------- আঁকা ----------

const Guides: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const L = computeLayout(width, height);
  const line = Math.max(3, L.unit * 4);
  const box = (key: string, x: number, y: number, w: number, h: number, color: string) => (
    <div
      key={key}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        border: `${line}px dashed ${color}`,
        borderRadius: 16 * L.unit,
        opacity: 0.55,
        pointerEvents: "none",
        boxSizing: "border-box",
      }}
    />
  );
  return (
    <>
      {box("h", L.headerBox.x, L.headerBox.y, L.headerBox.width, L.headerBox.height, "#ffe27a")}
      {box("s", L.svgBox.x, L.svgBox.y, L.svgBox.size, L.svgBox.size, "#8ee3ff")}
      {box("c", L.captionBox.x, L.captionBox.y, L.captionBox.width, L.captionBox.height, "#ffb3c7")}
    </>
  );
};

const CellView: React.FC<{
  placed: Placed;
  info: CellInfo | null;
  ev: CellEval | null;
  setRef: (el: HTMLDivElement | null) => void;
}> = ({ placed, info, ev, setRef }) => {
  const { def, x, y, w, h, fullW, fullH } = placed;
  const scale = w / fullW;
  const timing = TIMING_OF[def.hadisId];
  const nightFactor = computeNightFactor({
    frame: def.frame,
    introFrames: timing.introFrames,
    mainFrames: timing.mainFrames,
    outroFrames: timing.outroFrames,
  });
  const allOk = ev ? ev.name && ev.box && ev.float && ev.glow && ev.pos && ev.fade : null;
  const got = info === null ? "…" : info.drawn ? (info.svg ?? "?") : "কিছু নয়";
  const want = def.expectSvg ?? "কিছু নয়";
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, overflow: "hidden", outline: "1px solid #ffffff44" }}>
      <div
        ref={setRef}
        style={{ width: fullW, height: fullH, transform: `scale(${scale})`, transformOrigin: "0 0", position: "relative" }}
      >
        <Background theme={def.theme} nightFactor={nightFactor} size={{ width: fullW, height: fullH }} />
        <SvgStage
          hadisId={def.hadisId}
          theme={def.theme}
          timing={timing}
          size={{ width: fullW, height: fullH }}
          frame={def.frame}
          idScope={`${def.key}-`}
          inventory={def.emptyFolder ? EMPTY_INVENTORY : undefined}
        />
        <Guides width={fullW} height={fullH} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 5,
          top: 5,
          right: 5,
          background: "#000000b8",
          color: "#fff",
          fontFamily: FONT_BODY,
          fontSize: w < 300 ? 13 : 16,
          lineHeight: 1.25,
          padding: "2px 7px",
          borderRadius: 6,
        }}
      >
        <div style={{ fontWeight: 700 }}>
          {allOk === null ? "⏳" : allOk ? "✅" : "❌"} {def.label}
        </div>
        <div style={{ opacity: 0.85 }}>
          {def.why} · চাই {want}, পেয়েছে {got}
        </div>
      </div>
    </div>
  );
};

const RowView: React.FC<{ p: Palette; ok: boolean; title: string; note: string }> = ({ p, ok, title, note }) => (
  <div style={{ height: ROW_PITCH, flexShrink: 0 }}>
    <div
      style={{
        height: ROW_H,
        boxSizing: "border-box",
        background: p.panelBg,
        border: `2px solid ${ok ? p.panelBorder : "#FF6B6B"}`,
        borderRadius: 14,
        padding: "6px 16px",
        display: "flex",
        gap: 14,
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div style={{ fontSize: 28, lineHeight: 1 }}>{ok ? "✅" : "❌"}</div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {title}
        </div>
        <div
          style={{
            fontSize: 18,
            lineHeight: 1.2,
            color: ok ? p.textMuted : "#FF8A8A",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {note}
        </div>
      </div>
    </div>
  </div>
);

const SectionTitle: React.FC<{ p: Palette; text: string }> = ({ p, text }) => (
  <div
    style={{
      height: SEC_H,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      fontSize: 27,
      fontWeight: 700,
      color: p.accent,
    }}
  >
    {text}
  </div>
);

export const SvgStagePreview: React.FC = () => {
  const p = getThemeColors("emerald", 0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  // ⚠️ ঘরগুলো আঁকার আগে (প্রথম রেন্ডারে) warn গোনা শুরু; আনমাউন্টে ফেরত
  const capture = useMemo(() => startWarnCapture(), []);
  useEffect(() => () => stopWarnCapture(), []);
  const infos = useCellInfos(refs);
  const cases = useMemo(() => runStageCases(), []);
  const tcases = useMemo(() => runTransitionCases(), []);

  const evals = useMemo(() => (infos ? PLACED.map((pl) => evalCell(pl, infos[pl.index] ?? EMPTY_INFO)) : null), [infos]);
  const rows = useMemo(() => (infos ? buildRows(infos, capture.messages.slice()) : []), [infos, capture]);

  const renderCell = (pl: Placed) => (
    <CellView
      key={pl.def.key}
      placed={pl}
      info={infos ? (infos[pl.index] ?? EMPTY_INFO) : null}
      ev={evals ? evals[PLACED.indexOf(pl)] : null}
      setRef={(el) => {
        refs.current[pl.index] = el;
      }}
    />
  );

  const rowsPassed = rows.filter((r) => r.ok).length;
  const casesPassed = cases.filter((c) => c.ok).length;
  const tcasesPassed = tcases.filter((c) => c.ok).length;
  const total = N_AUTO + STAGE_CASE_COUNT + TRANSITION_CASE_COUNT;
  const passed = rowsPassed + casesPassed + tcasesPassed;
  const allOk = infos !== null && rows.length === N_AUTO && passed === total;

  return (
    <AbsoluteFill
      style={{
        background: skyGradient(p),
        boxSizing: "border-box",
        padding: PAD,
        flexDirection: "column",
        fontFamily: FONT_BODY,
        color: p.text,
      }}
    >
      <div style={{ height: HEAD_H, flexShrink: 0, display: "flex", alignItems: "baseline", gap: 20 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 46, color: p.accent }}>SVG Stage যাচাই</div>
        <div style={{ fontWeight: 700, fontSize: 34, color: allOk ? "#7CFFB2" : "#FF8A8A" }}>
          {infos === null ? "⏳" : allOk ? "সব ✅" : "❌ আছে"} · {passed}/{total}
        </div>
      </div>

      <SectionTitle p={p} text={`9K-4 + 9K-5 + 9L · স্বয়ংক্রিয় যাচাই (DOM, console.warn ও হিসাব) · ${rowsPassed}/${N_AUTO}`} />
      {rows.length === 0 ? (
        <div style={{ height: N_AUTO * ROW_PITCH, flexShrink: 0 }} />
      ) : (
        rows.map((r) => <RowView key={r.title} p={p} ok={r.ok} title={r.title} note={r.note} />)
      )}

      <SectionTitle p={p} text="১৪টা ঘর — আসল Background + আসল SvgStage (হেডার হলুদ · SVG আকাশি · ক্যাপশন গোলাপি বক্স ফিকে)" />
      <div style={{ position: "relative", height: CELLS_H, width: CONTENT_W, flexShrink: 0 }}>
        {PLACED_MAIN.map((pl) => renderCell(pl))}
      </div>

      <SectionTitle p={p} text="9K-5 · খালি ফোল্ডার (N = 0, আপনার ফাইল না মুছে) — fallback আইকন + glow; পাতায় ঠিক ১টা সতর্কতা" />
      <div style={{ position: "relative", height: EMPTY_H, width: CONTENT_W, flexShrink: 0 }}>
        {PLACED_EMPTY.map((pl) => renderCell(pl))}
      </div>

      <SectionTitle p={p} text="9K-5 · ৪ আউটপুট সাইজ (আসল ঘর, ছোট করে আঁকা): 1080×1920 · 1920×1080 · 2160×3840 · 3840×2160" />
      <div style={{ position: "relative", height: SIZES_H, width: CONTENT_W, flexShrink: 0 }}>
        {PLACED_SIZES.map((pl) => renderCell(pl))}
      </div>

      <SectionTitle p={p} text="9L · cross-fade (ফ্রেম 150-এ সেগমেন্ট বদল, ১২ ফ্রেম): মাঝে · শুরুর কাছে · শেষ · একই SVG · ছোট সেগমেন্ট" />
      <div style={{ position: "relative", height: FADE_H, width: CONTENT_W, flexShrink: 0 }}>
        {PLACED_FADE.map((pl) => renderCell(pl))}
      </div>

      <SectionTitle p={p} text={`9K-1 · svgStage.ts-এর বিশুদ্ধ কেস · ${casesPassed}/${STAGE_CASE_COUNT}`} />
      {cases.map((c) => (
        <RowView key={c.id} p={p} ok={c.ok} title={c.title} note={c.ok ? c.rule : c.detail} />
      ))}

      <SectionTitle p={p} text={`9L · svgTransition.ts-এর বিশুদ্ধ কেস · ${tcasesPassed}/${TRANSITION_CASE_COUNT}`} />
      {tcases.map((c) => (
        <RowView key={c.id} p={p} ok={c.ok} title={c.title} note={c.ok ? c.rule : c.detail} />
      ))}
    </AbsoluteFill>
  );
};
