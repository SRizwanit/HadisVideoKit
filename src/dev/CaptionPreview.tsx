import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender } from "remotion";
import { Background } from "../components/Background";
import { CaptionView, CAPTION_PAD_UNITS } from "../components/Caption";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { computeNightFactor } from "../lib/dayNight";
import { buildFrameSegments, computeTiming, type FrameSegment, type Timing } from "../lib/timing";
import { computeLayout } from "../lib/useLayout";
import { getThemeColors, parseColor, skyGradient, type Palette } from "../themes";
import type { ThemeId } from "../types";
import { CAPTION_CASE_COUNT, runCaptionCases } from "./captionCases";

/**
 * Part 10 (dev টুল): ক্যাপশনের যাচাইয়ের ছবি — `npm run check` এটাকে নিজে ধরে `out/check-CaptionPreview.png` বানায়।
 *
 * - আসল `Background` + আসল `CaptionView` (নমুনা-ফাইল লাগে না: সেগমেন্ট/শব্দ নিচে হাতে লেখা, `buildFrameSegments` দিয়ে ফ্রেমে)।
 *   তাই `hadis0000` মুছে ফেললেও এই ছবি বানানো যায়।
 * - উপরে স্বয়ংক্রিয় সারি (DOM পড়ে ✅/❌), মাঝে ১২টা ঘর (ক্যাপশনের অংশ কেটে, ছোট করে), নিচে `captionWords.ts`-এর বিশুদ্ধ কেস।
 * - ছবি ফ্রেম ৪৫-এ তোলা হয়, কিন্তু প্রতিটা ঘর নিজের `frame` prop-এ আঁকা — কম্পোজিশনের ফ্রেমে কিছু নির্ভর করে না।
 */

// ---------- নমুনা (হাতে লেখা) ----------
const TIMING: Timing = computeTiming({ introSeconds: 3, outroSeconds: 4, audioSeconds: 14 }); // Intro 90 · Main 420 · Outro 120

const TEXT_A = "নিশ্চয়ই সকল আমল নিয়তের উপর নির্ভরশীল"; // ৬ শব্দ
const TEXT_B =
  "এটি একটি পরীক্ষামূলক লেখা, যা শুধু ক্যাপশনের রঙ, মাপ ও হাইলাইট যাচাই করার জন্য। লেখাটি বেশ লম্বা, যাতে ফন্ট ছোট হয় আর একাধিক লাইনে ভাঙে — তবুও সবটা বাক্সের ভেতরেই থাকা চাই।";
const SENT_C = "এটি পরীক্ষার জন্য একটি অতি দীর্ঘ বাক্য যা বাক্সে না আঁটলে শেষে ছাঁটা হবে।";
const TEXT_C = [SENT_C, SENT_C, SENT_C, SENT_C, SENT_C, SENT_C].join(" ");
const TEXT_D = "ধন্যবাদ আপনাকে"; // ২ শব্দ

/**
 * সেগমেন্ট (সেকেন্ড, .wav-এর শুরু থেকে):
 *  A 0–3 (৬ শব্দ, প্রতিটা ১৫ ফ্রেম) · B 3–7 (গায়ে-গায়ে A-র সাথে; লম্বা) · [ফাঁক ৭–৮] · C 8–12 (অতি লম্বা) · [ফাঁক] · D 12.5–13.5 (২ শব্দ, একা)
 * ফ্রেম (Intro ৯০ ধরে): A 90–180 · B 180–300 · C 330–450 · D 465–495
 */
const SEGMENTS: FrameSegment[] = buildFrameSegments(
  {
    segments: [
      { id: 1, start: 0, end: 3, text: TEXT_A },
      { id: 2, start: 3, end: 7, text: TEXT_B },
      { id: 3, start: 8, end: 12, text: TEXT_C },
      { id: 4, start: 12.5, end: 13.5, text: TEXT_D },
    ],
  },
  TIMING,
);

type Kind = "main" | "edge";
type CellDef = {
  key: string;
  label: string;
  why: string;
  theme: ThemeId;
  landscape: boolean;
  frame: number;
  kind: Kind;
  /** আঁকা সেগমেন্টের অবস্থান (`null` = কিছুই আঁকা হবে না) */
  expectSeg: number | null;
};

