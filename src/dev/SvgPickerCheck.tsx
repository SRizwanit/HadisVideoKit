import React from "react";
import { AbsoluteFill } from "remotion";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { getThemeColors, skyGradient } from "../themes";
import { PICK_CASE_COUNT, runPickCases } from "./svgPickerCases";

/**
 * Part 9G + 9H (dev টুল): svgPicker যাচাইয়ের ছবি।
 * প্রতি সারিতে একটা কেস: ✅/❌, শিরোনাম, ইনপুট (প্রতি সেগমেন্টে লেখা `svg`, আর available তালিকা), ফল (রঙিন ঘর:
 * সোনালি = JSON-এ লেখা, সবুজ-নীল = সিরিয়ালে ঘোরানো, ধূসর "∅" = fallback (N = 0), লালচে "∅ নাম" = লেখা নাম ফোল্ডারে নেই),
 * আর "সতর্কতা:" সারি (কয়টা ওয়ার্নিং উঠল / কয়টা হওয়ার কথা + বার্তা)। ব্যর্থ হলে প্রত্যাশিত ক্রমও দেখায়।
 * `npm run check` এটাকে নিজে ধরে `out/check-SvgPickerCheck.png` বানায়। 9H এই ছবিতে ১০টা নতুন সারি + "সতর্কতা:" সারি যোগ করেছে।
 */

/** কেস বাড়লে ছবির উচ্চতাও বাড়ে (প্রতি সারি গড়ে ≈ ২০৫px: শিরোনাম + available + লেখা + ফল + সতর্কতা) */
export const SVG_PICKER_CHECK_HEIGHT = 170 + PICK_CASE_COUNT * 208;

const MAX_CHIPS = 12;

const shorten = (t: string, max: number) => (t.length > max ? `${t.slice(0, max)}…` : t);

type ChipKind = "forced" | "rotation" | "fallback" | "missing" | "plain";

const Chip: React.FC<{ text: string; kind: ChipKind }> = ({ text, kind }) => {
  const bg =
    kind === "forced" ? "#f5d77a" : kind === "rotation" ? "#1abc9c" : kind === "fallback" ? "#7a8a80" : kind === "missing" ? "#ff9a8a" : "rgba(255,255,255,0.14)";
  const fg = kind === "plain" ? "#fff" : "#06281a";
  return (
    <span style={{ background: bg, color: fg, borderRadius: 10, padding: "1px 10px", fontSize: 21, fontWeight: 700 }}>{text}</span>
  );
};

const Chips: React.FC<{ items: string[]; kinds: ChipKind[]; total: number }> = ({ items, kinds, total }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
    {items.length === 0 && <span style={{ fontSize: 21, opacity: 0.7 }}>(খালি)</span>}
    {items.slice(0, MAX_CHIPS).map((t, i) => (
      <Chip key={i} text={t} kind={kinds[i]} />
    ))}
    {total > MAX_CHIPS && <span style={{ fontSize: 21 }}>… (মোট {total})</span>}
  </div>
);

export const SvgPickerCheck: React.FC = () => {
  const p = getThemeColors("emerald", 0);
  const outcomes = runPickCases();
  const passed = outcomes.filter((o) => o.ok).length;
  const allOk = passed === outcomes.length;

  return (
    <AbsoluteFill
      style={{
        background: skyGradient(p),
        padding: 36,
        flexDirection: "column",
        gap: 12,
        fontFamily: FONT_BODY,
        color: p.text,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 46, color: p.accent }}>SVG picker যাচাই</div>
        <div style={{ fontWeight: 700, fontSize: 34, color: allOk ? "#7CFFB2" : "#FF8A8A" }}>
          {allOk ? "সব ✅" : "❌ আছে"} · {passed}/{outcomes.length}
        </div>
      </div>
      <div style={{ fontSize: 22, color: p.textMuted, display: "flex", gap: 10, alignItems: "center" }}>
        রঙ: <Chip text="লেখা" kind="forced" /> JSON-এ `svg` <Chip text="ঘোরানো" kind="rotation" /> সিরিয়ালে <Chip text="∅" kind="fallback" /> fallback (N = 0){" "}
        <Chip text="∅ নাম" kind="missing" /> লেখা নাম ফোল্ডারে নেই
      </div>

      {outcomes.map((o) => (
        <div
          key={o.id}
          style={{
            background: p.panelBg,
            border: `2px solid ${o.ok ? p.panelBorder : "#FF6B6B"}`,
            borderRadius: 18,
            padding: "10px 20px",
            display: "flex",
            gap: 16,
            alignItems: "flex-start",
          }}
        >
          <div style={{ fontSize: 34, lineHeight: 1.1 }}>{o.ok ? "✅" : "❌"}</div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 25, fontWeight: 600, lineHeight: 1.25 }}>{o.title}</div>
            <div style={{ fontSize: 21, color: p.textMuted, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              available: {o.available.length ? o.available.join(", ") : "(খালি)"}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 21, color: p.textMuted, width: 70 }}>লেখা:</span>
              <Chips
                items={o.segs.map((s) => s ?? "–")}
                kinds={o.segs.map((s) => (s === null ? "plain" : "forced"))}
                total={o.segs.length}
              />
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 21, color: p.textMuted, width: 70 }}>ফল:</span>
              <Chips
                items={o.got.map((s, i) => (s !== null ? s : o.sources[i] === "missing" ? `∅ ${o.segs[i] ?? ""}` : "∅"))}
                kinds={o.sources.map((s): ChipKind => (s === "forced" ? "forced" : s === "rotation" ? "rotation" : s === "missing" ? "missing" : "fallback"))}
                total={o.got.length}
              />
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 21, color: p.textMuted, width: 70, flexShrink: 0 }}>সতর্কতা:</span>
              <div style={{ fontSize: 19, lineHeight: 1.25, color: o.warnings.length === o.expectedWarnings ? p.textMuted : "#FF8A8A" }}>
                {o.warnings.length}টা{o.warnings.length === o.expectedWarnings ? " ✓" : ` (প্রত্যাশিত ${o.expectedWarnings}টা)`}
                {o.warnings.length > 0 ? ` — ${shorten(o.warnings[0], 280)}` : ""}
              </div>
            </div>
            {!o.ok && (
              <div style={{ fontSize: 21, color: "#FF8A8A" }}>
                ✗ {o.note}
                {o.expected ? ` · প্রত্যাশিত: ${o.expected.slice(0, MAX_CHIPS).map((s) => s ?? "∅").join(" ")}` : ""}
              </div>
            )}
          </div>
        </div>
      ))}
    </AbsoluteFill>
  );
};
