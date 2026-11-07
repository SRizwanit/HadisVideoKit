import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { Background } from "../components/Background";
import { playBadgeLook } from "../components/PlayBadge";
import { OUTRO_TEXT } from "../constants";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import {
  BADGE_ASPECT,
  BADGE_PNG_WIDTH,
  CLEAR_SPACE_RATIO,
  OUTRO_BASE_FRAMES,
  OUTRO_FADE_IN,
  OUTRO_FADE_OUT,
  OUTRO_MIN_ANIMATED_FRAMES,
  OUTRO_STEPS,
  PULSE_PERIOD_FRAMES,
  SHINE_BAND,
  SHINE_PEAK_OPACITY,
  TAP_BOB_UNITS,
  outroLayout,
  planOutro,
  sceneFadeFrames,
  shineCenter,
  typewriterText,
  typewriterUnits,
} from "../lib/outroPlan";
import type { OutroLayout } from "../lib/outroPlan";
import type { Timing } from "../lib/timing";
import { computeLayout } from "../lib/useLayout";
import type { Box } from "../lib/useLayout";
import { OutroScene } from "../scenes/OutroScene";
import { getThemeColors, skyGradient, type Palette } from "../themes";
import type { ThemeId } from "../types";
import { OUTRO_CASE_COUNT, runOutroCases } from "./outroCases";

/**
 * Part 12E (dev টুল): Outro সিনের যাচাইয়ের ছবি — `npm run check` এটাকে নিজে ধরে `out/check-OutroPreview.png` বানায়।
 *
 * উপরে থেকে নিচে:
 *  ১. স্বয়ংক্রিয় সারি (✅/❌) — ৪ সাইজে (1080×1920 · 1920×1080 · 2160×3840 · 3840×2160) বিশুদ্ধ হিসাব মিলিয়ে:
 *     টাইপরাইটার (যুক্তাক্ষর অটুট) · ব্যাজের আস্পেক্ট + clear space · pulse সীমার ভেতরে · shine একবার, ব্যাজের ভেতরে ·
 *     সব কিছু কম্পোজিশন ও প্যানেলের ভেতরে · 4K = ২× HD · Outro ০ → কিছু নেই · ছোট Outro চেপে আসে · ৪K-তে ঝাপসা নয় ·
 *     সিনের ফেড · ট্যাপ-ইঙ্গিত বন্ধ করা যায় + রাতের halo।
 *  ২. আসল `Background` (greenDayNight-এ রাত + জোনাকি) + আসল `OutroScene`-এর ছবির ঘর: ৩ থিম × Portrait × ৫ মুহূর্ত,
 *     Landscape ৪টা, আর Outro-র দৈর্ঘ্যের ৫ রকম (০ s · ৩ ফ্রেম স্থির · ৩০ · ৯০ · ৪৫০ ফ্রেম)।
 *  ৩. `outroPlan.ts`-এর ৩৩টা বিশুদ্ধ কেস (12A)।
 * নমুনা-ফাইল (wav/json) লাগে না। উচ্চতা `OUTRO_PREVIEW_HEIGHT` ধ্রুবক থেকেই আসে।
 */

// ---------- ঘরের তালিকা (সব স্থির) ----------
/** সব ঘরে আসল Outro-র মতো রাত (nightFactor = 1; greenDayNight-এ তারা + সবচেয়ে বেশি জোনাকি) */
const NIGHT = 1;
const FPS_T = 30;

const mkTiming = (outroFrames: number): Timing => ({
  fps: FPS_T,
  introFrames: 90,
  mainFrames: 300,
  outroFrames,
  totalFrames: 90 + 300 + outroFrames,
});

/** ১২০ ফ্রেমের Outro-র ৫টা মুহূর্ত: টাইপ হচ্ছে · bounce-in-এর চূড়া · shine মাঝপথে · pulse-এর চূড়া · ফেড-আউট শুরু */
const PORTRAIT_FRAMES = [34, 56, 74, 100, 112];
const PORTRAIT_FRAME_NOTES = ["টাইপ", "bounce", "shine", "pulse", "ফেড-আউট"];

type Tile = {
  label: string;
  theme: ThemeId;
  frame: number;
  outroFrames: number;
  landscape: boolean;
};

const PORTRAIT_TILES = (theme: ThemeId): Tile[] =>
  PORTRAIT_FRAMES.map((f, i) => ({
    label: `${theme} · ফ্রেম ${f} (${PORTRAIT_FRAME_NOTES[i]})`,
    theme,
    frame: f,
    outroFrames: OUTRO_BASE_FRAMES,
    landscape: false,
  }));

