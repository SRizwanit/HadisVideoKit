import React from "react";
import {
  Audio,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FitText } from "../components/FitText";
import { Logo } from "../components/Logo";
import { Ribbon } from "../components/Ribbon";
import { APP_NAME, DEFAULT_SFX_VOLUME, TAGLINE, TRANSITION_FRAMES } from "../constants";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { buildHadisLabel } from "../lib/displayText";
import type { Timing } from "../lib/timing";
import { useNightFactor } from "../lib/useNightFactor";
import { useSfxSrc } from "../lib/useSfxSrc";
import { getThemeColors, parseColor } from "../themes";
import type { ThemeId } from "../types";

/**
 * Part 8: Intro সিন (ডিফল্ট ৩ সেকেন্ড = ৯০ ফ্রেম)।
 *
 * ক্রম (৯০ ফ্রেমের হিসাবে):
 *   ০–২৫   লোগো স্কেল-ইন (স্প্রিং + হালকা ঘূর্ণন) + glow পালস
 *   ১৪–৪০  অ্যাপের নাম লাইন-বাই-লাইন রিভিল (নিচ থেকে উঠে আসে)
 *   ৩৪–৬০  "আজকের হাদিস" রিবন বাঁ দিক থেকে স্লাইড-ইন
 *   ৪৮–৭৪  "(কিতাব) নং : (নম্বর)" ফেড-আপ
 *   শেষ ১২ ফ্রেম  ফেড-আউট (সামান্য বড় হতে হতে) → Main-এ
 * Intro ৯০ ফ্রেমের কম হলে পুরো ক্রম সময়ের অনুপাতে চেপে আসে (সব অ্যানিমেশন শেষ হয়ে তবে ফেড-আউট);
 * বেশি হলে অ্যানিমেশন স্বাভাবিক গতিতে হয়ে বাকি সময় স্থির থাকে।
 *
 * - সব লেখা থিমের আধা-স্বচ্ছ প্যানেলের (`panelBg`) কার্ডে → greenDayNight-এর উজ্জ্বল সকালের আকাশেও পড়া যায়।
 * - ব্যাকগ্রাউন্ড এখানে আঁকা হয় না; Part 13-এ `<Background>` পেছনে থাকবে।
 * - SFX: `sfx/whoosh.mp3` (শুরুতে) ও `sfx/chime.mp3` (লেবেল আসার সময়); `.wav`-ও চলে; ফাইল না থাকলে চুপচাপ বাদ।
 * - Intro ০ সেকেন্ড হলে কিছুই আঁকে না।
 */

type Props = {
  theme: ThemeId;
  bookname: string;
  number: string;
  timing: Timing;
  /** dev প্রিভিউয়ের জন্য সরাসরি nightFactor (timing-কে ছাপিয়ে যায়) */
  nightFactor?: number;
  /** dev প্রিভিউয়ের জন্য: ভিডিওর সাইজ ছাড়া অন্য সাইজে লেআউট */
  size?: { width: number; height: number };
  /** false হলে SFX খোঁজাও হয় না (dev প্রিভিউ) */
  sfx?: boolean;
};

/** ৯০ ফ্রেমের Intro-র ক্রমের সময়সূচি (বেস ফ্রেম) */
export const INTRO_BASE_FRAMES = 90;
export const INTRO_STEPS = {
  logo: 0,
  nameFirst: 14,
  nameStep: 8,
  ribbon: 34,
  label: 48,
} as const;
export const INTRO_SFX = {
  whoosh: { name: "whoosh", at: 0 },
  chime: { name: "chime", at: INTRO_STEPS.label },
} as const;

