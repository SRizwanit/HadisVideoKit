import React, { useLayoutEffect, useEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender } from "remotion";
import { FALLBACK_RING_RADIUS, FALLBACK_STAR_SIDE, FallbackSvg, fallbackColors, fallbackMotion } from "../components/FallbackSvg";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { svgInventoryLoader, useSvgInventory } from "../lib/svgInventory";
import { pickSvgNames } from "../lib/svgPicker";
import { getThemeColors, mixColors, parseColor, skyGradient } from "../themes";
import type { ThemeId } from "../types";
import { INVENTORY_CASE_COUNT, runInventoryCases, type InventoryCaseOutcome } from "./svgInventoryCases";

/**
 * Part 9I-5 (dev টুল): svgInventory যাচাইয়ের ছবি।
 *  - উপরে **আসল** ফল: আসল `useSvgInventory()` হুক (আসল `public/svg/` ফোল্ডার) — `names`, `count`, কোন উপায়ে পাওয়া গেল
 *    (`source`), কেন প্রথম উপায় চলেনি, প্রোব কোথায় ও কেন থেমেছে, কটা প্রোব, কয়বার স্ক্যান — আর ৫টা স্বয়ংক্রিয় ✅/❌।
 *    `npm run check` (`renderStill`)-এ `getStaticFiles()` তালিকা দেয় না, তাই এখানে সাধারণত **source = probe**; `static` দেখা যায় শুধু Remotion Studio-তে।
 *  - নিচে ১৮টা কেস (9I-1 … 9I-4-এর নিয়ম): নকল স্ক্যান/প্রোব/`fetch`-সার্ভার দিয়ে — খালি ফোল্ডার, গ্যাপ (`svg1`, `svg3`), HTML-ফেরত,
 *    ৬০-সীমা, ক্যাশ, throw — যা আসল ফোল্ডারে বানানো যায় না।
 *  - ছবি ধরার আগে সবকিছু শেষ হয়: হুক নিজে `delayRender` ধরে; কেসগুলোর জন্য এখানে আলাদা `delayRender`, যা ফল commit হওয়ার পরে ছাড়ে।
 *  - Part 9J: সবার নিচে `FallbackSvg` অংশ — ৩ থিম × ফ্রেম 0 ও 90 (৬টা ঘর, প্রতিটা নিজের আকাশের উপর) + ৪টা স্বয়ংক্রিয় ✅/❌
 *    (ফ্রেম 0 → 90 ঘুরেছে; একই ফ্রেম = একই হিসাব; সব ঘরে দেখা যায় (কনট্রাস্ট); তারা রিংয়ের ভেতরে)। উপরের অংশ আগের মতোই।
 * `npm run check` এটাকে নিজে ধরে `out/check-SvgInventoryCheck.png` বানায়।
 */

/** ছবির উচ্চতা: মাথা + আসল-ফলের বক্স + কেস × সারি */
export const FALLBACK_BLOCK_HEIGHT = 850;
export const SVG_INVENTORY_CHECK_HEIGHT = 700 + INVENTORY_CASE_COUNT * 155 + FALLBACK_BLOCK_HEIGHT;

// ---- 9J: FallbackSvg-র ঘর ও স্বয়ংক্রিয় যাচাই ----

type FbCell = { theme: ThemeId; frame: number; nightFactor: number; label: string };
/** ৩ থিম × ফ্রেম 0 ও 90। greenDayNight-এ ফ্রেম 0 = উজ্জ্বল দিন, ফ্রেম 90 = রাত (হালকা ও গাঢ় দুই আকাশেই পরীক্ষা) */
const FB_CELLS: FbCell[] = [
  { theme: "emerald", frame: 0, nightFactor: 0, label: "emerald · ফ্রেম 0" },
  { theme: "navy", frame: 0, nightFactor: 0, label: "navy · ফ্রেম 0" },
  { theme: "greenDayNight", frame: 0, nightFactor: 0, label: "greenDayNight (দিন) · ফ্রেম 0" },
  { theme: "emerald", frame: 90, nightFactor: 0, label: "emerald · ফ্রেম 90" },
  { theme: "navy", frame: 90, nightFactor: 0, label: "navy · ফ্রেম 90" },
  { theme: "greenDayNight", frame: 90, nightFactor: 1, label: "greenDayNight (রাত) · ফ্রেম 90" },
];