const LANDSCAPE_TILES: Tile[] = [
  { label: "emerald · Landscape · ফ্রেম 56 (bounce)", theme: "emerald", frame: 56, outroFrames: OUTRO_BASE_FRAMES, landscape: true },
  { label: "navy · Landscape · ফ্রেম 100 (pulse)", theme: "navy", frame: 100, outroFrames: OUTRO_BASE_FRAMES, landscape: true },
  { label: "greenDayNight · Landscape · ফ্রেম 74 (shine)", theme: "greenDayNight", frame: 74, outroFrames: OUTRO_BASE_FRAMES, landscape: true },
  { label: "greenDayNight · Landscape · ফ্রেম 100 (pulse)", theme: "greenDayNight", frame: 100, outroFrames: OUTRO_BASE_FRAMES, landscape: true },
];

const LENGTH_TILES: Tile[] = [
  { label: "Outro ০ s → কিছুই আঁকা হয় না (শুধু Background)", theme: "greenDayNight", frame: 0, outroFrames: 0, landscape: false },
  { label: "৩ ফ্রেম → স্থির শেষ-অবস্থা (টাইপ পুরো, ব্যাজ ১)", theme: "greenDayNight", frame: 1, outroFrames: 3, landscape: false },
  { label: "৩০ ফ্রেম (চেপে এসেছে) · ফ্রেম 20", theme: "greenDayNight", frame: 20, outroFrames: 30, landscape: false },
  { label: "৯০ ফ্রেম (চেপে এসেছে) · ফ্রেম 70", theme: "greenDayNight", frame: 70, outroFrames: 90, landscape: false },
  { label: "৪৫০ ফ্রেম (১৫ s) · ফ্রেম 300 → স্থির + pulse চলছে", theme: "greenDayNight", frame: 300, outroFrames: 450, landscape: false },
];

// ---------- মাপ (সব স্থির সংখ্যা; উচ্চতা এখান থেকেই) ----------
const PAD = 36;
const HEAD_H = 84;
const SEC_H = 56;
const ROW_H = 54;
const ROW_PITCH = 62;
const N_AUTO = 11;
const CONTENT_W = 1080 - PAD * 2; // 1008
const GAP = 12;
const P_PER_ROW = 5;
const P_TILE_W = (CONTENT_W - GAP * (P_PER_ROW - 1)) / P_PER_ROW; // 192
const P_TILE_H = Math.ceil((P_TILE_W * 1920) / 1080); // 342
const P_PITCH = P_TILE_H + GAP;
const L_PER_ROW = 2;
const L_TILE_W = (CONTENT_W - GAP * (L_PER_ROW - 1)) / L_PER_ROW; // 498
const L_TILE_H = Math.ceil((L_TILE_W * 1080) / 1920); // 281
const L_PITCH = L_TILE_H + GAP;
const N_THEME_ROWS = 3;
const N_LAND_ROWS = 2;

export const OUTRO_PREVIEW_HEIGHT =
  PAD * 2 +
  HEAD_H +
  (SEC_H + N_AUTO * ROW_PITCH) +
  (SEC_H + N_THEME_ROWS * P_PITCH) +
  (SEC_H + N_LAND_ROWS * L_PITCH) +
  (SEC_H + P_PITCH) +
  (SEC_H + OUTRO_CASE_COUNT * ROW_PITCH) +
  30;

// ---------- স্বয়ংক্রিয় সারি ----------
type Row = { title: string; ok: boolean; note: string };

const SIZES = [
  { key: "1080×1920", w: 1080, h: 1920 },
  { key: "1920×1080", w: 1920, h: 1080 },
  { key: "2160×3840", w: 2160, h: 3840 },
  { key: "3840×2160", w: 3840, h: 2160 },
] as const;

const TOL = 1e-6;
/** স্থির সীমা (আমদানি-করা ধ্রুবক নয়) — ধ্রুবক ভুল করে বাড়ালেও এই সারি ধরবে */
const PULSE_LIMIT = 1.06;
const SCALE_LIMIT = 1.07;
const lay = (w: number, h: number): OutroLayout => outroLayout(computeLayout(w, h));
const inside = (inner: Box, outer: Box, tol = TOL): boolean =>
  inner.x >= outer.x - tol &&
  inner.y >= outer.y - tol &&
  inner.x + inner.width <= outer.x + outer.width + tol &&
  inner.y + inner.height <= outer.y + outer.height + tol;
const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width - TOL && a.x + a.width > b.x + TOL && a.y < b.y + b.height - TOL && a.y + a.height > b.y + TOL;
const sq = (s: { x: number; y: number; size: number }): Box => ({ x: s.x, y: s.y, width: s.size, height: s.size });
const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const f2 = (v: number, d = 4) => v.toFixed(d);