const CELLS: CellDef[] = [
  { key: "p1", label: "emerald · সেগমেন্ট A, ফ্রেম 145", why: "৪র্থ শব্দ active, আগের ৩টা read, পরের ২টা upcoming", theme: "emerald", landscape: false, frame: 145, kind: "main", expectSeg: 0 },
  { key: "p2", label: "navy · সেগমেন্ট B (লম্বা), ফ্রেম 240", why: "ফন্ট ছোট, একাধিক লাইন, বাক্সের ভেতরে", theme: "navy", landscape: false, frame: 240, kind: "main", expectSeg: 1 },
  { key: "p3", label: "greenDayNight দিন · A, ফ্রেম 100", why: "উজ্জ্বল সকাল — ১ম শব্দ active", theme: "greenDayNight", landscape: false, frame: 100, kind: "main", expectSeg: 0 },
  { key: "p4", label: "greenDayNight রাতের দিকে · C (অতি লম্বা), ফ্রেম 436", why: "গাঢ় প্যানেল; ন্যূনতম ফন্ট/ছাঁটা — তবু বাইরে যায় না", theme: "greenDayNight", landscape: false, frame: 436, kind: "main", expectSeg: 2 },
  { key: "p5", label: "emerald · D শুরুর কাছে, ফ্রেম 468", why: "নিচ থেকে উঠছে + ফেড-ইন (স্বচ্ছ, একটু নিচে)", theme: "emerald", landscape: false, frame: 468, kind: "main", expectSeg: 3 },
  { key: "p6", label: "emerald · D শেষের কাছে, ফ্রেম 493", why: "মিলিয়ে যাচ্ছে (ফেড-আউট)", theme: "emerald", landscape: false, frame: 493, kind: "main", expectSeg: 3 },
  { key: "p7", label: "navy · B-র শুরু (A-র গায়ে-গায়ে), ফ্রেম 182", why: "ফেড নেই — পুরো উজ্জ্বল, শুধু উঠে আসছে", theme: "navy", landscape: false, frame: 182, kind: "main", expectSeg: 1 },
  { key: "p8", label: "emerald · ফাঁক (B ও C-র মাঝে), ফ্রেম 315", why: "ক্যাপশন নেই", theme: "emerald", landscape: false, frame: 315, kind: "main", expectSeg: null },
  { key: "l1", label: "emerald Landscape · B, ফ্রেম 240", why: "ডানের বাক্সে লম্বা লেখা", theme: "emerald", landscape: true, frame: 240, kind: "main", expectSeg: 1 },
  { key: "l2", label: "greenDayNight Landscape · C, ফ্রেম 436", why: "রাতের দিকে, অতি লম্বা", theme: "greenDayNight", landscape: true, frame: 436, kind: "main", expectSeg: 2 },
  { key: "e1", label: "emerald · Intro, ফ্রেম 45", why: "Main-এর বাইরে — কিছু নয়", theme: "emerald", landscape: false, frame: 45, kind: "edge", expectSeg: null },
  { key: "e2", label: "emerald · Outro, ফ্রেম 560", why: "Main-এর বাইরে — কিছু নয়", theme: "emerald", landscape: false, frame: 560, kind: "edge", expectSeg: null },
];

// ---------- মাপ (সব স্থির সংখ্যা; উচ্চতা এখান থেকেই) ----------
const PAD = 36;
const GAP = 12;
const HEAD_H = 84;
const SEC_H = 46;
const ROW_H = 62;
const ROW_PITCH = 70;
const N_AUTO = 9;
const CONTENT_W = 1080 - PAD * 2; // 1008
const CW = 498; // ঘরের প্রস্থ (দুটো + ফাঁক = 1008)

const LP = computeLayout(1080, 1920);
const LL = computeLayout(1920, 1080);
const MARGIN_P = 70;
const MARGIN_L = 40;
/** Portrait ঘর: ক্যাপশন বাক্স + উপর-নিচে মার্জিন */
const P_CROP = { x: 0, y: LP.captionBox.y - MARGIN_P, w: 1080, h: LP.captionBox.height + 2 * MARGIN_P };
const P_SCALE = CW / P_CROP.w;
const PH = Math.round(P_CROP.h * P_SCALE);
/** Landscape ঘর: ক্যাপশন বাক্স + চারদিকে মার্জিন */
const L_CROP = { x: LL.captionBox.x - MARGIN_L, y: LL.captionBox.y - MARGIN_L, w: LL.captionBox.width + 2 * MARGIN_L, h: LL.captionBox.height + 2 * MARGIN_L };
const L_SCALE = CW / L_CROP.w;
const LH = Math.round(L_CROP.h * L_SCALE);

