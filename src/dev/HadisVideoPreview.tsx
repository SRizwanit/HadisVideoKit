import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, Sequence } from "remotion";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { HadisVideoView } from "../HadisVideo";
import { planSfx } from "../lib/audioPlan";
import { computeNightFactor, MAIN_END_NIGHT } from "../lib/dayNight";
import { loadHadis, loadTimestamp } from "../lib/loadHadis";
import { mainFadeIn, mainFadeLength, planScenes } from "../lib/sceneFade";
import {
  buildFrameSegments,
  computeTiming,
  findActiveSegment,
  timingFromConfig,
  type Timing,
} from "../lib/timing";
import { computeLayout } from "../lib/useLayout";
import { resolveSfx } from "../lib/useSfxSrc";
import { getThemeColors, skyGradient, type Palette } from "../themes";
import type { Orientation, ThemeId, TimestampFile } from "../types";
import { runSceneFadeCases, SCENE_FADE_CASE_COUNT } from "./sceneFadeCases";

/**
 * Part 13C (dev টুল): **পুরো ভিডিও** (`HadisVideoView` — `HadisVideo`-র ঠিক একই আঁকার কোড) যাচাইয়ের ছবি।
 * `npm run check` এটাকে নিজে ধরে `out/check-HadisVideoPreview.png` বানায় (ফ্রেম ৪৫-এ; ঘরের মুহূর্ত `<Sequence from>` দিয়ে সরানো)।
 *
 * নিচে ৩৩টা ঘর — আসল `HadisVideoView` (Background + Intro/Main/Outro + ক্রস-ফেড), নমুনা `hadis0000`
 * (Intro ৩s = ৯০ ফ্রেম · Main ৬s = ১৮০ · Outro ৪s = ১২০; Main-এর সেগমেন্ট ৯০–১৫০ · ১৫০–২১০ · ২১০–২৭০; Outro শুরু ২৭০):
 *   ১. Portrait ১৫টা: তিন থিম × {Intro · ক্রস-ফেড · হাদিস · Main-এর শেষ · Outro-র স্থির অংশ}
 *   ২. Landscape ৬টা: emerald (Intro · Main · Outro), navy Main, greenDayNight দিনের Main ও রাতের Outro
 *   ৩. বিশেষ সময় ১০টা: Intro ০ · ১s · ১০s, Outro ০ · ১s · ১০s, দুটোই ০, Main-এর ফাঁক (`hadis0000gap`), Outro-র ঢোকা, লম্বা কিতাবের নাম
 *   ৪. 4K ২টা (২১৬০×৩৮৪০, ৩৮৪০×২১৬০ — ছোট করে আঁকা আসল ঘর)
 * উপরে ১৬টা স্বয়ংক্রিয় সারি (DOM পড়ে + বিশুদ্ধ হিসাব + নমুনা-ফাইল) আর `sceneFade.ts`-এর ১৫টা বিশুদ্ধ কেস — মাথায় "সব ✅ · n/total"।
 *
 * ⚠️ ছবিতে অডিও নেই (`audio={false}`, `sfx={false}`): আসল ভয়েস/SFX-এর শব্দ ও সময় শুধু তুমি Studio-তে/প্রথম ভিডিওতে বিচার করবে।
 *    এখানে অডিও-পরিকল্পনা (`planSfx`) ও নমুনা ফাইল (`hadis0000.wav`, `sfx/whoosh.mp3`) হিসাব করে মেলানো হয়।
 * নমুনা JSON (`hadis0000`, `hadis0000gap`) না থাকলে `calculateMetadata` `[HADIS_DATA]` এরর দেয় → `check.mjs` ⚠️ বাদ দেয়, রান সবুজ থাকে।
 */

// ---------- নমুনা ডেটা ----------

const MAIN_ID = "0000";
const GAP_ID = "0000gap";
const AUDIO_SECONDS = 6;
const CHECK_FRAME = 45; // check.mjs এই ফ্রেমে ছবি তোলে
const BOOK = "সহীহ বুখারী";
const LONG_BOOK = "রিয়াদুস সালেহীন — ইমাম নববী (রহ.)-এর সংকলিত হাদিস গ্রন্থ";

/** Root.tsx-এর `calculateMetadata` এটা ডাকে: নমুনা-JSON না থাকলে `[HADIS_DATA]` এরর → check.mjs কম্পোজিশনটা বাদ দেয় (⚠️) */
export async function ensureVideoPreviewData(): Promise<void> {
  await Promise.all([loadTimestamp(MAIN_ID), loadTimestamp(GAP_ID)]);
}

const mk = (introSeconds: number, outroSeconds: number): Timing =>
  computeTiming({ introSeconds, outroSeconds, audioSeconds: AUDIO_SECONDS });
const TIMING = mk(3, 4);

// ---------- ঘরের তালিকা ----------

type CellDef = {
  key: string;
  label: string;
  theme: ThemeId;
  hadisId: string;
  introS: number;
  outroS: number;
  /** ভিডিওর পরম ফ্রেম (Intro-সহ) */
  abs: number;
  fullW: number;
  fullH: number;
  bookname: string;
  number: string;
  /** Main-এর ফাঁকের ঘর: ক্যাপশন থাকার কথা নয় */
  gap?: boolean;
};

type Placed = CellDef & { x: number; y: number; w: number; h: number; timing: Timing; orientation: Orientation };

