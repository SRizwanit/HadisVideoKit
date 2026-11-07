import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, Sequence } from "remotion";
import { Background } from "../components/Background";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { computeNightFactor } from "../lib/dayNight";
import { loadTimestamp } from "../lib/loadHadis";
import { FLOAT_UNITS } from "../lib/svgStage";
import { computeTiming, type Timing } from "../lib/timing";
import { computeLayout, type Box } from "../lib/useLayout";
import { MainScene } from "../scenes/MainScene";
import { getThemeColors, skyGradient, type Palette } from "../themes";
import type { ThemeId } from "../types";

/**
 * Part 13A (dev টুল): `MainScene` যাচাইয়ের ছবি।
 *  - নিচে ১৩টা ঘর — আসল `Background` + আসল `MainScene` (Header + SvgStage + Caption), নমুনা `hadis0000`
 *    (Intro ৩ সেকেন্ড = ৯০ ফ্রেম, Main ৬ সেকেন্ড = ১৮০, Outro ৪ সেকেন্ড = ১২০; সেগমেন্ট ৯০–১৫০ · ১৫০–২১০ · ২১০–২৭০):
 *      Portrait ৭টা (emerald ৪ — তার একটা লম্বা কিতাবের নাম, একটা হেডার ঢোকার মুহূর্ত; navy; greenDayNight দিন ও রাত),
 *      Landscape ৪টা (emerald, navy, greenDayNight দিন ও রাত), আর ৪K ২টা (২১৬০×৩৮৪০, ৩৮৪০×২১৬০ — ছোট করে আঁকা আসল ঘর)।
 *    ঘরের মুহূর্ত `<Sequence from>` দিয়ে বসানো (Intro-র পর Main শুরুর মতোই `useCurrentFrame()` ০ থেকে), তাই `frameOffset` সত্যিই কাজে লাগে।
 *  - উপরে ১৩টা স্বয়ংক্রিয় ✅/❌ সারি — **ছবি আঁকা শেষ হওয়ার পর DOM পড়ে**: তিন স্লটে ঠিক `frameOffset`, ঠিক সেগমেন্ট
 *    (SvgStage ও Caption), Header-এর প্যানেল-রঙ ঐ ফ্রেমের দিন-রাতের সাথে মেলা, স্তরের ক্রম ও স্বচ্ছতা, বক্স-মিল (SvgStage = `svgBox`, Caption = `captionBox`, Header = `headerBox`),
 *    তিনটার একটা অন্যটার উপর চাপে না, সব কম্পোজিশনের ভেতরে, ৪ সাইজ ও 4K = ঠিক ২× HD।
 *  - মাথায় "সব ✅ · n/total"।
 * নমুনা `hadis0000` (JSON) না থাকলে `calculateMetadata` `[HADIS_DATA]` এরর দেয় → `check.mjs` কম্পোজিশনটা ⚠️ বাদ দেয়, রান সবুজ থাকে।
 * `npm run check` এটাকে নিজে ধরে `out/check-MainSceneCheck.png` বানায় (ফ্রেম ৪৫-এ; ঘরের মুহূর্ত Sequence দিয়ে সরানো)।
 */

// ---------- নমুনা ডেটা ও টাইমিং ----------

const HADIS_ID = "0000";
const TIMING: Timing = computeTiming({ introSeconds: 3, outroSeconds: 4, audioSeconds: 6 });
const CHECK_FRAME = 45; // check.mjs এই ফ্রেমে ছবি তোলে

/** Root.tsx-এর `calculateMetadata` এটা ডাকে: নমুনা-JSON না থাকলে `[HADIS_DATA]` এরর → check.mjs কম্পোজিশনটা বাদ দেয় (⚠️) */
export async function ensureMainSceneCheckData(): Promise<void> {
  await loadTimestamp(HADIS_ID);
}

const LONG_BOOK = "রিয়াদুস সালেহীন — ইমাম নববী (রহ.)-এর সংকলিত হাদিস গ্রন্থ";

// ---------- ঘরের তালিকা ----------

