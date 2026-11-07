import React from "react";
import { AbsoluteFill } from "remotion";
import { Background } from "../components/Background";
import { Header } from "../components/Header";
import { FONT_BODY } from "../fonts";
import { computeLayout } from "../lib/useLayout";
import type { ThemeId } from "../types";

/**
 * Part 7 (dev টুল): লোগো ও হেডার যাচাইয়ের ছবি।
 * উপরে ৪টা Portrait হেডার-স্ট্রিপ, নিচে ২টা Landscape স্ট্রিপ (ব্যাকগ্রাউন্ডসহ, শুধু উপরের অংশ কাটা)।
 * স্ট্রিপে আছে: স্বাভাবিক নাম, লম্বা কিতাবের নাম (ওভারফ্লো পরীক্ষা), ইংরেজি সংখ্যা ইনপুট,
 * greenDayNight-এর দিন / গোধূলি / রাত।
 * `npm run check` এটাকে নিজে ধরে `out/check-HeaderPreview.png` বানায়।
 * (ছবি ফ্রেম ৪৫-এ তোলা হয়, তখন সব স্প্রিং-ইন শেষ।)
 */

type Strip = {
  label: string;
  theme: ThemeId;
  nightFactor: number;
  landscape: boolean;
  bookname: string;
  number: string;
};

const STRIPS: Strip[] = [
  { label: "emerald · স্বাভাবিক", theme: "emerald", nightFactor: 0, landscape: false, bookname: "সহীহ বুখারী", number: "১২৩" },
  {
    label: "navy · লম্বা নাম",
    theme: "navy",
    nightFactor: 0,
    landscape: false,
    bookname: "সুনানে ইবনে মাজাহ (আল-মুজতাবা)",
    number: "১২৩৪৫",
  },
  { label: "greenDayNight · দিন · ইংরেজি সংখ্যা", theme: "greenDayNight", nightFactor: 0, landscape: false, bookname: "সহীহ মুসলিম", number: "4567" },
  {
    label: "greenDayNight · রাত · খুব লম্বা নাম",
    theme: "greenDayNight",
    nightFactor: 1,
    landscape: false,
    bookname: "রিয়াদুস সালেহীন — ইমাম নববী (রহ.)-এর সংকলিত হাদিস গ্রন্থ",
    number: "১২৩৪৫৬",
  },
  { label: "emerald · Landscape", theme: "emerald", nightFactor: 0, landscape: true, bookname: "সহীহ বুখারী", number: "১২৩" },
  {
    label: "greenDayNight · গোধূলি · Landscape · লম্বা নাম",
    theme: "greenDayNight",
    nightFactor: 0.65,
    landscape: true,
    bookname: "রিয়াদুস সালেহীন — ইমাম নববী (রহ.)-এর সংকলিত হাদিস গ্রন্থ",
    number: "৯৮৭",
  },
];

const PREVIEW_WIDTH = 1080;

/** স্ট্রিপে ব্যাকগ্রাউন্ডের কতটা উপরের অংশ দেখাবে (বেস সাইজে, px) */
function cropHeight(landscape: boolean): number {
  const L = computeLayout(landscape ? 1920 : 1080, landscape ? 1080 : 1920);
  return L.headerBox.y + L.headerBox.height + L.headerBox.y * (landscape ? 1 : 0.4);
}

const StripView: React.FC<{ strip: Strip; y: number }> = ({ strip, y }) => {
  const fullW = strip.landscape ? 1920 : 1080;
  const fullH = strip.landscape ? 1080 : 1920;
  const scale = PREVIEW_WIDTH / fullW;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: y,
        width: PREVIEW_WIDTH,
        height: cropHeight(strip.landscape) * scale,
        overflow: "hidden",
      }}
    >
      <div style={{ width: fullW, height: fullH, transform: `scale(${scale})`, transformOrigin: "0 0", position: "relative" }}>
        <Background theme={strip.theme} nightFactor={strip.nightFactor} size={{ width: fullW, height: fullH }} />
        <Header
          theme={strip.theme}
          bookname={strip.bookname}
          number={strip.number}
          nightFactor={strip.nightFactor}
          size={{ width: fullW, height: fullH }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 6,
          bottom: 4,
          background: "#000000b0",
          color: "#fff",
          fontFamily: FONT_BODY,
          fontSize: 17,
          padding: "2px 8px",
          borderRadius: 6,
        }}
      >
        {strip.label}
      </div>
    </div>
  );
};

/** প্রিভিউ কম্পোজিশনের উচ্চতা (সব স্ট্রিপ + ফাঁক) — Root.tsx-এ ব্যবহার হয় */
export const HEADER_PREVIEW_HEIGHT = 2100;

export const HeaderPreview: React.FC = () => {
  let y = 0;
  const nodes: React.ReactNode[] = [];
  for (const s of STRIPS) {
    nodes.push(<StripView key={s.label} strip={s} y={y} />);
    y += cropHeight(s.landscape) * (PREVIEW_WIDTH / (s.landscape ? 1920 : 1080)) + 8;
  }
  return <AbsoluteFill style={{ background: "#000" }}>{nodes}</AbsoluteFill>;
};
