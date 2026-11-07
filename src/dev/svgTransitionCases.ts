import {
  BLUR_UNITS,
  TRANSITION_FRAMES,
  crossFadeLooks,
  planStage,
  runStartIndex,
  transitionLength,
} from "../lib/svgTransition";

/**
 * Part 9L (dev): svgTransition.ts-এর বিশুদ্ধ কেস — React ছাড়া, সাধারণ Node-এও চলে।
 * `SvgStagePreview` এগুলো সারি হিসেবে আঁকে। `runTransitionCases()` কখনো throw করে না; ভাঙা কেস ❌ + কারণ।
 */
export type TransitionCaseOutcome = { id: string; title: string; ok: boolean; detail: string; rule: string };
type Def = { id: string; title: string; rule: string; run: () => string | null };

const seg = (startFrame: number, endFrame: number) => ({ startFrame, endFrame });
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;
const expect = (cond: boolean, msg: string): string | null => (cond ? null : msg);
const first = (...checks: (string | null)[]): string | null => checks.find((c) => c !== null) ?? null;

/** তিন সেগমেন্ট, প্রতিটা ৬০ ফ্রেম: ৯০–১৫০, ১৫০–২১০, ২১০–২৭০ */
const SEGS = [seg(90, 150), seg(150, 210), seg(210, 270)];

