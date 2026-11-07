import { TRANSITION_FRAMES } from "../constants";
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