/** একটা সারি বানায়; ভেতরে যা-ই ঘটুক throw করে না — ভাঙলে ❌ + কারণ */
function row(title: string, fn: () => { ok: boolean; note: string }): Row {
  try {
    const r = fn();
    return { title, ok: r.ok, note: r.note };
  } catch (e) {
    return { title, ok: false, note: `সারি নিজেই ভেঙেছে: ${String(e)}` };
  }
}

/** সংখ্যা-গাছ সমান্তরালভাবে চলে ঠিক ২× কি না (4K = ২× HD) */
function flatNums(v: unknown, prefix = ""): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof v === "number") out[prefix] = v;
  else if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) Object.assign(out, flatNums(val, prefix ? `${prefix}.${k}` : k));
  }
  return out;
}

function buildRows(): Row[] {
  const rows: Row[] = [];

  // 1. টাইপরাইটার: যুক্তাক্ষর কখনো ভাঙে না
  rows.push(
    row("টাইপরাইটার: প্রতি ধাপ = ইউনিট-প্রিফিক্স; হসন্ত/ZWJ-এ শেষ নয়; পুরো লেখা অটুট", () => {
      const units = typewriterUnits(OUTRO_TEXT);
      const bad: string[] = [];
      const lens = new Set<number>();
      for (let i = 0; i <= 200; i++) {
        const txt = typewriterText(OUTRO_TEXT, i / 200);
        lens.add(txt.length);
        const isPrefix = OUTRO_TEXT.startsWith(txt);
        const last = txt.slice(-1);
        const endsBad = last === "\u09CD" || last === "\u200D" || last === "\u200C";
        const isUnitPrefix = units.some((_, k) => units.slice(0, k).join("") === txt) || txt === OUTRO_TEXT;
        if (!isPrefix || endsBad || !isUnitPrefix) bad.push(`${i / 200}→"${txt}"`);
      }
      const ok =
        bad.length === 0 &&
        units.join("") === OUTRO_TEXT &&
        typewriterText(OUTRO_TEXT, 0) === "" &&
        typewriterText(OUTRO_TEXT, 1) === OUTRO_TEXT;
      return { ok, note: ok ? `${units.length} ইউনিট · ${lens.size} আলাদা ধাপ · পুরো লেখা \"${OUTRO_TEXT}\"` : `ভাঙা ধাপ: ${bad.slice(0, 3).join(" ")}` };
    }),
  );

  // 2. ব্যাজের আস্পেক্ট রেশিও + clear space (৪ সাইজ × ১২০ ফ্রেম)
  rows.push(
    row("ব্যাজ: আস্পেক্ট রেশিও ঠিক + ¼-উচ্চতার clear space `outer`-এর ভেতরে (৪ সাইজ × ১২০ ফ্রেম)", () => {
      const fails: string[] = [];
      let worst = 0;
      for (const s of SIZES) {
        const L = lay(s.w, s.h);
        for (const f of range(OUTRO_BASE_FRAMES)) {
          const look = playBadgeLook(L.badge, planOutro(f, OUTRO_BASE_FRAMES));
          const a1 = look.rest.width / look.rest.height;
          const a2 = look.drawn.width / look.drawn.height;
          worst = Math.max(worst, Math.abs(a1 - BADGE_ASPECT), Math.abs(a2 - BADGE_ASPECT));
          const c = look.drawn.height * CLEAR_SPACE_RATIO;
          const clearBox: Box = { x: look.drawn.x - c, y: look.drawn.y - c, width: look.drawn.width + 2 * c, height: look.drawn.height + 2 * c };
          if (Math.abs(a1 - BADGE_ASPECT) > 1e-9 || Math.abs(a2 - BADGE_ASPECT) > 1e-9) fails.push(`${s.key} f${f}: আস্পেক্ট ${f2(a2, 6)}`);
          else if (!inside(clearBox, L.badge.outer)) fails.push(`${s.key} f${f}: clear space outer-এর বাইরে`);
        }
      }
      const ok = fails.length === 0;
      return { ok, note: ok ? `আস্পেক্ট ${f2(BADGE_ASPECT, 4)} (ভুল ≤ ${worst.toExponential(1)}) · clear space = উচ্চতার ${CLEAR_SPACE_RATIO * 100}% (Google-এর নিয়ম) সব ফ্রেমে ভেতরে` : fails.slice(0, 2).join(" · ") };
    }),
  );

  // 3. bounce + pulse সীমার ভেতরে; pulse bounce থিতানোর পরে শুরু; লুপ করে
  rows.push(
    row("pulse: স্কেল ≤ 1.07 · pulse 1…1.06 · bounce-এর পরে শুরু · লুপ করে (৬ দৈর্ঘ্য × ৪ সাইজ)", () => {
      const fails: string[] = [];
      let maxScale = 0;
      let maxPulse = 1;
      for (const s of SIZES) {
        const L = lay(s.w, s.h);
        for (const n of [6, 30, 60, 120, 200, 450]) {
          for (const f of range(n)) {
            const plan = planOutro(f, n);
            if (!plan) {
              fails.push(`${s.key} n${n} f${f}: plan null`);
              continue;
            }
            const look = playBadgeLook(L.badge, plan);
            maxScale = Math.max(maxScale, look.scale);
            maxPulse = Math.max(maxPulse, look.pulse);
            if (look.scale > SCALE_LIMIT + 1e-9) fails.push(`${s.key} n${n} f${f}: স্কেল ${f2(look.scale)}`);
            if (look.pulse < 1 - 1e-12 || look.pulse > PULSE_LIMIT + 1e-9) fails.push(`${s.key} n${n} f${f}: pulse ${f2(look.pulse)}`);
            if (plan.t < OUTRO_STEPS.pulse && look.pulse !== 1) fails.push(`${s.key} n${n} f${f}: pulse আগেই শুরু`);
            if (!inside(look.drawn, L.badge.outer)) fails.push(`${s.key} n${n} f${f}: ব্যাজ outer-এর বাইরে`);
          }
        }
      }
      // লুপ: ৪৫০ ফ্রেমে চূড়া বারবার আসে
      const ps = range(450).map((f) => planOutro(f, 450)?.pulse ?? 1);
      let peaks = 0;
      for (let i = 1; i < ps.length - 1; i++) if (ps[i] > ps[i - 1] && ps[i] >= ps[i + 1] && ps[i] > PULSE_LIMIT - 1e-3) peaks++;
      const expectPeaks = Math.floor((450 - OUTRO_STEPS.pulse) / PULSE_PERIOD_FRAMES);
      const ok = fails.length === 0 && peaks >= expectPeaks - 1 && maxPulse >= PULSE_LIMIT - 1e-6;
      return { ok, note: ok ? `সর্বোচ্চ স্কেল ${f2(maxScale)} ≤ ${SCALE_LIMIT} · pulse সর্বোচ্চ ${f2(maxPulse)} · ৪৫০ ফ্রেমে ${peaks}টা চূড়া (পর্যায় ${PULSE_PERIOD_FRAMES})` : fails.slice(0, 2).join(" · ") || `চূড়া ${peaks}/${expectPeaks}` };
    }),
  );

  // 4. shine: একবার, ব্যাজের ভেতরে
  rows.push(
    row("shine: ঠিক একবার · ফালি ব্যাজের বাইরে শুরু ও শেষ · আলো ≤ 0.55 · সীমা ছাড়ায় না", () => {
      const fails: string[] = [];
      const runsInfo: string[] = [];
      for (const s of SIZES) {
        const L = lay(s.w, s.h);
        for (const n of [30, 60, 120, 450]) {
          let runs = 0;
          let prev = false;
          let maxOp = 0;
          for (const f of range(n)) {
            const look = playBadgeLook(L.badge, planOutro(f, n));
            const w = look.rest.width;
            if (look.shine.active && !prev) runs++;
            prev = look.shine.active;
            maxOp = Math.max(maxOp, look.shine.opacity);
            if (look.shine.centerX < -SHINE_BAND * w - 1e-6 || look.shine.centerX > (1 + SHINE_BAND) * w + 1e-6) fails.push(`${s.key} n${n} f${f}: ফালি বেশি দূরে`);
          }
          if (runs !== 1) fails.push(`${s.key} n${n}: ${runs} বার`);
          if (maxOp > SHINE_PEAK_OPACITY + 1e-9) fails.push(`${s.key} n${n}: আলো ${f2(maxOp)}`);
          if (s.key === "1080×1920") runsInfo.push(`n${n}:${runs}`);
        }
        const bw = L.badge.width * SHINE_BAND;
        if (shineCenter(0) * L.badge.width + bw / 2 > 1e-6) fails.push(`${s.key}: শুরুতে ফালি ভেতরে`);
        if (shineCenter(1) * L.badge.width - bw / 2 < L.badge.width - 1e-6) fails.push(`${s.key}: শেষে ফালি ভেতরে`);
      }
      const ok = fails.length === 0;
      return { ok, note: ok ? `দৌড় (১০৮০×১৯২০): ${runsInfo.join(" ")} · শুরু ও শেষে ফালি পুরোপুরি ব্যাজের বাইরে · সর্বোচ্চ আলো ${SHINE_PEAK_OPACITY}` : fails.slice(0, 2).join(" · ") };
    }),
  );

  // 5. সব কিছু কম্পোজিশন ও প্যানেলের ভেতরে (৪ সাইজ)
  rows.push(
    row("সব ভেতরে: প্যানেল ⊂ কম্পোজিশন; লোগো/নাম/লেখা/ব্যাজ/ট্যাপ ⊂ প্যানেল; outer-এ অন্য কিছু নেই", () => {
      const fails: string[] = [];
      const parts: string[] = [];
      for (const s of SIZES) {
        const L = lay(s.w, s.h);
        const comp: Box = { x: 0, y: 0, width: s.w, height: s.h };
        const tapMax: Box = { ...L.tap, height: L.tap.height + TAP_BOB_UNITS * L.unit };
        if (!inside(L.panel, comp)) fails.push(`${s.key}: প্যানেল বাইরে`);
        const items: [string, Box][] = [
          ["লোগো", sq(L.logo)],
          ["নাম", L.name],
          ["লেখা", L.text],
          ["ব্যাজ-outer", L.badge.outer],
          ["ট্যাপ", tapMax],
        ];
        for (const [nm, b] of items) if (!inside(b, L.panel)) fails.push(`${s.key}: ${nm} প্যানেলের বাইরে`);
        for (const [nm, b] of [["লোগো", sq(L.logo)], ["নাম", L.name], ["লেখা", L.text], ["ট্যাপ", tapMax]] as [string, Box][]) {
          if (overlap(b, L.badge.outer)) fails.push(`${s.key}: ${nm} ব্যাজ-outer-এ ঢুকেছে`);
        }
        if (s.key === "1080×1920" || s.key === "1920×1080") parts.push(`${s.key}: প্যানেল ${Math.round(L.panel.width)}×${Math.round(L.panel.height)}`);
      }
      const ok = fails.length === 0;
      return { ok, note: ok ? `৪ সাইজেই ঠিক · ${parts.join(" · ")}` : fails.slice(0, 2).join(" · ") };
    }),
  );

  // 6. 4K = ২× HD
  rows.push(
    row("4K = ঠিক ২× HD: প্যানেল · লোগো · নাম · লেখা · ব্যাজ · outer · ট্যাপ · ফন্ট · unit", () => {
      const fails: string[] = [];
      let count = 0;
      for (const [hd, k4] of [
        [SIZES[0], SIZES[2]],
        [SIZES[1], SIZES[3]],
      ] as const) {
        const a = flatNums(lay(hd.w, hd.h));
        const b = flatNums(lay(k4.w, k4.h));
        for (const key of Object.keys(a)) {
          if (key === "isPortrait" || key.endsWith("aspect")) continue; // অনুপাত ২× হয় না — অপরিবর্তিত থাকে (সেটা সারি ২-এ যাচাই)
          count++;
          if (b[key] === undefined || Math.abs(b[key] - 2 * a[key]) > 1e-6 * Math.max(1, Math.abs(a[key]))) fails.push(`${hd.key}→${k4.key} ${key}: ${a[key]} → ${b[key]}`);
        }
      }
      const ok = fails.length === 0 && count > 40;
      return { ok, note: ok ? `${count} সংখ্যা মিলিয়ে দেখা হয়েছে — সব ঠিক ২×` : fails.slice(0, 2).join(" · ") || `মাত্র ${count}টা সংখ্যা` };
    }),
  );

  // 7. Outro ০ → কিছুই আঁকা হয় না
  rows.push(
    row("Outro ০ s (বা অবৈধ) → কিছুই আঁকা হয় না, ভাঙে না; অবৈধ ফ্রেম → ফ্রেম ০", () => {
      const L = lay(1080, 1920);
      const nulls = [planOutro(0, 0), planOutro(10, 0), planOutro(5, -3), planOutro(5, NaN), planOutro(5, -Infinity)];
      const allNull = nulls.every((p) => p === null);
      const badgeHidden = playBadgeLook(L.badge, null).visible === false;
      const weird = [NaN, -5, Infinity, -Infinity].map((f) => planOutro(f, OUTRO_BASE_FRAMES));
      const weirdOk = weird.every((p) => p !== null && p.frame === 0);
      const framesZero = weirdOk;
      const ok = allNull && badgeHidden && weirdOk && framesZero;
      return { ok, note: `০/−৩/NaN/−∞ ফ্রেম → null ${nulls.filter((p) => p === null).length}/${nulls.length} · ব্যাজ অদৃশ্য ${badgeHidden ? "হ্যাঁ" : "না"} · NaN/নেগেটিভ ফ্রেম → ০` };
    }),
  );

  // 8. ছোট Outro চেপে আসে / বড় Outro স্থির থাকে / < ৬ ফ্রেম স্থির দৃশ্য
  rows.push(
    row("ছোট Outro চেপে আসে (৩০/৬০/৯০) · < ৬ ফ্রেম স্থির · ৪৫০ ফ্রেমে চলে তারপর স্থির", () => {
      const fails: string[] = [];
      const notes: string[] = [];
      for (const n of [30, 60, 90]) {
        const last = planOutro(n - 1, n);
        if (!last) {
          fails.push(`n${n}: null`);
          continue;
        }
        const shineDone = last.t >= OUTRO_STEPS.shine + 24;
        if (last.text.typed !== 1) fails.push(`n${n}: লেখা ${f2(last.text.typed)}`);
        if (Math.abs(last.badge.scale - 1) > 1e-9) fails.push(`n${n}: ব্যাজ ${f2(last.badge.scale)}`);
        if (!shineDone) fails.push(`n${n}: shine শেষ হয়নি`);
        notes.push(`${n}→t${Math.round(last.t)}`);
      }
      for (const f of [0, 1, 2]) {
        const st = planOutro(f, 3);
        const okSt = !!st && st.isStatic && st.text.typed === 1 && st.badge.scale === 1 && st.pulse === 1 && !st.shine.active && st.tap.opacity === 0 && st.scene.opacity === 1;
        if (!okSt) fails.push(`n3 f${f}: স্থির নয়`);
      }
      const hold = planOutro(300, 450);
      if (!hold || hold.text.typed !== 1 || Math.abs(hold.badge.scale - 1) > 1e-9 || hold.pulse < 1 || hold.pulse > PULSE_LIMIT + 1e-9 || hold.tap.opacity <= 0) fails.push("n450 f300: স্থির নয়");
      const ok = fails.length === 0 && OUTRO_MIN_ANIMATED_FRAMES === 6;
      return { ok, note: ok ? `শেষ ফ্রেমের base-সময়: ${notes.join(" · ")} (≥ 114) · ৩ ফ্রেম স্থির ✓ · ৪৫০ ফ্রেমে f300-এ pulse ${hold ? f2(hold.pulse) : "—"} চলছে` : fails.slice(0, 2).join(" · ") };
    }),
  );

  // 9. ৪K-তেও ঝাপসা নয়
  rows.push(
    row("ব্যাজ ঝাপসা নয়: 4K-তে সর্বোচ্চ আঁকা প্রস্থ ≤ PNG-র ১৬০০ px", () => {
      const fails: string[] = [];
      const notes: string[] = [];
      for (const s of SIZES) {
        const L = lay(s.w, s.h);
        let maxW = 0;
        for (const f of range(OUTRO_BASE_FRAMES)) {
          const look = playBadgeLook(L.badge, planOutro(f, OUTRO_BASE_FRAMES));
          maxW = Math.max(maxW, look.drawn.width);
          if (!look.sharp) fails.push(`${s.key} f${f}: ঝাপসা হতে পারে`);
        }
        if (maxW > BADGE_PNG_WIDTH) fails.push(`${s.key}: আঁকা প্রস্থ ${Math.round(maxW)} > ${BADGE_PNG_WIDTH}`);
        if (s.w >= 2160 || s.h >= 2160) notes.push(`${s.key}: বিশ্রাম ${Math.round(L.badge.width)} px · সর্বোচ্চ ${Math.round(maxW)} px`);
      }
      const ok = fails.length === 0;
      return { ok, note: ok ? `${notes.join(" · ")} < PNG ${BADGE_PNG_WIDTH} px` : fails.slice(0, 2).join(" · ") };
    }),
  );

  // 10. সিনের ফেড
  rows.push(
    row("সিনের ফেড: min(12, ⌊n×25%⌋) · f0 অদৃশ্য · মাঝে পুরো · শেষে প্রায় ০ · স্কেল ≤ 1.04", () => {
      const fails: string[] = [];
      const want: [number, number][] = [[120, 12], [90, 12], [48, 12], [30, 7], [6, 1], [5, 0]];
      for (const [n, w] of want) if (sceneFadeFrames(n) !== w) fails.push(`sceneFadeFrames(${n}) = ${sceneFadeFrames(n)} (চাই ${w})`);
      const p0 = planOutro(0, 120);
      const pm = planOutro(60, 120);
      const pl = planOutro(119, 120);
      if (!p0 || !pm || !pl) return { ok: false, note: "plan null" };
      if (OUTRO_FADE_IN && p0.scene.opacity !== 0) fails.push(`f0 opacity ${f2(p0.scene.opacity)}`);
      if (pm.scene.opacity !== 1) fails.push(`f60 opacity ${f2(pm.scene.opacity)}`);
      if (OUTRO_FADE_OUT && (pl.scene.opacity > 0.05 || pl.scene.opacity < 0)) fails.push(`f119 opacity ${f2(pl.scene.opacity)}`);
      let maxScale = 0;
      for (const f of range(120)) maxScale = Math.max(maxScale, planOutro(f, 120)?.scene.scale ?? 0);
      if (maxScale > 1.04 + 1e-9) fails.push(`স্কেল ${f2(maxScale)}`);
      const ok = fails.length === 0;
      return { ok, note: ok ? `১২০ ফ্রেম: f0 ${f2(p0.scene.opacity, 2)} · f60 ${f2(pm.scene.opacity, 2)} · f119 ${f2(pl.scene.opacity, 3)} · সর্বোচ্চ স্কেল ${f2(maxScale, 3)}` : fails.slice(0, 2).join(" · ") };
    }),
  );

  // 11. ট্যাপ-ইঙ্গিত বন্ধ করা যায় + রাতের halo
  rows.push(
    row("ট্যাপ-ইঙ্গিত: ফ্রেম 86 থেকে, শুধু নিচে ওঠে-নামে, বন্ধ করা যায় · রাতের halo > দিনের", () => {
      const fails: string[] = [];
      let down = true;
      for (const s of SIZES) {
        const L = lay(s.w, s.h);
        for (const f of range(OUTRO_BASE_FRAMES)) {
          const plan = planOutro(f, OUTRO_BASE_FRAMES);
          const on = playBadgeLook(L.badge, plan, BADGE_ASPECT, { tapBox: L.tap, unit: L.unit });
          const off = playBadgeLook(L.badge, plan, BADGE_ASPECT, { tapBox: L.tap, unit: L.unit, showTap: false });
          const none = playBadgeLook(L.badge, plan, BADGE_ASPECT, { unit: L.unit });
          if (off.tap.visible || none.tap.visible) fails.push(`${s.key} f${f}: বন্ধ করা যায়নি`);
          if (plan && plan.t < OUTRO_STEPS.tap && on.tap.visible) fails.push(`${s.key} f${f}: ট্যাপ আগেই`);
          if (on.tap.offsetY < -1e-9 || on.tap.offsetY > TAP_BOB_UNITS * L.unit + 1e-6) {
            down = false;
            fails.push(`${s.key} f${f}: offsetY ${f2(on.tap.offsetY)}`);
          }
        }
      }
      const L0 = lay(1080, 1920);
      const plan0 = planOutro(80, OUTRO_BASE_FRAMES);
      const day = playBadgeLook(L0.badge, plan0, BADGE_ASPECT, { nightFactor: 0 }).haloAlpha;
      const night = playBadgeLook(L0.badge, plan0, BADGE_ASPECT, { nightFactor: 1 }).haloAlpha;
      if (!(night > day)) fails.push(`halo রাত ${f2(night, 2)} ≤ দিন ${f2(day, 2)}`);
      const ok = fails.length === 0 && down;
      return { ok, note: ok ? `ট্যাপ সবসময় নিচের দিকে 0…${TAP_BOB_UNITS} unit · halo দিন ${f2(day, 2)} → রাত ${f2(night, 2)}` : fails.slice(0, 2).join(" · ") };
    }),
  );

  return rows;
}