const CELLS_H = 4 * (PH + GAP) + (LH + GAP) + PH;

export const CAPTION_PREVIEW_HEIGHT =
  PAD * 2 + HEAD_H + (SEC_H + N_AUTO * ROW_PITCH) + (SEC_H + CELLS_H) + (SEC_H + CAPTION_CASE_COUNT * ROW_PITCH) + 30;

type Placed = { def: CellDef; index: number; x: number; y: number; w: number; h: number; fullW: number; fullH: number; crop: typeof P_CROP; scale: number };

function placeCells(): Placed[] {
  const out: Placed[] = [];
  const at = (def: CellDef, index: number, x: number, y: number) => {
    const land = def.landscape;
    out.push({
      def,
      index,
      x,
      y,
      w: CW,
      h: land ? LH : PH,
      fullW: land ? 1920 : 1080,
      fullH: land ? 1080 : 1920,
      crop: land ? L_CROP : P_CROP,
      scale: land ? L_SCALE : P_SCALE,
    });
  };
  const col = (c: number) => c * (CW + GAP);
  // ৪ সারি Portrait (p1..p8), ১ সারি Landscape (l1 l2), ১ সারি edge (e1 e2)
  for (let i = 0; i < 8; i += 1) at(CELLS[i], i, col(i % 2), Math.floor(i / 2) * (PH + GAP));
  const yL = 4 * (PH + GAP);
  at(CELLS[8], 8, col(0), yL);
  at(CELLS[9], 9, col(1), yL);
  const yE = yL + LH + GAP;
  at(CELLS[10], 10, col(0), yE);
  at(CELLS[11], 11, col(1), yE);
  return out;
}
const PLACED = placeCells();

// ---------- DOM থেকে পড়া ----------
type Info = {
  drawn: boolean;
  seg: number;
  activeWord: number;
  fs: number;
  lines: number;
  clipped: number;
  opacityAttr: number;
  slideAttr: number;
  opacityCss: number;
  /** বাক্সের layout-অবস্থান ও মাপ (unscaled px) */
  box: { x: number; y: number; w: number; h: number };
  overflowY: boolean;
  overflowX: boolean;
  wordsInside: boolean;
  states: string[];
  scales: number[];
  opacities: number[];
  underlines: boolean[];
  colors: string[];
  panelBg: string;
  hasPanelTransform: boolean;
};

const EMPTY_INFO: Info = {
  drawn: false,
  seg: -1,
  activeWord: -1,
  fs: 0,
  lines: 0,
  clipped: 0,
  opacityAttr: 0,
  slideAttr: 0,
  opacityCss: 0,
  box: { x: 0, y: 0, w: 0, h: 0 },
  overflowY: false,
  overflowX: false,
  wordsInside: true,
  states: [],
  scales: [],
  opacities: [],
  underlines: [],
  colors: [],
  panelBg: "",
  hasPanelTransform: false,
};

const scaleOfTransform = (t: string): number => {
  if (!t || t === "none") return 1;
  const m = t.match(/matrix\(([^)]+)\)/);
  if (!m) return 1;
  const a = parseFloat(m[1].split(",")[0]);
  return Number.isFinite(a) ? a : 1;
};

