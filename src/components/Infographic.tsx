import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { toBnDigits } from "../lib/bnDigits";
import { computeNightFactor } from "../lib/dayNight";
import {
  buildFrameInfographics,
  compareSideOf,
  findActiveInfographic,
  infographicItemProgress,
  infographicVisibility,
  type FrameInfographic,
} from "../lib/infographic";
import { useHadisTimestamp } from "../lib/loadHadis";
import type { Timing } from "../lib/timing";
import { computeLayout } from "../lib/useLayout";
import { getThemeColors, parseColor, type Palette } from "../themes";
import type { ThemeId } from "../types";
import { FitText } from "./FitText";
import { RIBBON_INK } from "./Ribbon";

/**
 * ইনফোগ্রাফিক: timestamp JSON-এর `infographics` থেকে নির্দিষ্ট সময়ে তথ্য-কার্ড ফোটায় — `layout.infoBox`-এ (আয়তাকার)।
 *  - Portrait: SVG তখন ছোট হয়ে উপরে থাকে (`SvgStage`), কার্ড তার ঠিক নিচে; ক্যাপশন নিজের জায়গায়, পুরো আকারে
 *  - Landscape: SVG বাঁয়ে একই; ডান কলামের উপরে কার্ড, তার নিচে ক্যাপশন-বক্স (ছোট হয়ে)
 *  - SVG/ক্যাপশনের লেআউট বদল `useInfographicMix` → `computeLayout(w, h, mix)` দিয়ে (সবাই একই সংখ্যা পায়)
 *  - steps   → ধাপে ধাপে ক্রম (সংখ্যা-ব্যাজ + মাঝে তীর)
 *  - list    → সংখ্যা-দেওয়া পয়েন্ট
 *  - compare → বাঁ/ডান দুই কলাম
 * JSON-এ `infographics` না থাকলে বা এখন কোনো ইনফোগ্রাফিকের সময় না হলে **কিছুই আঁকে না** (null) — ভিডিও আগের মতোই।
 * কার্ড SVG বা ক্যাপশন ঢাকে না — নিজের আলাদা বক্সে বসে।
 * সব মাপ কার্ডের ছোট দিকের সমানুপাতিক → 4K = ঠিক ২× HD। কোনো CSS transition নেই — সব ফ্রেম থেকে (render-safe)।
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

type RowProps = {
  text: string;
  /** দেখানো সংখ্যা (বাংলায়) */
  num: string;
  progress: number;
  p: Palette;
  rowH: number;
  innerW: number;
  S: number;
  /** compare-এ পাশ বুঝে ঢোকার দিক */
  fromX?: number;
  compact?: boolean;
};