const luminance = (color: string): number => {
  const c = parseColor(color);
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
};
const contrast = (a: string, b: string): number => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** একটা ঘরে আইকন কতটা দেখা যায়: উজ্জ্বল সোনালি/সাদাটে রং বনাম গাঢ় রূপরেখা — আকাশের (মাঝের রঙ) সাথে যেটার কনট্রাস্ট বেশি */
function cellVisibility(c: FbCell): number {
  const sky = getThemeColors(c.theme, c.nightFactor).skyMid;
  const col = fallbackColors(c.theme, c.nightFactor);
  const outlineOverSky = mixColors(sky, "rgb(4, 30, 18)", 0.62);
  return Math.max(contrast(col.gold, sky), contrast(col.light, sky), contrast(outlineOverSky, sky));
}

const MIN_VISIBILITY = 1.8;

function fallbackRows(): Row[] {
  const rows: Row[] = [];
  const a = fallbackMotion(0);
  const b = fallbackMotion(90);
  const moved = a.outerDeg !== b.outerDeg && a.innerDeg !== b.innerDeg;
  rows.push({ label: "ফ্রেম 0 → 90: দুই তারাই ঘুরেছে (উল্টো দিকে)", ok: moved && b.outerDeg > a.outerDeg && b.innerDeg < a.innerDeg, note: `বাইরে ${a.outerDeg}° → ${b.outerDeg}°, ভেতরে ${a.innerDeg}° → ${b.innerDeg}°` });
  const x = JSON.stringify(fallbackMotion(45));
  const finite = [NaN, Infinity, -Infinity].every((v) => Object.values(fallbackMotion(v)).every((n) => Number.isFinite(n)));
  rows.push({ label: "একই ফ্রেম = একই হিসাব; NaN/Infinity-তেও ক্র্যাশ নয়", ok: x === JSON.stringify(fallbackMotion(45)) && finite, note: "ফ্রেম 45 দুইবার হুবহু এক" });
  const vis = FB_CELLS.map(cellVisibility);
  const minVis = Math.min(...vis);
  rows.push({ label: `৬টা ঘরেই আইকন দেখা যায় (কনট্রাস্ট ≥ ${MIN_VISIBILITY})`, ok: minVis >= MIN_VISIBILITY, note: `সবচেয়ে কম ${minVis.toFixed(1)}` });
  const starR = FALLBACK_STAR_SIDE / Math.SQRT2;
  rows.push({ label: "তারা রিংয়ের ভেতরে (গোল/বর্গ অনুপাত ঠিক)", ok: starR < FALLBACK_RING_RADIUS - 10, note: `তারার ঘেরবৃত্ত ${starR.toFixed(0)} < রিং ${FALLBACK_RING_RADIUS}` });
  return rows;
}

const noop = () => undefined;

/** কেসগুলো চালায়; ফল commit হওয়ার পরেই `delayRender` ছাড়ে (কখনো আটকে থাকে না — `runInventoryCases` reject করে না) */
function useInventoryCases(): InventoryCaseOutcome[] | null {
  const [outcomes, setOutcomes] = useState<InventoryCaseOutcome[] | null>(null);
  const [handle] = useState(() => delayRender("SvgInventoryCheck: কেস চলছে"));
  const released = useRef(false);
  useEffect(() => {
    let alive = true;
    runInventoryCases().then(
      (o) => {
        if (alive) setOutcomes(o);
      },
      () => {
        if (alive) setOutcomes([]);
      },
    );
    return () => {
      alive = false;
    };
  }, []);
  useLayoutEffect(() => {
    if (outcomes !== null && !released.current) {
      released.current = true;
      continueRender(handle);
    }
  }, [outcomes, handle]);
  return outcomes;
}

const Chip: React.FC<{ text: string; kind: "name" | "plain" }> = ({ text, kind }) => (
  <span
    style={{
      background: kind === "name" ? "#1abc9c" : "rgba(255,255,255,0.14)",
      color: kind === "name" ? "#06281a" : "#fff",
      borderRadius: 10,
      padding: "1px 10px",
      fontSize: 22,
      fontWeight: 700,
    }}
  >
    {text}
  </span>
);

type Row = { label: string; ok: boolean; note: string };