/** অ্যাপের নাম শব্দের সীমানায় প্রায় সমান দুই লাইনে ভাঙা */
export function splitAppName(name: string): [string, string] {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return [name, ""];
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const left = words.slice(0, i).join(" ").length;
    const right = words.slice(i).join(" ").length;
    const diff = Math.abs(left - right);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

/** সময়-সংকোচন গুণক: Intro ৯০ ফ্রেমের কম হলে চেপে আসে, বেশি হলে ১ */
export const introSpeed = (introFrames: number): number =>
  introFrames >= INTRO_BASE_FRAMES ? 1 : Math.max(0.05, introFrames / INTRO_BASE_FRAMES);

function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color);
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${alpha})`;
}

export const IntroScene: React.FC<Props> = ({
  theme,
  bookname,
  number,
  timing,
  nightFactor,
  size,
  sfx = true,
}) => {
  const frame = useCurrentFrame();
  const video = useVideoConfig();
  const fps = video.fps;
  const width = size?.width ?? video.width;
  const height = size?.height ?? video.height;
  const isPortrait = height >= width;
  const u = Math.min(width, height) / 1080;

  const introFrames = timing.introFrames;
  const speed = introSpeed(introFrames);
  const t = frame / speed; // বেস-সময় (৯০ ফ্রেমের হিসাবে)

  const computedNight = useNightFactor(timing);
  const p = getThemeColors(theme, nightFactor ?? computedNight);
  const label = buildHadisLabel(bookname, number);

  const whooshSrc = useSfxSrc(sfx ? INTRO_SFX.whoosh.name : null);
  const chimeSrc = useSfxSrc(sfx ? INTRO_SFX.chime.name : null);

  if (introFrames <= 0) return null;

  const enter = (delayBase: number, damping = 15) =>
    spring({
      frame: Math.max(0, t - delayBase),
      fps,
      config: { damping, stiffness: 130, mass: 0.8 },
      durationInFrames: 26,
    });

  // ---------- অ্যানিমেশন মান ----------
  const cardIn = enter(0);
  const logoIn = enter(INTRO_STEPS.logo, 11);
  const [line1, line2] = splitAppName(APP_NAME);
  // Part 14C-landscape: Landscape-এ অ্যাপের নাম এক লাইনে (Portrait-এ আগের মতো দুই লাইন)
  const lines = isPortrait ? [line1, line2].filter((l) => l.length > 0) : [APP_NAME];
  const ribbonIn = enter(INTRO_STEPS.ribbon);
  const labelIn = enter(INTRO_STEPS.label);

  const fadeFrames = Math.min(TRANSITION_FRAMES, Math.max(1, Math.floor(introFrames * 0.25)));
  const fadeStart = introFrames - fadeFrames;
  const fadeOut = interpolate(frame, [fadeStart, introFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outScale = interpolate(frame, [fadeStart, introFrames], [1, 1.04], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // glow পালস: ২ সেকেন্ডে একবার; লোগো আসার পর জোরালো
  const pulse = 0.85 + 0.15 * Math.sin((frame / fps) * ((Math.PI * 2) / 2));

  // ---------- মাপ ----------
  // Part 14C-landscape: Landscape কার্ড ০.৭৪ → ০.৮০ চওড়া — অ্যাপের নাম এক লাইনে প্রায় পুরো ফন্টে আঁটে (Portrait অপরিবর্তিত)
  const cardW = isPortrait ? width * 0.86 : width * 0.8;
  const padX = (isPortrait ? 48 : 64) * u;
  const padY = (isPortrait ? 60 : 48) * u;
  const gap = (isPortrait ? 34 : 56) * u;
  const logoSize = (isPortrait ? 340 : 330) * u;
  const innerW = cardW - padX * 2;
  const textW = isPortrait ? innerW : innerW - logoSize - gap;
  const nameBase = (isPortrait ? 72 : 66) * u;
  const ribbonH = (isPortrait ? 92 : 80) * u;
  const ribbonFont = (isPortrait ? 56 : 48) * u;
  const labelBase = (isPortrait ? 54 : 50) * u;
  const labelPadX = 36 * u;
  // Part 14C-landscape: দুই অবস্থাতেই অ্যাপের নাম + "আজকের হাদিস" + কিতাবের লেবেল টেক্সট-কলামের মাঝখানে (আগে Landscape-এ বাঁ-ঘেঁষা)
  const align = "center";

  const logoEl = (
    <div
      style={{
        position: "relative",
        opacity: Math.min(1, logoIn * 1.4),
        transform: `scale(${interpolate(logoIn, [0, 1], [0.15, 1])}) rotate(${interpolate(logoIn, [0, 1], [-35, 0])}deg)`,
      }}
    >
      {/* লোগোর পেছনের নরম আলোর বৃত্ত */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: logoSize * 1.9,
          height: logoSize * 1.9,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${withAlpha(p.glow, 0.38 * pulse)} 0%, ${withAlpha(p.glow, 0)} 65%)`,
        }}
      />
      <Logo
        size={logoSize}
        ringColor={p.accent}
        ringColor2={p.accent2}
        glowColor={p.glow}
        glowStrength={1.25}
      />
    </div>
  );

  const nameEl = (
    <div style={{ width: textW, display: "flex", flexDirection: "column", alignItems: align }}>
      {lines.map((text, i) => {
        const prog = enter(INTRO_STEPS.nameFirst + INTRO_STEPS.nameStep * i);
        return (
          <div
            key={i}
            // লাইনের মাস্ক: ভেতরের লেখা নিচ থেকে উঠে আসে। Part 14C-fix: উপরে ০.৪em / নিচে ০.৩em ফাঁক (আগে ৬ unit) —
            // বাংলা মাথার অংশ (মাত্রা, ই-কার, রেফ) আর নিচের অংশ কাটা পড়ে না; negative margin-এ মোট উচ্চতা আগের মতোই থাকে
            style={{
              width: "100%",
              overflow: "hidden",
              padding: `${nameBase * 0.4}px 0 ${nameBase * 0.3}px`,
              margin: `${6 * u - nameBase * 0.4}px 0 ${6 * u - nameBase * 0.3}px`,
            }}
          >
            <div
              style={{
                opacity: Math.min(1, prog * 1.5),
                transform: `translateY(${interpolate(prog, [0, 1], [150, 0])}%)`,
              }}
            >
              <FitText
                text={text}
                baseSize={nameBase}
                minSize={nameBase * 0.55}
                maxWidth={textW}
                color={p.text}
                fontFamily={FONT_DISPLAY}
                fontWeight={700}
                lineHeight={1.3}
                textAlign="center"
                maxLines={isPortrait ? undefined : 1}
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  const ribbonEl = (
    <div style={{ alignSelf: "center", overflow: "hidden" }}>
      <Ribbon
        text={TAGLINE}
        height={ribbonH}
        fontSize={ribbonFont}
        accent={p.accent}
        accent2={p.accent2}
        style={{
          opacity: Math.min(1, ribbonIn * 1.6),
          transform: `translateX(${interpolate(ribbonIn, [0, 1], [-420 * u, 0])}px)`,
        }}
      />
    </div>
  );

  const labelEl = label ? (
    <div
      style={{
        opacity: labelIn,
        transform: `translateY(${interpolate(labelIn, [0, 1], [34 * u, 0])}px)`,
        width: isPortrait ? innerW : textW,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `${12 * u}px ${labelPadX}px`,
        borderRadius: 999,
        border: `${3 * u}px solid ${p.accent}`,
        background: withAlpha("#000000", 0.22),
        // Part 14C-fix: hidden ছিল — কিতাবের নামের মাথার অংশ কাটত
        overflow: "visible",
      }}
    >
      <FitText
        text={label}
        baseSize={labelBase}
        minSize={labelBase * 0.62}
        maxWidth={(isPortrait ? innerW : textW) - labelPadX * 2 - 6 * u}
        color={p.accent2}
        fontFamily={FONT_BODY}
        fontWeight={700}
        lineHeight={1.2}
      />
    </div>
  ) : null;

  const textColumn = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align,
        gap: (isPortrait ? 26 : 22) * u,
        width: isPortrait ? innerW : textW,
      }}
    >
      {nameEl}
      {ribbonEl}
      {labelEl}
    </div>
  );

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
          width: cardW,
          boxSizing: "border-box",
          padding: `${padY}px ${padX}px`,
          borderRadius: 48 * u,
          background: p.panelBg,
          border: `${3 * u}px solid ${p.panelBorder}`,
          boxShadow: `0 ${16 * u}px ${56 * u}px rgba(0,0,0,0.4), 0 0 ${48 * u}px ${withAlpha(p.glow, 0.25)}`,
          display: "flex",
          flexDirection: isPortrait ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap,
          opacity: Math.min(1, cardIn * 1.5),
          transform: `scale(${interpolate(cardIn, [0, 1], [0.9, 1])})`,
        }}
      >
        {logoEl}
        {textColumn}
      </div>

      {/* SFX — ফাইল না থাকলে src null, তাই কিছুই বাজে না */}
      {whooshSrc ? (
        <Sequence from={Math.round(INTRO_SFX.whoosh.at * speed)} layout="none">
          <Audio src={whooshSrc} volume={DEFAULT_SFX_VOLUME} />
        </Sequence>
      ) : null}
      {chimeSrc ? (
        <Sequence from={Math.round(INTRO_SFX.chime.at * speed)} layout="none">
          <Audio src={chimeSrc} volume={DEFAULT_SFX_VOLUME} />
        </Sequence>
      ) : null}
    </div>
  );
};