const Row: React.FC<RowProps> = ({ text, num, progress, p, rowH, innerW, S, fromX = 0, compact = false }) => {
  const d = Math.min(rowH * 0.74, S * (compact ? 0.1 : 0.14));
  const gap = S * (compact ? 0.02 : 0.03);
  const padX = S * (compact ? 0.022 : 0.03);
  const textW = Math.max(10, innerW - d - gap - padX * 2);
  return (
    <div
      style={{
        width: innerW,
        height: rowH,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap,
        padding: `0 ${padX}px`,
        borderRadius: S * 0.04,
        background: withAlpha("#000000", 0.22),
        border: `${Math.max(1, S * 0.004)}px solid ${withAlpha(p.accent, 0.7)}`,
        opacity: progress,
        transform: `translate(${(1 - progress) * fromX}px, ${(1 - progress) * S * 0.03}px)`,
      }}
    >
      <div
        style={{
          width: d,
          height: d,
          flexShrink: 0,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${p.accent}, ${p.accent2})`,
          boxShadow: `0 0 ${S * 0.03}px ${withAlpha(p.glow, 0.55)}`,
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: d * 0.56,
          lineHeight: 1,
          color: RIBBON_INK,
        }}
      >
        {num}
      </div>
      <div style={{ width: textW, position: "relative" }}>
        <FitText
          text={text}
          baseSize={rowH * (compact ? 0.3 : 0.36)}
          minSize={rowH * 0.2}
          maxWidth={textW}
          color={p.text}
          fontFamily={FONT_BODY}
          fontWeight={700}
          lineHeight={1.25}
          textAlign="left"
          maxLines={compact ? 3 : 2}
        />
      </div>
    </div>
  );
};

/** steps-এর দুই ধাপের মাঝের ছোট তীর (নিচের item ফোটার সাথে ফোটে) */
const Arrow: React.FC<{ p: Palette; h: number; S: number; progress: number; d: number; padX: number }> = ({
  p,
  h,
  S,
  progress,
  d,
  padX,
}) => (
  <div
    style={{
      height: h,
      width: "100%",
      position: "relative",
      opacity: progress,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: padX + d / 2,
        top: 0,
        transform: "translateX(-50%)",
        width: 0,
        height: 0,
        borderLeft: `${S * 0.016}px solid transparent`,
        borderRight: `${S * 0.016}px solid transparent`,
        borderTop: `${Math.max(h * 0.8, 1)}px solid ${p.accent2}`,
      }}
    />
  </div>
);

const InfographicCard: React.FC<{
  g: FrameInfographic;
  frame: number;
  p: Palette;
  /** কার্ডের প্রস্থ ও উচ্চতা (`layout.infoBox`) — আয়তাকার */
  W: number;
  H: number;
}> = ({ g, frame, p, W, H }) => {
  const visibility = infographicVisibility(g, frame);
  // সব অনুপাত ছোট দিক ধরে (4K = ঠিক ২× HD)
  const S = Math.min(W, H);
  const pad = S * 0.05;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;
  const titleH = g.title ? S * 0.12 : 0;
  const titleGap = g.title ? S * 0.025 : 0;
  const bodyH = innerH - titleH - titleGap;
  const n = g.items.length;

  let body: React.ReactNode = null;

  if (g.type === "compare") {
    const colGap = S * 0.03;
    const colW = (innerW - colGap) / 2;
    const hasHeads = Boolean(g.leftTitle || g.rightTitle);
    const headH = hasHeads ? S * 0.09 : 0;
    const headGap = hasHeads ? S * 0.02 : 0;
    const left = g.items.map((it, i) => ({ it, i })).filter(({ it, i }) => compareSideOf(it, i) === "left");
    const right = g.items.map((it, i) => ({ it, i })).filter(({ it, i }) => compareSideOf(it, i) === "right");
    const maxCount = Math.max(1, left.length, right.length);
    const itemGap = S * 0.02;
    const rowH = Math.min(S * 0.24, (bodyH - headH - headGap - (maxCount - 1) * itemGap) / maxCount);
    const column = (rows: typeof left, title: string | undefined, sign: 1 | -1) => (
      <div style={{ width: colW, display: "flex", flexDirection: "column", alignItems: "center", gap: itemGap }}>
        {hasHeads && (
          <div
            style={{
              width: colW,
              height: headH,
              boxSizing: "border-box",
              marginBottom: headGap - itemGap,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              background: `linear-gradient(90deg, ${p.accent}, ${p.accent2})`,
              padding: `0 ${S * 0.02}px`,
            }}
          >
            <div style={{ width: colW - S * 0.06, position: "relative" }}>
              <FitText
                text={title ?? " "}
                baseSize={headH * 0.46}
                minSize={headH * 0.28}
                maxWidth={colW - S * 0.06}
                color={RIBBON_INK}
                fontFamily={FONT_DISPLAY}
                fontWeight={800}
                lineHeight={1.2}
                maxLines={1}
              />
            </div>
          </div>
        )}
        {rows.map(({ it, i }, k) => (
          <Row
            key={i}
            text={it.text}
            num={toBnDigits(k + 1)}
            progress={infographicItemProgress(it, frame)}
            p={p}
            rowH={rowH}
            innerW={colW}
            S={S}
            fromX={sign * S * 0.06}
            compact
          />
        ))}
      </div>
    );
    body = (
      <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: colGap }}>
        {column(left, g.leftTitle, -1)}
        {column(right, g.rightTitle, 1)}
      </div>
    );
  } else {
    const isSteps = g.type === "steps";
    const arrowH = isSteps ? S * 0.035 : 0;
    const rowGap = isSteps ? S * 0.008 : S * 0.022;
    const rowH = Math.min(S * 0.2, (bodyH - (n - 1) * (arrowH + rowGap * 2)) / n);
    const d = Math.min(rowH * 0.74, S * 0.14);
    const padX = S * 0.03;
    body = (
      <div style={{ width: innerW, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {g.items.map((it, i) => {
          const prog = infographicItemProgress(it, frame);
          return (
            <React.Fragment key={i}>
              {isSteps && i > 0 && (
                <div style={{ width: innerW, paddingTop: rowGap, paddingBottom: rowGap }}>
                  <Arrow p={p} h={arrowH} S={S} progress={prog} d={d} padX={padX} />
                </div>
              )}
              <div style={{ paddingTop: !isSteps && i > 0 ? rowGap : 0 }}>
                <Row text={it.text} num={toBnDigits(i + 1)} progress={prog} p={p} rowH={rowH} innerW={innerW} S={S} />
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div
      data-infographic={g.type}
      data-infographic-index={g.index}
      style={{
        position: "relative",
        width: W,
        height: H,
        boxSizing: "border-box",
        padding: pad,
        borderRadius: S * 0.06,
        // অস্বচ্ছ ব্যাকিং (নিচের SVG ঢাকতে) + থিমের প্যানেল-রঙ উপরে
        background: `linear-gradient(${p.panelBg}, ${p.panelBg}), ${p.skyMid}`,
        border: `${Math.max(2, S * 0.004)}px solid ${p.panelBorder}`,
        boxShadow: `0 ${S * 0.02}px ${S * 0.06}px rgba(0,0,0,0.4), 0 0 ${S * 0.05}px ${withAlpha(p.glow, 0.25)}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: visibility,
        transform: `scale(${0.94 + 0.06 * visibility})`,
      }}
    >
      {g.title && (
        <div style={{ width: innerW, height: titleH, marginBottom: titleGap, position: "relative" }}>
          <FitText
            text={g.title}
            baseSize={titleH * 0.58}
            minSize={titleH * 0.34}
            maxWidth={innerW}
            color={p.accent2}
            fontFamily={FONT_DISPLAY}
            fontWeight={800}
            lineHeight={1.25}
            maxLines={2}
          />
        </div>
      )}
      <div style={{ width: innerW, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>{body}</div>
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
      <InfographicCard g={active} frame={absFrame} p={p} W={W} H={H} />
    </div>
  );
};