const DEFS: Def[] = [
  {
    id: "len-rule",
    title: "transition-দৈর্ঘ্য = min(12, ⌊দৈর্ঘ্য ÷ 3⌋)",
    rule: "60→12 · 36→12 · 30→10 · 12→4 · 5→1 · 2→0",
    run: () =>
      first(
        expect(transitionLength(60) === 12, "60 → 12"),
        expect(transitionLength(36) === 12, "36 → 12"),
        expect(transitionLength(30) === 10, "30 → 10"),
        expect(transitionLength(12) === 4, "12 → 4"),
        expect(transitionLength(5) === 1, "5 → 1"),
        expect(transitionLength(2) === 0, "2 → 0"),
        expect(TRANSITION_FRAMES === 12, "TRANSITION_FRAMES = 12"),
      ),
  },
  {
    id: "len-safe",
    title: "transition-দৈর্ঘ্য: সংখ্যা না/ঋণাত্মক/০ → ০",
    rule: "NaN, Infinity, -5, 0, string → 0",
    run: () =>
      first(
        ...[Number.NaN, Number.POSITIVE_INFINITY, -5, 0, "x" as unknown as number].map((v) =>
          expect(transitionLength(v) === 0, `${String(v)} → 0`),
        ),
      ),
  },
  {
    id: "plan-none",
    title: "সেগমেন্ট নেই (বা names ছোট) → null",
    rule: "খালি তালিকা, names-এর দৈর্ঘ্য কম",
    run: () => first(expect(planStage([], [], 100) === null, "খালি → null"), expect(planStage(SEGS, ["a"], 100) === null, "names কম → null")),
  },
  {
    id: "plan-first",
    title: "প্রথম সেগমেন্টে transition নেই (আগে কিছু নেই)",
    rule: "ফ্রেম 90, 95 → outgoing null",
    run: () => {
      const a = planStage(SEGS, ["a", "b", "a"], 90);
      const b = planStage(SEGS, ["a", "b", "a"], 95);
      return first(expect(a !== null && a.outgoing === null && a.progress === 0, "90"), expect(b !== null && b.outgoing === null, "95"));
    },
  },
  {
    id: "plan-diff",
    title: "ভিন্ন SVG: শুরুতে 0, মাঝে 0.5, 12 ফ্রেম পরে শেষ",
    rule: "সেগমেন্ট ২ শুরু 150: ফ্রেম 150 → 0; 156 → 0.5; 161 → <1; 162 → নেই",
    run: () => {
      const n = ["a", "b", "a"];
      const p0 = planStage(SEGS, n, 150);
      const p6 = planStage(SEGS, n, 156);
      const p11 = planStage(SEGS, n, 161);
      const p12 = planStage(SEGS, n, 162);
      return first(
        expect(p0 !== null && p0.outgoing !== null && p0.progress === 0, "150: outgoing আছে, progress 0"),
        expect(p6 !== null && p6.outgoing !== null && near(p6.progress, 0.5), "156: progress 0.5"),
        expect(p11 !== null && p11.outgoing !== null && p11.progress < 1, "161: <1"),
        expect(p12 !== null && p12.outgoing === null && p12.progress === 0, "162: transition শেষ"),
        expect(p6 !== null && p6.active === 1 && p6.incoming.name === "b" && p6.outgoing?.name === "a", "নাম: নতুন b, পুরনো a"),
      );
    },
  },
  {
    id: "plan-same",
    title: "পাশাপাশি একই SVG: transition নেই, অ্যানিমেশন আবার শুরু হয় না",
    rule: "[a, a, b]: ফ্রেম 153 → outgoing null, স্থানীয় ফ্রেম = 153 − 90 = 63, run = 0",
    run: () => {
      const p = planStage(SEGS, ["a", "a", "b"], 153);
      return first(
        expect(p !== null && p.outgoing === null, "outgoing null"),
        expect(p !== null && p.incoming.run === 0 && p.incoming.localFrame === 63, `স্থানীয় ফ্রেম ${p?.incoming.localFrame} (চাই 63, run ${p?.incoming.run})`),
        expect(p !== null && p.active === 1, "active = 1"),
      );
    },
  },
  {
    id: "run-start",
    title: "একই SVG-র লম্বা ধারা: run-এর শুরু প্রথম সেগমেন্টে; null-null একই ধরা হয়",
    rule: "[a,a,a,b] → 0; [x,null,null] → 1; একক → নিজে",
    run: () =>
      first(
        expect(runStartIndex(["a", "a", "a", "b"], 2) === 0, "a a a"),
        expect(runStartIndex(["a", "a", "a", "b"], 3) === 3, "b একা"),
        expect(runStartIndex(["x", null, null], 2) === 1, "null null"),
        expect(runStartIndex(["a"], 0) === 0, "একক"),
        (() => {
          const p = planStage(SEGS, ["x", null, null], 215);
          return expect(p !== null && p.outgoing === null && p.incoming.run === 1, "null-null → transition নেই");
        })(),
      ),
  },
  {
    id: "plan-short",
    title: "ছোট সেগমেন্ট: transition ⌊12 ÷ 3⌋ = 4 ফ্রেমে ছোট হয়",
    rule: "সেগমেন্ট ২ = 12 ফ্রেম: ফ্রেম +2 → 0.5; +4 → শেষ",
    run: () => {
      const s = [seg(90, 150), seg(150, 162)];
      const n = ["a", "b"];
      const a = planStage(s, n, 152);
      const b = planStage(s, n, 154);
      return first(
        expect(a !== null && a.frames === 4 && near(a.progress, 0.5), `+2: frames ${a?.frames}, progress ${a?.progress}`),
        expect(b !== null && b.outgoing === null, "+4: শেষ"),
      );
    },
  },
  {
    id: "plan-tiny",
    title: "খুব ছোট সেগমেন্ট (2 ফ্রেম): transition নেই, সরাসরি বদল",
    rule: "⌊2 ÷ 3⌋ = 0",
    run: () => {
      const p = planStage([seg(90, 150), seg(150, 152)], ["a", "b"], 150);
      return first(expect(p !== null && p.frames === 0 && p.outgoing === null, "frames 0, outgoing null"), expect(p !== null && p.active === 1, "active 1"));
    },
  },
  {
    id: "plan-gap",
    title: "ফাঁকে আগেরটা থাকে, transition নেই; পুরনো স্তরের ফ্রেম থামে না",
    rule: "সেগমেন্ট 90–135, 150–195: ফ্রেম 142 → active 0, outgoing null; ফ্রেম 152 → পুরনোর স্থানীয় ফ্রেম 62 (শেষের পরেও চলছে)",
    run: () => {
      const s = [seg(90, 135), seg(150, 195)];
      const g = planStage(s, ["a", "b"], 142);
      const t = planStage(s, ["a", "b"], 152);
      return first(
        expect(g !== null && g.active === 0 && g.outgoing === null, "ফাঁকে আগেরটা"),
        expect(t !== null && t.outgoing !== null && t.outgoing.localFrame === 62, `পুরনোর ফ্রেম ${t?.outgoing?.localFrame} (চাই 62)`),
        expect(t !== null && t.outgoing !== null && t.outgoing.run !== t.incoming.run, "দুই স্তরের run (prefix) আলাদা"),
      );
    },
  },
  {
    id: "looks",
    title: "চেহারা: পুরনো 1→0 / ×1.06 / ঝাপসা বাড়ে; নতুন 0→1 / ×0.94→1 / ঝাপসা কমে",
    rule: "progress 0, 0.5, 1; ঝাপসা সর্বোচ্চ 6 × unit; মাঝে দুটোই আধা-স্বচ্ছ",
    run: () => {
      const a = crossFadeLooks(0, 1);
      const m = crossFadeLooks(0.5, 1);
      const z = crossFadeLooks(1, 1);
      return first(
        expect(near(a.outgoing.opacity, 1) && near(a.outgoing.scale, 1) && near(a.outgoing.blur, 0), "0: পুরনো পূর্ণ, ঝাপসা 0"),
        expect(near(a.incoming.opacity, 0) && near(a.incoming.scale, 0.94) && near(a.incoming.blur, BLUR_UNITS), "0: নতুন অদৃশ্য, 0.94, ঝাপসা সর্বোচ্চ"),
        expect(near(z.outgoing.opacity, 0) && near(z.outgoing.scale, 1.06) && near(z.outgoing.blur, BLUR_UNITS), "1: পুরনো অদৃশ্য"),
        expect(near(z.incoming.opacity, 1) && near(z.incoming.scale, 1) && near(z.incoming.blur, 0), "1: নতুন পূর্ণ, ঝাপসা 0"),
        expect(m.outgoing.opacity > 0.4 && m.outgoing.opacity < 0.6 && m.incoming.opacity > 0.4 && m.incoming.opacity < 0.6, "0.5: দুটোই আধা-স্বচ্ছ"),
        expect(near(m.outgoing.opacity + m.incoming.opacity, 1), "opacity-র যোগফল 1"),
      );
    },
  },
  {
    id: "looks-scale4k",
    title: "চেহারা: ঝাপসা unit-এর সমানুপাতিক (4K = ২×); progress/unit সংখ্যা না হলে নিরাপদ",
    rule: "unit 1 vs 2; NaN",
    run: () => {
      const a = crossFadeLooks(0.3, 1);
      const b = crossFadeLooks(0.3, 2);
      const bad = crossFadeLooks(Number.NaN, Number.NaN);
      return first(
        expect(near(a.outgoing.blur * 2, b.outgoing.blur) && near(a.incoming.blur * 2, b.incoming.blur), "ঝাপসা ২×"),
        expect(Number.isFinite(bad.outgoing.opacity) && bad.outgoing.blur === 0 && bad.incoming.blur === 0, "NaN নিরাপদ"),
      );
    },
  },
  {
    id: "never-throws",
    title: "আজেবাজে ইনপুটে কখনো throw করে না",
    rule: "NaN ফ্রেম, উল্টো সেগমেন্ট, undefined নাম",
    run: () => {
      try {
        planStage(SEGS, ["a", "b", "c"], Number.NaN);
        planStage([seg(10, 5)], ["a"], 7);
        planStage(SEGS, [undefined as unknown as string, "b", "c"], 160);
        runStartIndex([], 3);
        return null;
      } catch (e) {
        return `throw: ${String(e)}`;
      }
    },
  },
];

export const TRANSITION_CASE_COUNT = DEFS.length;

export function runTransitionCases(): TransitionCaseOutcome[] {
  return DEFS.map((d) => {
    try {
      const msg = d.run();
      return { id: d.id, title: d.title, rule: d.rule, ok: msg === null, detail: msg ?? "" };
    } catch (e) {
      return { id: d.id, title: d.title, rule: d.rule, ok: false, detail: `কেস নিজেই throw করেছে: ${String(e)}` };
    }
  });
}
