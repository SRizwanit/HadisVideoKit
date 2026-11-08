import { TRANSITION_FRAMES } from "../constants";
import { fitHookSeconds, planIntroOutroAudio } from "../lib/introOutroAudio";
import { computeTiming, introOnlyFrames, timingFromConfig } from "../lib/timing";
import { hookWordStarts } from "../scenes/HookScene";
import { buildTeaser, clampTeaserRange, fitTeaserSeconds, teaserActiveIndex, teaserGain, teaserWords } from "../lib/teaser";
import type { TimestampFile } from "../types";
import {
  MAIN_FADE_FRAMES,
  MAIN_FADE_SCALE_START,
  mainFadeIn,
  mainFadeLength,
  planScenes,
} from "../lib/sceneFade";

/**
 * Part 13B (dev): sceneFade.ts-এর বিশুদ্ধ কেস — React ছাড়া, সাধারণ Node-এও চলে।
 * Part 13C-র `HadisVideoPreview` এগুলো সারি হিসেবে আঁকবে। `runSceneFadeCases()` কখনো throw করে না; ভাঙা কেস ❌ + কারণ।
 */
export type SceneFadeCaseOutcome = { id: string; title: string; ok: boolean; detail: string; rule: string };
type Def = { id: string; title: string; rule: string; run: () => string | null };

const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;
const expect = (cond: boolean, msg: string): string | null => (cond ? null : msg);
const first = (...checks: (string | null)[]): string | null => checks.find((c) => c !== null) ?? null;