type CellDef = {
  key: string;
  label: string;
  theme: ThemeId;
  /** ভিডিওর পরম ফ্রেম (Intro-সহ) */
  abs: number;
  fullW: number;
  fullH: number;
  bookname: string;
  number: string;
  /** প্রত্যাশিত সেগমেন্ট (০ থেকে) */
  expectSegment: number;
  /** `false` → হেডার তখনো ঢুকছে (স্প্রিং চলছে), তাই বক্স-মাপের সারিতে ধরা হয় না */
  settled: boolean;
  /** পাতায় ঘরের জায়গা ও আঁকার প্রস্থ */
  x: number;
  y: number;
  w: number;
};

const P = { fullW: 1080, fullH: 1920 };
const L = { fullW: 1920, fullH: 1080 };
const BOOK = "সহীহ বুখারী";

const DEFS: CellDef[] = [
  { key: "p1", label: "emerald · ফ্রেম 130 · সেগমেন্ট ১", theme: "emerald", abs: 130, ...P, bookname: BOOK, number: "১", expectSegment: 0, settled: true, x: 0, y: 0, w: 196 },
  { key: "p2", label: "emerald · ফ্রেম 190 · সেগমেন্ট ২", theme: "emerald", abs: 190, ...P, bookname: BOOK, number: "১২৩", expectSegment: 1, settled: true, x: 206, y: 0, w: 196 },
  { key: "p3", label: "navy · ফ্রেম 240 · সেগমেন্ট ৩", theme: "navy", abs: 240, ...P, bookname: BOOK, number: "১২৩৪", expectSegment: 2, settled: true, x: 412, y: 0, w: 196 },
  { key: "p4", label: "greenDayNight · ফ্রেম 135 (দিন)", theme: "greenDayNight", abs: 135, ...P, bookname: BOOK, number: "১", expectSegment: 0, settled: true, x: 618, y: 0, w: 196 },
  { key: "p5", label: "greenDayNight · ফ্রেম 262 (রাত)", theme: "greenDayNight", abs: 262, ...P, bookname: BOOK, number: "১", expectSegment: 2, settled: true, x: 824, y: 0, w: 196 },
  { key: "p6", label: "emerald · লম্বা কিতাবের নাম", theme: "emerald", abs: 140, ...P, bookname: LONG_BOOK, number: "১২৩৪৫৬", expectSegment: 0, settled: true, x: 0, y: 374, w: 196 },
  { key: "p7", label: "emerald · ফ্রেম 100 (হেডার ঢুকছে)", theme: "emerald", abs: 100, ...P, bookname: BOOK, number: "১", expectSegment: 0, settled: false, x: 206, y: 374, w: 196 },
  { key: "l1", label: "emerald · Landscape · ফ্রেম 135", theme: "emerald", abs: 135, ...L, bookname: BOOK, number: "১", expectSegment: 0, settled: true, x: 412, y: 374, w: 300 },
  { key: "l2", label: "navy · Landscape · ফ্রেম 190", theme: "navy", abs: 190, ...L, bookname: "সহীহ মুসলিম", number: "৪৫৬৭", expectSegment: 1, settled: true, x: 722, y: 374, w: 298 },
  { key: "l3", label: "greenDayNight · Landscape · দিন", theme: "greenDayNight", abs: 140, ...L, bookname: BOOK, number: "১", expectSegment: 0, settled: true, x: 412, y: 559, w: 300 },
  { key: "l4", label: "greenDayNight · Landscape · রাত", theme: "greenDayNight", abs: 262, ...L, bookname: BOOK, number: "১", expectSegment: 2, settled: true, x: 722, y: 559, w: 298 },
  { key: "k1", label: "4K Portrait 2160×3840 · ফ্রেম 190", theme: "emerald", abs: 190, fullW: 2160, fullH: 3840, bookname: BOOK, number: "১২৩", expectSegment: 1, settled: true, x: 0, y: 748, w: 160 },
  { key: "k2", label: "4K Landscape 3840×2160 · ফ্রেম 190", theme: "emerald", abs: 190, fullW: 3840, fullH: 2160, bookname: BOOK, number: "১২৩", expectSegment: 1, settled: true, x: 170, y: 748, w: 505 },
];

