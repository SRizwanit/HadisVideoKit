import React from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import { DayNightSky } from "./DayNightSky";
import { Fireflies } from "./Fireflies";
import { computeNightFactor } from "../lib/dayNight";
import type { Timing } from "../lib/timing";
import { getThemeColors, skyGradient, THEMES } from "../themes";
import type { ThemeId } from "../types";

/**
 * Part 6: ৩ থিমের ব্যাকগ্রাউন্ড।
 *  - emerald / navy : গ্রেডিয়েন্ট + ধীর ঘূর্ণায়মান জিওমেট্রিক প্যাটার্ন (emerald) + ভাসমান কণা
 *  - greenDayNight  : DayNightSky + Fireflies
 * সব অ্যানিমেশন useCurrentFrame() ভিত্তিক।
 *
 * nightFactor আসে `timing` থেকে (Intro ০ → Main-এ ধীরে ~০.৯৫ → Outro ১)।
 * dev প্রিভিউয়ের জন্য `nightFactor` ও `size` সরাসরি দেওয়া যায়।
 */

type Props = {
  theme: ThemeId;
  timing?: Timing;
  nightFactor?: number;
  size?: { width: number; height: number };
};

/** ইসলামী জিওমেট্রিক প্যাটার্ন (৮-কোনা তারা = দুটো ঘোরানো বর্গ + বৃত্ত) */
const GeometricPattern: React.FC<{ width: number; height: number; color: string; frame: number }> = ({
  width,
  height,
  color,
  frame,
}) => {
  const diag = Math.hypot(width, height) * 1.15; // ঘুরলেও কোণা ফাঁকা থাকবে না
  const tile = 150;
  const rotate = frame * 0.04;
  return (
    <svg
      width={diag}
      height={diag}
      style={{
        position: "absolute",
        left: (width - diag) / 2,
        top: (height - diag) / 2,
        transform: `rotate(${rotate}deg)`,
        opacity: 0.1,
      }}
    >
      <defs>
        <pattern id="geo-tile" width={tile} height={tile} patternUnits="userSpaceOnUse">
          <g fill="none" stroke={color} strokeWidth="2">
            <rect x="30" y="30" width="90" height="90" />
            <rect x="30" y="30" width="90" height="90" transform="rotate(45 75 75)" />
            <circle cx="75" cy="75" r="22" />
            <circle cx="0" cy="0" r="10" />
            <circle cx="150" cy="0" r="10" />
            <circle cx="0" cy="150" r="10" />
            <circle cx="150" cy="150" r="10" />
          </g>
        </pattern>
      </defs>
      <rect width={diag} height={diag} fill="url(#geo-tile)" />
    </svg>
  );
};

/** ধীরে ওপরে ভাসা কণা (সোনালী ধুলো / তারা-কণা) */
const Particles: React.FC<{
  width: number;
  height: number;
  count: number;
  color: string;
  kind: "gold" | "stars";
  frame: number;
}> = ({ width, height, count, color, kind, frame }) => {
  const unit = Math.min(width, height) / 1080;
  const rise = kind === "gold" ? 0.35 : 0.08; // নেভিতে খুব ধীর
  const wrapH = height + 40 * unit;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const size = (kind === "gold" ? 3 + 5 * random(`pt-s-${i}`) : 2 + 3.5 * random(`pt-s-${i}`)) * unit;
        const baseX = random(`pt-x-${i}`) * width;
        const sway = Math.sin(frame * (0.01 + 0.02 * random(`pt-w-${i}`)) + random(`pt-p-${i}`) * 6.28) * 30 * unit;
        const speed = rise * (0.5 + random(`pt-v-${i}`)) * unit;
        const y = wrapH - ((random(`pt-y-${i}`) * wrapH + frame * speed) % wrapH);
        const tw = 0.5 + 0.5 * Math.sin(frame * (0.03 + 0.05 * random(`pt-t-${i}`)) + random(`pt-q-${i}`) * 6.28);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: baseX + sway,
              top: y - 20 * unit,
              width: size,
              height: size,
              borderRadius: "50%",
              background: color,
              opacity: (kind === "gold" ? 0.25 : 0.3) + 0.5 * tw,
              boxShadow: `0 0 ${size * 3}px ${color}`,
            }}
          />
        );
      })}
    </>
  );
};

export const Background: React.FC<Props> = ({ theme, timing, nightFactor, size }) => {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const width = size?.width ?? config.width;
  const height = size?.height ?? config.height;

  const nf =
    nightFactor ??
    (timing
      ? computeNightFactor({
          frame,
          introFrames: timing.introFrames,
          mainFrames: timing.mainFrames,
          outroFrames: timing.outroFrames,
        })
      : 0);

  const def = THEMES[theme];
  const palette = getThemeColors(theme, nf);

  if (def.id === "greenDayNight" && def.scenery) {
    return (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <DayNightSky width={width} height={height} nightFactor={nf} />
        <Fireflies
          width={width}
          height={height}
          nightFactor={nf}
          count={def.scenery.fireflyCount}
          color={def.scenery.fireflyColor}
          glow={def.scenery.fireflyGlow}
        />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: skyGradient(palette) }}>
      {def.decor.pattern === "geometric" && (
        <GeometricPattern width={width} height={height} color={palette.accent} frame={frame} />
      )}
      {def.decor.particles !== "none" && (
        <Particles
          width={width}
          height={height}
          count={def.decor.particleCount}
          color={def.decor.particles === "gold" ? palette.accent : palette.accent2}
          kind={def.decor.particles}
          frame={frame}
        />
      )}
    </AbsoluteFill>
  );
};
