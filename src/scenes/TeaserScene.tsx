import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { TRANSITION_FRAMES } from "../constants";
import { FONT_DISPLAY } from "../fonts";
import { useHadisTimestamp } from "../lib/loadHadis";
import { teaserActiveIndex, teaserWords, type TeaserWord } from "../lib/teaser";
import { teaserFramesOf, type Timing } from "../lib/timing";
import { useNightFactor } from "../lib/useNightFactor";
import { getThemeColors, parseColor } from "../themes";
import type { ThemeId } from "../types";

/**
 * অডিও টিজার দৃশ্য (Hook-এর পরে): হাদিসের সবচেয়ে শক্তিশালী বাক্যাংশ বড় লেখায়, যে শব্দ বলা হচ্ছে সেটা জ্বলজ্বল করে।
 * ভয়েস এখানে বাজে না — `TeaserAudio` মূল স্তরে বাজায়। শব্দ আসে timestamp JSON থেকে (`teaserWords`; JSON লোড না হওয়া পর্যন্ত রেন্ডার আটকে থাকে)।
 *
 *  - শব্দের অবস্থা: বলা হয়ে গেছে → পুরো উজ্জ্বল; এখন বলা হচ্ছে → accent রঙ + ১.০৮ স্কেল + glow; এখনো বলা হয়নি → ঝাপসা (৩৫%)।
 *  - লেখার ফন্ট শব্দ-সংখ্যা অনুযায়ী (কম শব্দ = বড়); `flex-wrap`, কোনো `overflow: hidden` নেই (বাংলা মাথার মাত্রা কাটে না)।
 *  - প্যানেল কার্ড Hook/Intro-র মতোই; আসল উদ্ধৃতি-চিহ্ন (“ ”) কার্ডের কোণে। শেষ ≤১২ ফ্রেমে ফেড-আউট → Intro।
 *  - সব frame-ভিত্তিক। টিজার ০ ফ্রেম / শব্দ নেই হলে কিছুই আঁকে না।
 */

type Props = {
  theme: ThemeId;
  hadisId: string;
  timing: Timing;
  startSeconds?: number;
  endSeconds?: number;
  size?: { width: number; height: number };
  /** dev প্রিভিউ/টেস্টের জন্য: JSON না পড়ে সরাসরি শব্দ */
  words?: TeaserWord[];
};

/** শব্দ-সংখ্যা অনুযায়ী বেস ফন্ট (Portrait, 1080 বেস); Landscape-এ × ০.৮৫ */
export function teaserFontBase(wordCount: number): number {
  const n = Math.max(0, Math.floor(wordCount));
  if (n <= 6) return 120;
  if (n <= 12) return 100;
  if (n <= 20) return 84;
  if (n <= 30) return 70;
  return 60;
}

function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color);
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${alpha})`;
}

export const TeaserScene: React.FC<Props> = ({ theme, hadisId, timing, startSeconds, endSeconds, size, words: wordsOverride }) => {
  const frame = useCurrentFrame();
  const video = useVideoConfig();
  const fps = video.fps;
  const width = size?.width ?? video.width;
  const height = size?.height ?? video.height;
  const isPortrait = height >= width;
  const u = Math.min(width, height) / 1080;

  const file = useHadisTimestamp(hadisId);
  const p = getThemeColors(theme, useNightFactor(timing));
  const frames = teaserFramesOf(timing);

  let words: TeaserWord[] = wordsOverride ?? [];
  if (!wordsOverride && file && typeof startSeconds === "number" && typeof endSeconds === "number") {
    words = teaserWords(file, { startSeconds, endSeconds });
  }
  if (frames <= 0 || words.length === 0) return null;

  const active = teaserActiveIndex(words, frame, fps);

  const cardIn = spring({ frame, fps, config: { damping: 15, stiffness: 130, mass: 0.8 }, durationInFrames: 26 });
  const fadeFrames = Math.min(TRANSITION_FRAMES, Math.max(1, Math.floor(frames * 0.25)));
  const fadeStart = frames - fadeFrames;
  const fadeOut = interpolate(frame, [fadeStart, frames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outScale = interpolate(frame, [fadeStart, frames], [1, 1.04], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const cardW = isPortrait ? width * 0.9 : width * 0.82;
  const padX = (isPortrait ? 52 : 80) * u;
  const padY = (isPortrait ? 90 : 70) * u;
  const innerW = cardW - padX * 2;
  const fontSize = teaserFontBase(words.length) * (isPortrait ? 1 : 0.85) * u;
  const quoteSize = (isPortrait ? 190 : 150) * u;

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
        <div
          aria-hidden
          style={{ position: "absolute", left: 28 * u, top: -6 * u, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: quoteSize, lineHeight: 1, color: withAlpha(p.accent, 0.55) }}
        >
          “
        </div>
        <div
          aria-hidden
          style={{ position: "absolute", right: 28 * u, bottom: -quoteSize * 0.42, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: quoteSize, lineHeight: 1, color: withAlpha(p.accent, 0.55) }}
        >
          ”
        </div>

        <div
          style={{
            position: "relative",
            width: innerW,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            columnGap: fontSize * 0.24,
            rowGap: fontSize * 0.1,
          }}
        >
          {words.map((w, i) => {
            const spoken = i < active;
            const now = i === active;
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 800,
                  fontSize,
                  lineHeight: 1.45,
                  color: now ? p.accent2 : p.text,
                  opacity: spoken || now ? 1 : 0.35,
                  textShadow: `0 ${4 * u}px ${18 * u}px rgba(0,0,0,0.35)${now ? `, 0 0 ${30 * u}px ${withAlpha(p.glow, 0.55)}` : ""}`,
                  transform: `scale(${now ? 1.08 : 1})`,
                }}
              >
                {w.word}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
