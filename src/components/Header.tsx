import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { APP_NAME, TAGLINE } from "../constants";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { buildHadisLabel } from "../lib/displayText";
import type { Timing } from "../lib/timing";
import { computeLayout } from "../lib/useLayout";
import { useNightFactor } from "../lib/useNightFactor";
import { getThemeColors, parseColor } from "../themes";
import type { ThemeId } from "../types";
import { FitText } from "./FitText";
import { Logo } from "./Logo";
import { RIBBON_INK, Ribbon } from "./Ribbon";

/**
 * Part 7: Main সিনের উপরের স্থায়ী হেডার।
 *   লোগো + "ইসলামী বিশ্বকোষ ও আল হাদিস S2"
 *   "আজকের হাদিস" (রিবন ব্যাজ)
 *   "(কিতাবের নাম) নং : (বাংলা সংখ্যা)"  ← buildHadisLabel (Intro-র সাথে একই ফরম্যাট)
 *
 * - সব লেখা থিমের আধা-স্বচ্ছ প্যানেলের (`panelBg`) উপরে → দিন-রাত সব ধাপে পড়া যায়।
 * - রঙ `getThemeColors(theme, nightFactor)` থেকে, তাই greenDayNight-এ দিন-রাতের সাথে বদলায়।
 * - শুরুতে স্প্রিং-ইন (ধাপে ধাপে), তারপর হালকা ভাসা (float)।
 * - লম্বা কিতাবের নামে ফন্ট ছোট হয়, দরকারে দুই লাইনে ভাঙে (`FitText`); কখনো বাইরে উপচে পড়ে না।
 *
 * ⚠️ Part 13: Header `<Sequence>`-এর ভেতরে বসালে `useCurrentFrame()` ০ থেকে শুরু হয়।
 *    তাই nightFactor ঠিক রাখতে `frameOffset={timing.introFrames}` দিতে হবে।
 */

type Props = {
  theme: ThemeId;
  bookname: string;
  number: string;
  /** দিলে nightFactor নিজে হিসাব হয় (`useNightFactor`) */
  timing?: Timing;
  /** `<Sequence from>`-এর অফসেট (ফ্রেম) — nightFactor হিসাবের জন্য */
  frameOffset?: number;
  /** dev প্রিভিউয়ের জন্য সরাসরি nightFactor (timing-কে ছাপিয়ে যায়) */
  nightFactor?: number;
  /** dev প্রিভিউয়ের জন্য: ভিডিওর সাইজ ছাড়া অন্য সাইজে লেআউট (ডিফল্ট: useVideoConfig) */
  size?: { width: number; height: number };
};

/** আগের মতোই Header থেকে পাওয়া যায় (এখন সংজ্ঞা Ribbon.tsx-এ) */
export { RIBBON_INK };

