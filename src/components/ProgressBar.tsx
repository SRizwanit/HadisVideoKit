import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  PROGRESS_BAR_BOTTOM,
  PROGRESS_BAR_HEIGHT,
  PROGRESS_BAR_SIDE_MARGIN,
} from "../constants";
import { useNightFactor } from "../lib/useNightFactor";
import type { Timing } from "../lib/timing";
import { getThemeColors, parseColor } from "../themes";
import type { ThemeId } from "../types";

/**
 * নিচের প্রোগ্রেস বার: পুরো ভিডিও (Hook → Teaser → Intro → Main → Outro) জুড়ে বাঁ থেকে ডানে ভরে।
 * দর্শককে দেখায় "আর কতটুকু বাকি" — তাই শেষ পর্যন্ত দেখতে উৎসাহ দেয়।
 *
 * - মূল স্তরে (কোনো দৃশ্য-Sequence-এর বাইরে) বসে, তাই `useCurrentFrame()` ভিডিওর শুরু থেকে মাপা।
 * - অগ্রগতি = frame ÷ (মোট ফ্রেম − ১): প্রথম ফ্রেমে ০%, শেষ ফ্রেমে ঠিক ১০০%।
 * - রঙ থিমের accent → accent2 (দিন-রাত অনুযায়ী); ট্র্যাক গাঢ় আধা-স্বচ্ছ, তাই উজ্জ্বল আকাশেও দেখা যায়।
 * - জায়গা: Portrait-এ শর্টসের নিচের নিরাপদ এলাকায়, Landscape-এ নিচের মার্জিনে — ক্যাপশন/SVG/Outro-র সাথে মেশে না।
 * - সব মাপ `u = min(width, height) / 1080` দিয়ে (4K-তেও একই চেহারা); কোনো CSS-অ্যানিমেশন/random নেই।
 * - বন্ধ করতে `constants.ts`-এ `PROGRESS_BAR_ENABLED = false`।
 */

type Props = {
  theme: ThemeId;
  timing: Timing;
  /** dev প্রিভিউয়ের জন্য: ভিডিওর সাইজ ছাড়া অন্য সাইজে লেআউট */
  size?: { width: number; height: number };
  /** dev প্রিভিউয়ের জন্য সরাসরি nightFactor */
  nightFactor?: number;
};

function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color);
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${alpha})`;
}

/** ০…১ অগ্রগতি (মোট ১ ফ্রেম বা কম হলে ১) — বিশুদ্ধ হিসাব */
export function progressOf(frame: number, totalFrames: number): number {
  const total = Number.isFinite(totalFrames) ? Math.floor(totalFrames) : 0;
  if (total <= 1) return 1;
  const f = Number.isFinite(frame) ? frame : 0;
  return Math.min(1, Math.max(0, f / (total - 1)));
}

export const ProgressBar: React.FC<Props> = ({ theme, timing, size, nightFactor }) => {
  const frame = useCurrentFrame();
  const video = useVideoConfig();
  const width = size?.width ?? video.width;
  const height = size?.height ?? video.height;
  const isPortrait = height >= width;
  const u = Math.min(width, height) / 1080;

  const computedNight = useNightFactor(timing);
  const p = getThemeColors(theme, nightFactor ?? computedNight);

  const progress = progressOf(frame, timing.totalFrames);

  const barH = PROGRESS_BAR_HEIGHT * u;
  const side = PROGRESS_BAR_SIDE_MARGIN * u;
  const bottom = (isPortrait ? PROGRESS_BAR_BOTTOM.portrait : PROGRESS_BAR_BOTTOM.landscape) * u;
  const trackW = width - side * 2;
  const fillW = trackW * progress;
  const knob = barH * 2.4;

  return (
    <div
      data-progress-bar=""
      data-progress={progress.toFixed(4)}
      style={{
        position: "absolute",
        left: side,
        bottom,
        width: trackW,
        height: barH,
        borderRadius: barH,
        background: "rgba(0, 0, 0, 0.42)",
        border: `${Math.max(1, u * 1.5)}px solid ${withAlpha("#ffffff", 0.22)}`,
        boxSizing: "border-box",
        boxShadow: `0 ${3 * u}px ${12 * u}px rgba(0,0,0,0.35)`,
        pointerEvents: "none",
      }}
    >
      {/* ভরা অংশ */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: fillW,
          borderRadius: barH,
          background: `linear-gradient(90deg, ${p.accent}, ${p.accent2})`,
          boxShadow: `0 0 ${14 * u}px ${withAlpha(p.glow, 0.75)}`,
        }}
      />
      {/* মাথায় উজ্জ্বল বিন্দু */}
      <div
        style={{
          position: "absolute",
          left: fillW - knob / 2,
          top: "50%",
          width: knob,
          height: knob,
          marginTop: -knob / 2,
          borderRadius: "50%",
          background: p.accent2,
          border: `${Math.max(1, u * 2)}px solid ${withAlpha("#ffffff", 0.9)}`,
          boxSizing: "border-box",
          boxShadow: `0 0 ${18 * u}px ${withAlpha(p.glow, 0.9)}`,
        }}
      />
    </div>
  );
};
