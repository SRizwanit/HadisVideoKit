import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_BODY } from "../fonts";
import { computeNightFactor } from "../lib/dayNight";
import {
  buildFrameInfographics,
  findActiveInfographic,
  infographicItemProgress,
  infographicVisibility,
  planInfographicPills,
  type FrameInfographic,
} from "../lib/infographic";
import { useHadisTimestamp } from "../lib/loadHadis";
import type { Timing } from "../lib/timing";
import { computeLayout } from "../lib/useLayout";
import { getThemeColors, parseColor, type Palette } from "../themes";
import type { ThemeId } from "../types";

/**
 * ইনফোগ্রাফিক: timestamp JSON-এর `infographics` থেকে নির্দিষ্ট সময়ে **ছোট ছোট পয়েন্ট (পিল)** ফোটায় — `layout.infoBox`-এ (SVG-র ঠিক নিচের স্ট্রিপ)।
 *  - steps   → পিল → পিল (মাঝে সোনালি তীর), যেমন "নিয়ত → ফল"
 *  - list    → পাশাপাশি পিল, মাঝে ছোট ফোঁটা (◆)
 *  - compare → বাঁ-পিল ◆ ডান-পিল
 *  - বড় কার্ড/ব্যাকগ্রাউন্ড/সংখ্যা-ব্যাজ নেই; শুধু গোল-কোনা পিল: গাঢ় ভেতর, সোনালি (accent) বর্ডার, বোল্ড লেখা
 *  - Portrait: SVG একটু ছোট হয়ে উপরে থাকে (`SvgStage`), পিল তার নিচে; ক্যাপশন নিজের জায়গায়, পুরো আকারে
 *  - Landscape: SVG বাঁয়ে একই; ডান কলামের উপরে পাতলা স্ট্রিপে পিল, তার নিচে ক্যাপশন-বক্স (ছোট হয়ে)
 *  - SVG/ক্যাপশনের লেআউট বদল `useInfographicMix` → `computeLayout(w, h, mix)` দিয়ে (সবাই একই সংখ্যা পায়)
 *  - মাপের হিসাব পিওর `planInfographicPills` (src/lib/infographic.ts): ২–৩টা পয়েন্ট এক সারিতে, লম্বা হলে ফন্ট কমে
 * JSON-এ `infographics` না থাকলে বা এখন কোনো ইনফোগ্রাফিকের সময় না হলে **কিছুই আঁকে না** (null) — ভিডিও আগের মতোই।
 * সব মাপ স্ট্রিপের প্রস্থ/উচ্চতার সমানুপাতিক → 4K = ঠিক ২× HD। কোনো CSS transition নেই — সব ফ্রেম থেকে (render-safe)।
 * Main `<Sequence from={intro}>`-এর ভেতরে বসালে `frameOffset={timing.introFrames}` দিতে হয় (`MainScene` দেয়)।
 */

export type InfographicProps = {
  hadisId: string;
  theme: ThemeId;
  timing: Timing;
  /** `<Sequence from>`-এর অফসেট (ফ্রেম) — ভিডিওর পরম ফ্রেম = useCurrentFrame() + frameOffset */
  frameOffset?: number;
  /** dev প্রিভিউয়ের জন্য: ভিডিওর সাইজ ছাড়া অন্য সাইজে লেআউট */
  size?: { width: number; height: number };
  /** dev প্রিভিউয়ের জন্য: ভিডিওর পরম ফ্রেম সরাসরি */
  frame?: number;
};