const P = { fullW: 1080, fullH: 1920 };
const L = { fullW: 1920, fullH: 1080 };
const THEMES: ReadonlyArray<readonly [ThemeId, string]> = [
  ["emerald", "emerald"],
  ["navy", "navy"],
  ["greenDayNight", "greenDayNight"],
];

const base = (key: string, label: string, theme: ThemeId, abs: number, size: { fullW: number; fullH: number }, extra: Partial<CellDef> = {}): CellDef => ({
  key,
  label,
  theme,
  hadisId: MAIN_ID,
  introS: 3,
  outroS: 4,
  abs,
  ...size,
  bookname: BOOK,
  number: "১",
  ...extra,
});

const SEC1: CellDef[] = THEMES.flatMap(([t, name]) => [
  base(`p-${t}-intro`, `${name} · Intro · ফ্রেম 45`, t, 45, P),
  base(`p-${t}-fade`, `${name} · ক্রস-ফেড · Main ফ্রেম 6`, t, 96, P),
  base(`p-${t}-main`, `${name} · হাদিস · ফ্রেম 190`, t, 190, P, { number: "১২৩" }),
  base(`p-${t}-end`, `${name} · Main-এর শেষ · ফ্রেম 269`, t, 269, P),
  base(`p-${t}-outro`, `${name} · Outro · ফ্রেম 340`, t, 340, P),
]);

const SEC2: CellDef[] = [
  base("l-emerald-intro", "emerald · Landscape · Intro", "emerald", 45, L),
  base("l-emerald-main", "emerald · Landscape · হাদিস", "emerald", 190, L, { number: "১২৩" }),
  base("l-emerald-outro", "emerald · Landscape · Outro", "emerald", 340, L),
  base("l-navy-main", "navy · Landscape · হাদিস", "navy", 190, L, { bookname: "সহীহ মুসলিম", number: "৪৫৬৭" }),
  base("l-gdn-day", "greenDayNight · Landscape · দিন", "greenDayNight", 135, L),
  base("l-gdn-night", "greenDayNight · Landscape · Outro রাত", "greenDayNight", 340, L),
];

const SEC3: CellDef[] = [
  base("s-intro0", "Intro ০s · ফ্রেম 0 (Main দিয়ে শুরু)", "emerald", 0, P, { introS: 0 }),
  base("s-intro1", "Intro ১s · ফ্রেম 20", "emerald", 20, P, { introS: 1 }),
  base("s-intro10", "Intro ১০s · ফ্রেম 200 (স্থির)", "emerald", 200, P, { introS: 10 }),
  base("s-outro0", "Outro ০s · শেষ ফ্রেম 269", "emerald", 269, P, { outroS: 0 }),
  base("s-outro1", "Outro ১s · ফ্রেম 285", "emerald", 285, P, { outroS: 1 }),
  base("s-outro10", "Outro ১০s · ফ্রেম 400 (স্থির)", "emerald", 400, P, { outroS: 10 }),
  base("s-both0", "Intro ০ + Outro ০ · ফ্রেম 100", "emerald", 100, P, { introS: 0, outroS: 0 }),
  base("s-gap", "Main-এর ফাঁক (0000gap) · ফ্রেম 142", "emerald", 142, P, { hadisId: GAP_ID, gap: true }),
  base("s-outro-in", "Outro ঢুকছে · ফ্রেম 276", "navy", 276, P),
  base("s-longbook", "লম্বা কিতাবের নাম", "emerald", 190, P, { bookname: LONG_BOOK, number: "১২৩৪৫৬" }),
];

const SEC4: CellDef[] = [
  base("k-portrait", "4K Portrait 2160×3840 · ফ্রেম 190", "emerald", 190, { fullW: 2160, fullH: 3840 }, { number: "১২৩" }),
  base("k-landscape", "4K Landscape 3840×2160 · ফ্রেম 190", "emerald", 190, { fullW: 3840, fullH: 2160 }, { number: "১২৩" }),
];

// ---------- পাতার মাপ ----------

const PAD = 30;
const CONTENT_W = 1080 - PAD * 2; // ১০২০
const HEAD_H = 84;
const TITLE_H = 46;
const ROW_H = 58;
const ROW_PITCH = 64;
const LABEL_H = 38;
const CELL_GAP = 10;
const FADE_ROW_PITCH = 54;
const N_PURE = 16;
export const N_AUTO = N_PURE + SCENE_FADE_CASE_COUNT;

function place(defs: CellDef[], opts: { cols: number; w: number }): { cells: Placed[]; height: number } {
  const gapX = opts.cols > 1 ? (CONTENT_W - opts.cols * opts.w) / (opts.cols - 1) : 0;
  let rowTop = 0;
  let rowH = 0;
  const cells: Placed[] = defs.map((d, i) => {
    const col = i % opts.cols;
    const h = Math.round((d.fullH * opts.w) / d.fullW);
    if (col === 0 && i > 0) {
      rowTop += rowH + LABEL_H + CELL_GAP;
      rowH = 0;
    }
    rowH = Math.max(rowH, h);
    return {
      ...d,
      x: col * (opts.w + gapX),
      y: rowTop,
      w: opts.w,
      h,
      timing: mk(d.introS, d.outroS),
      orientation: (d.fullH >= d.fullW ? "portrait" : "landscape") as Orientation,
    };
  });
  return { cells, height: rowTop + rowH + LABEL_H + CELL_GAP };
}

