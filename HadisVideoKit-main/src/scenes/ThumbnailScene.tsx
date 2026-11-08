import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { FitText } from "../components/FitText";
import { Logo } from "../components/Logo";
import { RIBBON_INK } from "../components/Ribbon";
import { APP_NAME, HOOK_TEXT, type TimeMode } from "../constants";
import { FONT_DISPLAY } from "../fonts";
import { buildSeriesLabel } from "../lib/displayText";
import { useHadisTimestamp } from "../lib/loadHadis";
import { teaserWords, type TeaserWord } from "../lib/teaser";
import { getThemeColors, parseColor } from "../themes";
import type { ThemeId } from "../types";
import { splitAppName } from "./IntroScene";

/**
 * থাম্বনেইল: Intro + Teaser + Hook এক ছবিতে (স্থির ফ্রেম; ভিডিওর মতো কোনো অ্যানিমেশন/ফেড নেই)।
 * `ThumbnailPortrait` (9:16) ও `ThumbnailLandscape` (16:9) কম্পোজিশন এটাই আঁকে; `render.mjs` `renderStill --scale 2` দিয়ে 4K ছবি বের করে।
 *
 * উপর → নিচ (তিনটা প্যানেল-কার্ড, Intro/Teaser/Hook-র কার্ডের মতোই):
 *   ১. Intro  — লোগো + অ্যাপের নাম (`APP_NAME`); কার্ডের ডান-উপরের কোণে সিরিজ ব্যাজ "পর্ব ১২" (`seriesNumber` দিলে)
 *      ⚠️ থাম্বনেইলে "আজকের হাদিস" রিবন এবং "কিতাবের নাম + হাদিস নং" লেবেল দেখানো হয় না (ভিডিওর Intro/Header-এ আগের মতোই থাকে)
 *   ২. Teaser — হাদিসের শক্তিশালী বাক্যাংশ, উদ্ধৃতি-চিহ্নসহ; সব শব্দ পুরো উজ্জ্বল (ছবিতে "বলা হচ্ছে" ধারণা নেই)
 *   ৩. Hook   — বড় প্রশ্ন (শেষ দুই শব্দ accent রঙে), কৌতূহল জাগানোর জন্য
 * JSON-এ `teaser` না থাকলে (বা `teaserEnabled === false`) মাঝের কার্ড বাদ; Intro ও Hook থাকে।
 * লেখা সবসময় প্যানেলের উপরে → উজ্জ্বল আকাশেও পড়া যায়। ব্যাকগ্রাউন্ড `<Background>` (থিম অনুযায়ী)।
 * সব মাপ `u = min(width, height) / 1080` দিয়ে — তাই 4K (scale 2) ও dev প্রিভিউ-সাইজে একই চেহারা।
 */

type Props = {
  theme: ThemeId;
  hadisId: string;
  /** থাম্বনেইলে আর দেখানো হয় না (Root.tsx-এর সাথে সামঞ্জস্যের জন্য প্রপ রাখা) */
  bookname: string;
  /** থাম্বনেইলে আর দেখানো হয় না (Root.tsx-এর সাথে সামঞ্জস্যের জন্য প্রপ রাখা) */
  number: string;
  /** ফাঁকা/না দিলে `HOOK_TEXT` */
  hookText?: string;
  /** `calculateMetadata` JSON-এর `teaser` থেকে বসায় (সেকেন্ড, .wav-এর শুরু থেকে) */
  teaserStartSeconds?: number;
  teaserEndSeconds?: number;
  /** `false` হলে টিজার-কার্ড বাদ */
  teaserEnabled?: boolean;
  /** dev প্রিভিউ/টেস্টের জন্য: JSON না পড়ে সরাসরি শব্দ */
  words?: TeaserWord[];
  /** dev প্রিভিউয়ের জন্য: ভিডিওর সাইজ ছাড়া অন্য সাইজে লেআউট */
  size?: { width: number; height: number };
  /** সিরিজ নম্বর ("১২" বা "12") → ডান-উপরে "পর্ব ১২" ব্যাজ। ফাঁকা/না দিলে ব্যাজ নেই */
  seriesNumber?: string;
  /** workflow-এর `thumbnail_night`: ব্যাকগ্রাউন্ডের দিন-রাত (০–১)। না দিলে `timeMode`-এর বা থিমের ডিফল্ট */
  thumbnailNight?: number;
  /** workflow-এর `time_mode`: day → উজ্জ্বল দিন; nightToDay → সোনালি ভোর (সূর্য বাঁ দিক থেকে ওঠে); night/dayToNight/না দিলে → থিমের ডিফল্ট */
  timeMode?: TimeMode;
  /** dev প্রিভিউয়ের জন্য সরাসরি nightFactor (`thumbnailNight`-কে ছাপিয়ে যায়) */
  nightFactor?: number;
};