const DEFS: Def[] = [
  {
    id: "len-rule",
    title: "ফেড-ইনের দৈর্ঘ্য = min(12, ⌊Main ÷ 3⌋)",
    rule: "180→12 · 36→12 · 30→10 · 12→4 · 5→1 · 2→0",
    run: () =>
      first(
        expect(mainFadeLength(90, 180) === 12, "180 → 12"),
        expect(mainFadeLength(90, 36) === 12, "36 → 12"),
        expect(mainFadeLength(90, 30) === 10, "30 → 10"),
        expect(mainFadeLength(90, 12) === 4, "12 → 4"),
        expect(mainFadeLength(90, 5) === 1, "5 → 1"),
        expect(mainFadeLength(90, 2) === 0, "2 → 0"),
        expect(MAIN_FADE_FRAMES === 12 && TRANSITION_FRAMES === 12, "MAIN_FADE_FRAMES = TRANSITION_FRAMES = 12"),
      ),
  },
  {
    id: "len-no-intro",
    title: "Intro ০ ফ্রেম হলে ফেড নেই (ভিডিও Main দিয়ে শুরু)",
    rule: "intro 0 → দৈর্ঘ্য ০, frame 0-এও active=false, opacity 1",
    run: () => {
      const l = mainFadeIn(0, 0, 180);
      return first(
        expect(mainFadeLength(0, 180) === 0, "দৈর্ঘ্য ০"),
        expect(!l.active && l.opacity === 1 && l.scale === 1, "frame 0-এ opacity 1, স্কেল 1, active=false"),
      );
    },
  },
  {
    id: "len-safe",
    title: "দৈর্ঘ্য: সংখ্যা না/ঋণাত্মক/০ → ০",
    rule: "NaN, Infinity, -5, 0, string → ০",
    run: () =>
      first(
        expect(mainFadeLength(90, Number.NaN) === 0, "NaN"),
        expect(mainFadeLength(90, Number.POSITIVE_INFINITY) === 0, "Infinity"),
        expect(mainFadeLength(90, -5) === 0, "-5"),
        expect(mainFadeLength(90, 0) === 0, "0"),
        expect(mainFadeLength(90, "180" as unknown as number) === 0, "string"),
        expect(mainFadeLength(Number.NaN, 180) === 0, "intro NaN"),
        expect(mainFadeLength(-3, 180) === 0, "intro -3"),
      ),
  },
  {
    id: "curve-ends",
    title: "ফেড-ইন: শুরুতে opacity ০ / স্কেল ০.৯৭, শেষে ঠিক ১",
    rule: "frame 0 → 0 / 0.97; frame = দৈর্ঘ্য → active=false, 1 / 1",
    run: () => {
      const a = mainFadeIn(0, 90, 180);
      const b = mainFadeIn(12, 90, 180);
      const c = mainFadeIn(11, 90, 180);
      return first(
        expect(a.active && near(a.opacity, 0) && near(a.scale, MAIN_FADE_SCALE_START), `frame 0: ${a.opacity}/${a.scale}`),
        expect(!b.active && b.opacity === 1 && b.scale === 1, `frame 12: active=${b.active}`),
        expect(c.active && c.opacity > 0.9 && c.opacity < 1, `frame 11 প্রায় ১: ${c.opacity}`),
        expect(MAIN_FADE_SCALE_START === 0.97, "শুরুর স্কেল 0.97"),
      );
    },
  },
  {
    id: "curve-mid",
    title: "মাঝামাঝি (৬/১২): opacity ঠিক ০.৫, স্কেল ০.৯৮৫ (smoothstep)",
    rule: "ease(0.5) = 0.5 — Intro-র ফেড-আউটের সাথে সমান্তরাল",
    run: () => {
      const m = mainFadeIn(6, 90, 180);
      return first(
        expect(near(m.opacity, 0.5), `opacity ${m.opacity}`),
        expect(near(m.scale, 0.985), `scale ${m.scale}`),
        expect(near(m.progress, 0.5), `progress ${m.progress}`),
      );
    },
  },
  {
    id: "curve-monotone",
    title: "opacity শুধু বাড়ে, স্কেল শুধু বাড়ে; মান সীমার ভেতরে",
    rule: "frame 0…12: opacity 0…1 ও স্কেল 0.97…1, কখনো কমে না",
    run: () => {
      let po = -1;
      let ps = 0;
      for (let f = 0; f <= 14; f++) {
        const l = mainFadeIn(f, 90, 180);
        if (l.opacity < po - 1e-12) return `frame ${f}: opacity কমেছে`;
        if (l.scale < ps - 1e-12 && ps !== 0) return `frame ${f}: স্কেল কমেছে`;
        if (l.opacity < 0 || l.opacity > 1) return `frame ${f}: opacity সীমার বাইরে ${l.opacity}`;
        if (l.scale < MAIN_FADE_SCALE_START - 1e-12 || l.scale > 1 + 1e-12) return `frame ${f}: স্কেল সীমার বাইরে ${l.scale}`;
        po = l.opacity;
        ps = l.scale;
      }
      return null;
    },
  },
  {
    id: "no-style-outside",
    title: "ফেডের বাইরে active=false (মোড়কে কোনো opacity/transform নয়)",
    rule: "frame ≥ দৈর্ঘ্য এবং বড় frame, সবই active=false · ১-এ ১",
    run: () => {
      for (const f of [12, 13, 50, 179, 1000]) {
        const l = mainFadeIn(f, 90, 180);
        if (l.active || l.opacity !== 1 || l.scale !== 1) return `frame ${f}: active=${l.active}`;
      }
      return null;
    },
  },
  {
    id: "short-main",
    title: "খুব ছোট Main: ৫ ফ্রেমে ১ ফ্রেমের ফেড; ২ ফ্রেমে সরাসরি",
    rule: "Main 5 → frame 0 active, frame 1 নয় · Main 2 → ফেড নেই",
    run: () =>
      first(
        expect(mainFadeIn(0, 90, 5).active && !mainFadeIn(1, 90, 5).active, "Main 5"),
        expect(!mainFadeIn(0, 90, 2).active, "Main 2 → সরাসরি"),
        expect(!mainFadeIn(0, 90, 1).active, "Main 1 → সরাসরি"),
      ),
  },
  {
    id: "frame-safe",
    title: "আজেবাজে ফ্রেম: NaN/ঋণাত্মক → frame 0; Infinity → শেষ; কখনো throw নয়",
    rule: "NaN, -7, -Infinity, +Infinity, string",
    run: () => {
      try {
        const z = mainFadeIn(0, 90, 180);
        const n = mainFadeIn(Number.NaN, 90, 180);
        const neg = mainFadeIn(-7, 90, 180);
        const ninf = mainFadeIn(Number.NEGATIVE_INFINITY, 90, 180);
        const pinf = mainFadeIn(Number.POSITIVE_INFINITY, 90, 180);
        const str = mainFadeIn("x" as unknown as number, 90, 180);
        return first(
          expect(near(n.opacity, z.opacity) && near(neg.opacity, z.opacity) && near(ninf.opacity, z.opacity), "NaN/ঋণাত্মক ≠ frame 0"),
          expect(!pinf.active && pinf.opacity === 1, "+∞ ≠ শেষ"),
          expect(str.active && near(str.opacity, 0), "string ≠ frame 0"),
        );
      } catch (e) {
        return `throw: ${String(e)}`;
      }
    },
  },
  {
    id: "scenes-default",
    title: "দৃশ্য-ভাগ: Intro 90 · Main 180 · Outro 120 → 0 / 90 / 270",
    rule: "পরপর লাগানো, ফাঁক/ওভারল্যাপ নেই; মোট = যোগফল",
    run: () => {
      const p = planScenes(90, 180, 120);
      return first(
        expect(p.intro?.from === 0 && p.intro.frames === 90, "intro"),
        expect(p.main?.from === 90 && p.main.frames === 180, "main"),
        expect(p.outro?.from === 270 && p.outro.frames === 120, "outro"),
        expect(!!p.intro && !!p.main && !!p.outro && p.intro.from + p.intro.frames === p.main.from && p.main.from + p.main.frames === p.outro.from, "পরপর"),
      );
    },
  },
  {
    id: "scenes-zero",
    title: "০-ফ্রেমের দৃশ্য কখনো নয়: Intro ০ / Outro ০ / দুটোই ০",
    rule: "০ বা ঋণাত্মক বা NaN → null; Main-এর শুরু Intro-র ফ্রেমের সমান",
    run: () => {
      const a = planScenes(0, 180, 120);
      const b = planScenes(90, 180, 0);
      const c = planScenes(0, 180, 0);
      const d = planScenes(Number.NaN, 180, -4);
      return first(
        expect(a.intro === null && a.main?.from === 0 && a.outro?.from === 180, "Intro 0"),
        expect(b.outro === null && b.intro?.frames === 90 && b.main?.from === 90, "Outro 0"),
        expect(c.intro === null && c.outro === null && c.main?.from === 0 && c.main.frames === 180, "দুটোই 0"),
        expect(d.intro === null && d.outro === null && d.main?.from === 0, "NaN/ঋণাত্মক"),
        expect(planScenes(90, 0, 120).main === null, "Main 0 → null"),
      );
    },
  },
  {
    id: "scenes-hook",
    title: "Hook: Hook 126 · Intro 90 · Main 180 · Outro 120 → 0 / 126 / 216 / 396",
    rule: "introFrames = Hook + Intro (Main-এর শুরু); Hook না থাকলে আগের মতোই; Hook ছাড়া Intro ০ হলে Hook → Main",
    run: () => {
      const p = planScenes(216, 180, 120, 126);
      const noHook = planScenes(90, 180, 120);
      const hookOnly = planScenes(126, 180, 120, 126);
      return first(
        expect(p.hook?.from === 0 && p.hook.frames === 126, "hook"),
        expect(p.intro?.from === 126 && p.intro.frames === 90, "intro Hook-এর পরে"),
        expect(p.main?.from === 216 && p.outro?.from === 396, "main/outro"),
        expect(noHook.hook === null && noHook.intro?.from === 0 && noHook.intro.frames === 90, "Hook ছাড়া অপরিবর্তিত"),
        expect(hookOnly.hook?.frames === 126 && hookOnly.intro === null && hookOnly.main?.from === 126, "Intro ০"),
        expect(planScenes(50, 180, 120, 999).intro === null, "Hook > Intro+Hook ছেঁটে যায়"),
      );
    },
  },
  {
    id: "hook-timing-audio",
    title: "Hook সময়: hook.wav ৪.০৮s → ৪.২s (১২৬ ফ্রেম); অডিও-কিউ Hook → Intro → Outro",
    rule: "computeTiming = timingFromConfig; ভয়েস Hook ০, Intro Hook-এর পরে, Outro Main-এর পরে; অডিও না থাকলে Hook ০",
    run: () => {
      const hs = fitHookSeconds(4.08);
      const t = computeTiming({ introSeconds: 3, outroSeconds: 4, audioSeconds: 14, hookSeconds: hs });
      const t2 = timingFromConfig(t.totalFrames, { introSeconds: 3, outroSeconds: 4, hookSeconds: hs });
      const a = planIntroOutroAudio(t);
      const plain = computeTiming({ introSeconds: 3, outroSeconds: 4, audioSeconds: 14 });
      return first(
        expect(near(hs, 4.2) && t.hookFrames === 126 && t.introFrames === 216 && introOnlyFrames(t) === 90, "ফ্রেম"),
        expect(JSON.stringify(t) === JSON.stringify(t2), "computeTiming ≠ timingFromConfig"),
        expect(a.hook?.from === 0 && a.hook.durationFrames === 126, "hook কিউ"),
        expect(a.intro?.from === 126 && a.intro.durationFrames === 90, "intro কিউ"),
        expect(a.outro?.from === 636 && a.outro.durationFrames === 120, "outro কিউ"),
        expect(fitHookSeconds(null) === 0 && fitHookSeconds(0) === 0 && fitHookSeconds(Number.NaN) === 0, "অডিও নেই → ০"),
        expect(plain.hookFrames === undefined && plain.introFrames === 90 && planIntroOutroAudio(plain).hook === null, "Hook ছাড়া অপরিবর্তিত"),
      );
    },
  },
  {
    id: "hook-word-stagger",
    title: "Hook শব্দ-স্টাগার: বাড়ন্ত ক্রম, ≤ ১.৬s ও Hook-এর ৫৫%-এর মধ্যে",
    rule: "৭ শব্দ · ১২৬ ফ্রেম → প্রথম ৬, শেষ ≤ ৪৮; ছোট Hook-এ চেপে আসে; ০ শব্দ → []",
    run: () => {
      const s = hookWordStarts(7, 126, 30);
      const tiny = hookWordStarts(7, 20, 30);
      return first(
        expect(s.length === 7 && s[0] === 6 && s[6] <= 48 && s[6] <= 126 * 0.55, "দীর্ঘ Hook"),
        expect(s.every((v, i) => i === 0 || v >= s[i - 1]), "বাড়ন্ত"),
        expect(tiny.length === 7 && tiny.every((v) => v >= 0 && v <= 20), "ছোট Hook"),
        expect(hookWordStarts(0, 126, 30).length === 0 && hookWordStarts(1, 126, 30)[0] === 6, "০/১ শব্দ"),
      );
    },
  },
  {
    id: "scenes-teaser",
    title: "Teaser: Hook 126 · Teaser 60 · Intro 90 · Main 180 · Outro 120 → 0 / 126 / 186 / 276 / 456",
    rule: "Teaser Hook-এর ঠিক পরে, Intro তার পরে; Hook ছাড়াও চলে; কিছু না থাকলে আগের মতো; Intro-র জায়গার বেশি হলে ছেঁটে যায়",
    run: () => {
      const p = planScenes(276, 180, 120, 126, 60);
      const noHook = planScenes(150, 180, 120, 0, 60);
      const none = planScenes(90, 180, 120, 0, 0);
      return first(
        expect(p.hook?.from === 0 && p.hook.frames === 126, "hook"),
        expect(p.teaser?.from === 126 && p.teaser.frames === 60, "teaser"),
        expect(p.intro?.from === 186 && p.intro.frames === 90, "intro"),
        expect(p.main?.from === 276 && p.outro?.from === 456, "main/outro"),
        expect(noHook.hook === null && noHook.teaser?.from === 0 && noHook.intro?.from === 60, "Hook ছাড়া"),
        expect(none.teaser === null && none.intro?.from === 0 && none.intro.frames === 90, "কিছু না থাকলে অপরিবর্তিত"),
        expect(planScenes(100, 180, 120, 30, 999).teaser?.frames === 70 && planScenes(100, 180, 120, 30, 999).intro === null, "teaser ছেঁটে যায়"),
      );
    },
  },
  {
    id: "teaser-range-timing",
    title: "Teaser অংশ ও সময়: ছাঁটাই, ন্যূনতম/সর্বোচ্চ, দৃশ্যের দৈর্ঘ্য, অডিও-কিউ",
    rule: "12.4–17.9 (wav 30s) → 5.5s → দৃশ্য 5.6667s (170 ফ্রেম); end>wav ছাঁটা; >12s ছাঁটা; <0.5s/অবৈধ → null; Intro-ভয়েস Hook+Teaser-এর পরে",
    run: () => {
      const r = clampTeaserRange(12.4, 17.9, 30);
      const over = clampTeaserRange(28, 40, 30);
      const long = clampTeaserRange(2, 30, 60);
      const t = computeTiming({ introSeconds: 3, outroSeconds: 4, audioSeconds: 30, hookSeconds: 4.2, teaserSeconds: fitTeaserSeconds(5.5) });
      const t2 = timingFromConfig(t.totalFrames, { introSeconds: 3, outroSeconds: 4, hookSeconds: 4.2, teaserSeconds: fitTeaserSeconds(5.5) });
      const a = planIntroOutroAudio(t);
      return first(
        expect(!!r && near(r.durationSeconds, 5.5, 1e-9), "5.5s"),
        expect(!!over && near(over.endSeconds, 30) && near(over.durationSeconds, 2), "end > wav ছাঁটা"),
        expect(!!long && near(long.durationSeconds, 12), ">12s ছাঁটা"),
        expect(clampTeaserRange(1, 1.3, 30) === null && clampTeaserRange(31, 35, 30) === null && clampTeaserRange(Number.NaN, 3, 30) === null, "ছোট/বাইরে/NaN → null"),
        expect(clampTeaserRange(-5, 3, 30)?.startSeconds === 0, "ঋণাত্মক start → 0"),
        expect(near(fitTeaserSeconds(5.5), 170 / 30) && fitTeaserSeconds(null) === 0 && fitTeaserSeconds(0) === 0, "দৃশ্যের দৈর্ঘ্য"),
        expect(t.hookFrames === 126 && t.teaserFrames === 170 && t.introFrames === 126 + 170 + 90 && introOnlyFrames(t) === 90, "ফ্রেম"),
        expect(JSON.stringify(t) === JSON.stringify(t2), "computeTiming ≠ timingFromConfig"),
        expect(a.intro?.from === 296 && a.intro.durationFrames === 90 && a.outro?.from === t.introFrames + t.mainFrames, "অডিও-কিউ"),
      );
    },
  },
  {
    id: "teaser-words-gain",
    title: "Teaser শব্দ ও ভলিউম: মাঝবিন্দু-নিয়ম, সমান-ভাগ fallback, সক্রিয় শব্দ, ফেড",
    rule: "words থাকলে সেগুলো (সময় অংশের শুরু থেকে); না থাকলে segment-লেখা সমান ভাগে; কিছুই না মিললে teaser.text; গেইন ০–১, অংশের পরে ০",
    run: () => {
      const file: TimestampFile = {
        teaser: { start: 1, end: 3 },
        segments: [
          { start: 0, end: 4, text: "ক খ গ ঘ", words: [{ word: "ক", start: 0, end: 0.9 }, { word: "খ", start: 0.9, end: 1.8 }, { word: "গ", start: 1.8, end: 2.6 }, { word: "ঘ", start: 2.6, end: 4 }] },
        ],
      };
      const plan = buildTeaser(file, 4);
      const even = teaserWords({ segments: [{ start: 0, end: 4, text: "ক খ গ ঘ" }] }, { startSeconds: 1, endSeconds: 3 });
      const fb = teaserWords({ segments: [{ start: 10, end: 11, text: "ঙ" }], teaser: { text: "চ ছ" } }, { startSeconds: 1, endSeconds: 3 });
      const g = [0, 1, 2, 50, 99, 100, -1, Number.NaN].map((f) => teaserGain(f, 100));
      return first(
        expect(!!plan && plan.words.map((w) => w.word).join("") === "খগ" && plan.text === "খ গ", "মাঝবিন্দু: খ(১.৩৫) গ(২.২) ঢোকে; ক(০.৪৫) ঘ(৩.৩) নয়"),
        expect(!!plan && near(plan.words[0].start, 0) && near(plan.words[1].end, 1.6, 1e-9), "সময় অংশের শুরু থেকে"),
        expect(even.map((w) => w.word).join("") === "খগ", "সমান-ভাগ fallback"),
        expect(fb.length === 2 && fb[0].word === "চ" && near(fb[1].end, 2), "teaser.text fallback"),
        expect(teaserActiveIndex(plan?.words ?? [], 0, 30) === 0 && teaserActiveIndex(plan?.words ?? [], 40, 30) === 1 && teaserActiveIndex([], 5, 30) === -1, "সক্রিয় শব্দ"),
        expect(g.every((v) => v >= 0 && v <= 1) && g[0] > 0 && g[0] < 1 && g[3] === 1 && g[5] === 0 && g[6] === 0 && g[7] === 0, "গেইন সীমা ও ফেড"),
        expect(teaserGain(1, 3) === 1 && teaserGain(0, 0) === 0, "খুব ছোট অংশে ফেড নেই"),
      );
    },
  },
  {
    id: "never-throws",
    title: "আজেবাজে ইনপুটে কখনো throw করে না",
    rule: "undefined, null, string, বিশাল সংখ্যা",
    run: () => {
      try {
        mainFadeIn(undefined as unknown as number, undefined as unknown as number, null as unknown as number);
        planScenes("a" as unknown as number, undefined as unknown as number, 1e12);
        mainFadeLength(1e12, 1e12);
        return null;
      } catch (e) {
        return `throw: ${String(e)}`;
      }
    },
  },
];

export const SCENE_FADE_CASE_COUNT = DEFS.length;

export function runSceneFadeCases(): SceneFadeCaseOutcome[] {
  return DEFS.map((d) => {
    try {
      const msg = d.run();
      return { id: d.id, title: d.title, rule: d.rule, ok: msg === null, detail: msg ?? "" };
    } catch (e) {
      return { id: d.id, title: d.title, rule: d.rule, ok: false, detail: `কেস নিজেই throw করেছে: ${String(e)}` };
    }
  });
}
