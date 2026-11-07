import React from "react";
import { FONT_DISPLAY } from "../fonts";

/**
 * Part 8: খাঁজ-কাটা রিবন ব্যাজ ("আজকের হাদিস")।
 * Header (Part 7) ও IntroScene (Part 8) একই কম্পোনেন্ট ব্যবহার করে, তাই চেহারা সবসময় এক।
 * লেখার রঙ RIBBON_INK (গাঢ় সবুজ) — accent-এর উজ্জ্বল রঙের উপর পড়ার জন্য।
 */

export const RIBBON_INK = "#052412";

type Props = {
  text: string;
  /** রিবনের উচ্চতা (px) */
  height: number;
  fontSize: number;
  accent: string;
  accent2: string;
  /** অ্যানিমেশনের opacity/transform ইত্যাদি */
  style?: React.CSSProperties;
};

export const Ribbon: React.FC<Props> = ({ text, height, fontSize, accent, accent2, style }) => (
  <div
    style={{
      height,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: `0 ${height * 0.95}px`,
      boxSizing: "border-box",
      // দুই প্রান্তে খাঁজ-কাটা রিবন
      clipPath: `polygon(0 0, 100% 0, calc(100% - ${height * 0.4}px) 50%, 100% 100%, 0 100%, ${height * 0.4}px 50%)`,
      background: `linear-gradient(100deg, ${accent}, ${accent2} 55%, ${accent})`,
      color: RIBBON_INK,
      fontFamily: FONT_DISPLAY,
      fontWeight: 800,
      fontSize,
      lineHeight: 1,
      whiteSpace: "nowrap",
      transformOrigin: "center",
      ...style,
    }}
  >
    {text}
  </div>
);
