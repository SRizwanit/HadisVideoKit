import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_BODY } from "../fonts";
import {
  CAPTION_LINE_HEIGHT,
  fitCaption,
  planCaption,
  popScale,
  wordColorIndex,
  wordLook,
  type CaptionPlan,
} from "../lib/captionWords";
import { computeNightFactor } from "../lib/dayNight";
import { useHadisTimestamp } from "../lib/loadHadis";
import { buildFrameSegments, type FrameSegment, type Timing } from "../lib/timing";
import { computeLayout, type Layout } from "../lib/useLayout";
import { getThemeColors, mixColors, parseColor, type Palette } from "../themes";
import type { ThemeId } from "../types";

/**
 * Part 10: রঙিন অ্যানিমেটেড ক্যাপশন (ভিডিওর নিচের বাক্স)।
 *
 *  - যে সেগমেন্ট চলছে তার শব্দগুলো `captionBox`-এর ভেতরে আঁকা হয়। বাক্স সেগমেন্টের শুরুতে নিচ থেকে উঠে আসে, শেষে মিলিয়ে যায়
 *    (গায়ে-গায়ে সেগমেন্টে ফেড নেই — নিয়ম `lib/captionWords.ts`-এ)।
 *  - শব্দ তিন অবস্থায়: upcoming (ঝাপসা) · active (রঙিন, ১.১৫ pop, glow, আন্ডারলাইন) · read (মূল লেখার রঙ)।
 *    active রঙ থিমের ৬টা `captionColors` থেকে ঘুরে ঘুরে। হাইলাইট অডিওর শব্দ-সময়ের সাথে (JSON-এর `words`; না থাকলে সমান ভাগ — Part 5)।
 *  - ফন্ট বেস → min-এর মাঝে আপনা-আপনি আঁটে (লাইন বেশি হলে ছোট); minSize-এও না আঁটলে "…" দিয়ে ছাঁটা (বাক্সের বাইরে যায় না)।
 *    মাপা হয় ব্রাউজারে লুকানো `span`-এ (FitText-এর মতো), প্রতি সেগমেন্টে একবার → সেগমেন্টের ভেতরে ফন্ট কাঁপে না।
 *  - প্যানেলের রঙ/বর্ডার/শব্দের রঙ `getThemeColors(theme, nightFactor)` থেকে → greenDayNight-এ দিন-গোধূলি-রাতে কনট্রাস্ট বজায় থাকে।
 *  - সব অ্যানিমেশন ফ্রেম থেকে হিসাব (CSS animation/`Math.random()` নেই) → render-safe।
 *
 * ⚠️ Part 13: Main `<Sequence from={intro}>`-এর ভেতরে বসালে `frameOffset={timing.introFrames}` দিতে হবে (Header/SvgStage-এর মতো)।
 */

/** প্যানেলের ভেতরের মার্জিন (unit-এ) */
export const CAPTION_PAD_UNITS = 36;
/** প্যানেলের কোণ (unit-এ) */
const PANEL_RADIUS_UNITS = 36;
/**
 * প্যানেলের পেছনের ঝাপসা (backdrop blur, unit-এ)। রেন্ডারে ঝাপসা ঠিকমতো না এলে এই একটা সংখ্যা ০ করুন — বাকি সব আগের মতো চলবে
 * (Part 9L-এর BLUR_UNITS-এর মতো)।
 */
export const PANEL_BLUR_UNITS = 10;

export type CaptionViewProps = {
  segments: FrameSegment[];
  theme: ThemeId;
  timing: Timing;
  /** ভিডিওর পরম ফ্রেম (Intro-সহ) */
  absFrame: number;
  /** লেআউট যে সাইজের হিসাবে হবে (ভিডিওর সাইজ, বা প্রিভিউয়ে অন্য সাইজ) */
  size: { width: number; height: number };
};

export type CaptionProps = {
  hadisId: string;
  theme: ThemeId;
  timing: Timing;
  /** `<Sequence from>`-এর অফসেট (ফ্রেম) — পরম ফ্রেম = useCurrentFrame() + frameOffset */
  frameOffset?: number;
  /** dev প্রিভিউয়ের জন্য: অন্য সাইজে লেআউট (ডিফল্ট: useVideoConfig) */
  size?: { width: number; height: number };
  /** dev প্রিভিউয়ের জন্য: পরম ফ্রেম সরাসরি */
  frame?: number;
};