// ---------- আঁকা ----------
const RowView: React.FC<{ p: Palette; ok: boolean; title: string; note: string }> = ({ p, ok, title, note }) => (
  <div style={{ height: ROW_PITCH, flexShrink: 0 }}>
    <div style={{ height: ROW_H, boxSizing: "border-box", background: p.panelBg, border: `2px solid ${ok ? p.panelBorder : "#FF6B6B"}`, borderRadius: 14, padding: "6px 16px", display: "flex", gap: 14, alignItems: "center" }}>
      <div style={{ fontSize: 28, lineHeight: 1 }}>{ok ? "✅" : "❌"}</div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        <div style={{ fontSize: 18, lineHeight: 1.2, color: ok ? p.textMuted : "#FF8A8A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{note}</div>
      </div>
    </div>
  </div>
);

const SectionTitle: React.FC<{ p: Palette; text: string }> = ({ p, text }) => (
  <div style={{ height: SEC_H, flexShrink: 0, display: "flex", alignItems: "center", fontSize: 27, fontWeight: 700, color: p.accent }}>{text}</div>
);

/** একটা ঘর: আসল Background + আসল OutroScene (frame + size prop দিয়ে), ছোট করে দেখানো */
const TileView: React.FC<{ tile: Tile; x: number; y: number; w: number }> = ({ tile, x, y, w }) => {
  const fullW = tile.landscape ? 1920 : 1080;
  const fullH = tile.landscape ? 1080 : 1920;
  const scale = w / fullW;
  const h = fullH * scale;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, overflow: "hidden", outline: "1px solid #ffffff44" }}>
      <div style={{ width: fullW, height: fullH, transform: `scale(${scale})`, transformOrigin: "0 0", position: "relative" }}>
        <Background theme={tile.theme} nightFactor={NIGHT} size={{ width: fullW, height: fullH }} />
        <OutroScene
          theme={tile.theme}
          timing={mkTiming(tile.outroFrames)}
          nightFactor={NIGHT}
          frame={tile.frame}
          size={{ width: fullW, height: fullH }}
          sfx={false}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 4,
          bottom: 4,
          maxWidth: w - 8,
          background: "#000000b8",
          color: "#fff",
          fontFamily: FONT_BODY,
          fontSize: tile.landscape ? 17 : 11,
          lineHeight: 1.25,
          padding: "2px 6px",
          borderRadius: 6,
        }}
      >
        {tile.label}
      </div>
    </div>
  );
};