function readCell(root: HTMLElement, scale: number): Info {
  const cap = root.querySelector<HTMLElement>("[data-caption]");
  if (!cap) return EMPTY_INFO;
  const txt = cap.querySelector<HTMLElement>("[data-caption-text]");
  const inner = txt?.firstElementChild as HTMLElement | null;
  const words = Array.from(cap.querySelectorAll<HTMLElement>("[data-word]"));
  const panel = cap.getBoundingClientRect();
  const clipped = Number(cap.dataset.clipped) === 1;
  const fs = Number(cap.dataset.fontSize);
  const tol = 0.08 * fs * scale + 2; // active শব্দের ১.১৫ pop-এর জন্য সামান্য ছাড়
  const wordsInside = words.every((w) => {
    const r = w.getBoundingClientRect();
    return r.left >= panel.left - tol && r.right <= panel.right + tol && r.top >= panel.top - tol && r.bottom <= panel.bottom + tol;
  });
  const cs = getComputedStyle(cap);
  return {
    drawn: true,
    seg: Number(cap.dataset.segment),
    activeWord: Number(cap.dataset.activeWord),
    fs,
    lines: Number(cap.dataset.lines),
    clipped: Number(cap.dataset.clipped),
    opacityAttr: Number(cap.dataset.opacity),
    slideAttr: Number(cap.dataset.slide),
    opacityCss: parseFloat(cs.opacity),
    box: { x: cap.offsetLeft, y: cap.offsetTop, w: cap.offsetWidth, h: cap.offsetHeight },
    // layout-মাপ (transform/pop ধরে না): ছাঁটা না হলে লেখার উচ্চতা জায়গার ভেতরে; কোনো শব্দ জায়গার ডান-বাঁ ছাড়ায় না
    overflowY: inner && txt ? !clipped && inner.offsetHeight > txt.clientHeight + 2 : false,
    overflowX: txt ? words.some((w) => w.offsetLeft < -2 || w.offsetLeft + w.offsetWidth > txt.clientWidth + 2) : false,
    wordsInside: clipped ? true : wordsInside,
    states: words.map((w) => w.dataset.state ?? ""),
    scales: words.map((w) => scaleOfTransform(getComputedStyle(w).transform)),
    opacities: words.map((w) => parseFloat(getComputedStyle(w).opacity)),
    underlines: words.map((w) => w.querySelector("[data-underline]") !== null),
    colors: words.map((w) => getComputedStyle(w).color),
    panelBg: cs.backgroundColor,
    hasPanelTransform: cs.transform !== "none",
  };
}

/** প্রতিটা ঘর আঁকা হওয়া পর্যন্ত অপেক্ষা (delayRender), তারপর DOM একবার পড়ে — ২০ সেকেন্ডে না হলে যা আছে তা-ই পড়ে */
function useCellInfos(refs: React.RefObject<(HTMLDivElement | null)[]>): Info[] | null {
  const [infos, setInfos] = useState<Info[] | null>(null);
  const [handle] = useState(() => delayRender("CaptionPreview: ঘরগুলো আঁকা হচ্ছে"));
  const released = useRef(false);

  useEffect(() => {
    let alive = true;
    const started = Date.now();
    let readyAt: number | null = null;

    const isReady = (p: Placed): boolean => {
      const el = refs.current[p.index];
      if (!el) return false;
      if (p.def.expectSeg === null) return true;
      return el.querySelectorAll("[data-caption] [data-word]").length > 0;
    };
    const finish = () => {
      if (!alive) return;
      setInfos(PLACED.map((p) => (refs.current[p.index] ? readCell(refs.current[p.index] as HTMLElement, p.scale) : EMPTY_INFO)));
    };
    const timer = window.setInterval(() => {
      if (!alive) return;
      const now = Date.now();
      if (now - started > 20000) {
        window.clearInterval(timer);
        finish();
        return;
      }
      if (PLACED.every(isReady)) {
        if (readyAt === null) readyAt = now;
        if (now - readyAt >= 400) {
          window.clearInterval(timer);
          finish();
        }
      } else {
        readyAt = null;
      }
    }, 60);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [refs]);

  useLayoutEffect(() => {
    if (infos !== null && !released.current) {
      released.current = true;
      continueRender(handle);
    }
  }, [infos, handle]);

  return infos;
}

// ---------- স্বয়ংক্রিয় সারি ----------
type Row = { title: string; ok: boolean; note: string };

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const cellOf = (key: string): Placed => PLACED.find((p) => p.def.key === key) as Placed;
const rgbaOf = (css: string): { r: number; g: number; b: number; a: number } | null => {
  const m = css.match(/rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[,/ ]+([\d.]+))?/);
  return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
};
const nf = (frame: number): number =>
  computeNightFactor({ frame, introFrames: TIMING.introFrames, mainFrames: TIMING.mainFrames, outroFrames: TIMING.outroFrames });

