import React from "react";
import { AbsoluteFill } from "remotion";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { getThemeColors, skyGradient } from "../themes";
import { runSanitizeCases, SANITIZE_CASE_COUNT } from "./svgSanitizeCases";

/**
 * Part 9A (dev টুল): sanitizeSvg যাচাইয়ের ছবি।
 * প্রতি সারিতে একটা কেস: ✅/❌ + কী কী সরানো হলো। সব ✅ হলে উপরে "সব ✅"।
 * `npm run check` এটাকে নিজে ধরে `out/check-SvgSanitizeCheck.png` বানায়।
 * Part 9A (নিরাপত্তা/সাইজ) + Part 9B (prefix) সব কেস এক ছবিতে; কেস বাড়লে ছবির উচ্চতা বাড়ে।
 */

/** কেস বাড়লে ছবির উচ্চতাও নিজে বাড়ে (প্রতি সারি ≈ ১৫০px, লম্বা শিরোনামেও কাটা পড়ে না) */
export const SVG_SANITIZE_CHECK_HEIGHT = 160 + SANITIZE_CASE_COUNT * 150;

export const SvgSanitizeCheck: React.FC = () => {
  const p = getThemeColors("emerald", 0);
  const outcomes = runSanitizeCases();
  const passed = outcomes.filter((o) => o.ok).length;
  const allOk = passed === outcomes.length;

  return (
    <AbsoluteFill
      style={{
        background: skyGradient(p),
        padding: 36,
        flexDirection: "column",
        gap: 14,
        fontFamily: FONT_BODY,
        color: p.text,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 46, color: p.accent }}>
          SVG sanitize যাচাই
        </div>
        <div style={{ fontWeight: 700, fontSize: 34, color: allOk ? "#7CFFB2" : "#FF8A8A" }}>
          {allOk ? "সব ✅" : "❌ আছে"} · {passed}/{outcomes.length}
        </div>
      </div>

      {outcomes.map((o) => (
        <div
          key={o.id}
          style={{
            background: p.panelBg,
            border: `2px solid ${o.ok ? p.panelBorder : "#FF6B6B"}`,
            borderRadius: 18,
            padding: "12px 20px",
            display: "flex",
            gap: 16,
            alignItems: "flex-start",
          }}
        >
          <div style={{ fontSize: 34, lineHeight: 1.1 }}>{o.ok ? "✅" : "❌"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.3 }}>{o.title}</div>
            <div style={{ fontSize: 22, color: p.textMuted, lineHeight: 1.3 }}>
              সরানো/ঠিক: {o.removedText}
            </div>
            {o.failures.map((f, i) => (
              <div key={i} style={{ fontSize: 22, color: "#FF8A8A", lineHeight: 1.3 }}>
                ✗ {f}
              </div>
            ))}
          </div>
        </div>
      ))}
    </AbsoluteFill>
  );
};
