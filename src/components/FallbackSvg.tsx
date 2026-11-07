import React from "react";
import { useCurrentFrame } from "remotion";
import { getThemeColors, parseColor } from "../themes";
import type { ThemeId } from "../types";

/**
 * Part 9J: SVG ফাইল না থাকলে (বা তালিকা খালি হলে) যে ফলব্যাক আইকন আঁকা হয় — ৮-কোণা ইসলামী জ্যামিতিক তারা।
 *  - দুটো ঘোরানো বর্গ (৪৫° ব্যবধানে) = ৮-কোণা তারা, ভেতরে উল্টো দিকে ঘোরা ছোট ৮-কোণা তারা, মাঝে ছোট বৃত্ত, বাইরে পাতলা রিং।
 *  - CSS/SMIL নয় — **সরাসরি ফ্রেম থেকে হিসাব** (`rotate = frame × k`), তাই সিঙ্কের কোনো ঝামেলাই নেই; একই ফ্রেম = একই ছবি।
 *  - ব্যাকগ্রাউন্ড স্বচ্ছ। রঙ থিম থেকে (সোনালি `accent` + উজ্জ্বল `text` + `accent2`); প্রতিটা রেখার নিচে পাতলা গাঢ় রূপরেখা,
 *    যাতে গাঢ় ও হালকা দুই আকাশেই দেখা যায় (সাদা/সোনালি হালকা আকাশে একা মিলিয়ে যেত)।
 *  - শুধু জ্যামিতি — কোনো প্রাণী/মানুষের মুখ নয়।
 *  - ফ্রেম-নির্ভর পরিবর্তনের হিসাব `fallbackMotion(frame)` শুদ্ধ ফাংশন (React ছাড়া পরীক্ষা করা যায়)।
 */

export const FALLBACK_VIEWBOX = 1000;
/** বড় বর্গের পাশ; ঘেরবৃত্তের ব্যাসার্ধ = পাশ/√২ ≈ ৩৯৬ (রিংয়ের ভেতরেই থাকতে হবে) */
export const FALLBACK_STAR_SIDE = 560;
/** বাইরের রিংয়ের ব্যাসার্ধ */
export const FALLBACK_RING_RADIUS = 430;

/** ধীর ঘূর্ণন: বাইরের বর্গ ০.৪৫°/ফ্রেম (পূর্ণ পাক ≈ ২৬.৭ সেকেন্ড), ভেতরের তারা উল্টো দিকে ০.৯°/ফ্রেম */
export const OUTER_DEG_PER_FRAME = 0.45;
export const INNER_DEG_PER_FRAME = -0.9;
/** নরম পালসের পর্যায়কাল (ফ্রেম): ৯৬ ফ্রেম = ৩.২ সেকেন্ড @30fps */
export const PULSE_PERIOD_FRAMES = 96;

export type FallbackMotion = {
  /** বাইরের দুই বর্গের ঘূর্ণন (ডিগ্রি) */
  outerDeg: number;
  /** ভেতরের ছোট তারার ঘূর্ণন (ডিগ্রি; উল্টো দিক) */
  innerDeg: number;
  /** পুরো আইকনের নরম স্কেল (≈ ০.৯৬ … ১.০৪) */
  scale: number;
  /** রিং ও ভেতরের দীপ্তি (০.৫৫ … ১) */
  glow: number;
};

/** ফ্রেম → ঘূর্ণন/পালস। ফ্রেম সংখ্যা না হলে (NaN/Infinity/অ-সংখ্যা) ০ ধরে — কখনো throw করে না */
export function fallbackMotion(frame: number): FallbackMotion {
  const f = typeof frame === "number" && Number.isFinite(frame) ? frame : 0;
  const phase = (f / PULSE_PERIOD_FRAMES) * Math.PI * 2;
  return {
    outerDeg: f * OUTER_DEG_PER_FRAME,
    innerDeg: f * INNER_DEG_PER_FRAME,
    scale: 1 + 0.04 * Math.sin(phase),
    glow: 0.775 + 0.225 * Math.sin(phase + Math.PI / 3),
  };
}

export type FallbackColors = {
  /** উজ্জ্বল সোনালি (বাইরের বর্গ, রিং) */
  gold: string;
  /** উজ্জ্বল সাদাটে (দ্বিতীয় বর্গ) */
  light: string;
  /** ভেতরের তারা */
  inner: string;
  /** সব রেখার নিচের গাঢ় রূপরেখা */
  outline: string;
};