function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color);
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${alpha})`;
}

const EMPTY_TIMING: Timing = { fps: 30, introFrames: 0, mainFrames: 1, outroFrames: 0, totalFrames: 1 };

/** ফ্রেম `delay` থেকে ০ → ১ স্প্রিং */
function useEntrance(delay: number): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 15, stiffness: 130, mass: 0.8 },
    durationInFrames: 26,
  });
}

export const Header: React.FC<Props> = ({
  theme,
  bookname,
  number,
  timing,
  frameOffset = 0,
  nightFactor,
  size,
}) => {
  const frame = useCurrentFrame();
  const video = useVideoConfig();
  const L = computeLayout(size?.width ?? video.width, size?.height ?? video.height);
  const u = L.unit;

  const computedNight = useNightFactor(timing ?? EMPTY_TIMING, frameOffset);
  const nf = nightFactor ?? (timing ? computedNight : 0);
  const p = getThemeColors(theme, nf);

  const label = buildHadisLabel(bookname, number);

  // ---------- অ্যানিমেশন ----------
  const panelIn = useEntrance(0);
  const logoIn = useEntrance(3);
  const nameIn = useEntrance(8);
  const ribbonIn = useEntrance(13);
  const labelIn = useEntrance(18);
  // স্প্রিং ঢোকার পর হালকা ভাসা (৪ সেকেন্ডে একবার)
  const floatY =
    Math.sin((frame / video.fps) * ((Math.PI * 2) / 4)) * 5 * u * Math.min(1, panelIn);

  // ---------- মাপ ----------
  const box = L.headerBox;
  const radius = 36 * u;
  const padX = (L.isPortrait ? 30 : 34) * u;
  const padY = (L.isPortrait ? 20 : 12) * u;
  const innerW = box.width - padX * 2;
  const innerH = box.height - padY * 2;
  const gap = (L.isPortrait ? 24 : 30) * u;

  const logoSize = L.isPortrait ? innerH * 0.42 : innerH;
  const ribbonH = (L.isPortrait ? 64 : 46) * u;
  const ribbonFont = L.fontSizes.tagline * (L.isPortrait ? 1 : 0.92);
  const labelPadX = 28 * u;

  // ---------- ছোট অংশগুলো ----------
  const logoEl = (
    <div
      style={{
        opacity: logoIn,
        transform: `scale(${interpolate(logoIn, [0, 1], [0.2, 1])}) rotate(${interpolate(logoIn, [0, 1], [-25, 0])}deg)`,
      }}
    >
      <Logo size={logoSize} ringColor={p.accent} ringColor2={p.accent2} glowColor={p.glow} />
    </div>
  );

  const appNameWidth = L.isPortrait ? innerW - logoSize - gap : undefined;
  const appNameEl = (maxWidth: number) => (
    <div
      style={{
        opacity: nameIn,
        transform: `translateX(${interpolate(nameIn, [0, 1], [60 * u, 0])}px)`,
        width: maxWidth,
        display: "flex",
        alignItems: "center",
      }}
    >
      <FitText
        text={APP_NAME}
        baseSize={L.fontSizes.appName}
        minSize={L.fontSizes.appName * 0.72}
        maxWidth={maxWidth}
        color={p.text}
        fontFamily={FONT_DISPLAY}
        fontWeight={700}
        lineHeight={1.18}
        textAlign={L.isPortrait ? "left" : "left"}
      />
    </div>
  );

  const ribbonEl = (
    <Ribbon
      text={TAGLINE}
      height={ribbonH}
      fontSize={ribbonFont}
      accent={p.accent}
      accent2={p.accent2}
      style={{
        opacity: ribbonIn,
        transform: `scaleX(${interpolate(ribbonIn, [0, 1], [0.3, 1])})`,
      }}
    />
  );

  const labelMaxW = L.isPortrait ? innerW : innerW * 0.38;
  const labelBoxH = L.isPortrait
    ? innerH - logoSize - ribbonH - gap * 1.0 // বাকি জায়গা
    : innerH;

  const labelEl = label ? (
    <div
      style={{
        opacity: labelIn,
        transform: `translateY(${interpolate(labelIn, [0, 1], [24 * u, 0])}px)`,
        width: labelMaxW,
        height: L.isPortrait ? labelBoxH : undefined,
        maxHeight: labelBoxH,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `${8 * u}px ${labelPadX}px`,
        borderRadius: 999,
        border: `${2.5 * u}px solid ${p.accent}`,
        background: withAlpha("#000000", 0.22),
        // Part 14C-fix: `overflow: hidden` ছিল — বাংলা মাথার অংশ কাটত। FitText নিজেই বাক্সের ভেতরে থাকে, তাই এখানে দরকার নেই
        overflow: "visible",
      }}
    >
      <FitText
        text={label}
        baseSize={L.fontSizes.hadisLabel}
        minSize={L.fontSizes.hadisLabel * 0.7}
        maxWidth={labelMaxW - labelPadX * 2 - 5 * u}
        color={p.accent2}
        fontFamily={FONT_BODY}
        fontWeight={700}
        lineHeight={1.2}
      />
    </div>
  ) : null;

  // ---------- বিন্যাস ----------
  const content = L.isPortrait ? (
    <div
      style={{
        width: innerW,
        height: innerH,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap, width: innerW, height: logoSize }}>
        {logoEl}
        {appNameEl(appNameWidth ?? 0)}
      </div>
      {ribbonEl}
      {labelEl}
    </div>
  ) : (
    <div
      style={{
        width: innerW,
        height: innerH,
        display: "flex",
        alignItems: "center",
        gap,
      }}
    >
      {logoEl}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: innerH,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: 8 * u,
        }}
      >
        {appNameEl(innerW - logoSize - labelMaxW - gap * 2)}
        <div style={{ alignSelf: "flex-start" }}>{ribbonEl}</div>
      </div>
      {labelEl}
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        boxSizing: "border-box",
        padding: `${padY}px ${padX}px`,
        borderRadius: radius,
        background: p.panelBg,
        border: `${3 * u}px solid ${p.panelBorder}`,
        boxShadow: `0 ${12 * u}px ${40 * u}px rgba(0,0,0,0.35), 0 0 ${34 * u}px ${withAlpha(p.glow, 0.22)}`,
        opacity: panelIn,
        transform: `translateY(${interpolate(panelIn, [0, 1], [-60 * u, 0]) + floatY}px)`,
        overflow: "hidden",
      }}
    >
      {content}
    </div>
  );
};
