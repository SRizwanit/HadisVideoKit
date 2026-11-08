import React from "react";
import { AbsoluteFill } from "remotion";
import { Background } from "../components/Background";
import { NUMBER_LABEL, type TimeMode } from "../constants";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { getThemeColors, THEMES } from "../themes";
import type { ThemeId } from "../types";

/**
 * ঋতু-থিম যাচাইয়ের ছবি (dev টুল): monsoon (বর্ষা), winter (শীত), spring (বসন্ত) + তুলনার জন্য greenDayNight।
 * প্রতিটা সারিতে চারটা টাইল — সময়ের চার মোডের প্রতিনিধি মুহূর্ত:
 *   Day (nf ০) · DayToNight (গোধূলি ০.৬৫ — জোনাকি ফুটছে) · Night (nf ১ — তারা + পূর্ণ জোনাকি) · NightToDay (ভোর ০.৪ — সূর্য বাঁ দিক থেকে ওঠে)
 * প্রতিটা টাইলে হেডারের মতো গাঢ় প্যানেলে নমুনা লেখা — প্যানেল ও লেখা সব সময়ে পড়া যায় কিনা দেখতে।
 * `npm run check` এটাকে নিজে ধরে `out/check-SeasonThemesPreview.png` বানায় (ফ্রেম ৪৫: বৃষ্টি/কুয়াশা/পাপড়ি চলমান)।
 */

type Tile = { label: string; theme: ThemeId; nightFactor: number; timeMode: TimeMode };

const MODES: { label: string; nightFactor: number; timeMode: TimeMode }[] = [
  { label: "Day", nightFactor: 0, timeMode: "day" },
  { label: "DayToNight · গোধূলি", nightFactor: 0.65, timeMode: "dayToNight" },
  { label: "Night", nightFactor: 1, timeMode: "night" },
  { label: "NightToDay · ভোর", nightFactor: 0.4, timeMode: "nightToDay" },
];

const ROWS: ThemeId[] = ["monsoon", "winter", "spring", "greenDayNight"];

const TILES: Tile[] = ROWS.flatMap((theme) =>
  MODES.map((m) => ({ label: `${theme} · ${m.label}`, theme, nightFactor: m.nightFactor, timeMode: m.timeMode })),
);

const TILE_W = 270;
const FULL_W = 1080;
const FULL_H = 1920;
const SCALE = TILE_W / FULL_W;
const TILE_H = FULL_H * SCALE; // ৪৮০

const TileView: React.FC<{ tile: Tile; x: number; y: number }> = ({ tile, x, y }) => {
  const p = getThemeColors(tile.theme, tile.nightFactor);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: TILE_W, height: TILE_H, overflow: "hidden", outline: "1px solid #ffffff44" }}>
      <div style={{ width: FULL_W, height: FULL_H, transform: `scale(${SCALE})`, transformOrigin: "0 0", position: "relative" }}>
        <Background
          theme={tile.theme}
          nightFactor={tile.nightFactor}
          timeMode={tile.timeMode}
          size={{ width: FULL_W, height: FULL_H }}
        />
        {/* হেডারের মতো নমুনা প্যানেল */}
        <div
          style={{
            position: "absolute",
            left: 70,
            right: 70,
            top: 640,
            background: p.panelBg,
            border: `6px solid ${p.panelBorder}`,
            borderRadius: 48,
            padding: "36px 48px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 84, color: p.accent }}>{THEMES[tile.theme].name}</div>
          <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 64, color: p.text }}>
            সহীহ বুখারী {NUMBER_LABEL} ১২৩
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 4,
          bottom: 4,
          right: 4,
          background: "#000000b8",
          color: "#fff",
          fontFamily: FONT_BODY,
          fontSize: 15,
          padding: "2px 6px",
          borderRadius: 6,
        }}
      >
        {tile.label}
      </div>
    </div>
  );
};

export const SeasonThemesPreview: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    {TILES.map((t, i) => (
      <TileView key={t.label} tile={t} x={(i % 4) * TILE_W} y={Math.floor(i / 4) * TILE_H} />
    ))}
  </AbsoluteFill>
);