const withAlpha = (color: string, alpha: number): string => {
  try {
    const c = parseColor(color);
    return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${Math.max(0, Math.min(1, alpha))})`;
  } catch {
    return color;
  }
};

/** এক সেগমেন্টের বাক্স: ফন্ট মাপে (hook) + শব্দ আঁকে। সেগমেন্ট বদলালে `key` বদলায় → নতুন মাপ */
const CaptionBox: React.FC<{
  seg: FrameSegment;
  plan: CaptionPlan;
  L: Layout;
  palette: Palette;
  absFrame: number;
  fps: number;
}> = ({ seg, plan, L, palette, absFrame, fps }) => {
  const u = L.unit;
  const pad = CAPTION_PAD_UNITS * u;
  const box = L.captionBox;
  const innerW = Math.max(1, box.width - 2 * pad);
  const innerH = Math.max(1, box.height - 2 * pad);
  const base = L.fontSizes.captionMax;

  const words = seg.words;
  const fullText = useMemo(() => words.map((w) => w.word).join(" "), [words]);

  const measureRef = useRef<HTMLSpanElement>(null);
  const [natural, setNatural] = useState<number>(0);

  useLayoutEffect(() => {
    let alive = true;
    const measure = () => {
      const el = measureRef.current;
      if (!el || !alive) return;
      const w = el.offsetWidth;
      setNatural((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
    };
    measure();
    // ফন্ট পরে লোড হলে (Studio-তে) আবার মাপা
    const fonts = (typeof document !== "undefined" ? document.fonts : undefined) as { ready?: Promise<unknown> } | undefined;
    fonts?.ready?.then(measure).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [fullText, base]);

  const fit = fitCaption({
    naturalWidth: natural,
    baseSize: base,
    minSize: L.fontSizes.captionMin,
    maxWidth: innerW,
    maxHeight: innerH,
    lineHeight: CAPTION_LINE_HEIGHT,
  });
  // Part 14C-fix: আন্দাজের পর আসল উচ্চতা মেপে দেখা — বাক্সে না আঁটলে ফন্ট ৬% করে কমে (ন্যূনতম captionMin-এর ৭৫%)।
  // সেগমেন্টের মধ্যে ফলাফল স্থির (state), তাই ফন্ট কাঁপে না; রেন্ডারে প্রতিটি ফ্রেম একই ধাপে একই মানে পৌঁছায়।
  const textRef = useRef<HTMLDivElement>(null);
  const [adj, setAdj] = useState<{ base: number; k: number }>({ base: fit.fontSize, k: 1 });
  const k = adj.base === fit.fontSize ? adj.k : 1;
  const floorSize = L.fontSizes.captionMin * 0.75;
  const fs = Math.max(Math.min(fit.fontSize, floorSize), fit.fontSize * k);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || natural <= 0) return;
    const h = el.offsetHeight;
    if (h > innerH + 0.5 && fs > floorSize + 0.01) {
      setAdj({ base: fit.fontSize, k: k * 0.94 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fs, fit.fontSize, innerH, innerW, natural, fullText]);
  const barH = Math.max(3 * u, fs * 0.06);

  const wordNodes: React.ReactNode[] = [];
  words.forEach((w, i) => {
    const look = wordLook(words, i, absFrame, fps);
    const activeColor = palette.captionColors[wordColorIndex(seg.index, i, palette.captionColors.length)] ?? palette.accent;
    const color = mixColors(palette.text, activeColor, look.activeMix);
    const glow = look.activeMix > 0.01 ? `0 0 ${fs * 0.32 * look.activeMix}px ${withAlpha(activeColor, 0.85 * look.activeMix)}, ` : "";
    wordNodes.push(
      <React.Fragment key={i}>
        <span
          data-word={i}
          data-state={look.state}
          style={{
            display: "inline-block",
            position: "relative",
            padding: "0 0.05em",
            color,
            opacity: look.opacity,
            transform: look.pop > 0.001 ? `scale(${popScale(look.pop)})` : undefined,
            transformOrigin: "50% 60%",
            textShadow: `${glow}0 ${2 * u}px ${6 * u}px rgba(0, 0, 0, 0.45)`,
          }}
        >
          {w.word}
          {look.underline > 0.01 ? (
            <span
              data-underline=""
              style={{
                position: "absolute",
                left: "6%",
                right: "6%",
                bottom: "0.04em",
                height: barH,
                borderRadius: barH,
                background: activeColor,
                transformOrigin: "50% 50%",
                transform: `scaleX(${look.underline})`,
                opacity: look.activeMix,
              }}
            />
          ) : null}
        </span>
        {i < words.length - 1 ? " " : null}
      </React.Fragment>,
    );
  });

  const active = words.findIndex((_, i) => wordLook(words, i, absFrame, fps).state === "active");

  return (
    <div
      data-caption=""
      data-segment={seg.index}
      data-words={words.length}
      data-active-word={active}
      data-font-size={fs.toFixed(2)}
      data-lines={fit.lines}
      data-clipped={fit.clipped ? 1 : 0}
      data-opacity={plan.opacity.toFixed(3)}
      data-slide={plan.slideUnits.toFixed(3)}
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        boxSizing: "border-box",
        borderRadius: PANEL_RADIUS_UNITS * u,
        background: palette.panelBg,
        border: `${Math.max(2, 2.5 * u)}px solid ${palette.panelBorder}`,
        boxShadow: `0 ${10 * u}px ${30 * u}px rgba(0, 0, 0, 0.35)`,
        backdropFilter: PANEL_BLUR_UNITS > 0 ? `blur(${PANEL_BLUR_UNITS * u}px)` : undefined,
        opacity: plan.opacity,
        transform: plan.slideUnits > 0.001 ? `translateY(${plan.slideUnits * u}px)` : undefined,
        overflow: "hidden",
      }}
    >
      {/* মাপার জন্য লুকানো কপি (বেস সাইজ, এক লাইন) */}
      <span
        ref={measureRef}
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          visibility: "hidden",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          fontFamily: FONT_BODY,
          fontWeight: 700,
          fontSize: base,
          lineHeight: CAPTION_LINE_HEIGHT,
        }}
      >
        {/* Part 14C-fix: আসল শব্দের মতোই inline-block + ০.০৫em padding, নইলে মাপ কম আসত */}
        {words.map((w, i) => (
          <React.Fragment key={i}>
            <span style={{ display: "inline-block", padding: "0 0.05em" }}>{w.word}</span>
            {i < words.length - 1 ? " " : null}
          </React.Fragment>
        ))}
      </span>
      <div
        data-caption-text=""
        style={{
          position: "absolute",
          left: pad,
          top: pad,
          width: innerW,
          height: innerH,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <div
          ref={textRef}
          style={{
            width: "100%",
            // ছাঁটার দরকার হলেই শুধু উচ্চতা-সীমা; নইলে বাড়তে দিই (pop-স্কেল/আন্ডারলাইন কাটা পড়ে না, আর উপচে পড়লে মাপা যায়)
            maxHeight: fit.clipped ? "100%" : undefined,
            textAlign: "center",
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: fs,
            lineHeight: CAPTION_LINE_HEIGHT,
            textWrap: "balance",
            overflowWrap: "break-word",
            overflow: fit.clipped ? "hidden" : "visible",
            // minSize-এও না আঁটলে সীমার বেশি লাইন "…" দিয়ে ছাঁটা (বাক্সের বাইরে যায় না)
            display: fit.clipped ? "-webkit-box" : "block",
            WebkitBoxOrient: fit.clipped ? "vertical" : undefined,
            WebkitLineClamp: fit.clipped ? fit.maxLines : undefined,
          }}
        >
          {wordNodes}
        </div>
      </div>
    </div>
  );
};

/** সেগমেন্ট + ফ্রেম ধরে ক্যাপশন আঁকে (ডেটা-লোড ছাড়া — প্রিভিউ সরাসরি এটা ডাকে) */
export const CaptionView: React.FC<CaptionViewProps> = ({ segments, theme, timing, absFrame, size }) => {
  const L = computeLayout(size.width, size.height);

  // শুধু Main অংশ: Intro/Outro-তে কিছু আঁকা হয় না (কখন দেখাবে Part 13-এর `Sequence` ঠিক করে)
  const mainStart = timing.introFrames;
  const mainEnd = timing.introFrames + timing.mainFrames;
  if (!(absFrame >= mainStart && absFrame < mainEnd)) return null;

  const plan = planCaption(segments, absFrame);
  if (!plan) return null;
  const seg = segments[plan.index];
  if (!seg || seg.words.length === 0) return null;

  const nightFactor = computeNightFactor({
    frame: absFrame,
    introFrames: timing.introFrames,
    mainFrames: timing.mainFrames,
    outroFrames: timing.outroFrames,
  });
  const palette = getThemeColors(theme, nightFactor);

  return <CaptionBox key={plan.index} seg={seg} plan={plan} L={L} palette={palette} absFrame={absFrame} fps={timing.fps} />;
};

export const Caption: React.FC<CaptionProps> = ({ hadisId, theme, timing, frameOffset = 0, size, frame }) => {
  const currentFrame = useCurrentFrame();
  const video = useVideoConfig();
  const absFrame = frame ?? currentFrame + frameOffset;

  const timestamp = useHadisTimestamp(hadisId);
  const segments = useMemo(
    () => (timestamp ? buildFrameSegments(timestamp, timing) : []),
    // timing object প্রতি রেন্ডারে নতুন হতে পারে — তাই তার সংখ্যাগুলো ধরেই মেলানো (SvgStage-এর মতো)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timestamp, timing.fps, timing.introFrames, timing.mainFrames, timing.outroFrames, timing.totalFrames],
  );

  return (
    <CaptionView
      segments={segments}
      theme={theme}
      timing={timing}
      absFrame={absFrame}
      size={size ?? { width: video.width, height: video.height }}
    />
  );
};
