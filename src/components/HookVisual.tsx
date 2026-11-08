import React, { useMemo } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useHadisTimestamp } from "../lib/loadHadis";
import { pickHookSvg } from "../lib/hookSvg";
import { useSvgInventory } from "../lib/svgInventory";
import { floatOffset, stageGlow } from "../lib/svgStage";
import type { Timing } from "../lib/timing";
import { useNightFactor } from "../lib/useNightFactor";
import type { ThemeId } from "../types";
import { StageLayer } from "./SvgStage";

/**
 * ভিজ্যুয়াল হুক: Hook দৃশ্যের একদম প্রথম ফ্রেম থেকেই বিষয়ের সাথে মেলে এমন SVG এনিমেশন (লেখার পাশে/উপরে)।
 *  - কোন SVG: `pickHookSvg` (JSON `hookSvg` → টিজারের সেগমেন্টের SVG → প্রথম সেগমেন্টের SVG; কিছু না থাকলে fallback আইকন)।
 *  - আঁকা: Main-এর `SvgStage`-এর মতোই (glow + হালকা ডিস্ক + ভাসা; একই `StageLayer`/`AnimatedSvg`), এনিমেশন Hook-এর নিজস্ব ফ্রেম ০ থেকে।
 *  - প্রথম ফ্রেমেই পুরো দৃশ্যমান (opacity ১); শুধু স্কেল ০.৮৫ → ১ দ্রুত স্প্রিংয়ে — শর্টসের প্রথম ফ্রেম ফাঁকা থাকে না।
 *  - id/class/keyframe prefix `hook-s0-` — Main-এর `s<N>-` থেকে আলাদা।
 *  - ইনভেন্টরি/JSON লোড শেষ না হওয়া পর্যন্ত কিছু আঁকে না (ভেতরের hook-গুলো নিজেরাই `delayRender` ধরে রাখে)।
 */

type Props = {
  hadisId: string;
  theme: ThemeId;
  timing: Timing;
  /** বর্গ বাক্সের পাশ (px) */
  size: number;
  /** টিজারের শুরু (সেকেন্ড) — `HadisVideoProps.teaserStartSeconds` (টিজার বন্ধ/না থাকলে undefined) */
  teaserStartSeconds?: number;
  /** ১০৮০-বেস unit (ভাসার মাপের জন্য) */
  unit: number;
};

export const HookVisual: React.FC<Props> = ({ hadisId, theme, timing, size, teaserStartSeconds, unit }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nightFactor = useNightFactor(timing);

  const timestamp = useHadisTimestamp(hadisId);
  const inventory = useSvgInventory();
  const namesKey = inventory.names.join("|");

  const pick = useMemo(
    () => (inventory.ready && timestamp ? pickHookSvg(timestamp, inventory.names, teaserStartSeconds) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inventory.ready, namesKey, timestamp, teaserStartSeconds],
  );

  if (!pick) return <div style={{ width: size, height: size, flexShrink: 0 }} />;

  const glow = stageGlow(theme, nightFactor, size);
  const glowShift = glow.glowRadius - size / 2;
  const discShift = glow.discRadius - size / 2;
  const pop = spring({ frame, fps, config: { damping: 13, stiffness: 190, mass: 0.7 }, durationInFrames: 16 });
  const scale = interpolate(pop, [0, 1], [0.85, 1]);

  return (
    <div
      data-hook-visual=""
      data-svg={pick.name ?? "fallback"}
      data-source={pick.source}
      style={{ position: "relative", width: size, height: size, flexShrink: 0, transform: `scale(${scale})` }}
    >
      <div
        style={{
          position: "absolute",
          left: -glowShift,
          top: -glowShift,
          width: glow.glowRadius * 2,
          height: glow.glowRadius * 2,
          background: glow.glowBackground,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -discShift,
          top: -discShift,
          width: glow.discRadius * 2,
          height: glow.discRadius * 2,
          borderRadius: "50%",
          background: glow.discBackground,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: size,
          height: size,
          transform: `translateY(${floatOffset(frame, unit)}px)`,
        }}
      >
        <StageLayer
          name={pick.name}
          segmentIndex={0}
          localFrame={frame}
          boxSize={size}
          theme={theme}
          nightFactor={nightFactor}
          idScope="hook-"
        />
      </div>
    </div>
  );
};