const hOf = (d: CellDef): number => (d.fullH * d.w) / d.fullW;
/** প্রতিটা ঘরের নিচে লেবেলের পটি (ঘরের ভেতরে লেবেল বসালে Header ঢাকা পড়ত) */
const LABEL_H = 16;

// ---------- পাতার মাপ ----------

const PAD = 30;
const CONTENT_W = 1080 - PAD * 2;
const HEAD_H = 84;
const TITLE_H = 46;
const ROW_H = 62;
const ROW_PITCH = 72;
const N_AUTO = 13;
const CELLS_H = 748 + 284 + LABEL_H;

export const MAIN_SCENE_CHECK_HEIGHT = PAD * 2 + HEAD_H + TITLE_H * 2 + N_AUTO * ROW_PITCH + CELLS_H + 20;

// ---------- DOM পড়া ----------

type Rect = { x: number; y: number; w: number; h: number };

type CellInfo = {
  scenes: number;
  slots: string[];
  slotOffsets: number[];
  transparent: boolean;
  stage: { segment: number; rect: Rect } | null;
  header: Rect | null;
  /** হেডার প্যানেলের আসল (computed) ব্যাকগ্রাউন্ড রঙ */
  headerBg: string | null;
  caption: { segment: number; words: number; rect: Rect } | null;
};

const EMPTY_INFO: CellInfo = { scenes: 0, slots: [], slotOffsets: [], transparent: false, stage: null, header: null, headerBg: null, caption: null };

function isTransparent(el: Element): boolean {
  const c = getComputedStyle(el);
  return c.backgroundColor === "rgba(0, 0, 0, 0)" || c.backgroundColor === "transparent";
}

function readCell(root: HTMLElement, scale: number): CellInfo {
  const base = root.getBoundingClientRect();
  const rectOf = (el: Element): Rect => {
    const r = el.getBoundingClientRect();
    return { x: (r.left - base.left) / scale, y: (r.top - base.top) / scale, w: r.width / scale, h: r.height / scale };
  };
  const scenes = root.querySelectorAll("[data-main-scene]");
  const slotEls = Array.from(root.querySelectorAll("[data-main-slot]"));
  const stageEl = root.querySelector("[data-svg-stage]");
  const headerSlot = root.querySelector('[data-main-slot="header"]');
  const headerEl = headerSlot?.firstElementChild ?? null;
  const captionEl = root.querySelector("[data-caption]");
  return {
    scenes: scenes.length,
    slots: slotEls.map((e) => e.getAttribute("data-main-slot") ?? ""),
    slotOffsets: slotEls.map((e) => Number(e.getAttribute("data-frame-offset"))),
    transparent: [...Array.from(scenes), ...slotEls].every(isTransparent),
    stage: stageEl ? { segment: Number(stageEl.getAttribute("data-segment")), rect: rectOf(stageEl) } : null,
    header: headerEl ? rectOf(headerEl) : null,
    headerBg: headerEl ? getComputedStyle(headerEl).backgroundColor : null,
    caption: captionEl
      ? {
          segment: Number(captionEl.getAttribute("data-segment")),
          words: Number(captionEl.getAttribute("data-words")),
          rect: rectOf(captionEl),
        }
      : null,
  };
}

/**
 * ঘরগুলো আঁকা শেষ হওয়া পর্যন্ত অপেক্ষা (প্রতি ৬০ms দেখে), তারপর DOM পড়ে।
 *  - প্রতিটা ঘরে `[data-svg-stage]` + ভেতরে `<svg>`, `[data-caption]` ও হেডারের প্যানেল আসা চাই; তারপর আরও ৪০০ms অপেক্ষা।
 *  - নিজের `delayRender` ধরে, পড়া commit হওয়ার পরে ছাড়ে; ২০ সেকেন্ডে না হলে যা আছে তা-ই পড়ে (তখন সারিগুলো ❌ দেখাবে) — আটকে থাকে না।
 */