function buildRows(infos: Info[]): Row[] {
  const get = (key: string): Info => infos[cellOf(key).index] ?? EMPTY_INFO;
  const drawnCells = PLACED.filter((p) => p.def.expectSeg !== null);
  const rows: Row[] = [];

  // 1. সঠিক সেগমেন্ট প্রতি মুহূর্তে
  {
    const bad = drawnCells.filter((p) => get(p.def.key).seg !== p.def.expectSeg || !get(p.def.key).drawn);
    rows.push({
      title: "ঠিক সেগমেন্টের ক্যাপশন প্রতি মুহূর্তে (A, B, C, D)",
      ok: bad.length === 0,
      note: bad.length === 0 ? `${drawnCells.length}/${drawnCells.length} ঘর — ` + drawnCells.map((p) => `${p.def.key}→${get(p.def.key).seg}`).join(" ") : `ভুল: ${bad.map((p) => `${p.def.key} চাই ${p.def.expectSeg}, পেয়েছে ${get(p.def.key).seg}`).join(" · ")}`,
    });
  }

  // 2. ফাঁক / Intro / Outro-তে কিছু আঁকা হয় না
  {
    const none = PLACED.filter((p) => p.def.expectSeg === null);
    const bad = none.filter((p) => get(p.def.key).drawn);
    rows.push({
      title: "ফাঁকে, Intro-তে ও Outro-তে ক্যাপশন আঁকা হয় না",
      ok: bad.length === 0 && none.length === 3,
      note: bad.length === 0 ? `${none.map((p) => p.def.key).join(" ")} — কিছুই আঁকা হয়নি` : `আঁকা হয়েছে: ${bad.map((p) => p.def.key).join(" ")}`,
    });
  }

  // 3. বাক্স = captionBox (layout-অবস্থান, transform-এর প্রভাব ছাড়া)
  {
    const res = drawnCells.map((p) => {
      const L = p.def.landscape ? LL : LP;
      const b = get(p.def.key).box;
      const cb = L.captionBox;
      const ok = near(b.x, cb.x, 1.5) && near(b.y, cb.y, 1.5) && near(b.w, cb.width, 1.5) && near(b.h, cb.height, 1.5);
      return { key: p.def.key, ok, b, cb };
    });
    const bad = res.filter((r) => !r.ok);
    rows.push({
      title: "ক্যাপশন-বাক্স ঠিক layout-এর captionBox-এ",
      ok: bad.length === 0,
      note: bad.length === 0 ? `Portrait ${LP.captionBox.width.toFixed(0)}×${LP.captionBox.height.toFixed(0)} · Landscape ${LL.captionBox.width.toFixed(0)}×${LL.captionBox.height.toFixed(0)} — ${res.length}/${res.length} ঘর ✓` : `ভুল: ${bad.map((r) => `${r.key} (${r.b.x.toFixed(0)},${r.b.y.toFixed(0)} ${r.b.w.toFixed(0)}×${r.b.h.toFixed(0)})`).join(" · ")}`,
    });
  }

  // 4. লেখা বাক্সের বাইরে যায় না (সবচেয়ে গুরুত্বপূর্ণ)
  {
    const bad = drawnCells.filter((p) => {
      const i = get(p.def.key);
      return i.overflowY || i.overflowX || !i.wordsInside;
    });
    rows.push({
      title: "লম্বা লেখাও বাক্সের বাইরে যায় না (সব ঘরে)",
      ok: bad.length === 0,
      note: bad.length === 0 ? `${drawnCells.length}/${drawnCells.length} ঘর — শব্দ বাক্সের ভেতরে, উপচে পড়া নেই; ছাঁটা: ${drawnCells.filter((p) => get(p.def.key).clipped === 1).map((p) => p.def.key).join(" ") || "কেউ নয়"}` : `উপচেছে: ${bad.map((p) => { const i = get(p.def.key); return `${p.def.key}(Y${i.overflowY ? "✗" : "✓"} X${i.overflowX ? "✗" : "✓"} শব্দ${i.wordsInside ? "✓" : "✗"})`; }).join(" ")}`,
    });
  }

  // 5. ফন্ট আঁটানো
  {
    const fa = get("p1").fs;
    const fb = get("p2").fs;
    const fc = get("p4").fs;
    const lines = get("p2").lines;
    const lp = LP.fontSizes;
    const inRange = drawnCells.every((p) => {
      const f = get(p.def.key).fs;
      const fsz = (p.def.landscape ? LL : LP).fontSizes;
      return f >= fsz.captionMin - 0.01 && f <= fsz.captionMax + 0.01;
    });
    const ok = near(fa, lp.captionMax, 0.01) && fb < fa && fc <= fb && lines >= 2 && inRange;
    rows.push({
      title: "ফন্ট আঁটে: ছোট লেখা = বেস, লম্বা = ছোট, অতি লম্বা = আরও ছোট (সীমার মধ্যে)",
      ok,
      note: `A ${fa.toFixed(1)}px (বেস ${lp.captionMax}) · B ${fb.toFixed(1)}px, ${lines} লাইন · C ${fc.toFixed(1)}px (ন্যূনতম ${lp.captionMin}) · সব ঘর সীমার ${inRange ? "মধ্যে" : "বাইরে ✗"}`,
    });
  }

  // 6. শব্দের হাইলাইট (p1: ৬ শব্দের মধ্যে ৪র্থটা active, ফ্রেম 145 = শব্দের ১০ ফ্রেম ভেতরে)
  {
    const i = get("p1");
    const want = ["read", "read", "read", "active", "upcoming", "upcoming"];
    const statesOk = want.length === i.states.length && want.every((w, k) => i.states[k] === w);
    const act = i.scales[3] ?? 1;
    const popOk = near(act, 1.15, 0.05);
    const readPlain = [0, 1, 2].every((k) => near(i.scales[k] ?? 0, 1, 0.001) && near(i.opacities[k] ?? 0, 1, 0.01));
    const upDim = [4, 5].every((k) => near(i.opacities[k] ?? 0, 0.45, 0.03));
    const colorDiff = i.colors[3] !== undefined && i.colors[3] !== i.colors[0];
    const bar = i.underlines[3] === true && !i.underlines[0] && !i.underlines[2] && !i.underlines[4];
    const ok = statesOk && popOk && readPlain && upDim && colorDiff && bar && i.activeWord === 3;
    rows.push({
      title: "শব্দ-হাইলাইট: read সাদা · active রঙিন + ১.১৫ pop + আন্ডারলাইন · upcoming ঝাপসা",
      ok,
      note: `অবস্থা ${i.states.join("/") || "—"} (চাই ${want.join("/")}) · active scale ${act.toFixed(3)} · upcoming opacity ${(i.opacities[4] ?? 0).toFixed(2)} · আন্ডারলাইন ${bar ? "শুধু active-এ ✓" : "✗"} · রঙ ${colorDiff ? "আলাদা ✓" : "একই ✗"}`,
    });
  }

  // 7. বাক্সের উঠে আসা ও ফেড (p1 স্থির; p5 enter; p6 exit; p7 গায়ে-গায়ে)
  {
    const p1 = get("p1");
    const p5 = get("p5");
    const p6 = get("p6");
    const p7 = get("p7");
    const cssMatch = [p1, p5, p6, p7].every((i) => near(i.opacityCss, i.opacityAttr, 0.01));
    const steady = near(p1.opacityAttr, 1, 1e-6) && p1.slideAttr === 0 && !p1.hasPanelTransform;
    const enter = p5.opacityAttr > 0 && p5.opacityAttr < 1 && p5.slideAttr > 0 && p5.hasPanelTransform;
    const exit = p6.opacityAttr > 0 && p6.opacityAttr < 1 && p6.slideAttr === 0;
    const contiguous = near(p7.opacityAttr, 1, 1e-6) && p7.slideAttr > 0;
    rows.push({
      title: "বাক্স: স্থির · উঠে আসা + ফেড-ইন · ফেড-আউট · গায়ে-গায়ে হলে শুধু উঠে আসা",
      ok: cssMatch && steady && enter && exit && contiguous,
      note: `স্থির ${p1.opacityAttr.toFixed(2)}/${p1.slideAttr.toFixed(1)}u · enter ${p5.opacityAttr.toFixed(2)}/${p5.slideAttr.toFixed(1)}u · exit ${p6.opacityAttr.toFixed(2)} · গায়ে-গায়ে ${p7.opacityAttr.toFixed(2)}/${p7.slideAttr.toFixed(1)}u · CSS = data ${cssMatch ? "✓" : "✗"}`,
    });
  }

  // 8. থিমের রঙ ও nightFactor: প্যানেলের রঙ = getThemeColors(...).panelBg
  {
    const checks = (["p1", "p3", "p4", "p2"] as const).map((k) => {
      const p = cellOf(k);
      const want = parseColor(getThemeColors(p.def.theme, nf(p.def.frame)).panelBg);
      const got = rgbaOf(get(k).panelBg);
      const ok = !!got && near(got.r, want.r, 2) && near(got.g, want.g, 2) && near(got.b, want.b, 2) && near(got.a, want.a, 0.02);
      return { k, ok, got, want };
    });
    const day = rgbaOf(get("p3").panelBg);
    const night = rgbaOf(get("p4").panelBg);
    const differs = !!day && !!night && (day.r !== night.r || day.g !== night.g || day.b !== night.b || Math.abs(day.a - night.a) > 0.001);
    const bad = checks.filter((c) => !c.ok);
    rows.push({
      title: "প্যানেলের রঙ থিম ও nightFactor অনুযায়ী (greenDayNight-এ দিন ≠ রাত)",
      ok: bad.length === 0 && differs,
      note: bad.length === 0 ? `p1 p3 p4 p2 = getThemeColors(...).panelBg ✓ · p3 দিন nf ${nf(100).toFixed(2)} ≠ p4 nf ${nf(436).toFixed(2)} ${differs ? "✓" : "✗ একই"}` : `ভুল: ${bad.map((c) => c.k).join(" ")}`,
    });
  }

  // 9. Landscape: বাক্স SVG-র ডানে, কম্পোজিশনের ভেতরে
  {
    const res = (["l1", "l2"] as const).map((k) => {
      const b = get(k).box;
      const inside = b.x >= LL.svgBox.x + LL.svgBox.size - 1 && b.x + b.w <= LL.width + 0.5 && b.y >= 0 && b.y + b.h <= LL.height + 0.5;
      return { k, inside, b };
    });
    const bad = res.filter((r) => !r.inside);
    const pad = CAPTION_PAD_UNITS * LL.unit;
    rows.push({
      title: "Landscape: ক্যাপশন SVG-র ডানে, কম্পোজিশনের ভেতরে; ভেতরের জায়গা পজিটিভ",
      ok: bad.length === 0 && LL.captionBox.width - 2 * pad > 0 && LP.captionBox.height - 2 * (CAPTION_PAD_UNITS * LP.unit) > 0,
      note: bad.length === 0 ? `ডান-কিনারা ${(res[0].b.x + res[0].b.w).toFixed(0)} ≤ ${LL.width} · SVG-র ডান ${(LL.svgBox.x + LL.svgBox.size).toFixed(0)} ≤ বাক্স-বাঁ ${res[0].b.x.toFixed(0)} · ভেতরের জায়গা ${(LL.captionBox.width - 2 * pad).toFixed(0)}×${(LL.captionBox.height - 2 * pad).toFixed(0)}` : `ভুল: ${bad.map((r) => r.k).join(" ")}`,
    });
  }

  return rows;
}

