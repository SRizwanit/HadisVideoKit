import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Background } from "../components/Background";
import { FONT_BODY } from "../fonts";
import type { Timing } from "../lib/timing";
import { IntroScene } from "../scenes/IntroScene";
import type { ThemeId } from "../types";

/**
 * Part 8 (dev টুল): Intro সিনের যাচাইয়ের ছবি।
 * - সারি ১: emerald, Portrait — ক্রমের ৫টা মুহূর্ত (ফ্রেম ১০ / ৩০ / ৫০ / ৭২ / ৮৬)
 * - সারি ২: greenDayNight (উজ্জ্বল সকাল), Portrait — একই ৫ মুহূর্ত
 * - সারি ৩: Landscape — navy (শেষ অবস্থা) ও greenDayNight (লম্বা নামে শেষ অবস্থা)
 * `npm run check` এটাকে নিজে ধরে `out/check-IntroPreview.png` বানায়।
 */

export const INTRO_PREVIEW_HEIGHT = 1100;

const TIMING: Timing = { fps: 30, introFrames: 90, mainFrames: 300, outroFrames: 120, totalFrames: 510 };
const FRAMES = [10, 30, 50, 72, 86];
const CHECK_FRAME = 45; // check.mjs এই ফ্রেমে ছবি তোলে

type Tile = {
  label: string;
  theme: ThemeId;
  frame: number;
  landscape: boolean;
  bookname: string;
  number: string;
};

const TileView: React.FC<{ tile: Tile; x: number; y: number; w: number }> = ({ tile, x, y, w }) => {
  const fullW = tile.landscape ? 1920 : 1080;
  const fullH = tile.landscape ? 1080 : 1920;
  const scale = w / fullW;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: fullH * scale, overflow: "hidden", outline: "1px solid #ffffff44" }}>
      <div style={{ width: fullW, height: fullH, transform: `scale(${scale})`, transformOrigin: "0 0", position: "relative" }}>
        <Background theme={tile.theme} nightFactor={0} size={{ width: fullW, height: fullH }} />
        {/* Sequence দিয়ে লোকাল ফ্রেম = tile.frame (check-এর ফ্রেম ৪৫ থেকে সরিয়ে) */}
        <Sequence from={CHECK_FRAME - tile.frame} layout="none">
          <IntroScene
            theme={tile.theme}
            bookname={tile.bookname}
            number={tile.number}
            timing={TIMING}
            nightFactor={0}
            size={{ width: fullW, height: fullH }}
            sfx={false}
          />
        </Sequence>
      </div>
      <div
        style={{
          position: "absolute",
          left: 4,
          bottom: 4,
          background: "#000000b0",
          color: "#fff",
          fontFamily: FONT_BODY,
          fontSize: tile.landscape ? 17 : 14,
          padding: "2px 7px",
          borderRadius: 6,
        }}
      >
        {tile.label}
      </div>
    </div>
  );
};

const LONG = "রিয়াদুস সালেহীন — ইমাম নববী (রহ.)-এর সংকলিত হাদিস গ্রন্থ";

export const IntroPreview: React.FC = () => {
  const row = (theme: ThemeId, name: string) =>
    FRAMES.map((f): Tile => ({
      label: `${name} · ফ্রেম ${f}`,
      theme,
      frame: f,
      landscape: false,
      bookname: "সহীহ বুখারী",
      number: "১২৩",
    }));
  const land: Tile[] = [
    { label: "navy · Landscape · ফ্রেম 72", theme: "navy", frame: 72, landscape: true, bookname: "সহীহ মুসলিম", number: "4567" },
    { label: "greenDayNight · Landscape · লম্বা নাম", theme: "greenDayNight", frame: 72, landscape: true, bookname: LONG, number: "১২৩৪৫৬" },
  ];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {row("emerald", "emerald").map((t, i) => (
        <TileView key={t.label} tile={t} x={i * 216} y={0} w={216} />
      ))}
      {row("greenDayNight", "greenDayNight").map((t, i) => (
        <TileView key={t.label} tile={t} x={i * 216} y={392} w={216} />
      ))}
      {land.map((t, i) => (
        <TileView key={t.label} tile={t} x={i * 540} y={784} w={540} />
      ))}
    </AbsoluteFill>
  );
};