const S1 = place(SEC1, { cols: 5, w: 196 });
const S2 = place(SEC2, { cols: 3, w: 332 });
const S3 = place(SEC3, { cols: 5, w: 196 });
// 4K: ছোট ঘর পাশাপাশি
const S4 = (() => {
  const a = place([SEC4[0]], { cols: 1, w: 160 }).cells[0];
  const b = place([SEC4[1]], { cols: 1, w: 505 }).cells[0];
  b.x = 170;
  return { cells: [a, b], height: Math.max(a.h, b.h) + LABEL_H + CELL_GAP };
})();

const ALL: Placed[] = [...S1.cells, ...S2.cells, ...S3.cells, ...S4.cells];
const SECTIONS = [S1, S2, S3, S4];

export const HADIS_VIDEO_PREVIEW_HEIGHT =
  PAD * 2 +
  HEAD_H +
  TITLE_H * 6 +
  N_PURE * ROW_PITCH +
  Math.ceil(SCENE_FADE_CASE_COUNT / 2) * FADE_ROW_PITCH +
  SECTIONS.reduce((s, sec) => s + sec.height, 0) +
  20;

const byKey = (key: string): Placed => {
  const c = ALL.find((x) => x.key === key);
  if (!c) throw new Error(`HadisVideoPreview: ঘর "${key}" নেই`);
  return c;
};

// ---------- প্রত্যাশা (বিশুদ্ধ) ----------

type SceneName = "intro" | "main" | "outro" | "";

function expectedScene(c: Placed): SceneName {
  const sc = planScenes(c.timing.introFrames, c.timing.mainFrames, c.timing.outroFrames);
  const within = (r: { from: number; frames: number } | null) => r !== null && c.abs >= r.from && c.abs < r.from + r.frames;
  if (within(sc.intro)) return "intro";
  if (within(sc.main)) return "main";
  if (within(sc.outro)) return "outro";
  return "";
}

/** Main-এর স্থানীয় ফ্রেম (Main `Sequence`-এর ভেতরের `useCurrentFrame()`) */
const localMain = (c: Placed): number => c.abs - c.timing.introFrames;

/** ক্যাপশন-প্যানেল ১০ ফ্রেমে ফেড-ইন করে — তার আগের ফ্রেমে ক্যাপশন আঁকা হয়েছে কিনা ধরা হয় না */
const CAPTION_SETTLE_FRAMES = 10;

// ---------- DOM পড়া ----------

type Rect = { x: number; y: number; w: number; h: number };

type CellInfo = {
  roots: number;
  frames: [number, number, number] | null;
  scenes: string[];
  rootRect: Rect | null;
  sceneRects: Rect[];
  fade: { state: string | null; opacity: number; scale: number } | null;
  stage: { segment: number; rect: Rect } | null;
  caption: { segment: number; words: number } | null;
  headerBg: string | null;
};

const EMPTY_INFO: CellInfo = { roots: 0, frames: null, scenes: [], rootRect: null, sceneRects: [], fade: null, stage: null, caption: null, headerBg: null };

function readCell(root: HTMLElement, scale: number): CellInfo {
  const base0 = root.getBoundingClientRect();
  const rectOf = (el: Element): Rect => {
    const r = el.getBoundingClientRect();
    return { x: (r.left - base0.left) / scale, y: (r.top - base0.top) / scale, w: r.width / scale, h: r.height / scale };
  };
  const roots = root.querySelectorAll("[data-hadis-video]");
  const rootEl = roots[0] ?? null;
  const sceneEls = Array.from(root.querySelectorAll("[data-scene]"));
  const mainEl = root.querySelector('[data-scene="main"]');
  const stageEl = root.querySelector("[data-svg-stage]");
  const captionEl = root.querySelector("[data-caption]");
  const headerEl = root.querySelector('[data-main-slot="header"]')?.firstElementChild ?? null;
  return {
    roots: roots.length,
    frames: rootEl
      ? [
          Number(rootEl.getAttribute("data-intro-frames")),
          Number(rootEl.getAttribute("data-main-frames")),
          Number(rootEl.getAttribute("data-outro-frames")),
        ]
      : null,
    scenes: sceneEls.map((e) => e.getAttribute("data-scene") ?? ""),
    rootRect: rootEl ? rectOf(rootEl) : null,
    sceneRects: sceneEls.map(rectOf),
    fade: mainEl
      ? {
          state: mainEl.getAttribute("data-main-fade"),
          opacity: Number(mainEl.getAttribute("data-main-fade-opacity")),
          scale: Number(mainEl.getAttribute("data-main-fade-scale")),
        }
      : null,
    stage: stageEl ? { segment: Number(stageEl.getAttribute("data-segment")), rect: rectOf(stageEl) } : null,
    caption: captionEl
      ? { segment: Number(captionEl.getAttribute("data-segment")), words: Number(captionEl.getAttribute("data-words")) }
      : null,
    headerBg: headerEl ? getComputedStyle(headerEl).backgroundColor : null,
  };
}

// ---------- অ্যাসিঙ্ক তথ্য (নমুনা-ফাইল) ----------

type Facts = {
  files: Record<string, TimestampFile | null>;
  voice: { seconds: number } | { error: string };
  sfxSrc: string | null;
};

