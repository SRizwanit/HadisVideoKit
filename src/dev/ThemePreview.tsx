import React from "react";
import { AbsoluteFill } from "remotion";
import { APP_NAME, NUMBER_LABEL, TAGLINE } from "../constants";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { getThemeColors, skyGradient, THEMES } from "../themes";
import type { ThemeId } from "../types";

/**
 * Part 3 (dev টুল): থিম যাচাইয়ের ছবি।
 * ৫টা প্যানেল — emerald, navy, greenDayNight (দিন, গোধূলি, রাত)।
 * `npm run check` এটাকে নিজে ধরে `out/check-ThemePreview.png` বানায়।
 */

const PANELS: { label: string; themeId: ThemeId; nightFactor: number }[] = [
  { label: "emerald — এমারেল্ড নাইট", themeId: "emerald", nightFactor: 0 },
  { label: "navy — রয়্যাল নেভি", themeId: "navy", nightFactor: 0 },
  { label: "greenDayNight — দিন (০)", themeId: "greenDayNight", nightFactor: 0 },
  { label: "greenDayNight — গোধূলি (০.৫)", themeId: "greenDayNight", nightFactor: 0.5 },
  { label: "greenDayNight — রাত (১)", themeId: "greenDayNight", nightFactor: 1 },
];

const SAMPLE_WORDS = ["নিশ্চয়ই", "সকল", "আমল", "নিয়তের", "উপর", "নির্ভরশীল"];

const Panel: React.FC<{ label: string; themeId: ThemeId; nightFactor: number }> = ({
  label,
  themeId,
  nightFactor,
}) => {
  const p = getThemeColors(themeId, nightFactor);
  const scenery = THEMES[themeId].scenery;

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        background: skyGradient(p),
        overflow: "hidden",
        padding: "18px 40px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {scenery ? (
        <div
          style={{
            position: "absolute",
            right: 50,
            top: 24,
            width: 90,
            height: 90,
            borderRadius: "50%",
            background: nightFactor < 0.6 ? scenery.sun.color : scenery.moon.color,
            boxShadow: `0 0 60px 20px ${nightFactor < 0.6 ? scenery.sun.glow : scenery.moon.glow}`,
          }}
        />
      ) : null}

      <div style={{ fontFamily: FONT_BODY, fontSize: 22, color: p.textMuted, background: p.panelBg, alignSelf: "flex-start", padding: "2px 14px", borderRadius: 10 }}>
        {label}
      </div>

      {/* হেডার প্যানেল */}
      <div
        style={{
          background: p.panelBg,
          border: `2px solid ${p.panelBorder}`,
          borderRadius: 24,
          padding: "12px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 40, color: p.text }}>
          {APP_NAME}
        </div>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 30, color: p.accent }}>
          {TAGLINE}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 28, color: p.textMuted }}>
          সহীহ বুখারী {NUMBER_LABEL} ১২৩
        </div>
      </div>

      {/* বহুরঙা ক্যাপশন */}
      <div
        style={{
          background: p.panelBg,
          border: `2px solid ${p.panelBorder}`,
          borderRadius: 24,
          padding: "10px 24px",
          display: "flex",
          flexWrap: "wrap",
          gap: "2px 16px",
          fontFamily: FONT_BODY,
          fontWeight: 700,
          fontSize: 40,
          color: p.text,
        }}
      >
        {SAMPLE_WORDS.map((w, i) => (
          <span key={w} style={{ color: p.captionColors[i % p.captionColors.length] }}>
            {w}
          </span>
        ))}
      </div>

      {/* রঙের নমুনা */}
      <div style={{ display: "flex", gap: 8 }}>
        {[p.skyTop, p.skyMid, p.skyBottom, p.accent, p.accent2, p.glow, ...p.captionColors].map(
          (c, i) => (
            <div
              key={i}
              style={{ width: 34, height: 34, borderRadius: 8, background: c, border: "1px solid #ffffff55" }}
            />
          ),
        )}
      </div>
    </div>
  );
};

export const ThemePreview: React.FC = () => (
  <AbsoluteFill style={{ flexDirection: "column", background: "#000" }}>
    {PANELS.map((panel) => (
      <Panel key={panel.label} {...panel} />
    ))}
  </AbsoluteFill>
);