/**
 * থিম অনুযায়ী থাম্বনেইলের ডিফল্ট nightFactor (০ = দিন, ০.৫ = গোধূলি, ১ = রাত)।
 * ⚠️ emerald ও navy "static" থিম — nightFactor তাদের রঙ/ব্যাকগ্রাউন্ডে কোনো প্রভাব ফেলে না (`getThemeColors` সবসময় একই প্যালেট দেয়)।
 *    তাই গুরুত্বপূর্ণ শুধু দিন-রাতের থিমগুলোর (greenDayNight, monsoon, winter, spring) মান: ০ = উজ্জ্বল দিন, ০.৫ = সোনালি গোধূলি, ০.৯ = রাত + জোনাকি।
 *    ভিন্ন লুক চাইলে workflow-এর `thumbnail_night` (০–১) দিয়ে বদলানো যায়; কোড বদলাতে হয় না।
 */
export const THUMBNAIL_NIGHT_BY_THEME: Record<ThemeId, number> = {
  emerald: 0.85,
  navy: 0.85,
  greenDayNight: 0.9,
  monsoon: 0.9, // বৃষ্টি + বিদ্যুতের রাত + জোনাকি
  winter: 0.9, // কুয়াশা + তারা + হিম-জোনাকি
  spring: 0.8, // বেগুনি-গোলাপি রাত, ঝরা পাপড়ি + জোনাকি
};
/**
 * `time_mode` অনুযায়ী থাম্বনেইলের ডিফল্ট (শুধু যে মোডের জন্য আলাদা লুক দরকার): day = উজ্জ্বল দিন, nightToDay = সোনালি ভোর।
 * night / dayToNight-এর জন্য নেই → `THUMBNAIL_NIGHT_BY_THEME` (থিমের রাতের লুক, আগের মতোই)।
 */
export const THUMBNAIL_NIGHT_BY_TIME_MODE: Partial<Record<TimeMode, number>> = {
  day: 0,
  nightToDay: 0.4,
};
/** ব্যাকগ্রাউন্ডের কণা/জোনাকি কোন ফ্রেমে থাকবে (render.mjs এই ফ্রেমই তোলে) */
export const THUMBNAIL_FRAME = 45;
/** থাম্বনেইল কম্পোজিশনের মোট ফ্রেম (শুধু `THUMBNAIL_FRAME` বৈধ থাকার জন্য; আসলে একটাই ছবি) */
export const THUMBNAIL_DURATION_FRAMES = 60;

/** টিজারের শব্দ-সংখ্যা অনুযায়ী বেস ফন্ট (Portrait, 1080 বেস); Landscape-এ × ০.৭৫ */
export function thumbnailFontBase(wordCount: number): number {
  const n = Math.max(0, Math.floor(wordCount));
  if (n <= 6) return 112;
  if (n <= 12) return 92;
  if (n <= 20) return 76;
  if (n <= 30) return 62;
  return 52;
}