async function loadFacts(): Promise<Facts> {
  const [f0, fg] = await Promise.all([
    loadTimestamp(MAIN_ID).catch(() => null),
    loadTimestamp(GAP_ID).catch(() => null),
  ]);
  let voice: Facts["voice"];
  try {
    voice = { seconds: (await loadHadis(MAIN_ID)).audioSeconds };
  } catch (e) {
    voice = { error: String((e as Error)?.message ?? e) };
  }
  let sfxSrc: string | null = null;
  try {
    sfxSrc = await resolveSfx("whoosh");
  } catch {
    sfxSrc = null;
  }
  return { files: { [MAIN_ID]: f0, [GAP_ID]: fg }, voice, sfxSrc };
}

type CheckData = { infos: CellInfo[]; facts: Facts };

/**
 * ঘরগুলো আঁকা শেষ হওয়া পর্যন্ত অপেক্ষা (প্রতি ৬০ms দেখে), তারপর DOM পড়ে ও নমুনা-ফাইল লোড করে।
 *  - ঘরের প্রত্যাশিত দৃশ্য আঁকা হয়েছে কিনা দেখা হয় (Intro/Outro: দৃশ্যের মোড়ক; Main: Header + SVG, আর ফেড-ইনের পরে ক্যাপশন); তারপর আরও ৫০০ms।
 *  - নিজের `delayRender` ধরে, পড়া commit হওয়ার পরে ছাড়ে; ৪৫ সেকেন্ডে না হলে যা আছে তা-ই পড়ে (সারিগুলো ❌ দেখাবে) — আটকে থাকে না।
 */