function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color);
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${alpha})`;
}

/** দুই পিলের মাঝের সোনালি তীর (লাইন + মাথা) — পরের পিল ফোটার সাথে ফোটে */
const Arrow: React.FC<{ w: number; h: number; p: Palette; progress: number }> = ({ w, h, p, progress }) => {
  const stroke = Math.max(2, h * 0.07);
  const head = h * 0.16;
  return (
    <div style={{ width: w, height: h, position: "relative", opacity: progress, flexShrink: 0 }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          width: w - head * 0.6,
          height: stroke,
          marginTop: -stroke / 2,
          borderRadius: stroke,
          background: p.accent,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 0,
          top: "50%",
          marginTop: -head,
          width: 0,
          height: 0,
          borderTop: `${head}px solid transparent`,
          borderBottom: `${head}px solid transparent`,
          borderLeft: `${head * 1.3}px solid ${p.accent}`,
        }}
      />
    </div>
  );
};

/** list/compare-এর মাঝের ছোট সোনালি ফোঁটা (ঘোরানো বর্গ) */
const Dot: React.FC<{ w: number; h: number; p: Palette; progress: number }> = ({ w, h, p, progress }) => {
  const d = h * 0.2;
  return (
    <div style={{ width: w, height: h, position: "relative", opacity: progress, flexShrink: 0 }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: d,
          height: d,
          marginLeft: -d / 2,
          marginTop: -d / 2,
          transform: "rotate(45deg)",
          background: p.accent,
          boxShadow: `0 0 ${d}px ${withAlpha(p.glow, 0.6)}`,
        }}
      />
    </div>
  );
};

const InfographicPills: React.FC<{
  g: FrameInfographic;
  frame: number;
  p: Palette;
  /** স্ট্রিপের প্রস্থ ও উচ্চতা (`layout.infoBox`) */
  W: number;
  H: number;
}> = ({ g, frame, p, W, H }) => {
  const visibility = infographicVisibility(g, frame);
  const plan = planInfographicPills(g, W, H);
  const { pillH, fontSize, gap, border } = plan;

  return (
    <div
      data-infographic={g.type}
      data-infographic-index={g.index}
      style={{
        position: "relative",
        width: W,
        height: H,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap,
        opacity: visibility,
        transform: `translateY(${(1 - visibility) * pillH * 0.2}px)`,
      }}
    >
      {plan.parts.map((part, k) => {
        if (part.kind === "pill") {
          const prog = infographicItemProgress(g.items[part.item], frame);
          return (
            <div
              key={k}
              style={{
                width: part.w,
                height: pillH,
                boxSizing: "border-box",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: pillH,
                // গাঢ় ভেতর (নিচের SVG/ব্যাকগ্রাউন্ড মিশে না যায়) + সোনালি বর্ডার
                background: `linear-gradient(${p.panelBg}, ${p.panelBg}), ${p.skyMid}`,
                border: `${border}px solid ${p.accent}`,
                boxShadow: `0 0 ${pillH * 0.18}px ${withAlpha(p.glow, 0.3)}`,
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize,
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                color: p.text,
                opacity: prog,
                transform: `translateY(${(1 - prog) * pillH * 0.25}px) scale(${0.92 + 0.08 * prog})`,
              }}
            >
              {part.text}
            </div>
          );
        }
        // তীর ও বিভাজক তাদের ডানের (পরের) পিল ফোটার সাথে ফোটে
        const nextPill = plan.parts[k + 1];
        const prog =
          part.kind === "arrow"
            ? infographicItemProgress(g.items[part.item], frame)
            : nextPill && nextPill.kind === "pill"
              ? infographicItemProgress(g.items[nextPill.item], frame)
              : 1;
        return part.kind === "arrow" ? (
          <Arrow key={k} w={part.w} h={pillH} p={p} progress={prog} />
        ) : (
          <Dot key={k} w={part.w} h={pillH} p={p} progress={prog} />
        );
      })}
    </div>
  );
};

export const Infographic: React.FC<InfographicProps> = ({ hadisId, theme, timing, frameOffset = 0, size, frame }) => {
  const currentFrame = useCurrentFrame();
  const video = useVideoConfig();
  const L = computeLayout(size?.width ?? video.width, size?.height ?? video.height);
  const absFrame = frame ?? currentFrame + frameOffset;

  const timestamp = useHadisTimestamp(hadisId);
  const list = useMemo(
    () => (timestamp ? buildFrameInfographics(timestamp, timing) : []),
    // timing object প্রতি রেন্ডারে নতুন হতে পারে — তাই তার সংখ্যাগুলো ধরেই মেলানো
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timestamp, timing.fps, timing.introFrames, timing.mainFrames, timing.outroFrames, timing.totalFrames],
  );

  const active = findActiveInfographic(list, absFrame);
  if (!active) return null;

  const nightFactor = computeNightFactor({
    frame: absFrame,
    introFrames: timing.introFrames,
    mainFrames: timing.mainFrames,
    outroFrames: timing.outroFrames,
    timeMode: timing.timeMode,
  });
  const p = getThemeColors(theme, nightFactor);
  const { x, y, width: W, height: H } = L.infoBox;

  return (
    <div style={{ position: "absolute", left: x, top: y, width: W, height: H }}>
      <InfographicPills g={active} frame={absFrame} p={p} W={W} H={H} />
    </div>
  );
};
