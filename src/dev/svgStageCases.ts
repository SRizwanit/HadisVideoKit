import { getThemeColors, parseColor } from "../themes";
import type { ThemeId } from "../types";
import { buildFrameSegments, computeTiming } from "../lib/timing";
import type { FrameSegment } from "../lib/timing";
import {
  DISC_ALPHA_DAY,
  DISC_ALPHA_NIGHT,
  FLOAT_PERIOD_FRAMES,
  FLOAT_UNITS,
  GLOW_ALPHA_DAY,
  GLOW_ALPHA_NIGHT,
  activeSegmentIndex,
  floatOffset,
  segmentLocalFrame,
  stageGlow,
} from "../lib/svgStage";

/**
 * Part 9K-1 (dev): svgStage.ts-এর পরীক্ষার কেস — React ছাড়া, তাই সাধারণ Node-এও চলে।
 * 9K-4-এর `SvgStagePreview` এই কেসগুলো সারি হিসেবে আঁকবে।
 * প্রতিটা কেস `null` ফেরালে ✅, বার্তা ফেরালে ❌ (বার্তা = কী মেলেনি)। `runStageCases()` কখনো throw করে না।
 */

export type StageCaseOutcome = {
  id: string;
  title: string;
  ok: boolean;
  /** ব্যর্থ হলে কী মেলেনি (✅ হলে খালি) */
  detail: string;
  /** কেসটা কোন নিয়ম পরীক্ষা করে (ছবিতে দেখানোর জন্য) */
  rule: string;
};

type Def = { id: string; title: string; rule: string; run: () => string | null };

const THEME_LIST: ThemeId[] = ["emerald", "navy", "greenDayNight"];

/** index অনুযায়ী ছোট সেগমেন্ট বানায় (শুধু ফ্রেম-ক্ষেত্র লাগে) */
const seg = (index: number, startFrame: number, endFrame: number): FrameSegment => ({
  index,
  id: index + 1,
  startFrame,
  endFrame,
  text: `s${index}`,
  words: [],
});

const TWO: FrameSegment[] = [seg(0, 10, 40), seg(1, 50, 80)];

const expectEq = (what: string, got: unknown, want: unknown): string | null =>
  got === want ? null : `${what}: পাওয়া ${String(got)}, প্রত্যাশা ${String(want)}`;

const firstFail = (...checks: (string | null)[]): string | null => checks.find((c) => c !== null) ?? null;

const hasNaN = (s: string): boolean => /NaN|Infinity|undefined/.test(s);

