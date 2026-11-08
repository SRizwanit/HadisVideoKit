import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_BODY } from "../fonts";
import {
  CAPTION_LINE_HEIGHT,
  CAPTION_MAX_LINES,
  clampBoxToSafe,
  pageIndexAt,
  pageTextOpacity,
  paginateCaption,
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
 *  - (ক্যাপশন-ফিক্স) **সর্বোচ্চ ২ লাইন:** লম্বা সেগমেন্ট শব্দ ধরে "পেজ"-এ ভাগ হয় (`paginateCaption`)। প্রতি পেজে ≤ ২ লাইন, ফন্ট স্থির (বেস সাইজ) —
 *    আগের মতো ফন্ট ছোট হয়ে ৩-৪ লাইন হয় না। পেজ বদলায় সেই পেজের প্রথম শব্দ শুরু হওয়ার ফ্রেমে (নতুন পেজের লেখা ৬ ফ্রেমে ফুটে ওঠে); হাইলাইট শব্দ ধরে আগের মতোই।
 *    প্রতিটা শব্দ লুকানো `span`-এ আলাদা মাপা হয় (FitText-এর মতো, সেগমেন্টে একবার); লাইন ভাঙা হয় ওই মাপ দিয়ে এবং প্রতি লাইন আলাদা `div` (`nowrap`) — তাই DOM-এ ঠিক হিসাবের লাইনই থাকে।
 *  - (ক্যাপশন-ফিক্স) **নিরাপদ মার্জিন:** বাক্স `clampBoxToSafe`-এ layout.safe-এর ভেতরে রাখা হয়; লেখা বাক্সের ভেতরের মার্জিনের (`CAPTION_PAD_UNITS`) ভেতরে, লাইনের প্রস্থ ৮৬% (pop/glow-এর জায়গা)।
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

/** এক সেগমেন্টের বাক্স: প্রতিটা শব্দ মাপে (hook) + পেজ ভাগ করে + বর্তমান পেজ আঁকে। সেগমেন্ট বদলালে `key` বদলায় → নতুন মাপ */
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

  // মাপার জন্য লুকানো কপি: প্রতিটা শব্দ বেস সাইজে (inline-block + ০.০৫em padding — আসল শব্দের মতোই) আর একটা ফাঁক
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const spaceRef = useRef<HTMLSpanElement>(null);
  const [measured, setMeasured] = useState<{ widths: number[]; space: number }>({ widths: [], space: 0 });

  useLayoutEffect(() => {
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const widths = words.map((_, i) => wordRefs.current[i]?.offsetWidth ?? 0);
      const space = spaceRef.current?.offsetWidth ?? 0;
      setMeasured((prev) => {
        const same = prev.widths.length === widths.length && prev.widths.every((w, i) => Math.abs(w - widths[i]) < 0.5) && Math.abs(prev.space - space) < 0.5;
        return same ? prev : { widths, space };
      });
    };
    measure();
    // ফন্ট পরে লোড হলে (Studio-তে) আবার মাপা
    const fonts = (typeof document !== "undefined" ? document.fonts : undefined) as { ready?: Promise<unknown> } | undefined;
    fonts?.ready?.then(measure).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [fullText, base, words]);

  // মাপ আসার আগের মুহূর্তে (প্রথম রেন্ডার, layout effect-এর আগে) মোটামুটি আন্দাজ; paint-এর আগেই আসল মাপে বদলে যায়
  const widths = useMemo(
    () => (measured.widths.length === words.length ? measured.widths : words.map((w) => w.word.length * base * 0.6)),
    [measured.widths, words, base],
  );
  const spaceW = measured.widths.length === words.length ? measured.space : base * 0.25;

  const paging = useMemo(
    () =>
      paginateCaption({
        wordWidths: widths,
        spaceWidth: spaceW,
        maxWidth: innerW,
        maxHeight: innerH,
        baseSize: base,
        lineHeight: CAPTION_LINE_HEIGHT,
        maxLines: CAPTION_MAX_LINES,
      }),
    [widths, spaceW, innerW, innerH, base],
  );
  const fs = base * paging.scale;
  const barH = Math.max(3 * u, fs * 0.06);

  const pageIdx = Math.max(0, pageIndexAt(paging.pages, words, absFrame));
  const page = paging.pages[pageIdx] ?? { start: 0, end: words.length, lines: [{ start: 0, end: words.length }] };
  const pageStartFrame = words[page.start]?.startFrame ?? seg.startFrame;
  const textOpacity = pageTextOpacity(pageIdx, pageStartFrame, absFrame);

  const renderWord = (i: number): React.ReactNode => {
    const w = words[i];
    const look = wordLook(words, i, absFrame, fps);
    const activeColor = palette.captionColors[wordColorIndex(seg.index, i, palette.captionColors.length)] ?? palette.accent;
    const color = mixColors(palette.text, activeColor, look.activeMix);
    const glow = look.activeMix > 0.01 ? `0 0 ${fs * 0.32 * look.activeMix}px ${withAlpha(activeColor, 0.85 * look.activeMix)}, ` : "";
    return (
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
    );
  };

  // বর্তমান পেজের লাইনগুলো (প্রতি লাইন আলাদা div — হিসাবের লাইনই আঁকা হয়)
  const lineNodes = page.lines.map((ln, li) => {
    const items: React.ReactNode[] = [];
    for (let i = ln.start; i < ln.end; i += 1) {
      items.push(<React.Fragment key={i}>{renderWord(i)}</React.Fragment>);
      if (i < ln.end - 1) items.push(" ");
    }
    return (
      <div key={li} data-caption-line={li} style={{ whiteSpace: "nowrap", textAlign: "center" }}>
        {items}
      </div>
    );
  });

  const active = words.findIndex((_, i) => wordLook(words, i, absFrame, fps).state === "active");

  return (
    <div
      data-caption=""
      data-segment={seg.index}
      data-words={page.end - page.start}
      data-active-word={active}
      data-font-size={fs.toFixed(2)}
      data-lines={page.lines.length}
      data-clipped={paging.overflow ? 1 : 0}
      data-page={pageIdx}
      data-pages={paging.pages.length}
      data-page-start={page.start}
      data-page-end={page.end}
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
      {/* মাপার জন্য লুকানো কপি (বেস সাইজ; প্রতিটা শব্দ আলাদা, এক লাইনে) */}
      <span
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
        {words.map((w, i) => (
          <span
            key={i}
            ref={(el) => {
              wordRefs.current[i] = el;
            }}
            style={{ display: "inline-block", padding: "0 0.05em" }}
          >
            {w.word}
          </span>
        ))}
        <span ref={spaceRef} style={{ display: "inline-block", whiteSpace: "pre" }}>
          {" "}
        </span>
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
          // উচ্চতা হিসাবে আঁটে (২ লাইন × ফন্ট × lineHeight ≤ innerH); বাংলা মাত্রা/রেফ কাটা না পড়তে visible — প্যানেলের নিজের overflow: hidden বাইরে যেতে দেয় না
          overflow: "visible",
        }}
      >
        <div
          style={{
            width: "100%",
            textAlign: "center",
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: fs,
            lineHeight: CAPTION_LINE_HEIGHT,
            opacity: textOpacity,
          }}
        >
          {lineNodes}
        </div>
      </div>
    </div>
  );
};

/** সেগমেন্ট + ফ্রেম ধরে ক্যাপশন আঁকে (ডেটা-লোড ছাড়া — প্রিভিউ সরাসরি এটা ডাকে) */
export const CaptionView: React.FC<CaptionViewProps> = ({ segments, theme, timing, absFrame, size }) => {
  const L0 = computeLayout(size.width, size.height);
  // নিরাপদ মার্জিন: বাক্স layout.safe-এর বাইরে গেলে ভেতরে টেনে আনা (এখনকার layout-এ আগে থেকেই ভেতরে, তাই কিছু বদলায় না)
  const L: Layout = { ...L0, captionBox: clampBoxToSafe(L0.captionBox, L0.safe, { width: L0.width, height: L0.height }) };

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