/** একই সারির ঘরগুলো (ফাঁকা জায়গা `GAP`); ঘরের উচ্চতা = প্রস্থ × অনুপাত */
const TileRow: React.FC<{ tiles: Tile[]; w: number; h: number; perRow: number }> = ({ tiles, w, h, perRow }) => {
  const rows = Math.ceil(tiles.length / perRow);
  return (
    <div style={{ height: rows * (h + GAP), flexShrink: 0, position: "relative" }}>
      {tiles.map((t, i) => (
        <TileView key={t.label} tile={t} x={(i % perRow) * (w + GAP)} y={Math.floor(i / perRow) * (h + GAP)} w={w} />
      ))}
    </div>
  );
};

export const OutroPreview: React.FC = () => {
  const p = getThemeColors("emerald", 0);
  const cases = useMemo(() => runOutroCases(), []);
  const rows = useMemo(() => buildRows(), []);
  const rowsPassed = rows.filter((r) => r.ok).length;
  const casesPassed = cases.filter((c) => c.ok).length;
  const total = N_AUTO + OUTRO_CASE_COUNT;
  const passed = rowsPassed + casesPassed;
  const allOk = rows.length === N_AUTO && passed === total;

  return (
    <AbsoluteFill style={{ background: skyGradient(p), boxSizing: "border-box", padding: PAD, flexDirection: "column", fontFamily: FONT_BODY, color: p.text }}>
      <div style={{ height: HEAD_H, flexShrink: 0, display: "flex", alignItems: "baseline", gap: 20 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 46, color: p.accent }}>Outro যাচাই</div>
        <div style={{ fontWeight: 700, fontSize: 34, color: allOk ? "#7CFFB2" : "#FF8A8A" }}>
          {allOk ? "সব ✅" : "❌ আছে"} · {passed}/{total}
        </div>
      </div>

      <SectionTitle p={p} text={`Part 12E · স্বয়ংক্রিয় যাচাই (৪ সাইজে) · ${rowsPassed}/${N_AUTO}`} />
      {rows.map((r) => (
        <RowView key={r.title} p={p} ok={r.ok} title={r.title} note={r.note} />
      ))}

      <SectionTitle p={p} text="Portrait · ৩ থিম × ৫ মুহূর্ত (রাত; আসল Background + OutroScene)" />
      {(["emerald", "navy", "greenDayNight"] as ThemeId[]).map((th) => (
        <TileRow key={th} tiles={PORTRAIT_TILES(th)} w={P_TILE_W} h={P_TILE_H} perRow={P_PER_ROW} />
      ))}

      <SectionTitle p={p} text="Landscape · emerald / navy / greenDayNight" />
      <TileRow tiles={LANDSCAPE_TILES} w={L_TILE_W} h={L_TILE_H} perRow={L_PER_ROW} />

      <SectionTitle p={p} text="Outro-র দৈর্ঘ্য: ০ s · ৩ · ৩০ · ৯০ · ৪৫০ ফ্রেম (greenDayNight)" />
      <TileRow tiles={LENGTH_TILES} w={P_TILE_W} h={P_TILE_H} perRow={P_PER_ROW} />

      <SectionTitle p={p} text={`outroPlan.ts-এর বিশুদ্ধ কেস (12A) · ${casesPassed}/${OUTRO_CASE_COUNT}`} />
      {cases.map((c) => (
        <RowView key={c.id} p={p} ok={c.ok} title={c.title} note={c.ok ? c.rule : c.detail} />
      ))}
    </AbsoluteFill>
  );
};