const rgbOf = (s: string): [number, number, number] => {
  const m = s.match(/(\d+)\D+(\d+)\D+(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : [-1, -1, -1];
};

const DEFS: Def[] = [
  {
    id: "seg-inside",
    title: "সেগমেন্টের ভেতরে ফ্রেম → সেই সেগমেন্ট",
    rule: "সক্রিয় সেগমেন্ট",
    run: () =>
      firstFail(
        expectEq("ফ্রেম 10 (শুরু)", activeSegmentIndex(TWO, 10), 0),
        expectEq("ফ্রেম 20", activeSegmentIndex(TWO, 20), 0),
        expectEq("ফ্রেম 39 (শেষের এক আগে)", activeSegmentIndex(TWO, 39), 0),
        expectEq("ফ্রেম 50", activeSegmentIndex(TWO, 50), 1),
        expectEq("ফ্রেম 79", activeSegmentIndex(TWO, 79), 1),
      ),
  },
  {
    id: "seg-gap",
    title: "দুই সেগমেন্টের ফাঁকে আগেরটাই থাকে",
    rule: "ফাঁকে আগেরটা",
    run: () =>
      firstFail(
        expectEq("ফ্রেম 40 (প্রথমের শেষ = ফাঁকের শুরু)", activeSegmentIndex(TWO, 40), 0),
        expectEq("ফ্রেম 45", activeSegmentIndex(TWO, 45), 0),
        expectEq("ফ্রেম 49", activeSegmentIndex(TWO, 49), 0),
        expectEq("তিন সেগমেন্ট, দ্বিতীয় ফাঁকে ফ্রেম 95", activeSegmentIndex([...TWO, seg(2, 100, 120)], 95), 1),
      ),
  },
  {
    id: "seg-before-first",
    title: "প্রথম সেগমেন্টের আগে (Intro-তেও) → প্রথমটা",
    rule: "প্রথমের আগে প্রথমটা",
    run: () =>
      firstFail(
        expectEq("ফ্রেম 0", activeSegmentIndex(TWO, 0), 0),
        expectEq("ফ্রেম 9", activeSegmentIndex(TWO, 9), 0),
        expectEq("ফ্রেম -5", activeSegmentIndex(TWO, -5), 0),
      ),
  },
  {
    id: "seg-after-last",
    title: "শেষ সেগমেন্টের পরে (Outro-তেও) → শেষটা",
    rule: "শেষের পরে শেষটা",
    run: () =>
      firstFail(
        expectEq("ফ্রেম 80 (শেষ = বাদ)", activeSegmentIndex(TWO, 80), 1),
        expectEq("ফ্রেম 500", activeSegmentIndex(TWO, 500), 1),
      ),
  },
  {
    id: "seg-none",
    title: "সেগমেন্ট নেই → −১, ক্র্যাশ নেই",
    rule: "খালি তালিকা",
    run: () =>
      firstFail(
        expectEq("[]", activeSegmentIndex([], 30), -1),
        expectEq("অ্যারে নয়", activeSegmentIndex(undefined as unknown as FrameSegment[], 30), -1),
      ),
  },
  {
    id: "seg-single",
    title: "একটাই সেগমেন্ট: আগে, ভেতরে, পরে — সবখানে ০",
    rule: "একক সেগমেন্ট",
    run: () => {
      const one = [seg(0, 30, 60)];
      return firstFail(
        expectEq("ফ্রেম 0", activeSegmentIndex(one, 0), 0),
        expectEq("ফ্রেম 45", activeSegmentIndex(one, 45), 0),
        expectEq("ফ্রেম 900", activeSegmentIndex(one, 900), 0),
      );
    },
  },
  {
    id: "seg-nonfinite",
    title: "ফ্রেম NaN/Infinity/অ-সংখ্যা → নিরাপদ (০ ধরে প্রথমটা)",
    rule: "নিরাপদ ইনপুট",
    run: () =>
      firstFail(
        expectEq("NaN", activeSegmentIndex(TWO, Number.NaN), 0),
        expectEq("Infinity", activeSegmentIndex(TWO, Number.POSITIVE_INFINITY), 0),
        expectEq("string", activeSegmentIndex(TWO, "x" as unknown as number), 0),
      ),
  },
  {
    id: "seg-overlap",
    title: "দুই সেগমেন্ট ওভারল্যাপ করলে প্রথমটা",
    rule: "ওভারল্যাপ",
    run: () => expectEq("ফ্রেম 40", activeSegmentIndex([seg(0, 0, 50), seg(1, 30, 80)], 40), 0),
  },
  {
    id: "local-basic",
    title: "স্থানীয় ফ্রেম = ফ্রেম − সেগমেন্টের শুরু",
    rule: "স্থানীয় ফ্রেম",
    run: () =>
      firstFail(
        expectEq("শুরুতেই", segmentLocalFrame(10, 10), 0),
        expectEq("শুরুর ১৫ পরে", segmentLocalFrame(25, 10), 15),
        expectEq("শুরুর আগে (ঋণাত্মক → ০)", segmentLocalFrame(5, 10), 0),
      ),
  },
  {
    id: "local-safe",
    title: "স্থানীয় ফ্রেম: NaN/Infinity/অ-সংখ্যা → ০",
    rule: "নিরাপদ ইনপুট",
    run: () =>
      firstFail(
        expectEq("NaN ফ্রেম", segmentLocalFrame(Number.NaN, 10), 0),
        expectEq("Infinity ফ্রেম", segmentLocalFrame(Number.POSITIVE_INFINITY, 10), 0),
        expectEq("NaN শুরু", segmentLocalFrame(25, Number.NaN), 25),
        expectEq("অ-সংখ্যা", segmentLocalFrame("a" as unknown as number, "b" as unknown as number), 0),
      ),
  },
  {
    id: "local-real",
    title: "আসল buildFrameSegments: সেগমেন্টের শুরুতে স্থানীয় ফ্রেম ঠিক ০",
    rule: "সেগমেন্টের শুরু = ০",
    run: () => {
      const timing = computeTiming({ introSeconds: 3, outroSeconds: 4, audioSeconds: 6 });
      const segs = buildFrameSegments(
        {
          segments: [
            { id: 1, start: 0, end: 2, text: "এক দুই" },
            { id: 2, start: 3, end: 5, text: "তিন" },
          ],
        },
        timing,
      );
      const a = segs[0].startFrame;
      const b = segs[1].startFrame;
      return firstFail(
        expectEq("প্রথম শুরু = Intro (90)", a, timing.introFrames),
        expectEq("প্রথম শুরুর ফ্রেমে সক্রিয়", activeSegmentIndex(segs, a), 0),
        expectEq("প্রথমের স্থানীয় ফ্রেম", segmentLocalFrame(a, segs[0].startFrame), 0),
        expectEq("দ্বিতীয় শুরুর ফ্রেমে সক্রিয়", activeSegmentIndex(segs, b), 1),
        expectEq("দ্বিতীয়ের স্থানীয় ফ্রেম", segmentLocalFrame(b, segs[1].startFrame), 0),
        expectEq("দ্বিতীয়ের ১২ ফ্রেম পরে", segmentLocalFrame(b + 12, segs[1].startFrame), 12),
        expectEq("Intro-তে (ফ্রেম 0) প্রথমটা", activeSegmentIndex(segs, 0), 0),
        expectEq("Outro-তে শেষটা", activeSegmentIndex(segs, timing.totalFrames - 1), 1),
      );
    },
  },
  {
    id: "float-bounds",
    title: "ভাসা সবসময় ±৬ × unit-এর ভেতরে (unit 1 ও 2.5, ফ্রেম ০…৬০০)",
    rule: "±৬ ইউনিট",
    run: () => {
      for (const unit of [1, 2.5]) {
        const max = FLOAT_UNITS * unit + 1e-9;
        for (let f = 0; f <= 600; f++) {
          const v = floatOffset(f, unit);
          if (Math.abs(v) > max) return `ফ্রেম ${f}, unit ${unit}: ${v} সীমার বাইরে`;
        }
      }
      // চূড়া সত্যিই ছোঁয়া হয় (¼ পর্যায়ে = সর্বোচ্চ)
      const peak = floatOffset(FLOAT_PERIOD_FRAMES / 4, 1);
      return Math.abs(peak - FLOAT_UNITS) < 1e-9 ? null : `চূড়া ${peak}, প্রত্যাশা ${FLOAT_UNITS}`;
    },
  },
  {
    id: "float-deterministic",
    title: "ভাসা: ফ্রেম ০-তে ০, একই ফ্রেম = একই ফল, পর্যায় ঠিক ১২০ ফ্রেম",
    rule: "নির্ধারিত ফল",
    run: () =>
      firstFail(
        expectEq("ফ্রেম 0", floatOffset(0, 1), 0),
        expectEq("একই ফ্রেম দুইবার", floatOffset(37, 2) === floatOffset(37, 2), true),
        Math.abs(floatOffset(37, 2) - floatOffset(37 + FLOAT_PERIOD_FRAMES, 2)) < 1e-9
          ? null
          : "পর্যায়কাল ১২০ ফ্রেম নয়",
        // সত্যিই নড়ে: দুই আলাদা ফ্রেমে আলাদা
        floatOffset(10, 1) !== floatOffset(20, 1) ? null : "ফ্রেম 10 ও 20-তে একই — নড়ছে না",
      ),
  },
  {
    id: "float-scale",
    title: "ভাসা unit-এর সমানুপাতিক: 4K (unit 2) = HD (unit 1)-এর ঠিক ২×",
    rule: "4K-তে ২×",
    run: () => {
      for (const f of [0, 7, 30, 61, 99, 250]) {
        const hd = floatOffset(f, 1);
        const k4 = floatOffset(f, 2);
        if (Math.abs(k4 - 2 * hd) > 1e-9) return `ফ্রেম ${f}: ${k4} ≠ 2 × ${hd}`;
      }
      return null;
    },
  },
  {
    id: "float-safe",
    title: "ভাসা: ফ্রেম/unit NaN, ০, ঋণাত্মক, অ-সংখ্যা → ০ (ক্র্যাশ নেই)",
    rule: "নিরাপদ ইনপুট",
    run: () =>
      firstFail(
        expectEq("ফ্রেম NaN", floatOffset(Number.NaN, 1), 0),
        expectEq("ফ্রেম Infinity", floatOffset(Number.POSITIVE_INFINITY, 1), 0),
        expectEq("unit 0", floatOffset(30, 0), 0),
        expectEq("unit −1", floatOffset(30, -1), 0),
        expectEq("unit NaN", floatOffset(30, Number.NaN), 0),
        expectEq("অ-সংখ্যা", floatOffset("a" as unknown as number, "b" as unknown as number), 0),
      ),
  },
  {
    id: "glow-day-night",
    title: "দিনে ডিস্ক গাঢ়, রাতে glow বেশি উজ্জ্বল (৩ থিম)",
    rule: "দিন/রাত",
    run: () => {
      for (const t of THEME_LIST) {
        const day = stageGlow(t, 0, 800);
        const night = stageGlow(t, 1, 800);
        if (!(day.discAlpha > night.discAlpha)) return `${t}: ডিস্ক দিনে (${day.discAlpha}) রাতের (${night.discAlpha}) চেয়ে গাঢ় নয়`;
        if (!(night.glowAlpha > day.glowAlpha)) return `${t}: glow রাতে (${night.glowAlpha}) দিনের (${day.glowAlpha}) চেয়ে উজ্জ্বল নয়`;
      }
      const d = stageGlow("emerald", 0, 800);
      const n = stageGlow("emerald", 1, 800);
      return firstFail(
        expectEq("দিনের glowAlpha", d.glowAlpha, GLOW_ALPHA_DAY),
        expectEq("রাতের glowAlpha", n.glowAlpha, GLOW_ALPHA_NIGHT),
        expectEq("দিনের discAlpha", d.discAlpha, DISC_ALPHA_DAY),
        expectEq("রাতের discAlpha", n.discAlpha, DISC_ALPHA_NIGHT),
      );
    },
  },
  {
    id: "glow-monotonic",
    title: "nightFactor বাড়লে glow ধাপে ধাপে বাড়ে, ডিস্ক কমে (০ → ১)",
    rule: "মসৃণ বদল",
    run: () => {
      let prevGlow = -1;
      let prevDisc = 2;
      for (let i = 0; i <= 20; i++) {
        const g = stageGlow("greenDayNight", i / 20, 800);
        if (g.glowAlpha < prevGlow) return `nf ${i / 20}: glow কমেছে`;
        if (g.discAlpha > prevDisc) return `nf ${i / 20}: ডিস্ক বেড়েছে`;
        prevGlow = g.glowAlpha;
        prevDisc = g.discAlpha;
      }
      return null;
    },
  },
  {
    id: "glow-themes-valid",
    title: "৩ থিম × nightFactor ০/০.৫/১: স্বচ্ছতা ০…১, CSS-এ NaN নেই",
    rule: "বৈধ CSS",
    run: () => {
      for (const t of THEME_LIST) {
        for (const nf of [0, 0.5, 1]) {
          const g = stageGlow(t, nf, 826);
          for (const a of [g.glowAlpha, g.discAlpha]) {
            if (!(a >= 0 && a <= 1)) return `${t}/${nf}: স্বচ্ছতা ${a} সীমার বাইরে`;
          }
          if (!g.glowBackground.startsWith("radial-gradient(circle closest-side,")) return `${t}/${nf}: glow CSS ভুল`;
          if (hasNaN(g.glowBackground) || hasNaN(g.discBackground) || hasNaN(g.glowColor)) return `${t}/${nf}: CSS-এ NaN`;
          if (!/^rgba\(\d+, \d+, \d+, [\d.]+\)$/.test(g.discBackground)) return `${t}/${nf}: ডিস্ক CSS ভুল: ${g.discBackground}`;
        }
      }
      return null;
    },
  },
  {
    id: "glow-color-theme",
    title: "glow-এর রঙ থিমের `glow` রঙ থেকেই (static থিমে দিন-রাতে একই)",
    rule: "থিমের রঙ",
    run: () => {
      for (const t of ["emerald", "navy"] as ThemeId[]) {
        const p = parseColor(getThemeColors(t, 0).glow);
        const got = rgbOf(stageGlow(t, 0.7, 800).glowColor);
        if (got[0] !== Math.round(p.r) || got[1] !== Math.round(p.g) || got[2] !== Math.round(p.b)) {
          return `${t}: glow রঙ ${got.join(",")} ≠ থিমের ${Math.round(p.r)},${Math.round(p.g)},${Math.round(p.b)}`;
        }
      }
      // দুই থিমের glow রঙ আলাদা (থিম সত্যিই প্রভাব ফেলছে)
      return stageGlow("emerald", 0, 800).glowColor !== stageGlow("navy", 0, 800).glowColor ? null : "emerald ও navy-র glow একই";
    },
  },
  {
    id: "glow-nf-clamp",
    title: "nightFactor ০…১-এ আটকানো: −১ = ০, ২ = ১, NaN = ০",
    rule: "clamp",
    run: () => {
      const same = (a: number, b: number) => JSON.stringify(stageGlow("greenDayNight", a, 800)) === JSON.stringify(stageGlow("greenDayNight", b, 800));
      return firstFail(
        same(-1, 0) ? null : "−১ ≠ ০",
        same(2, 1) ? null : "২ ≠ ১",
        same(Number.NaN, 0) ? null : "NaN ≠ ০",
        same(Number.POSITIVE_INFINITY, 0) ? null : "Infinity ≠ ০ (সংখ্যা না হলে ০)",
        expectEq("clamp-করা মান ফেরত", stageGlow("emerald", 5, 800).nightFactor, 1),
      );
    },
  },
  {
    id: "glow-size-scale",
    title: "ব্যাসার্ধ size-এর সমানুপাতিক: 4K (size ×২) = HD-র ঠিক ২×",
    rule: "4K-তে ২×",
    run: () => {
      const hd = stageGlow("emerald", 0.3, 826);
      const k4 = stageGlow("emerald", 0.3, 1652);
      return firstFail(
        expectEq("glow ব্যাসার্ধ", k4.glowRadius, 2 * hd.glowRadius),
        expectEq("ডিস্ক ব্যাসার্ধ", k4.discRadius, 2 * hd.discRadius),
      );
    },
  },
  {
    id: "glow-radius-order",
    title: "ডিস্ক বাক্সের ভেতরে, glow বাক্সের বাইরেও ছড়ায়",
    rule: "ব্যাসার্ধের ক্রম",
    run: () => {
      for (const size of [826, 768, 1652, 1536]) {
        const g = stageGlow("navy", 0.5, size);
        if (!(g.discRadius <= size / 2)) return `size ${size}: ডিস্ক (${g.discRadius}) বাক্সের (${size / 2}) বাইরে`;
        if (!(g.glowRadius >= size / 2)) return `size ${size}: glow (${g.glowRadius}) বাক্সের চেয়ে ছোট`;
        if (!(g.glowRadius > g.discRadius)) return `size ${size}: glow ডিস্কের চেয়ে বড় নয়`;
      }
      return null;
    },
  },
  {
    id: "glow-size-safe",
    title: "size NaN/ঋণাত্মক/অ-সংখ্যা → ব্যাসার্ধ ০, CSS বৈধ",
    rule: "নিরাপদ ইনপুট",
    run: () => {
      for (const size of [Number.NaN, -50, Number.POSITIVE_INFINITY, "x" as unknown as number]) {
        const g = stageGlow("emerald", 0.4, size);
        if (g.glowRadius !== 0 || g.discRadius !== 0) return `size ${String(size)}: ব্যাসার্ধ ০ নয়`;
        if (hasNaN(g.glowBackground) || hasNaN(g.discBackground)) return `size ${String(size)}: CSS-এ NaN`;
      }
      return null;
    },
  },
  {
    id: "never-throws",
    title: "উল্টোপাল্টা ইনপুটেও কোনো ফাংশন throw করে না",
    rule: "কখনো throw নয়",
    run: () => {
      const junk: unknown[] = [undefined, null, "x", {}, [], Number.NaN, -1, 1e308];
      try {
        for (const j of junk) {
          activeSegmentIndex(j as FrameSegment[], j as number);
          segmentLocalFrame(j as number, j as number);
          floatOffset(j as number, j as number);
          stageGlow(j as ThemeId, j as number, j as number);
        }
      } catch (e) {
        return `throw করেছে: ${e instanceof Error ? e.message : String(e)}`;
      }
      return null;
    },
  },
];

export const STAGE_CASE_COUNT = DEFS.length;

/** সব কেস চালায়; একটা ভাঙলে সেটা ❌ (কারণসহ), বাকিরা চলে — কখনো throw করে না */
export function runStageCases(): StageCaseOutcome[] {
  return DEFS.map((d) => {
    try {
      const err = d.run();
      return { id: d.id, title: d.title, rule: d.rule, ok: err === null, detail: err ?? "" };
    } catch (e) {
      return {
        id: d.id,
        title: d.title,
        rule: d.rule,
        ok: false,
        detail: `কেস নিজেই throw করেছে: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  });
}
