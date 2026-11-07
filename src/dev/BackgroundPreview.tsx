import React from "react";
import { AbsoluteFill } from "remotion";
import { Background } from "../components/Background";
import { FONT_BODY } from "../fonts";
import { computeLayout } from "../lib/useLayout";
import type { ThemeId } from "../types";

/**
 * Part 6 (dev টুল): ব্যাকগ্রাউন্ড + লেআউট যাচাইয়ের ছবি।
 * উপরে ৬টা Portrait টাইল (emerald, navy, greenDayNight দিন/গোধূলি/রাত...), নিচে ৪টা Landscape টাইল।
 * প্রতিটায় হেডার / SVG / ক্যাপশনের বক্স ড্যাশ-লাইনে আঁকা, যাতে লেআউট চোখে দেখা যায়।
 * `npm run check` এটাকে নিজে ধরে `out/check-BackgroundPreview.png` বানায়।
 */

type Tile = { label: string; theme: ThemeId; nightFactor: number; landscape: boolean };

const PORTRAIT: Tile[] = [
  { label: "emerald", theme: "emerald", nightFactor: 0, landscape: false },
  { label: "navy", theme: "navy", nightFactor: 0, landscape: false },
  { label: "greenDayNight · দিন ০", theme: "greenDayNight", nightFactor: 0, landscape: false },
  { label: "greenDayNight · ০.৪৫", theme: "greenDayNight", nightFactor: 0.45, landscape: false },
  { label: "greenDayNight · গোধূলি ০.৬৫", theme: "greenDayNight", nightFactor: 0.65, landscape: false },
  { label: "greenDayNight · রাত ১", theme: "greenDayNight", nightFactor: 1, landscape: false },
];

const LANDSCAPE: Tile[] = [
  { label: "emerald · Landscape", theme: "emerald", nightFactor: 0, landscape: true },
  { label: "navy · Landscape", theme: "navy", nightFactor: 0, landscape: true },
  { label: "greenDayNight · দিন · Landscape", theme: "greenDayNight", nightFactor: 0, landscape: true },
  { label: "greenDayNight · রাত · Landscape", theme: "greenDayNight", nightFactor: 1, landscape: true },
];

const Guides: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const L = computeLayout(width, height);
  const font = Math.max(26, L.unit * 54);
  const box = (name: string, x: number, y: number, w: number, h: number, color: string) => (
    <div
      key={name}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        border: `${Math.max(3, L.unit * 5)}px dashed ${color}`,
        borderRadius: 16 * L.unit,
        color,
        fontFamily: FONT_BODY,
        fontWeight: 700,
        fontSize: font,
        padding: 10 * L.unit,
        background: "rgba(0,0,0,0.18)",
      }}
    >
      {name}
    </div>
  );
  return (
    <>
      {box("হেডার", L.headerBox.x, L.headerBox.y, L.headerBox.width, L.headerBox.height, "#ffe27a")}
      {box("SVG", L.svgBox.x, L.svgBox.y, L.svgBox.size, L.svgBox.size, "#8ee3ff")}
      {box("ক্যাপশন", L.captionBox.x, L.captionBox.y, L.captionBox.width, L.captionBox.height, "#ffb3c7")}
      {/* নিরাপদ মার্জিনের নিচের সীমা */}
      <div
        style={{
          position: "absolute",
          left: 0,
          width,
          top: height - L.safe.bottom,
          borderTop: `${Math.max(3, L.unit * 4)}px dotted #ffffffaa`,
        }}
      />
    </>
  );
};

const TileView: React.FC<{ tile: Tile; x: number; y: number; w: number }> = ({ tile, x, y, w }) => {
  const fullW = tile.landscape ? 1920 : 1080;
  const fullH = tile.landscape ? 1080 : 1920;
  const scale = w / fullW;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: fullH * scale, overflow: "hidden", outline: "1px solid #ffffff44" }}>
      <div style={{ width: fullW, height: fullH, transform: `scale(${scale})`, transformOrigin: "0 0", position: "relative" }}>
        <Background theme={tile.theme} nightFactor={tile.nightFactor} size={{ width: fullW, height: fullH }} />
        <Guides width={fullW} height={fullH} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 6,
          bottom: 6,
          background: "#000000b0",
          color: "#fff",
          fontFamily: FONT_BODY,
          fontSize: 17,
          padding: "2px 8px",
          borderRadius: 6,
        }}
      >
        {tile.label}
      </div>
    </div>
  );
};

export const BackgroundPreview: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    {PORTRAIT.map((t, i) => (
      <TileView key={t.label} tile={t} x={(i % 3) * 360} y={Math.floor(i / 3) * 640} w={360} />
    ))}
    {LANDSCAPE.map((t, i) => (
      <TileView key={t.label} tile={t} x={(i % 2) * 540} y={1280 + Math.floor(i / 2) * 304} w={540} />
    ))}
  </AbsoluteFill>
);
