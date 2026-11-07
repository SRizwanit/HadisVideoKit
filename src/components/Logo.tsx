import React from "react";
import { Img, useCurrentFrame, useVideoConfig } from "remotion";
import logo from "../logo.jpg";

/**
 * Part 7: গোল লোগো।
 * `src/logo.jpg` পুরোটা গোল করে (border-radius ৫০%, object-fit cover),
 * বাইরে অ্যাকসেন্ট রিং আর হালকা পালস-করা glow।
 * Intro (Part 8) ও Outro (Part 12) একই `Logo` ব্যবহার করবে।
 */

type Props = {
  /** ব্যাস (px) — রিংসহ */
  size: number;
  /** রিংয়ের দুই রঙ (গ্রেডিয়েন্ট) */
  ringColor: string;
  ringColor2?: string;
  glowColor: string;
  /** glow ধীরে জ্বলা-নেভা করবে কিনা (ডিফল্ট true) */
  pulse?: boolean;
  /** glow-এর শক্তি (০–১, ডিফল্ট ১) */
  glowStrength?: number;
  style?: React.CSSProperties;
};

/** "#rrggbb" / "rgba(...)" → alpha বদলানো রঙ (শুধু glow-এর জন্য) */
function withAlpha(color: string, alpha: number): string {
  const a = Math.min(1, Math.max(0, alpha));
  const hex = color.trim().match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  const rgb = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${a})`;
  return color;
}

export const Logo: React.FC<Props> = ({
  size,
  ringColor,
  ringColor2,
  glowColor,
  pulse = true,
  glowStrength = 1,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ring = Math.max(3, size * 0.045);
  // ২.৪ সেকেন্ডে একবার জ্বলা-নেভা (০.৬৫ ↔ ১.০)
  const wave = pulse ? 0.825 + 0.175 * Math.sin((frame / fps) * ((Math.PI * 2) / 2.4)) : 1;
  const glow = glowStrength * wave;

  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        padding: ring,
        boxSizing: "border-box",
        background: `linear-gradient(135deg, ${ringColor}, ${ringColor2 ?? ringColor})`,
        boxShadow: [
          `0 0 ${size * 0.22}px ${size * 0.03}px ${withAlpha(glowColor, 0.55 * glow)}`,
          `0 ${size * 0.04}px ${size * 0.12}px ${withAlpha("#000000", 0.35)}`,
        ].join(", "),
        ...style,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          overflow: "hidden",
          background: "#ffffff",
        }}
      >
        <Img
          src={logo}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>
    </div>
  );
};
