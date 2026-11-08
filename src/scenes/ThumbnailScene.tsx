import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { FitText } from "../components/FitText";
import { Logo } from "../components/Logo";
import { Ribbon } from "../components/Ribbon";
import { HOOK_TEXT, TAGLINE } from "../constants";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { buildHadisLabel } from "../lib/displayText";
import { useHadisTimestamp } from "../lib/loadHadis";
import { teaserWords, type TeaserWord } from "../lib/teaser";
import { getThemeColors, parseColor } from "../themes";
import type { ThemeId } from "../types";

/**
 * থাম্বনেইল: Hook + Teaser + Intro এক ছবিতে (স্থির ফ্রেম; ভিডিওর মতো কোনো অ্যানিমেশন/ফেড নেই)।
 * `ThumbnailPortrait` (9:16) ও `ThumbnailLandscape` (16:9) কম্পোজিশন এটাই আঁকে; `render.mjs` `renderStill --scale 2` দিয়ে 4K ছবি বের করে।
 *
 * উপর → নিচ (তিনটা প্যানেল-কার্ড, Hook/Teaser/Intro-র কার্ডের মতোই):
 *   ১. Hook   — বড় প্রশ্ন (শেষ দুই শব্দ accent রঙে), কৌতূহল জাগানোর জন্য
 *   ২. Teaser — হাদিসের শক্তিশালী বাক্যাংশ, উদ্ধৃতি-চিহ্নসহ; সব শব্দ পুরো উজ্জ্বল (ছবিতে "বলা হচ্ছে" ধারণা নেই)
 *   ৩. Intro  — লোগো + "আজকের হাদিস" রিবন + "কিতাব হাদিস নং : নম্বর"
 * JSON-এ `teaser` না থাকলে (বা `teaserEnabled === false`) মাঝের কার্ড বাদ; Hook ও Intro-র অংশ থাকে।
 * লেখা সবসময় প্যানেলের উপরে → উজ্জ্বল আকাশেও পড়া যায়। ব্যাকগ্রাউন্ড `<Background>` (থিম অনুযায়ী)।
 * সব মাপ `u = min(width, height) / 1080` দিয়ে — তাই 4K (scale 2) ও dev প্রিভিউ-সাইজে একই চেহারা।
 */

type Props = {
  theme: ThemeId;
  hadisId: string;
  bookname: string;
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
  /** ব্যাকগ্রাউন্ড/প্যালেটের দিন-রাত (০ = দিন, ১ = রাত)। greenDayNight-এ রাতের জোনাকি-আকাশ থাম্বনেইলে বেশি আকর্ষণীয় */
  nightFactor?: number;
};

/** থাম্বনেইলে ব্যাকগ্রাউন্ডের ডিফল্ট nightFactor (Main-এর শেষের কাছাকাছি = রাত, glow স্পষ্ট) */
export const THUMBNAIL_NIGHT_FACTOR = 0.85;
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
  bookname,
  number,
  hookText,
  teaserStartSeconds,
  teaserEndSeconds,
  teaserEnabled = true,
  words: wordsOverride,
  size,
  nightFactor = THUMBNAIL_NIGHT_FACTOR,
}) => {
  const video = useVideoConfig();
  const width = size?.width ?? video.width;
  const height = size?.height ?? video.height;
  const isPortrait = height >= width;
  const u = Math.min(width, height) / 1080;

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

  const label = buildHadisLabel(bookname, number);

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

  // Teaser
  const teaserPadX = (isPortrait ? 64 : 96) * u;
  const teaserPadY = (isPortrait ? 90 : 56) * u;
  const teaserInnerW = cardW - teaserPadX * 2;
  const teaserFont = thumbnailFontBase(words.length) * (isPortrait ? 1 : 0.75) * u;
  const quoteSize = (isPortrait ? 200 : 150) * u;

  // Intro (লোগো + রিবন + লেবেল)
  const footPadX = (isPortrait ? 48 : 64) * u;
  const footPadY = (isPortrait ? 40 : 28) * u;
  const footGap = (isPortrait ? 40 : 52) * u;
  const logoSize = (isPortrait ? 250 : 200) * u;
  const footInnerW = cardW - footPadX * 2;
  const textW = footInnerW - logoSize - footGap;
  const ribbonH = (isPortrait ? 84 : 70) * u;
  const ribbonFont = (isPortrait ? 52 : 42) * u;
  const labelBase = (isPortrait ? 54 : 46) * u;
  const labelPadX = 36 * u;

  return (
    <AbsoluteFill data-thumbnail="" data-thumbnail-teaser={showTeaser ? "1" : "0"}>
      <Background theme={theme} nightFactor={nightFactor} size={{ width, height }} />

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
        {/* ১. Hook — বড় প্রশ্ন */}
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

        {/* ৩. Intro — লোগো + "আজকের হাদিস" + কিতাব ও নম্বর */}
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
              gap: (isPortrait ? 26 : 20) * u,
            }}
          >
            <div style={{ alignSelf: "center" }}>
              <Ribbon text={TAGLINE} height={ribbonH} fontSize={ribbonFont} accent={p.accent} accent2={p.accent2} />
            </div>
            {label ? (
              <div
                style={{
                  width: textW,
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: `${12 * u}px ${labelPadX}px`,
                  borderRadius: 999,
                  border: `${3 * u}px solid ${p.accent}`,
                  background: withAlpha("#000000", 0.22),
                  overflow: "visible",
                }}
              >
                <FitText
                  text={label}
                  baseSize={labelBase}
                  minSize={labelBase * 0.62}
                  maxWidth={textW - labelPadX * 2 - 6 * u}
                  color={p.accent2}
                  fontFamily={FONT_BODY}
                  fontWeight={700}
                  lineHeight={1.2}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
