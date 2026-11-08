import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { HOOK_TEXT, TRANSITION_FRAMES } from "../constants";
import { FONT_DISPLAY } from "../fonts";
import { hookFramesOf, type Timing } from "../lib/timing";
import { useNightFactor } from "../lib/useNightFactor";
import { getThemeColors, parseColor } from "../themes";
import type { ThemeId } from "../types";

/**
 * Hook দৃশ্য — ভিডিওর একদম শুরুতে বড় প্রশ্ন-লেখা ("এই হাদিসের ব্যাপারে কি আপনার জানা আছে?") + hook.wav-এর ভয়েস।
 * ভয়েস এখানে বাজে না — `IntroOutroAudio` মূল স্তরে বাজায় (ক্যাপশনের মতো আলাদা সিঙ্ক লাগে না)।
 *
 * ক্রম (দৃশ্যের নিজের ফ্রেমে):
 *   ০–          প্যানেল কার্ড স্প্রিং-ইন (স্কেল ০.৯ → ১)
 *   ৬–          শব্দগুলো একটা একটা করে নিচ থেকে লাফিয়ে ওঠে (স্টাগার; পুরো ক্রম ≤ ১.৬ সেকেন্ড ও Hook-এর ৫৫%-এর মধ্যে)
 *   এরপর        সামান্য ভাসা + পেছনের বড় "?"-এর glow পালস
 *   শেষ ≤১২ ফ্রেম ফেড-আউট (সামান্য বড় হতে হতে) → Intro-তে
 *
 * - লেখা বাক্যের শব্দে ভাঙা `flex-wrap` — বাংলা যুক্তাক্ষর কখনো ভাঙে না; কোনো `overflow: hidden` নেই (মাথার মাত্রা/ই-কার কাটে না)।
 * - শেষ দুই শব্দ accent রঙে (জোর), বাকি `p.text`। সব লেখা থিমের আধা-স্বচ্ছ প্যানেলে → উজ্জ্বল আকাশেও পড়া যায়।
 * - সবকিছু frame-ভিত্তিক (CSS-অ্যানিমেশন / Math.random নয়)। Hook ০ ফ্রেম হলে কিছুই আঁকে না।
 */

type Props = {
  theme: ThemeId;
  /** ডিফল্ট `HOOK_TEXT` */
  text?: string;
  timing: Timing;
  /** dev প্রিভিউয়ের জন্য: ভিডিওর সাইজ ছাড়া অন্য সাইজে লেআউট */
  size?: { width: number; height: number };
};

/** শব্দের স্টাগার: প্রতি শব্দের বিরতি (ফ্রেম) ও পুরো ক্রমের সর্বোচ্চ ভাগ */
export const HOOK_STAGGER_START = 6;
export const HOOK_STAGGER_MAX_SECONDS = 1.6;
export const HOOK_STAGGER_MAX_SHARE = 0.55;

/** `n` শব্দের প্রতিটার শুরুর ফ্রেম (দৃশ্যের লোকাল ফ্রেমে); ছোট Hook-এ চেপে আসে। বিশুদ্ধ হিসাব */
export function hookWordStarts(n: number, hookFrames: number, fps: number): number[] {
  const count = Math.max(0, Math.floor(n));
  if (count === 0) return [];
  const window = Math.max(
    0,
    Math.min(HOOK_STAGGER_MAX_SECONDS * fps, Math.max(0, hookFrames) * HOOK_STAGGER_MAX_SHARE) - HOOK_STAGGER_START,
  );
  const step = count > 1 ? window / (count - 1) : 0;
  return Array.from({ length: count }, (_, i) => Math.round(HOOK_STAGGER_START + step * i));
}

function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color);
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${alpha})`;
}

export const HookScene: React.FC<Props> = ({ theme, text = HOOK_TEXT, timing, size }) => {
  const frame = useCurrentFrame();
  const video = useVideoConfig();
  const fps = video.fps;
  const width = size?.width ?? video.width;
  const height = size?.height ?? video.height;
  const isPortrait = height >= width;
  const u = Math.min(width, height) / 1080;

  const hookFrames = hookFramesOf(timing);
  const p = getThemeColors(theme, useNightFactor(timing));

  if (hookFrames <= 0) return null;

  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const starts = hookWordStarts(words.length, hookFrames, fps);

  const cardIn = spring({ frame, fps, config: { damping: 15, stiffness: 130, mass: 0.8 }, durationInFrames: 26 });

  const fadeFrames = Math.min(TRANSITION_FRAMES, Math.max(1, Math.floor(hookFrames * 0.25)));
  const fadeStart = hookFrames - fadeFrames;
  const fadeOut = interpolate(frame, [fadeStart, hookFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outScale = interpolate(frame, [fadeStart, hookFrames], [1, 1.04], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pulse = 0.85 + 0.15 * Math.sin((frame / fps) * ((Math.PI * 2) / 2));

  // ---------- মাপ ----------
  const cardW = isPortrait ? width * 0.9 : width * 0.82;
  const padX = (isPortrait ? 44 : 72) * u;
  const padY = (isPortrait ? 70 : 56) * u;
  const innerW = cardW - padX * 2;
  const fontSize = (isPortrait ? 136 : 118) * u;
  const wordGap = fontSize * 0.26;
  const lineGap = fontSize * 0.12;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width,
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut,
        transform: `scale(${outScale})`,
      }}
    >
      <div
        style={{
          position: "relative",
          width: cardW,
          boxSizing: "border-box",
          padding: `${padY}px ${padX}px`,
          borderRadius: 48 * u,
          background: p.panelBg,
          border: `${3 * u}px solid ${p.panelBorder}`,
          boxShadow: `0 ${16 * u}px ${56 * u}px rgba(0,0,0,0.4), 0 0 ${48 * u}px ${withAlpha(p.glow, 0.25)}`,
          opacity: Math.min(1, cardIn * 1.5),
          transform: `scale(${interpolate(cardIn, [0, 1], [0.9, 1])})`,
        }}
      >
        {/* পেছনের বড় "?" — নরম glow, লেখার নিচে */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT_DISPLAY,
            fontWeight: 800,
            fontSize: (isPortrait ? 900 : 640) * u,
            lineHeight: 1,
            color: withAlpha(p.accent, 0.1 * pulse),
            textShadow: `0 0 ${60 * u}px ${withAlpha(p.glow, 0.35 * pulse)}`,
            pointerEvents: "none",
          }}
        >
          ?
        </div>

        <div
          style={{
            position: "relative",
            width: innerW,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            columnGap: wordGap,
            rowGap: lineGap,
          }}
        >
          {words.map((w, i) => {
            const prog = spring({
              frame: Math.max(0, frame - starts[i]),
              fps,
              config: { damping: 12, stiffness: 150, mass: 0.7 },
              durationInFrames: 22,
            });
            const emphasised = i >= words.length - 2;
            const float = Math.sin((frame / fps) * 2 + i * 0.7) * 5 * u * Math.min(1, prog);
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 800,
                  fontSize,
                  lineHeight: 1.45,
                  color: emphasised ? p.accent2 : p.text,
                  textShadow: `0 ${4 * u}px ${18 * u}px rgba(0,0,0,0.35)${emphasised ? `, 0 0 ${28 * u}px ${withAlpha(p.glow, 0.45)}` : ""}`,
                  opacity: Math.min(1, prog * 1.6),
                  transform: `translateY(${interpolate(prog, [0, 1], [70 * u, 0]) + float}px) scale(${interpolate(prog, [0, 1], [0.7, 1])})`,
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