// ---------- আঁকা ----------
const Guides: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const L = computeLayout(width, height);
  const line = Math.max(3, L.unit * 4);
  const box = (key: string, x: number, y: number, w: number, h: number, color: string) => (
    <div key={key} style={{ position: "absolute", left: x, top: y, width: w, height: h, border: `${line}px dashed ${color}`, borderRadius: 16 * L.unit, opacity: 0.4, pointerEvents: "none", boxSizing: "border-box" }} />
  );
  return (
    <>
      {box("h", L.headerBox.x, L.headerBox.y, L.headerBox.width, L.headerBox.height, "#ffe27a")}
      {box("s", L.svgBox.x, L.svgBox.y, L.svgBox.size, L.svgBox.size, "#8ee3ff")}
      {box("c", L.captionBox.x, L.captionBox.y, L.captionBox.width, L.captionBox.height, "#ffb3c7")}
    </>
  );
};

const CellView: React.FC<{ placed: Placed; info: Info | null; ok: boolean | null; setRef: (el: HTMLDivElement | null) => void }> = ({ placed, info, ok, setRef }) => {
  const { def, x, y, w, h, fullW, fullH, crop, scale } = placed;
  const night = nf(def.frame);
  const got = info === null ? "…" : info.drawn ? `সেগমেন্ট ${info.seg}` : "কিছু নয়";
  const want = def.expectSeg === null ? "কিছু নয়" : `সেগমেন্ট ${def.expectSeg}`;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, overflow: "hidden", outline: "1px solid #ffffff44" }}>
      <div
        ref={setRef}
        style={{ position: "absolute", left: -crop.x * scale, top: -crop.y * scale, width: fullW, height: fullH, transform: `scale(${scale})`, transformOrigin: "0 0" }}
      >
        <Background theme={def.theme} nightFactor={night} size={{ width: fullW, height: fullH }} />
        <Guides width={fullW} height={fullH} />
        <CaptionView segments={SEGMENTS} theme={def.theme} timing={TIMING} absFrame={def.frame} size={{ width: fullW, height: fullH }} />
      </div>
      <div style={{ position: "absolute", left: 5, top: 5, right: 5, background: "#000000c0", color: "#fff", fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.25, padding: "2px 7px", borderRadius: 6 }}>
        <div style={{ fontWeight: 700 }}>{ok === null ? "⏳" : ok ? "✅" : "❌"} {def.label}</div>
        <div style={{ opacity: 0.85 }}>{def.why} · চাই {want}, পেয়েছে {got}</div>
      </div>
    </div>
  );
};