export const SvgInventoryCheck: React.FC = () => {
  const p = getThemeColors("emerald", 0);
  const inv = useSvgInventory(); // আসল হুক, আসল ফোল্ডার
  const cases = useInventoryCases();
  const d = svgInventoryLoader.details();
  const st = svgInventoryLoader.stats();

  // ---- আসল ফলের স্বয়ংক্রিয় যাচাই ----
  const realRows: Row[] = [];
  if (inv.ready) {
    realRows.push({ label: "হুক ready হয়েছে", ok: true, note: "delayRender ছেড়েছে, ফ্রেম ধরা হয়েছে" });
    const hasSample = inv.names.includes("svg1") && inv.names.includes("svg2") && inv.count >= 2;
    realRows.push({
      label: "নমুনা svg1, svg2 পাওয়া গেছে (count ≥ 2)",
      ok: hasSample,
      note: hasSample ? `count = ${inv.count}` : "public/svg/-এ svg1.svg, svg2.svg আছে কিনা দেখো",
    });
    const srcOk = inv.source === "probe" || inv.source === "static";
    realRows.push({
      label: "উৎস চেনা (probe বা static)",
      ok: srcOk,
      note: inv.source === "probe" ? "probe — renderStill-এ এটাই স্বাভাবিক" : inv.source === "static" ? "static — Studio-তে স্বাভাবিক" : "অজানা",
    });
    const cachedOk = inv.source === "static" ? st.probes === 0 : st.probes === 1 && svgInventoryLoader.peek()?.names === inv.names;
    realRows.push({
      label: "ক্যাশ: এই ছবিতে স্ক্যান/প্রোব বারবার হয়নি",
      ok: cachedOk,
      note: inv.source === "static" ? `প্রোব ${st.probes}` : `প্রোব ${st.probes} বার, একই names অ্যারে`,
    });
    const picked = pickSvgNames([{}, {}, {}], inv.names, { warn: noop });
    const pickOk = inv.count > 0 ? picked.every((n) => n !== null && inv.names.includes(n)) : picked.every((n) => n === null);
    realRows.push({
      label: "names সরাসরি pickSvgNames-এ চলে (3 সেগমেন্ট)",
      ok: pickOk,
      note: picked.map((n) => n ?? "∅").join(" "),
    });
  } else {
    realRows.push({ label: "হুক ready হয়নি", ok: false, note: "delayRender ছাড়ার পরেও ready নয় — এটা হওয়ার কথা নয়" });
  }
  const fbRows = fallbackRows();
  const fbOk = fbRows.every((r) => r.ok);
  const realOk = realRows.every((r) => r.ok);
  const outcomes = cases ?? [];
  const casesPassed = outcomes.filter((o) => o.ok).length;
  const casesOk = cases !== null && casesPassed === INVENTORY_CASE_COUNT;
  const total = realRows.length + INVENTORY_CASE_COUNT + fbRows.length;
  const passed = realRows.filter((r) => r.ok).length + casesPassed + fbRows.filter((r) => r.ok).length;
  const allOk = realOk && casesOk && fbOk;

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
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 46, color: p.accent }}>SVG inventory যাচাই</div>
        <div style={{ fontWeight: 700, fontSize: 34, color: allOk ? "#7CFFB2" : "#FF8A8A" }}>
          {allOk ? "সব ✅" : "❌ আছে"} · {passed}/{total}
        </div>
      </div>

      {/* ---- আসল ফল ---- */}
      <div style={{ background: p.panelBg, border: `2px solid ${realOk ? p.panelBorder : "#FF6B6B"}`, borderRadius: 18, padding: "14px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: p.accent }}>9I-5 · আসল useSvgInventory() — আসল public/svg/</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 22, color: p.textMuted, width: 110 }}>names:</span>
          {inv.names.length === 0 && <span style={{ fontSize: 22, opacity: 0.7 }}>(খালি)</span>}
          {inv.names.slice(0, 14).map((n) => (
            <Chip key={n} text={n} kind="name" />
          ))}
          {inv.names.length > 14 && <span style={{ fontSize: 22 }}>… (মোট {inv.names.length})</span>}
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", fontSize: 22 }}>
          <span style={{ color: p.textMuted, width: 110 }}>ফল:</span>
          <Chip text={`count = ${inv.count}`} kind="plain" />
          <Chip text={`source = ${inv.source ?? "—"}`} kind="plain" />
          <Chip text={`ready = ${String(inv.ready)}`} kind="plain" />
          <Chip text={`স্ক্যান ${st.scans} · প্রোব ${st.probes}`} kind="plain" />
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 20, lineHeight: 1.3 }}>
          <span style={{ color: p.textMuted, width: 110, flexShrink: 0 }}>প্রথম উপায়:</span>
          <span>{d.staticReason ?? (inv.source === "static" ? "কাজ করেছে (getStaticFiles তালিকা)" : "—")}</span>
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 20, lineHeight: 1.3 }}>
          <span style={{ color: p.textMuted, width: 110, flexShrink: 0 }}>প্রোব:</span>
          <span>
            {d.probes === null
              ? "চলেনি"
              : `${d.probes}টা প্রোব${d.stoppedAt ? `, থেমেছে ${d.stoppedAt}-এ` : ", সীমায় পৌঁছেছে"}${d.probeReason ? ` — ${d.probeReason}` : ""}`}
          </span>
        </div>
        {realRows.map((r) => (
          <div key={r.label} style={{ display: "flex", gap: 12, alignItems: "baseline", fontSize: 22 }}>
            <span>{r.ok ? "✅" : "❌"}</span>
            <span style={{ fontWeight: 600 }}>{r.label}</span>
            <span style={{ color: p.textMuted, fontSize: 20 }}>— {r.note}</span>
          </div>
        ))}
      </div>

      {/* ---- নকল-সার্ভারের কেস ---- */}
      <div style={{ fontSize: 26, fontWeight: 700, color: p.accent, marginTop: 4 }}>
        কেস (নকল স্ক্যান/প্রোব/সার্ভার) · {casesPassed}/{INVENTORY_CASE_COUNT}
      </div>
      {outcomes.map((o) => (
        <div key={o.id} style={{ background: p.panelBg, border: `2px solid ${o.ok ? p.panelBorder : "#FF6B6B"}`, borderRadius: 18, padding: "8px 20px", display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ fontSize: 30, lineHeight: 1.1 }}>{o.ok ? "✅" : "❌"}</div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.25 }}>
              <span style={{ color: p.accent }}>{o.step}</span> · {o.title}
            </div>
            <div style={{ fontSize: 19, color: p.textMuted, lineHeight: 1.25 }}>ইনপুট: {o.input}</div>
            <div style={{ fontSize: 20, lineHeight: 1.25 }}>
              <span style={{ color: p.textMuted }}>প্রত্যাশা:</span> {o.expected}
            </div>
            <div style={{ fontSize: 20, lineHeight: 1.25, color: o.ok ? p.text : "#FF8A8A" }}>
              <span style={{ color: p.textMuted }}>পেয়েছে:</span> {o.actual}
            </div>
          </div>
        </div>
      ))}
      {/* ---- 9J: FallbackSvg ---- */}
      <div style={{ fontSize: 26, fontWeight: 700, color: p.accent, marginTop: 8 }}>9J · FallbackSvg (৩ থিম × ফ্রেম 0 ও 90)</div>
      <div style={{ background: p.panelBg, border: `2px solid ${fbOk ? p.panelBorder : "#FF6B6B"}`, borderRadius: 18, padding: "12px 22px", display: "flex", flexDirection: "column", gap: 6 }}>
        {fbRows.map((r) => (
          <div key={r.label} style={{ display: "flex", gap: 12, alignItems: "baseline", fontSize: 22 }}>
            <span>{r.ok ? "✅" : "❌"}</span>
            <span style={{ fontWeight: 600 }}>{r.label}</span>
            <span style={{ color: p.textMuted, fontSize: 20 }}>— {r.note}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        {FB_CELLS.map((c) => {
          const cp = getThemeColors(c.theme, c.nightFactor);
          return (
            <div key={c.label} style={{ width: 320, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ background: skyGradient(cp), border: `2px solid ${p.panelBorder}`, borderRadius: 18, height: 320, width: 320, alignItems: "center", justifyContent: "center", display: "flex" }}>
                <FallbackSvg frame={c.frame} size={280} theme={c.theme} nightFactor={c.nightFactor} />
              </div>
              <div style={{ fontSize: 19, color: p.textMuted, textAlign: "center" }}>{c.label}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