function useCheckData(refs: React.RefObject<(HTMLDivElement | null)[]>): CheckData | null {
  const [data, setData] = useState<CheckData | null>(null);
  const [handle] = useState(() => delayRender("HadisVideoPreview: ঘরগুলো আঁকা হচ্ছে"));
  const released = useRef(false);

  useEffect(() => {
    let alive = true;
    const started = Date.now();
    let readyAt: number | null = null;

    const isReady = (i: number): boolean => {
      const el = refs.current[i];
      const c = ALL[i];
      if (!el || !c) return false;
      const want = expectedScene(c);
      if (want === "") return el.querySelector("[data-hadis-video]") !== null;
      if (el.querySelector(`[data-scene="${want}"]`) === null) return false;
      if (want !== "main") return true;
      const headerOk = el.querySelector('[data-main-slot="header"]')?.firstElementChild != null;
      const stageOk = el.querySelector("[data-svg-stage] svg") !== null;
      const captionOk = c.gap || localMain(c) < CAPTION_SETTLE_FRAMES || el.querySelector("[data-caption]") !== null;
      return headerOk && stageOk && captionOk;
    };

    const finish = () => {
      if (!alive) return;
      const infos = ALL.map((c, i) => {
        const el = refs.current[i];
        return el ? readCell(el, c.w / c.fullW) : EMPTY_INFO;
      });
      loadFacts().then((facts) => {
        if (alive) setData({ infos, facts });
      });
    };

    const timer = window.setInterval(() => {
      if (!alive) return;
      const now = Date.now();
      if (now - started > 45000) {
        window.clearInterval(timer);
        finish();
        return;
      }
      if (ALL.every((_, i) => isReady(i))) {
        if (readyAt === null) readyAt = now;
        if (now - readyAt >= 500) {
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
    if (data !== null && !released.current) {
      released.current = true;
      continueRender(handle);
    }
  }, [data, handle]);

  return data;
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

/** `c.abs` ফ্রেমে `c.theme`-এর প্যানেল রঙ (Header যা আঁকার কথা) */
function expectedPanelBg(c: Placed): string {
  const night = computeNightFactor({
    frame: c.abs,
    introFrames: c.timing.introFrames,
    mainFrames: c.timing.mainFrames,
    outroFrames: c.timing.outroFrames,
  });
  return normColor(getThemeColors(c.theme, night).panelBg);
}

const near = (a: number, b: number, tol = 1e-6): boolean => Math.abs(a - b) <= tol;
const insideRect = (r: Rect, w: number, h: number, tol: number): boolean =>
  r.x >= -tol && r.y >= -tol && r.x + r.w <= w + tol && r.y + r.h <= h + tol;

type Row = { title: string; ok: boolean; note: string };

/** Intro/Outro ০/১/৩/১০/১৫ সেকেন্ডের সব জোড়া — বিশুদ্ধ যাচাইয়ের জন্য */
const SECS = [0, 1, 3, 10, 15] as const;
const OUTRO_SECS = [0, 1, 4, 10, 15] as const;

function buildRows(data: CheckData): Row[] {
  const { infos, facts } = data;
  const rows: Row[] = [];
  const infoOf = (i: number): CellInfo => infos[i] ?? EMPTY_INFO;

  const each = (pred: (c: Placed, info: CellInfo) => boolean, only?: (c: Placed) => boolean): string[] => {
    const bad: string[] = [];
    ALL.forEach((c, i) => {
      if (only && !only(c)) return;
      if (!pred(c, infoOf(i))) bad.push(c.key);
    });
    return bad;
  };
  const push = (title: string, bad: string[], okNote: string) =>
    rows.push({ title, ok: bad.length === 0, note: bad.length === 0 ? okNote : `ভুল ঘর: ${bad.join(", ")}` });
  const isMain = (c: Placed) => expectedScene(c) === "main";

  // ১ · timingFromConfig ≡ computeTiming (পুরো ভিডিও `HadisVideo` মোট ফ্রেম থেকে timing ফিরে পায়)
  {
    const bad: string[] = [];
    for (const i of SECS) {
      for (const o of OUTRO_SECS) {
        const a = mk(i, o);
        const b = timingFromConfig(a.totalFrames, { introSeconds: i, outroSeconds: o });
        if (a.introFrames !== b.introFrames || a.mainFrames !== b.mainFrames || a.outroFrames !== b.outroFrames || a.totalFrames !== b.totalFrames) {
          bad.push(`${i}/${o}`);
        }
      }
    }
    rows.push({
      title: "১ · `HadisVideo` মোট ফ্রেম থেকে ঠিক সেই timing ফিরে পায় (Intro/Outro ০·১·৩·১০·১৫s — ২৫ জোড়া)",
      ok: bad.length === 0,
      note: bad.length === 0 ? "২৫ জোড়াতেই timingFromConfig = computeTiming" : `ভুল জোড়া (intro/outro): ${bad.join(", ")}`,
    });
  }

  // ২ · ঠিক প্রত্যাশিত দৃশ্যটাই DOM-এ (বাকি দৃশ্য নেই; ০-ফ্রেমের দৃশ্য নেই)
  push(
    "২ · প্রতি ঘরে ঠিক প্রত্যাশিত দৃশ্য (Intro / Main / Outro) — একটাই, বাকিগুলো DOM-এ নেই",
    each((c, i) => {
      const want = expectedScene(c);
      return i.roots === 1 && i.scenes.length === (want === "" ? 0 : 1) && (want === "" || i.scenes[0] === want);
    }),
    `${ALL.length}টা ঘরেই ঠিক ১ দৃশ্য — Outro ঠিক ফ্রেম ২৭০-এ শুরু (২৬৯ = Main, ২৭৬ = Outro)`,
  );

  // ৩ · root-এর ফ্রেম-সংখ্যা
  push(
    "৩ · root-এর `data-*-frames` ঘরের timing-এর সাথে মেলে (Intro · Main · Outro)",
    each((c, i) => i.frames !== null && i.frames[0] === c.timing.introFrames && i.frames[1] === c.timing.mainFrames && i.frames[2] === c.timing.outroFrames),
    "সব ঘরে মিলেছে",
  );

  // ৪ · ফেড-ইনের বৈশিষ্ট্য = `mainFadeIn` (Main-এর সব ঘর)
  push(
    "৪ · Main-এর ফেড-মোড়ক (`on/off`, opacity, স্কেল) প্রতি ঘরে `mainFadeIn`-এর হিসাবের সাথে মেলে",
    each((c, i) => {
      if (!i.fade) return false;
      const look = mainFadeIn(localMain(c), c.timing.introFrames, c.timing.mainFrames);
      return i.fade.state === (look.active ? "on" : "off") && near(i.fade.opacity, look.opacity) && near(i.fade.scale, look.scale);
    }, isMain),
    "সব Main-ঘরে মিলেছে (ফেডের বাইরে `off`, opacity ১, স্কেল ১)",
  );

  // ৫ · ক্রস-ফেডের মাঝের ফ্রেমে আংশিক
  push(
    "৫ · ক্রস-ফেডের মাঝে (Main ফ্রেম ৬) পুরো MainScene আংশিক স্বচ্ছ ও সামান্য ছোট; হাদিসের মাঝের ঘরগুলোতে ফেড বন্ধ",
    each(
      (c, i) => !!i.fade && i.fade.state === "on" && i.fade.opacity > 0.05 && i.fade.opacity < 0.95 && i.fade.scale > 0.97 && i.fade.scale < 1,
      (c) => c.key.endsWith("-fade"),
    ).concat(
      each((c, i) => !!i.fade && i.fade.state === "off" && i.fade.opacity === 1 && i.fade.scale === 1, (c) => c.key.endsWith("-main")),
    ),
    "৩টা ক্রস-ফেড ঘরে ০ < opacity < ১; হাদিসের ঘরগুলোতে ফেড বন্ধ",
  );

  // ৬ · Intro ০
  {
    const bad = each(
      (c, i) => i.scenes.join() === "main" && !!i.fade && i.fade.state === "off" && i.fade.opacity === 1 && i.fade.scale === 1,
      (c) => c.introS === 0,
    );
    const pure = mainFadeLength(0, 180) === 0 && planScenes(0, 180, 120).intro === null;
    rows.push({
      title: "৬ · Intro ০ সেকেন্ড: ভিডিও Main দিয়ে শুরু — Intro-র দৃশ্য নেই, ফেড নেই, প্রথম ফ্রেম পুরো দৃশ্যমান",
      ok: bad.length === 0 && pure,
      note: bad.length === 0 && pure ? "ঘর `s-intro0`, `s-both0`-এ শুধু Main, ফেড `off`, opacity ১" : bad.length ? `ভুল ঘর: ${bad.join(", ")}` : "বিশুদ্ধ হিসাব ভুল",
    });
  }

  // ৭ · Outro ০
  {
    const bad = each(
      (c, i) => i.scenes.join() === "main",
      (c) => c.outroS === 0,
    );
    const pure = planScenes(90, 180, 0).outro === null;
    rows.push({
      title: "৭ · Outro ০ সেকেন্ড: শেষ Main-ফ্রেমেও শুধু Main (০-ফ্রেমের Outro-`Sequence` নেই)",
      ok: bad.length === 0 && pure,
      note: bad.length === 0 && pure ? "ঘর `s-outro0`, `s-both0`-এ Outro নেই" : bad.length ? `ভুল ঘর: ${bad.join(", ")}` : "বিশুদ্ধ হিসাব ভুল",
    });
  }

  // ৮ · stage + caption সেগমেন্ট
  {
    const bad: string[] = [];
    ALL.forEach((c, idx) => {
      if (!isMain(c) || c.gap) return;
      const file = facts.files[c.hadisId];
      const info = infoOf(idx);
      if (!file) {
        bad.push(c.key);
        return;
      }
      const seg = findActiveSegment(buildFrameSegments(file, c.timing), c.abs)?.index ?? -1;
      const stageOk = !!info.stage && info.stage.segment === seg;
      const capNeeded = localMain(c) >= CAPTION_SETTLE_FRAMES;
      const capOk = !capNeeded || (!!info.caption && info.caption.segment === seg && info.caption.words > 0);
      if (!stageOk || !capOk) bad.push(c.key);
    });
    push("৮ · SvgStage ও Caption সব Main-ঘরে ঠিক সেগমেন্ট দেখায় (ক্যাপশনে শব্দ > ০; Intro-র অফসেট সত্যিই কাজ করছে)", bad, "সব Main-ঘরে প্রত্যাশিত সেগমেন্ট (Intro ০/১০s-এও)");
  }

  // ৯ · ফাঁক
  push(
    "৯ · Main-এর ফাঁকে (`hadis0000gap`, ফ্রেম ১৪২): Main আছে, Header আছে, ক্যাপশন আঁকা হয় না",
    each((c, i) => i.scenes.join() === "main" && i.headerBg !== null && i.caption === null, (c) => !!c.gap),
    "ফাঁকে ক্যাপশন নেই, ভিডিও ভাঙেনি",
  );

  // ১০ · Header রঙ
  {
    const bad = each((c, i) => i.headerBg !== null && i.headerBg === expectedPanelBg(c), isMain);
    const d = infoOf(ALL.findIndex((c) => c.key === "p-greenDayNight-main")).headerBg;
    const n = infoOf(ALL.findIndex((c) => c.key === "l-gdn-day")).headerBg;
    const e = infoOf(ALL.findIndex((c) => c.key === "p-greenDayNight-end")).headerBg;
    const differs = d !== null && e !== null && d !== e && n !== null;
    rows.push({
      title: "১০ · Header-এর প্যানেল-রঙ প্রতি ঘরে ঐ ফ্রেমের দিন-রাতের সাথে মেলে; greenDayNight-এ ফ্রেম ১৯০ ≠ ২৬৯",
      ok: bad.length === 0 && differs,
      note: bad.length === 0 && differs ? "সব Main-ঘরে প্রত্যাশিত রঙ; greenDayNight-এ আকাশ সত্যিই বদলায়" : bad.length ? `ভুল ঘর: ${bad.join(", ")}` : "greenDayNight-এর দিন ও রাতের রঙ একই",
    });
  }

  // ১১ · Outro-র আকাশ রাত (বিশুদ্ধ)
  {
    const bad: string[] = [];
    for (const i of SECS) {
      for (const o of OUTRO_SECS) {
        if (o === 0) continue;
        const t = mk(i, o);
        const start = t.introFrames + t.mainFrames;
        const first = computeNightFactor({ frame: start, introFrames: t.introFrames, mainFrames: t.mainFrames, outroFrames: t.outroFrames });
        const last = computeNightFactor({ frame: start + t.outroFrames - 1, introFrames: t.introFrames, mainFrames: t.mainFrames, outroFrames: t.outroFrames });
        const full = computeNightFactor({ frame: start + 15, introFrames: t.introFrames, mainFrames: t.mainFrames, outroFrames: t.outroFrames });
        if (first < MAIN_END_NIGHT - 1e-9 || last < first - 1e-9 || !near(full, 1)) bad.push(`${i}/${o}`);
      }
    }
    rows.push({
      title: "১১ · Outro-র আকাশ রাত: প্রথম Outro-ফ্রেমে ≥ ০.৯৫ (Main-এর শেষের রাত), কখনো কমে না, ১৫ ফ্রেমে ঠিক ১",
      ok: bad.length === 0,
      note: bad.length === 0 ? "২০ জোড়া (Outro > ০) সবটাতেই ঠিক" : `ভুল জোড়া (intro/outro): ${bad.join(", ")}`,
    });
  }

  // ১২ · সাইজ
  push(
    "১২ · প্রতি ঘরে root ঠিক ঘরের সাইজের (১০৮০×১৯২০ · ১৯২০×১০৮০ · ২১৬০×৩৮৪০ · ৩৮৪০×২১৬০) আর দৃশ্য কম্পোজিশনের ভেতরে",
    each(
      (c, i) =>
        !!i.rootRect &&
        near(i.rootRect.w, c.fullW, 1) &&
        near(i.rootRect.h, c.fullH, 1) &&
        i.sceneRects.every((r) => insideRect(r, c.fullW, c.fullH, 1)),
    ),
    "সব ঘরে ঠিক মাপ, কিছু বাইরে যায়নি",
  );

  // ১৩ · 4K = ২×
  {
    const pairs: Array<[string, string]> = [
      ["p-emerald-main", "k-portrait"],
      ["l-emerald-main", "k-landscape"],
    ];
    const bad: string[] = [];
    for (const [hdKey, kKey] of pairs) {
      const hd = infoOf(ALL.indexOf(byKey(hdKey))).stage;
      const uhd = infoOf(ALL.indexOf(byKey(kKey))).stage;
      const a = computeLayout(byKey(hdKey).fullW, byKey(hdKey).fullH);
      const b = computeLayout(byKey(kKey).fullW, byKey(kKey).fullH);
      if (!hd || !uhd || Math.abs(uhd.rect.w - 2 * hd.rect.w) > 2 || !near(b.svgBox.size, 2 * a.svgBox.size) || !near(b.unit, 2 * a.unit)) bad.push(kKey);
    }
    rows.push({
      title: "১৩ · 4K = ঠিক ২× HD (আসল ঘরে SvgStage-এর চওড়া + লেআউট হিসাব; দুই অভিমুখে)",
      ok: bad.length === 0,
      note: bad.length === 0 ? "Portrait ও Landscape দুটোতেই ঠিক ২×" : `ভুল: ${bad.join(", ")}`,
    });
  }

  // ১৪ · নমুনা ভয়েস
  {
    const v = facts.voice;
    const ok = "seconds" in v && Math.abs(v.seconds - AUDIO_SECONDS) < 0.05;
    rows.push({
      title: "১৪ · নমুনা `public/hadis/hadis0000.wav` পড়া যায়, ঠিক ৬ সেকেন্ড (Main = ১৮০ ফ্রেম)",
      ok,
      note: "seconds" in v ? `পাওয়া দৈর্ঘ্য ${v.seconds.toFixed(2)}s` : `পড়া গেল না: ${v.error.slice(0, 90)}`,
    });
  }

  // ১৫ · নমুনা SFX
  rows.push({
    title: "১৫ · নমুনা SFX `public/sfx/whoosh.mp3` পাওয়া যায় (Part 11-এর ফাইল-খোঁজা দিয়ে)",
    ok: facts.sfxSrc !== null,
    note: facts.sfxSrc !== null ? `পাওয়া গেছে: ${facts.sfxSrc.split("/").pop()}` : "ফাইল পাওয়া যায়নি (ভিডিও চুপচাপ চলবে, তবে এই সারি ❌)",
  });

  // ১৬ · SFX-পরিকল্পনা
  {
    const file = facts.files[MAIN_ID];
    let ok = false;
    let note = "hadis0000_timestamp.json পাওয়া যায়নি";
    if (file) {
      const plan = planSfx(buildFrameSegments(file, TIMING), TIMING);
      const seg = plan.cues.find((c) => c.kind === "segment");
      const outro = plan.cues.find((c) => c.kind === "outro");
      const mainEnd = TIMING.introFrames + TIMING.mainFrames;
      ok =
        plan.cues.length === 2 &&
        !!seg && seg.name === "whoosh" && seg.from === TIMING.introFrames && near(seg.volume, 0.6) && seg.from + seg.durationFrames <= mainEnd &&
        !!outro && outro.name === "whoosh" && outro.from === mainEnd && outro.from + outro.durationFrames <= TIMING.totalFrames &&
        plan.warnings.length === 0;
      note = ok
        ? `সেগমেন্ট-১ whoosh ফ্রেম ${seg!.from} (ভলিউম ০.৬) · Outro whoosh ফ্রেম ${outro!.from}; কোনো সতর্কতা নেই`
        : `কিউ ${plan.cues.length}টা, সতর্কতা ${plan.warnings.length}টা — প্রত্যাশা ২ কিউ (৯০ ও ২৭০)`;
    }
    rows.push({ title: "১৬ · অডিও-পরিকল্পনা (`hadis0000`): সেগমেন্ট-১-এর whoosh ঠিক Main-এর শুরুতে, Outro-র whoosh ঠিক Outro-র শুরুতে", ok, note });
  }

  return rows;
}

// ---------- আঁকা ----------

const CellView: React.FC<{ cell: Placed; setRef: (el: HTMLDivElement | null) => void }> = ({ cell, setRef }) => {
  const scale = cell.w / cell.fullW;
  const size = { width: cell.fullW, height: cell.fullH };
  return (
    <div style={{ position: "absolute", left: cell.x, top: cell.y, width: cell.w, height: cell.h, overflow: "hidden", outline: "1px solid #ffffff44" }}>
      <div
        ref={setRef}
        style={{ width: cell.fullW, height: cell.fullH, transform: `scale(${scale})`, transformOrigin: "0 0", position: "relative" }}
      >
        {/* Sequence দিয়ে ভিডিওর পরম ফ্রেম = `cell.abs` (check-এর ফ্রেম ৪৫ থেকে সরিয়ে) */}
        <Sequence from={CHECK_FRAME - cell.abs} layout="none">
          <HadisVideoView
            hadisId={cell.hadisId}
            hadisBookname={cell.bookname}
            hadisNumber={cell.number}
            theme={cell.theme}
            orientation={cell.orientation}
            introSeconds={cell.introS}
            outroSeconds={cell.outroS}
            timing={cell.timing}
            size={size}
            idScope={`${cell.key}-`}
            audio={false}
            sfx={false}
          />
        </Sequence>
      </div>
    </div>
  );
};

const CellLabel: React.FC<{ cell: Placed; p: Palette }> = ({ cell, p }) => (
  <div
    style={{
      position: "absolute",
      left: cell.x,
      top: cell.y + cell.h + 3,
      width: cell.w,
      height: LABEL_H - 3,
      fontFamily: FONT_BODY,
      fontSize: 14,
      lineHeight: 1.15,
      color: p.text,
      opacity: 0.9,
      overflow: "hidden",
    }}
  >
    {cell.label}
  </div>
);

const RowView: React.FC<{ p: Palette; row: Row }> = ({ p, row }) => (
  <div style={{ height: ROW_PITCH, flexShrink: 0 }}>
    <div
      style={{
        height: ROW_H,
        boxSizing: "border-box",
        background: row.ok ? "rgba(46, 160, 100, 0.22)" : "rgba(220, 70, 70, 0.30)",
        border: `1px solid ${row.ok ? "#4CD08A" : "#FF7A7A"}`,
        borderRadius: 14,
        padding: "5px 16px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div style={{ fontSize: 30 }}>{row.ok ? "✅" : "❌"}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 18.5, lineHeight: 1.2, color: p.text }}>{row.title}</div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 16, lineHeight: 1.2, opacity: 0.85, color: p.text }}>{row.note}</div>
      </div>
    </div>
  </div>
);

const SectionTitle: React.FC<{ p: Palette; text: string }> = ({ p, text }) => (
  <div style={{ height: TITLE_H, flexShrink: 0, display: "flex", alignItems: "center", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, color: p.accent }}>
    {text}
  </div>
);

const FadeCases: React.FC<{ p: Palette }> = ({ p }) => {
  const cases = React.useMemo(() => runSceneFadeCases(), []);
  const colW = (CONTENT_W - 12) / 2;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0 12px", width: CONTENT_W, flexShrink: 0, alignContent: "flex-start", height: Math.ceil(SCENE_FADE_CASE_COUNT / 2) * FADE_ROW_PITCH }}>
      {cases.map((c) => (
        <div key={c.id} style={{ width: colW, height: FADE_ROW_PITCH, boxSizing: "border-box", paddingBottom: 6 }}>
          <div
            style={{
              height: FADE_ROW_PITCH - 6,
              boxSizing: "border-box",
              background: c.ok ? "rgba(46, 160, 100, 0.22)" : "rgba(220, 70, 70, 0.30)",
              border: `1px solid ${c.ok ? "#4CD08A" : "#FF7A7A"}`,
              borderRadius: 12,
              padding: "3px 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              overflow: "hidden",
            }}
          >
            <div style={{ fontSize: 24 }}>{c.ok ? "✅" : "❌"}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 15, lineHeight: 1.15, color: p.text }}>{c.title}</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 13, lineHeight: 1.15, opacity: 0.85, color: p.text }}>{c.ok ? c.rule : c.detail}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const HadisVideoPreview: React.FC = () => {
  const p = getThemeColors("emerald", 0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const data = useCheckData(refs);
  const rows = data ? buildRows(data) : [];
  const fadeCases = runSceneFadeCases();
  const passed = rows.filter((r) => r.ok).length + fadeCases.filter((c) => c.ok).length;
  const allOk = data !== null && rows.length === N_PURE && passed === N_AUTO;

  let index = 0;
  const sectionView = (title: string, sec: { cells: Placed[]; height: number }) => {
    const start = index;
    index += sec.cells.length;
    return (
      <React.Fragment key={title}>
        <SectionTitle p={p} text={title} />
        <div style={{ position: "relative", height: sec.height, width: CONTENT_W, flexShrink: 0 }}>
          {sec.cells.map((c, k) => (
            <CellView
              key={c.key}
              cell={c}
              setRef={(el) => {
                refs.current[start + k] = el;
              }}
            />
          ))}
          {sec.cells.map((c) => (
            <CellLabel key={`${c.key}-label`} cell={c} p={p} />
          ))}
        </div>
      </React.Fragment>
    );
  };

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
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 46, color: p.accent }}>HadisVideo যাচাই</div>
        <div style={{ fontWeight: 700, fontSize: 34, color: allOk ? "#7CFFB2" : "#FF8A8A" }}>
          {data === null ? "⏳" : allOk ? "সব ✅" : "❌ আছে"} · {passed}/{N_AUTO}
        </div>
      </div>

      <SectionTitle p={p} text={`স্বয়ংক্রিয় যাচাই (DOM + হিসাব + নমুনা-ফাইল) · ${rows.filter((r) => r.ok).length}/${N_PURE}`} />
      {rows.length === 0 ? (
        <div style={{ height: N_PURE * ROW_PITCH, flexShrink: 0 }} />
      ) : (
        rows.map((r) => <RowView key={r.title} p={p} row={r} />)
      )}

      <SectionTitle p={p} text={`Intro ↔ Main ক্রস-ফেডের বিশুদ্ধ কেস (sceneFade.ts) · ${fadeCases.filter((c) => c.ok).length}/${SCENE_FADE_CASE_COUNT}`} />
      <FadeCases p={p} />

      {sectionView("১ · Portrait — তিন থিম × (Intro · ক্রস-ফেড · হাদিস · Main-এর শেষ · Outro)", S1)}
      {sectionView("২ · Landscape — Intro · হাদিস · Outro · দিন ও রাত", S2)}
      {sectionView("৩ · বিশেষ সময় — Intro/Outro ০·১·১০s, ফাঁক, Outro-র ঢোকা, লম্বা নাম", S3)}
      {sectionView("৪ · 4K — ২১৬০×৩৮৪০ ও ৩৮৪০×২১৬০", S4)}
    </AbsoluteFill>
  );
};