function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color);
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${alpha})`;
}

export const ThumbnailScene: React.FC<Props> = ({
  theme,
  hadisId,
  hookText,
  teaserStartSeconds,
  teaserEndSeconds,
  teaserEnabled = true,
  words: wordsOverride,
  size,
  seriesNumber,
  thumbnailNight,
  timeMode,
  nightFactor: nightFactorOverride,
}) => {
  const video = useVideoConfig();
  const width = size?.width ?? video.width;
  const height = size?.height ?? video.height;
  const isPortrait = height >= width;
  const u = Math.min(width, height) / 1080;

  const nightFactor =
    nightFactorOverride ??
    thumbnailNight ??
    (timeMode !== undefined ? THUMBNAIL_NIGHT_BY_TIME_MODE[timeMode] : undefined) ??
    THUMBNAIL_NIGHT_BY_THEME[theme];
  const file = useHadisTimestamp(hadisId);
  const p = getThemeColors(theme, nightFactor);

  // ---------- টিজারের শব্দ ----------
  let words: TeaserWord[] = wordsOverride ?? [];
  if (
    !wordsOverride &&
    teaserEnabled &&
    file &&
    typeof teaserStartSeconds === "number" &&
    typeof teaserEndSeconds === "number"
  ) {
    words = teaserWords(file, { startSeconds: teaserStartSeconds, endSeconds: teaserEndSeconds });
  }
  const showTeaser = words.length > 0;

  // ---------- Hook-এর শব্দ ----------
  const hookWords = (hookText && hookText.trim() !== "" ? hookText : HOOK_TEXT)
    .split(/\s+/)
    .filter((w) => w.length > 0);

  const seriesLabel = buildSeriesLabel(seriesNumber);

  // ---------- মাপ ----------
  const outerPad = (isPortrait ? 60 : 56) * u;
  const stackGap = (isPortrait ? 40 : 28) * u;
  const cardW = width - outerPad * 2;
  const radius = 48 * u;

  const cardStyle: React.CSSProperties = {
    position: "relative",
    width: cardW,
    boxSizing: "border-box",
    borderRadius: radius,
    background: p.panelBg,
    border: `${3 * u}px solid ${p.panelBorder}`,
    boxShadow: `0 ${16 * u}px ${56 * u}px rgba(0,0,0,0.4), 0 0 ${48 * u}px ${withAlpha(p.glow, 0.25)}`,
  };

  // Hook
  const hookPadX = (isPortrait ? 44 : 72) * u;
  const hookPadY = (isPortrait ? 44 : 26) * u;
  const hookFont = (isPortrait ? 84 : 58) * u;
  const hookInnerW = cardW - hookPadX * 2;

  // সিরিজ ব্যাজ
  const badgeFont = (isPortrait ? 50 : 38) * u;
  const badgeH = badgeFont * 1.9;

  // Teaser
  const teaserPadX = (isPortrait ? 64 : 96) * u;
  const teaserPadY = (isPortrait ? 90 : 56) * u;
  const teaserInnerW = cardW - teaserPadX * 2;
  const teaserFont = thumbnailFontBase(words.length) * (isPortrait ? 1 : 0.75) * u;
  const quoteSize = (isPortrait ? 200 : 150) * u;

  // Intro (লোগো + অ্যাপের নাম)
  const footPadX = (isPortrait ? 48 : 64) * u;
  const footPadY = (isPortrait ? 40 : 28) * u;
  const footGap = (isPortrait ? 40 : 52) * u;
  const logoSize = (isPortrait ? 250 : 220) * u;
  const footInnerW = cardW - footPadX * 2;
  const textW = footInnerW - logoSize - footGap;
  const nameBase = (isPortrait ? 54 : 44) * u;
  const [nameLine1, nameLine2] = splitAppName(APP_NAME);
  // Portrait: দুই লাইন (Intro সিনের মতো); Landscape: এক লাইন
  const nameLines = isPortrait ? [nameLine1, nameLine2].filter((l) => l.length > 0) : [APP_NAME];

  return (
    <AbsoluteFill data-thumbnail="" data-thumbnail-teaser={showTeaser ? "1" : "0"}>
      <Background theme={theme} nightFactor={nightFactor} timeMode={timeMode} size={{ width, height }} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          width,
          height,
          boxSizing: "border-box",
          padding: outerPad,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: stackGap,
        }}
      >
        {/* ১. Intro — লোগো + অ্যাপের নাম (+ সিরিজ ব্যাজ); রিবন ও কিতাব-নম্বর লেবেল নেই */}
        <div
          style={{
            ...cardStyle,
            padding: `${footPadY}px ${footPadX}px`,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: footGap,
          }}
        >
          {seriesLabel && (
            <div
              style={{
                position: "absolute",
                right: 44 * u,
                top: -badgeH * 0.55,
                height: badgeH,
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: `0 ${badgeFont * 0.7}px`,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${p.accent}, ${p.accent2})`,
                border: `${3 * u}px solid ${p.accent2}`,
                boxShadow: `0 ${8 * u}px ${28 * u}px rgba(0,0,0,0.45), 0 0 ${30 * u}px ${withAlpha(p.glow, 0.5)}`,
                fontFamily: FONT_DISPLAY,
                fontWeight: 800,
                fontSize: badgeFont,
                lineHeight: 1.2,
                color: RIBBON_INK,
                whiteSpace: "nowrap",
              }}
            >
              {seriesLabel}
            </div>
          )}
          <div style={{ position: "relative", width: logoSize, height: logoSize, flexShrink: 0 }}>
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: logoSize * 1.9,
                height: logoSize * 1.9,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                background: `radial-gradient(circle, ${withAlpha(p.glow, 0.38)} 0%, ${withAlpha(p.glow, 0)} 65%)`,
              }}
            />
            <Logo
              size={logoSize}
              ringColor={p.accent}
              ringColor2={p.accent2}
              glowColor={p.glow}
              glowStrength={1.25}
              pulse={false}
            />
          </div>

          <div
            style={{
              width: textW,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: (isPortrait ? 14 : 12) * u,
            }}
          >
            {/* অ্যাপের নাম */}
            <div style={{ width: textW, display: "flex", flexDirection: "column", alignItems: "center" }}>
              {nameLines.map((text, i) => (
                <FitText
                  key={i}
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
              ))}
            </div>
          </div>
        </div>
        {/* ২. Teaser — হাদিসের শক্তিশালী বাক্যাংশ (সব শব্দ পুরো উজ্জ্বল) */}
        {showTeaser && (
          <div style={{ ...cardStyle, padding: `${teaserPadY}px ${teaserPadX}px` }}>
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: 28 * u,
                top: -6 * u,
                fontFamily: FONT_DISPLAY,
                fontWeight: 800,
                fontSize: quoteSize,
                lineHeight: 1,
                color: withAlpha(p.accent, 0.55),
              }}
            >
              “
            </div>
            <div
              aria-hidden
              style={{
                position: "absolute",
                right: 28 * u,
                bottom: -quoteSize * 0.42,
                fontFamily: FONT_DISPLAY,
                fontWeight: 800,
                fontSize: quoteSize,
                lineHeight: 1,
                color: withAlpha(p.accent, 0.55),
              }}
            >
              ”
            </div>
            <div
              style={{
                position: "relative",
                width: teaserInnerW,
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "center",
                columnGap: teaserFont * 0.24,
                rowGap: teaserFont * 0.1,
              }}
            >
              {words.map((w, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 800,
                    fontSize: teaserFont,
                    lineHeight: 1.45,
                    color: p.text,
                    textShadow: `0 ${4 * u}px ${18 * u}px rgba(0,0,0,0.35)`,
                  }}
                >
                  {w.word}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ৩. Hook — বড় প্রশ্ন */}
        <div style={{ ...cardStyle, padding: `${hookPadY}px ${hookPadX}px` }}>
          <div
            style={{
              width: hookInnerW,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "center",
              columnGap: hookFont * 0.26,
              rowGap: hookFont * 0.1,
            }}
          >
            {hookWords.map((w, i) => {
              const emphasised = i >= hookWords.length - 2;
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 800,
                    fontSize: hookFont,
                    lineHeight: 1.45,
                    color: emphasised ? p.accent2 : p.text,
                    textShadow: `0 ${4 * u}px ${18 * u}px rgba(0,0,0,0.35)${
                      emphasised ? `, 0 0 ${28 * u}px ${withAlpha(p.glow, 0.45)}` : ""
                    }`,
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
        </div>

      </div>
    </AbsoluteFill>
  );
};