/** থিম ও দিন-রাত অনুযায়ী আইকনের রঙ */
export function fallbackColors(theme: ThemeId, nightFactor = 0): FallbackColors {
  const p = getThemeColors(theme, nightFactor);
  return { gold: p.accent, light: p.text, inner: p.accent2, outline: "rgba(4, 30, 18, 0.62)" };
}

/** "#rrggbb"/"rgba(...)" → আলফা বদলানো রঙ (পার্স না হলে মূল রঙই) */
function withAlpha(color: string, alpha: number): string {
  try {
    const c = parseColor(color);
    return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${Math.min(1, Math.max(0, alpha * c.a))})`;
  } catch {
    return color;
  }
}

const C = FALLBACK_VIEWBOX / 2;

type Props = {
  /** দেওয়া হলে এই ফ্রেম; না দিলে `useCurrentFrame()` (SvgStage সেগমেন্টের স্থানীয় ফ্রেম পাঠাবে) */
  frame?: number;
  /** পাশের দৈর্ঘ্য (px) — বর্গাকার */
  size: number;
  theme: ThemeId;
  /** ০ (দিন) → ১ (রাত); static থিমে প্রভাব নেই */
  nightFactor?: number;
  style?: React.CSSProperties;
};

/** দুই বর্গের ৮-কোণা তারা (পাশ `side`, মাঝ C,C; দ্বিতীয়টা ৪৫° ঘোরানো) */
const Square: React.FC<{ side: number; deg: number }> = ({ side, deg }) => (
  <rect x={C - side / 2} y={C - side / 2} width={side} height={side} transform={`rotate(${deg} ${C} ${C})`} />
);

export const FallbackSvg: React.FC<Props> = ({ frame, size, theme, nightFactor = 0, style }) => {
  const current = useCurrentFrame();
  const m = fallbackMotion(frame ?? current);
  const col = fallbackColors(theme, nightFactor);

  const OUTER = FALLBACK_STAR_SIDE;
  const INNER = 210;
  const strokeW = 14;
  const outlineW = strokeW + 10;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${FALLBACK_VIEWBOX} ${FALLBACK_VIEWBOX}`}
      style={{ display: "block", overflow: "visible", ...style }}
      aria-hidden
    >
      <g transform={`translate(${C} ${C}) scale(${m.scale}) translate(${-C} ${-C})`}>
        {/* বাইরের পাতলা রিং */}
        <circle cx={C} cy={C} r={FALLBACK_RING_RADIUS} fill="none" stroke={col.outline} strokeWidth={9 + 8} opacity={m.glow} />
        <circle cx={C} cy={C} r={FALLBACK_RING_RADIUS} fill="none" stroke={withAlpha(col.gold, 0.85)} strokeWidth={9} opacity={m.glow} />

        {/* দুই বর্গ = ৮-কোণা তারা: প্রথমে রূপরেখা, তারপর রঙ */}
        <g fill="none" stroke={col.outline} strokeWidth={outlineW} strokeLinejoin="round">
          <Square side={OUTER} deg={m.outerDeg} />
          <Square side={OUTER} deg={m.outerDeg + 45} />
        </g>
        <g strokeWidth={strokeW} strokeLinejoin="round">
          <g fill={withAlpha(col.gold, 0.16)} stroke={col.gold}>
            <Square side={OUTER} deg={m.outerDeg} />
          </g>
          <g fill={withAlpha(col.light, 0.1)} stroke={col.light}>
            <Square side={OUTER} deg={m.outerDeg + 45} />
          </g>
        </g>

        {/* ভেতরের ছোট ৮-কোণা তারা (উল্টো দিকে ঘোরে) */}
        <g fill="none" stroke={col.outline} strokeWidth={outlineW - 4} strokeLinejoin="round">
          <Square side={INNER} deg={m.innerDeg} />
          <Square side={INNER} deg={m.innerDeg + 45} />
        </g>
        <g strokeWidth={10} strokeLinejoin="round" stroke={col.inner} fill={withAlpha(col.inner, 0.28)}>
          <Square side={INNER} deg={m.innerDeg} />
          <Square side={INNER} deg={m.innerDeg + 45} />
        </g>

        {/* মাঝের ছোট বৃত্ত */}
        <circle cx={C} cy={C} r={34} fill={col.outline} />
        <circle cx={C} cy={C} r={26} fill={col.light} opacity={m.glow} />
      </g>
    </svg>
  );
};