const RowView: React.FC<{ p: Palette; ok: boolean; title: string; note: string }> = ({ p, ok, title, note }) => (
  <div style={{ height: ROW_PITCH, flexShrink: 0 }}>
    <div style={{ height: ROW_H, boxSizing: "border-box", background: p.panelBg, border: `2px solid ${ok ? p.panelBorder : "#FF6B6B"}`, borderRadius: 14, padding: "6px 16px", display: "flex", gap: 14, alignItems: "center", overflow: "hidden" }}>
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

export const CaptionPreview: React.FC = () => {
  const p = getThemeColors("emerald", 0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const infos = useCellInfos(refs);
  const cases = useMemo(() => runCaptionCases(), []);
  const rows = useMemo(() => (infos ? buildRows(infos) : []), [infos]);

  // ঘর-প্রতি ✅: নিজের সেগমেন্ট ঠিক + (আঁকা হলে) উপচে পড়া নেই
  const cellOk = (pl: Placed): boolean | null => {
    if (!infos) return null;
    const i = infos[pl.index] ?? EMPTY_INFO;
    if (pl.def.expectSeg === null) return !i.drawn;
    return i.drawn && i.seg === pl.def.expectSeg && !i.overflowX && !i.overflowY && i.wordsInside;
  };

  const rowsPassed = rows.filter((r) => r.ok).length;
  const casesPassed = cases.filter((c) => c.ok).length;
  const total = N_AUTO + CAPTION_CASE_COUNT;
  const passed = rowsPassed + casesPassed;
  const allOk = infos !== null && rows.length === N_AUTO && passed === total;

  return (
    <AbsoluteFill style={{ background: skyGradient(p), boxSizing: "border-box", padding: PAD, flexDirection: "column", fontFamily: FONT_BODY, color: p.text }}>
      <div style={{ height: HEAD_H, flexShrink: 0, display: "flex", alignItems: "baseline", gap: 20 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 46, color: p.accent }}>Caption যাচাই</div>
        <div style={{ fontWeight: 700, fontSize: 34, color: allOk ? "#7CFFB2" : "#FF8A8A" }}>
          {infos === null ? "⏳" : allOk ? "সব ✅" : "❌ আছে"} · {passed}/{total}
        </div>
      </div>

      <SectionTitle p={p} text={`Part 10 · স্বয়ংক্রিয় যাচাই (DOM পড়ে) · ${rowsPassed}/${N_AUTO}`} />
      {rows.length === 0 ? <div style={{ height: N_AUTO * ROW_PITCH, flexShrink: 0 }} /> : rows.map((r) => <RowView key={r.title} p={p} ok={r.ok} title={r.title} note={r.note} />)}

      <SectionTitle p={p} text="১২টা ঘর — আসল Background + আসল CaptionView (ক্যাপশনের অংশ কেটে; গোলাপি ড্যাশ = captionBox)" />
      <div style={{ position: "relative", height: CELLS_H, width: CONTENT_W, flexShrink: 0 }}>
        {PLACED.map((pl) => (
          <CellView
            key={pl.def.key}
            placed={pl}
            info={infos ? (infos[pl.index] ?? EMPTY_INFO) : null}
            ok={cellOk(pl)}
            setRef={(el) => {
              refs.current[pl.index] = el;
            }}
          />
        ))}
      </div>

      <SectionTitle p={p} text={`captionWords.ts-এর বিশুদ্ধ কেস · ${casesPassed}/${CAPTION_CASE_COUNT}`} />
      {cases.map((c) => (
        <RowView key={c.id} p={p} ok={c.ok} title={c.title} note={c.ok ? c.rule : c.detail} />
      ))}
    </AbsoluteFill>
  );
};