function useCellInfos(refs: React.RefObject<(HTMLDivElement | null)[]>): CellInfo[] | null {
  const [infos, setInfos] = useState<CellInfo[] | null>(null);
  const [handle] = useState(() => delayRender("MainSceneCheck: ঘরগুলো আঁকা হচ্ছে"));
  const released = useRef(false);

  useEffect(() => {
    let alive = true;
    const started = Date.now();
    let readyAt: number | null = null;

    const isReady = (i: number): boolean => {
      const el = refs.current[i];
      if (!el) return false;
      return (
        el.querySelector("[data-svg-stage] svg") !== null &&
        el.querySelector("[data-caption]") !== null &&
        el.querySelector('[data-main-slot="header"]')?.firstElementChild != null
      );
    };

    const finish = () => {
      if (!alive) return;
      setInfos(
        DEFS.map((d, i) => {
          const el = refs.current[i];
          return el ? readCell(el, d.w / d.fullW) : EMPTY_INFO;
        }),
      );
    };

    const timer = window.setInterval(() => {
      if (!alive) return;
      const now = Date.now();
      if (now - started > 20000) {
        window.clearInterval(timer);
        finish();
        return;
      }
      if (DEFS.every((_, i) => isReady(i))) {
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

// ---------- হিসাব ----------

/** যেকোনো CSS রঙকে ব্রাউজারের computed রূপে আনে (তুলনার জন্য) */
function normColor(c: string): string {
  const d = document.createElement("div");
  d.style.background = c;
  document.body.appendChild(d);
  const v = getComputedStyle(d).backgroundColor;
  d.remove();
  return v;
}

/** `frame` পরম ফ্রেমে `theme`-এর প্যানেল রঙ (Header যা আঁকার কথা) */
function expectedPanelBg(theme: ThemeId, absFrame: number): string {
  const night = computeNightFactor({
    frame: absFrame,
    introFrames: TIMING.introFrames,
    mainFrames: TIMING.mainFrames,
    outroFrames: TIMING.outroFrames,
  });
  return normColor(getThemeColors(theme, night).panelBg);
}

const inside = (r: Rect, box: Box, tol: number): boolean =>
  r.x >= box.x - tol && r.y >= box.y - tol && r.x + r.w <= box.x + box.width + tol && r.y + r.h <= box.y + box.height + tol;

const overlapArea = (a: Rect, b: Rect): number => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

const boxRect = (b: Box): Rect => ({ x: b.x, y: b.y, w: b.width, h: b.height });

const SIZES: ReadonlyArray<readonly [number, number]> = [
  [1080, 1920],
  [1920, 1080],
  [2160, 3840],
  [3840, 2160],
];

type Row = { title: string; ok: boolean; note: string };

function buildRows(infos: CellInfo[]): Row[] {
  const rows: Row[] = [];
  const each = (pred: (d: CellDef, i: CellInfo, lay: ReturnType<typeof computeLayout>) => boolean, only?: (d: CellDef) => boolean) => {
    const bad: string[] = [];
    DEFS.forEach((d, idx) => {
      if (only && !only(d)) return;
      const lay = computeLayout(d.fullW, d.fullH);
      if (!pred(d, infos[idx] ?? EMPTY_INFO, lay)) bad.push(d.key);
    });
    return bad;
  };
  const push = (title: string, bad: string[], okNote: string) =>
    rows.push({ title, ok: bad.length === 0, note: bad.length === 0 ? okNote : `ভুল ঘর: ${bad.join(", ")}` });

  push(
    "১ · প্রতি ঘরে ঠিক ১টা MainScene আর ৩টা স্লট (stage · header · caption)",
    each((_, i) => i.scenes === 1 && i.slots.length === 3),
    `${DEFS.length}টা ঘরেই ১ সিন + ৩ স্লট`,
  );
  push(
    "২ · তিন স্লটেই `frameOffset = timing.introFrames` (৯০) গেছে",
    each((_, i) => i.slotOffsets.length === 3 && i.slotOffsets.every((o) => o === TIMING.introFrames)),
    "সব স্লটে ৯০",
  );
  push(
    "৩ · স্তরের ক্রম stage → header → caption; সিন ও স্লট স্বচ্ছ (ব্যাকগ্রাউন্ড আঁকে না)",
    each((_, i) => i.slots.join(",") === "stage,header,caption" && i.transparent),
    "নিচে SvgStage, তার উপরে Header, সবার উপরে Caption; কোনো স্তরে রঙ নেই",
  );
  push(
    "৪ · SvgStage ঠিক সেগমেন্ট দেখাচ্ছে (frameOffset SvgStage-এ কাজ করছে)",
    each((d, i) => i.stage !== null && i.stage.segment === d.expectSegment),
    "সব ঘরে প্রত্যাশিত সেগমেন্ট",
  );
  push(
    "৫ · Caption ঠিক সেগমেন্ট দেখাচ্ছে (frameOffset Caption-এ কাজ করছে), শব্দ আছে",
    each((d, i) => i.caption !== null && i.caption.segment === d.expectSegment && i.caption.words > 0),
    "সব ঘরে প্রত্যাশিত সেগমেন্ট, শব্দ > ০",
  );
  {
    const dayIdx = DEFS.findIndex((d) => d.key === "p4");
    const nightIdx = DEFS.findIndex((d) => d.key === "p5");
    const bad = each((d, i) => i.headerBg !== null && i.headerBg === expectedPanelBg(d.theme, d.abs));
    const differs =
      infos[dayIdx]?.headerBg != null &&
      infos[nightIdx]?.headerBg != null &&
      infos[dayIdx].headerBg !== infos[nightIdx].headerBg;
    rows.push({
      title: "৬ · Header প্যানেলের রঙ ঐ ফ্রেমের দিন-রাতের সাথে মেলে (frameOffset Header-এ কাজ করছে)",
      ok: bad.length === 0 && differs,
      note:
        bad.length === 0 && differs
          ? "সব ঘরে প্রত্যাশিত রঙ; greenDayNight-এ দিন ≠ রাত"
          : bad.length > 0
            ? `ভুল ঘর: ${bad.join(", ")}`
            : "greenDayNight-এর দিন ও রাতের রঙ একই — frameOffset কাজ করছে না",
    });
  }
  push(
    "৭ · SvgStage-এর বক্স = `svgBox` (ভাসা ±৬ ইউনিট পর্যন্ত)",
    each(
      (d, i, lay) => {
        const s = i.stage;
        if (!s) return false;
        const tol = FLOAT_UNITS * lay.unit + 2;
        return (
          Math.abs(s.rect.w - lay.svgBox.size) <= 2 &&
          Math.abs(s.rect.h - lay.svgBox.size) <= 2 &&
          Math.abs(s.rect.x - lay.svgBox.x) <= 2 &&
          Math.abs(s.rect.y - lay.svgBox.y) <= tol
        );
      },
    ),
    "সব ঘরে মাপ ও জায়গা মিলেছে",
  );
  push(
    "৮ · Caption প্যানেল `captionBox`-এর ভেতরে",
    each((_, i, lay) => i.caption !== null && inside(i.caption.rect, lay.captionBox, 2)),
    "সব ঘরে ভেতরে",
  );
  push(
    "৯ · Header প্যানেল `headerBox`-এর ভেতরে (ভাসা-সহ; ঢোকার ঘর বাদ)",
    each((_, i, lay) => i.header !== null && inside(i.header, lay.headerBox, 14 * lay.unit + 2), (d) => d.settled),
    "সব স্থির ঘরে ভেতরে",
  );
  push(
    "১০ · Header, SvgStage, Caption একটা অন্যটার উপর চাপে না (ঢোকার ঘর বাদ)",
    each(
      (_, i) => {
        if (!i.header || !i.stage || !i.caption) return false;
        return (
          overlapArea(i.header, i.stage.rect) < 1 &&
          overlapArea(i.header, i.caption.rect) < 1 &&
          overlapArea(i.stage.rect, i.caption.rect) < 1
        );
      },
      (d) => d.settled,
    ),
    "কোনো জোড়ায় ওভারল্যাপ নেই",
  );
  push(
    "১১ · তিনটাই কম্পোজিশনের ভেতরে (সব ঘর)",
    each((d, i) => {
      if (!i.header || !i.stage || !i.caption) return false;
      const whole: Box = { x: 0, y: 0, width: d.fullW, height: d.fullH };
      return [i.header, i.stage.rect, i.caption.rect].every((r) => inside(r, whole, 1));
    }),
    "সব ঘরে ভেতরে",
  );

  // ---- বিশুদ্ধ হিসাব: ৪ সাইজ ----
  const sizeBad: string[] = [];
  for (const [w, h] of SIZES) {
    const lay = computeLayout(w, h);
    const whole: Box = { x: 0, y: 0, width: w, height: h };
    const hb = boxRect(lay.headerBox);
    const sb: Rect = { x: lay.svgBox.x, y: lay.svgBox.y, w: lay.svgBox.size, h: lay.svgBox.size };
    const cb = boxRect(lay.captionBox);
    const ok =
      inside(hb, whole, 0) &&
      inside(sb, whole, 0) &&
      inside(cb, whole, 0) &&
      overlapArea(hb, sb) === 0 &&
      overlapArea(hb, cb) === 0 &&
      overlapArea(sb, cb) === 0;
    if (!ok) sizeBad.push(`${w}×${h}`);
  }
  rows.push({
    title: "১২ · ৪ সাইজে (১০৮০×১৯২০ · ১৯২০×১০৮০ · ২১৬০×৩৮৪০ · ৩৮৪০×২১৬০) তিন বক্স আলাদা ও কম্পোজিশনের ভেতরে",
    ok: sizeBad.length === 0,
    note: sizeBad.length === 0 ? "চার সাইজেই মিলেছে" : `ভুল সাইজ: ${sizeBad.join(", ")}`,
  });

  // ---- 4K = ঠিক ২× HD (হিসাব + আসল ঘর) ----
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  const pairs: Array<[number, number, number, number]> = [
    [1080, 1920, 2160, 3840],
    [1920, 1080, 3840, 2160],
  ];
  const scaleBad: string[] = [];
  for (const [w1, h1, w2, h2] of pairs) {
    const a = computeLayout(w1, h1);
    const b = computeLayout(w2, h2);
    const ok =
      near(b.svgBox.size, 2 * a.svgBox.size) &&
      near(b.svgBox.x, 2 * a.svgBox.x) &&
      near(b.headerBox.width, 2 * a.headerBox.width) &&
      near(b.captionBox.height, 2 * a.captionBox.height) &&
      near(b.unit, 2 * a.unit);
    if (!ok) scaleBad.push(`${w2}×${h2} (হিসাব)`);
  }
  const p2 = DEFS.findIndex((d) => d.key === "p2");
  const k1 = DEFS.findIndex((d) => d.key === "k1");
  const hd = infos[p2]?.stage;
  const uhd = infos[k1]?.stage;
  if (!hd || !uhd || Math.abs(uhd.rect.w - 2 * hd.rect.w) > 2) scaleBad.push("4K ঘরের SvgStage ≠ ২× HD");
  rows.push({
    title: "১৩ · 4K = ঠিক ২× HD (লেআউট হিসাব + আসল 4K ঘরের SvgStage)",
    ok: scaleBad.length === 0,
    note: scaleBad.length === 0 ? "দুই অভিমুখেই ঠিক ২×" : `ভুল: ${scaleBad.join(", ")}`,
  });

  return rows;
}

// ---------- আঁকা ----------

const CellView: React.FC<{
  def: CellDef;
  setRef: (el: HTMLDivElement | null) => void;
}> = ({ def, setRef }) => {
  const scale = def.w / def.fullW;
  const h = hOf(def);
  const nightFactor = computeNightFactor({
    frame: def.abs,
    introFrames: TIMING.introFrames,
    mainFrames: TIMING.mainFrames,
    outroFrames: TIMING.outroFrames,
  });
  // Main-এর স্থানীয় ফ্রেম (Sequence-এর ভেতরে `useCurrentFrame()` এটাই হয়)
  const local = def.abs - TIMING.introFrames;
  const size = { width: def.fullW, height: def.fullH };
  return (
    <div style={{ position: "absolute", left: def.x, top: def.y, width: def.w, height: h, overflow: "hidden", outline: "1px solid #ffffff44" }}>
      <div
        ref={setRef}
        style={{ width: def.fullW, height: def.fullH, transform: `scale(${scale})`, transformOrigin: "0 0", position: "relative" }}
      >
        <Background theme={def.theme} nightFactor={nightFactor} size={size} />
        {/* Sequence দিয়ে স্থানীয় ফ্রেম = `local` (check-এর ফ্রেম ৪৫ থেকে সরিয়ে) */}
        <Sequence from={CHECK_FRAME - local} layout="none">
          <MainScene
            hadisId={HADIS_ID}
            theme={def.theme}
            bookname={def.bookname}
            number={def.number}
            timing={TIMING}
            size={size}
            idScope={`${def.key}-`}
          />
        </Sequence>
      </div>
    </div>
  );
};

const CellLabel: React.FC<{ def: CellDef; p: Palette }> = ({ def, p }) => (
  <div
    style={{
      position: "absolute",
      left: def.x,
      top: def.y + hOf(def) + 1,
      width: def.w,
      height: LABEL_H,
      overflow: "hidden",
      whiteSpace: "nowrap",
      fontFamily: FONT_BODY,
      fontSize: 12,
      lineHeight: `${LABEL_H}px`,
      color: p.text,
    }}
  >
    {def.label}
  </div>
);

const RowView: React.FC<{ p: Palette; row: Row }> = ({ p, row }) => (
  <div style={{ height: ROW_PITCH, flexShrink: 0 }}>
    <div
      style={{
        height: ROW_H,
        boxSizing: "border-box",
        background: p.panelBg,
        border: `2px solid ${row.ok ? p.panelBorder : "#FF6B6B"}`,
        borderRadius: 14,
        padding: "6px 16px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div style={{ fontSize: 32 }}>{row.ok ? "✅" : "❌"}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 21, lineHeight: 1.2, color: p.text }}>{row.title}</div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 18, lineHeight: 1.2, opacity: 0.85, color: p.text }}>{row.note}</div>
      </div>
    </div>
  </div>
);

const SectionTitle: React.FC<{ p: Palette; text: string }> = ({ p, text }) => (
  <div
    style={{
      height: TITLE_H,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      fontFamily: FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 26,
      color: p.accent,
    }}
  >
    {text}
  </div>
);

export const MainSceneCheck: React.FC = () => {
  const p = getThemeColors("emerald", 0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const infos = useCellInfos(refs);
  const rows = infos ? buildRows(infos) : [];
  const passed = rows.filter((r) => r.ok).length;
  const allOk = infos !== null && rows.length === N_AUTO && passed === N_AUTO;

  return (
    <AbsoluteFill
      style={{
        background: skyGradient(p),
        boxSizing: "border-box",
        padding: PAD,
        flexDirection: "column",
        fontFamily: FONT_BODY,
        color: p.text,
      }}
    >
      <div style={{ height: HEAD_H, flexShrink: 0, display: "flex", alignItems: "baseline", gap: 20 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 46, color: p.accent }}>MainScene যাচাই</div>
        <div style={{ fontWeight: 700, fontSize: 34, color: allOk ? "#7CFFB2" : "#FF8A8A" }}>
          {infos === null ? "⏳" : allOk ? "সব ✅" : "❌ আছে"} · {passed}/{N_AUTO}
        </div>
      </div>

      <SectionTitle p={p} text={`স্বয়ংক্রিয় যাচাই (DOM + হিসাব) · ${passed}/${N_AUTO}`} />
      {rows.length === 0 ? (
        <div style={{ height: N_AUTO * ROW_PITCH, flexShrink: 0 }} />
      ) : (
        rows.map((r) => <RowView key={r.title} p={p} row={r} />)
      )}

      <SectionTitle p={p} text="১৩টা ঘর — আসল Background + আসল MainScene (hadis0000)" />
      <div style={{ position: "relative", height: CELLS_H, width: CONTENT_W, flexShrink: 0 }}>
        {DEFS.map((d, i) => (
          <CellView
            key={d.key}
            def={d}
            setRef={(el) => {
              refs.current[i] = el;
            }}
          />
        ))}
        {DEFS.map((d) => (
          <CellLabel key={`${d.key}-label`} def={d} p={p} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
