import { DEFAULT_OUTRO_SECONDS, FPS, OUTRO_TEXT, TRANSITION_FRAMES } from "../constants";
import {
  BADGE_ASPECT,
  BADGE_BOUNCE_FRAMES,
  BADGE_BOUNCE_PEAK,
  BADGE_MAX_SCALE,
  BADGE_PNG_HEIGHT,
  BADGE_PNG_WIDTH,
  BADGE_SCALE_FROM,
  BADGE_WIDTH_UNITS,
  CLEAR_SPACE_RATIO,
  OUTRO_BASE_FRAMES,
  OUTRO_MIN_ANIMATED_FRAMES,
  OUTRO_STEPS,
  PULSE_MAX_SCALE,
  PULSE_PERIOD_FRAMES,
  SHINE_FRAMES,
  SHINE_PEAK_OPACITY,
  SPRING_SETTLE_FRAMES,
  TAP_BOB_UNITS,
  TAP_PERIOD_FRAMES,
  badgeBox,
  badgeIsSharp,
  badgeSize,
  outroLayout,
  outroSpeed,
  planOutro,
  pulseScale,
  sceneFadeFrames,
  scaledBox,
  settleSpring,
  shineCenter,
  shineLook,
  tapLook,
  typewriterCount,
  typewriterText,
  typewriterUnits,
} from "../lib/outroPlan";
import type { OutroLayout, OutroPlan } from "../lib/outroPlan";
import { computeLayout } from "../lib/useLayout";
import type { Box, Layout } from "../lib/useLayout";

/**
 * Part 12A (dev): outroPlan.ts-এর পরীক্ষার কেস — React ছাড়া, তাই সাধারণ Node-এও চলে।
 * `OutroPreview` (12E) এগুলো সারি হিসেবে আঁকবে। কেস `null` ফেরালে ✅, বার্তা ফেরালে ❌। `runOutroCases()` কখনো throw করে না।
 */

export type OutroCaseOutcome = { id: string; title: string; ok: boolean; detail: string; rule: string };
type Def = { id: string; title: string; rule: string; run: () => string | null };

// ---------- সহায়ক ----------
const expectEq = (what: string, got: unknown, want: unknown): string | null =>
  got === want ? null : `${what}: পাওয়া ${String(got)}, প্রত্যাশা ${String(want)}`;
const near = (what: string, got: number, want: number, tol = 1e-9): string | null =>
  Math.abs(got - want) <= tol ? null : `${what}: পাওয়া ${got}, প্রত্যাশা ${want} ± ${tol}`;
const firstFail = (...checks: (string | null)[]): string | null => checks.find((c) => c !== null) ?? null;
const arrEq = (what: string, got: readonly string[], want: readonly string[]): string | null =>
  JSON.stringify(got) === JSON.stringify(want) ? null : `${what}: পাওয়া ${JSON.stringify(got)}, প্রত্যাশা ${JSON.stringify(want)}`;

const plan = (frame: number, n: number): OutroPlan => {
  const p = planOutro(frame, n);
  if (!p) throw new Error(`planOutro(${frame}, ${n}) = null`);
  return p;
};

/** অবজেক্টের ভেতরের সব সংখ্যা (গভীরে) — NaN/Infinity ধরতে */
function badNumber(v: unknown, path = ""): string | null {
  if (typeof v === "number") return Number.isFinite(v) ? null : `${path} = ${v}`;
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const r = badNumber(v[i], `${path}[${i}]`);
      if (r) return r;
    }
    return null;
  }
  if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      const r = badNumber(x, path ? `${path}.${k}` : k);
      if (r) return r;
    }
  }
  return null;
}

const SIZES = [
  { id: "পোর্ট্রেট HD 1080×1920", w: 1080, h: 1920 },
  { id: "ল্যান্ডস্কেপ HD 1920×1080", w: 1920, h: 1080 },
  { id: "পোর্ট্রেট 4K 2160×3840", w: 2160, h: 3840 },
  { id: "ল্যান্ডস্কেপ 4K 3840×2160", w: 3840, h: 2160 },
] as const;

const layoutAt = (w: number, h: number): { layout: Layout; o: OutroLayout } => {
  const layout = computeLayout(w, h);
  return { layout, o: outroLayout(layout) };
};

const EPS = 1e-6;
const inside = (inner: Box, outer: Box, eps = EPS): boolean =>
  inner.x >= outer.x - eps &&
  inner.y >= outer.y - eps &&
  inner.x + inner.width <= outer.x + outer.width + eps &&
  inner.y + inner.height <= outer.y + outer.height + eps;
const overlaps = (a: Box, b: Box, eps = EPS): boolean =>
  a.x < b.x + b.width - eps && b.x < a.x + a.width - eps && a.y < b.y + b.height - eps && b.y < a.y + a.height - eps;

const contentBoxes = (o: OutroLayout): { name: string; box: Box }[] => [
  { name: "logo", box: { x: o.logo.x, y: o.logo.y, width: o.logo.size, height: o.logo.size } },
  { name: "name", box: o.name },
  { name: "text", box: o.text },
  { name: "badge.outer", box: o.badge.outer },
  { name: "tap", box: o.tap },
];

function flat(v: unknown, prefix = "", out: Record<string, number> = {}): Record<string, number> {
  if (typeof v === "number") out[prefix] = v;
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) flat(x, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

/** পরীক্ষার বাংলা নমুনা: যুক্তাক্ষর, র-ফলা, য-ফলা, ZWJ */
const ZWJ = "\u200D";
const ZWNJ = "\u200C";
const VIRAMA = "\u09CD";

const defs: Def[] = [
  // ---------- সময়সূচি ও সংকোচন ----------
  {
    id: "steps-order",
    title: "ধাপের ক্রম ঠিক: লোগো → নাম → লেখা → ব্যাজ → shine → pulse → ইঙ্গিত",
    rule: "logo < nameFirst < text < badge < shine < pulse < tap · লেখা শেষ ≤ ব্যাজ শুরু · pulse = ব্যাজ + bounce · ক্রম শেষ ≤ ফেড-আউট শুরু (১০৮)",
    run: () => {
      const s = OUTRO_STEPS;
      const order = [s.logo, s.nameFirst, s.text, s.badge, s.shine, s.pulse, s.tap];
      for (let i = 1; i < order.length; i++) if (!(order[i] > order[i - 1])) return `ধাপ ${i}: ${order[i]} ≤ ${order[i - 1]}`;
      return firstFail(
        s.text + s.textFrames <= s.badge ? null : `লেখা শেষ ${s.text + s.textFrames} > ব্যাজ শুরু ${s.badge}`,
        expectEq("pulse শুরু", s.pulse, s.badge + BADGE_BOUNCE_FRAMES),
        s.shine + SHINE_FRAMES <= OUTRO_BASE_FRAMES - sceneFadeFrames(OUTRO_BASE_FRAMES)
          ? null
          : `shine শেষ ${s.shine + SHINE_FRAMES} ফেড-আউটের পরে`,
        expectEq("OUTRO_BASE_FRAMES", OUTRO_BASE_FRAMES, DEFAULT_OUTRO_SECONDS * FPS),
        expectEq("OUTRO_BASE_FRAMES = 120", OUTRO_BASE_FRAMES, 120),
      );
    },
  },
  {
    id: "speed-compression",
    title: "সংকোচন: ৩০/৬০/৯০/১২০/৪৫০ ফ্রেমের Outro",
    rule: "speed = 0.25 / 0.5 / 0.75 / 1 / 1 (১২০-র নিচে চেপে আসে, ওপরে স্বাভাবিক গতি)",
    run: () =>
      firstFail(
        near("speed(30)", outroSpeed(30), 0.25),
        near("speed(60)", outroSpeed(60), 0.5),
        near("speed(90)", outroSpeed(90), 0.75),
        near("speed(120)", outroSpeed(120), 1),
        near("speed(450)", outroSpeed(450), 1),
      ),
  },
  {
    id: "speed-bad",
    title: "Outro ০/নেগেটিভ/NaN/অসংখ্যা হলে গতি ০ ও কিছুই আঁকা হয় না (null)",
    rule: "outroSpeed(0, −5, NaN, ∞) = 0 · planOutro(f, 0/−5/NaN/∞/undefined) = null",
    run: () => {
      const bad: unknown[] = [0, -5, Number.NaN, Number.POSITIVE_INFINITY, undefined, null, "120"];
      for (const b of bad) {
        const sp = outroSpeed(b as number);
        if (sp !== 0) return `outroSpeed(${String(b)}) = ${sp}`;
        if (planOutro(10, b as number) !== null) return `planOutro(10, ${String(b)}) null নয়`;
      }
      return null;
    },
  },
  {
    id: "frame-zero",
    title: "ফ্রেম ০-তে কিছুই দেখা যায় না (সিন, লোগো, নাম, লেখা, ব্যাজ, shine, ইঙ্গিত)",
    rule: "plan(0, 120): সিন/লোগো/নাম/লেখা/ব্যাজ opacity 0 · typed 0 · badge.visible = false · shine নিষ্ক্রিয় · pulse 1",
    run: () => {
      const p = plan(0, 120);
      return firstFail(
        expectEq("scene.opacity", p.scene.opacity, 0),
        expectEq("logo.opacity", p.logo.opacity, 0),
        expectEq("name[0].opacity", p.name[0].opacity, 0),
        expectEq("name[1].opacity", p.name[1].opacity, 0),
        expectEq("text.opacity", p.text.opacity, 0),
        expectEq("text.typed", p.text.typed, 0),
        expectEq("badge.visible", p.badge.visible, false),
        expectEq("badge.opacity", p.badge.opacity, 0),
        expectEq("shine.active", p.shine.active, false),
        expectEq("tap.opacity", p.tap.opacity, 0),
        expectEq("pulse", p.pulse, 1),
        expectEq("typewriter(0)", typewriterText(OUTRO_TEXT, p.text.typed), ""),
      );
    },
  },
  {
    id: "frame-safe",
    title: "ফ্রেম NaN/নেগেটিভ/অসংখ্যা/undefined হলে ফ্রেম ০-র মতোই — throw নয়, সব সংখ্যা সসীম",
    rule: "plan(NaN | −10 | ∞ | undefined, 120) = plan(0, 120)",
    run: () => {
      const ref = JSON.stringify(plan(0, 120));
      for (const f of [Number.NaN, -10, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, undefined, null]) {
        const p = planOutro(f as number, 120);
        if (!p) return `plan(${String(f)}) = null`;
        const bad = badNumber(p);
        if (bad) return `plan(${String(f)}): ${bad}`;
        if (JSON.stringify(p) !== ref) return `plan(${String(f)}) ≠ plan(0)`;
      }
      return null;
    },
  },
  {
    id: "ranges-all-frames",
    title: "সব ফ্রেমে সব মান সসীম ও সীমার মধ্যে (Outro ১, ৫, ৬, ৩০, ৬০, ৯০, ১২০, ৪৫০)",
    rule: "opacity ০…১ · pulse ১…১.০৬ · shine position ০…১, opacity ≤ শিখর · tap offset ০…১৪ · স্কেল > ০",
    run: () => {
      for (const n of [1, 5, 6, 30, 60, 90, 120, 450]) {
        for (let f = -2; f <= n + 4; f++) {
          const p = plan(f, n);
          const bad = badNumber(p);
          if (bad) return `n=${n} f=${f}: ${bad}`;
          const ops = [p.scene.opacity, p.logo.opacity, p.name[0].opacity, p.name[1].opacity, p.text.opacity, p.badge.opacity, p.tap.opacity, p.shine.opacity / SHINE_PEAK_OPACITY];
          if (ops.some((x) => x < -1e-12 || x > 1 + 1e-12)) return `n=${n} f=${f}: opacity সীমার বাইরে ${JSON.stringify(ops)}`;
          if (p.pulse < 1 - 1e-12 || p.pulse > PULSE_MAX_SCALE + 1e-12) return `n=${n} f=${f}: pulse ${p.pulse}`;
          if (p.shine.position < 0 || p.shine.position > 1) return `n=${n} f=${f}: shine position ${p.shine.position}`;
          if (p.tap.offsetUnits < -1e-12 || p.tap.offsetUnits > TAP_BOB_UNITS + 1e-12) return `n=${n} f=${f}: tap offset ${p.tap.offsetUnits}`;
          if (p.text.typed < 0 || p.text.typed > 1) return `n=${n} f=${f}: typed ${p.text.typed}`;
          if (!(p.logo.scale > 0) || !(p.badge.scale > 0) || !(p.scene.scale >= 1)) return `n=${n} f=${f}: স্কেল ≤ ০`;
        }
      }
      return null;
    },
  },
  {
    id: "deterministic",
    title: "একই ইনপুটে সবসময় একই ফল (Math.random নেই)",
    rule: "planOutro / pulse / shine / tap / layout দুইবার ডাকলে হুবহু সমান",
    run: () => {
      for (let f = 0; f < 130; f += 7) {
        if (JSON.stringify(planOutro(f, 120)) !== JSON.stringify(planOutro(f, 120))) return `plan f=${f} আলাদা`;
      }
      const a = JSON.stringify(layoutAt(1080, 1920).o);
      const b = JSON.stringify(layoutAt(1080, 1920).o);
      return a === b ? null : "layout আলাদা";
    },
  },
  {
    id: "settled-hold",
    title: "লম্বা Outro (৪৫০): ক্রম শেষে সবকিছু ঠিক জায়গায় স্থির (হুবহু ১), shine আর আসে না",
    rule: "ফ্রেম ১৫০…৪২৭: লোগো/নাম/লেখা progress = 1 · ব্যাজ scale = opacity = 1 · shine নিষ্ক্রিয় · সিন opacity = 1 (ফেড-আউটের আগে)",
    run: () => {
      const n = 450;
      const fade = sceneFadeFrames(n);
      for (let f = 150; f < n - fade; f++) {
        const p = plan(f, n);
        const miss = firstFail(
          expectEq(`f${f} logo`, p.logo.progress, 1),
          expectEq(`f${f} logo.scale`, p.logo.scale, 1),
          expectEq(`f${f} name0`, p.name[0].progress, 1),
          expectEq(`f${f} name1`, p.name[1].progress, 1),
          expectEq(`f${f} typed`, p.text.typed, 1),
          expectEq(`f${f} badge.scale`, p.badge.scale, 1),
          expectEq(`f${f} badge.opacity`, p.badge.opacity, 1),
          expectEq(`f${f} shine`, p.shine.active, false),
          expectEq(`f${f} scene`, p.scene.opacity, 1),
          expectEq(`f${f} scene.scale`, p.scene.scale, 1),
        );
        if (miss) return miss;
      }
      return null;
    },
  },
  {
    id: "compressed-completes",
    title: "ছোট Outro (৩০/৬০/৯০) চেপে আসে — শেষ ফ্রেমের আগেই পুরো ক্রম শেষ",
    rule: "শেষ ফ্রেমে (n−1): typed = 1 · ব্যাজ scale = 1 · shine শেষ (position 1, নিষ্ক্রিয়) · লোগো/নাম progress = 1",
    run: () => {
      for (const n of [30, 60, 90]) {
        const p = plan(n - 1, n);
        const miss = firstFail(
          expectEq(`n${n} typed`, p.text.typed, 1),
          expectEq(`n${n} badge.scale`, p.badge.scale, 1),
          expectEq(`n${n} shine.active`, p.shine.active, false),
          expectEq(`n${n} shine.position`, p.shine.position, 1),
          expectEq(`n${n} logo`, p.logo.progress, 1),
          expectEq(`n${n} name1`, p.name[1].progress, 1),
        );
        if (miss) return miss;
        if (!(plan(Math.floor(n * 0.1), n).t < OUTRO_STEPS.badge)) return `n${n}: শুরুতেই ব্যাজ এসে গেছে`;
      }
      return null;
    },
  },
  {
    id: "tiny-static",
    title: "খুব ছোট Outro (১–৫ ফ্রেম): অ্যানিমেশন নেই, পুরো তৈরি দৃশ্য স্থির, ফেড নেই",
    rule: `n < ${OUTRO_MIN_ANIMATED_FRAMES}: isStatic · সিন opacity 1, ফেড 0 · সব progress 1 · ব্যাজ দৃশ্যমান scale 1 · pulse 1 · shine/ইঙ্গিত নেই`,
    run: () => {
      for (let n = 1; n < OUTRO_MIN_ANIMATED_FRAMES; n++) {
        for (let f = 0; f < n; f++) {
          const p = plan(f, n);
          const miss = firstFail(
            expectEq(`n${n} isStatic`, p.isStatic, true),
            expectEq(`n${n} scene.opacity`, p.scene.opacity, 1),
            expectEq(`n${n} fade`, p.scene.fadeFrames, 0),
            expectEq(`n${n} logo`, p.logo.progress, 1),
            expectEq(`n${n} name1`, p.name[1].progress, 1),
            expectEq(`n${n} typed`, p.text.typed, 1),
            expectEq(`n${n} badge.visible`, p.badge.visible, true),
            expectEq(`n${n} badge.scale`, p.badge.scale, 1),
            expectEq(`n${n} badge.opacity`, p.badge.opacity, 1),
            expectEq(`n${n} pulse`, p.pulse, 1),
            expectEq(`n${n} shine`, p.shine.active, false),
            expectEq(`n${n} tap`, p.tap.opacity, 0),
          );
          if (miss) return miss;
        }
      }
      return expectEq("n=6 অ্যানিমেটেড", plan(0, OUTRO_MIN_ANIMATED_FRAMES).isStatic, false);
    },
  },
  // ---------- সিন ফেড ----------
  {
    id: "scene-fade-length",
    title: "সিন ফেডের দৈর্ঘ্য = min(১২, ⌊Outro × ২৫%⌋); ছোট Outro-তে ০",
    rule: "১২০ → ১২ · ৬০ → ১২ · ৩০ → ৭ · ২৪ → ৬ · ৮ → ২ · ৬ → ১ · ৫ → ০ · ০/NaN → ০ · TRANSITION_FRAMES = ১২",
    run: () =>
      firstFail(
        expectEq("TRANSITION_FRAMES", TRANSITION_FRAMES, 12),
        expectEq("120", sceneFadeFrames(120), 12),
        expectEq("450", sceneFadeFrames(450), 12),
        expectEq("60", sceneFadeFrames(60), 12),
        expectEq("30", sceneFadeFrames(30), 7),
        expectEq("24", sceneFadeFrames(24), 6),
        expectEq("8", sceneFadeFrames(8), 2),
        expectEq("6", sceneFadeFrames(6), 1),
        expectEq("5", sceneFadeFrames(5), 0),
        expectEq("0", sceneFadeFrames(0), 0),
        expectEq("NaN", sceneFadeFrames(Number.NaN), 0),
      ),
  },
  {
    id: "scene-fade-shape",
    title: "সিন ফেড: ফ্রেম ০-তে অদৃশ্য, মাঝে পুরো দৃশ্যমান, শেষে মিলিয়ে যায় (একটু বড় হতে হতে)",
    rule: "n=120: opacity(0) = 0 · opacity(12…108) = 1 · (১০৮…১১৯) কমতে থাকে, সিন স্কেল ১ → ≤ ১.০৪ বাড়তে থাকে · শেষ ফ্রেম ≤ ০.০৫",
    run: () => {
      const n = 120;
      let prevO = 1;
      let prevS = 1;
      for (let f = 0; f < n; f++) {
        const p = plan(f, n);
        if (f === 0 && p.scene.opacity !== 0) return `f0 opacity ${p.scene.opacity}`;
        if (f >= 12 && f <= 108 && (p.scene.opacity !== 1 || p.scene.scale !== 1)) return `f${f}: opacity ${p.scene.opacity}, scale ${p.scene.scale}`;
        if (f >= 108) {
          if (p.scene.opacity > prevO + 1e-12) return `f${f}: opacity বাড়ছে`;
          if (p.scene.scale < prevS - 1e-12) return `f${f}: scale কমছে`;
          if (p.scene.scale > 1.04 + 1e-12) return `f${f}: scale ${p.scene.scale} > ১.০৪`;
          prevO = p.scene.opacity;
          prevS = p.scene.scale;
        }
      }
      const last = plan(n - 1, n).scene.opacity;
      return last <= 0.05 ? null : `শেষ ফ্রেমের opacity ${last}`;
    },
  },
  // ---------- স্প্রিং / ব্যাজের গতি ----------
  {
    id: "bounce-settles",
    title: "bounce-in: ০ থেকে শুরু, একটু ছাড়ায়, ঠিক ৩০ ফ্রেমের পর হুবহু ১ — ঝাঁকুনি নেই",
    rule: "settleSpring(≤0 | NaN) = 0 · (≥ ৩০) = 1 · ২৯.৯৯ এর কাছে ১-এর ≈ ৫×১০⁻⁴ · সর্বোচ্চ স্কেল ১ < শিখর ≤ ১.০৭",
    run: () => {
      const peak = BADGE_BOUNCE_PEAK;
      return firstFail(
        expectEq("spring(0)", settleSpring(0), 0),
        expectEq("spring(−4)", settleSpring(-4), 0),
        expectEq("spring(NaN)", settleSpring(Number.NaN), 0),
        expectEq("spring(30)", settleSpring(SPRING_SETTLE_FRAMES), 1),
        expectEq("spring(31)", settleSpring(SPRING_SETTLE_FRAMES + 1), 1),
        expectEq("spring(900)", settleSpring(900), 1),
        Math.abs(settleSpring(SPRING_SETTLE_FRAMES - 0.01) - 1) < 5e-4 ? null : `সংযোগে লাফ ${settleSpring(SPRING_SETTLE_FRAMES - 0.01)}`,
        peak > 1 && peak <= BADGE_MAX_SCALE ? null : `শিখর ${peak} (১ < শিখর ≤ ${BADGE_MAX_SCALE} হওয়ার কথা)`,
        expectEq("ব্যাজ শুরু scale", plan(OUTRO_STEPS.badge, 450).badge.scale, BADGE_SCALE_FROM),
        expectEq("ব্যাজ settle scale", plan(OUTRO_STEPS.badge + BADGE_BOUNCE_FRAMES, 450).badge.scale, 1),
      );
    },
  },
  {
    id: "badge-scale-bound",
    title: "ব্যাজ (bounce × pulse) কখনো BADGE_MAX_SCALE-এর বেশি বড় হয় না",
    rule: "সব ফ্রেম (৪৫০ ফ্রেমের Outro): badge.scale × pulse ≤ 1.07",
    run: () => {
      let max = 0;
      for (let f = 0; f < 450; f++) {
        const p = plan(f, 450);
        max = Math.max(max, p.badge.scale * p.pulse);
      }
      return max <= BADGE_MAX_SCALE ? null : `সর্বোচ্চ ${max} > ${BADGE_MAX_SCALE}`;
    },
  },
  {
    id: "pulse",
    title: "pulse: ধীর, ১ → ১.০৬ → ১, মসৃণ লুপ; ব্যাজ স্থির হওয়ার পর শুরু",
    rule: `pulse ≤ শুরু = ১ · শুরুর ½ পিরিয়ডে = ১.০৬ · সব মান ১…১.০৬ · t ও t+${PULSE_PERIOD_FRAMES} সমান · অবৈধ → ১`,
    run: () => {
      const start = OUTRO_STEPS.pulse;
      for (let t = -10; t <= 600; t += 0.25) {
        const v = pulseScale(t);
        if (v < 1 - 1e-12 || v > PULSE_MAX_SCALE + 1e-12) return `pulse(${t}) = ${v}`;
      }
      let loop: string | null = null;
      for (let x = 0; x < PULSE_PERIOD_FRAMES; x += 1.5) {
        loop = loop ?? near(`লুপ x=${x}`, pulseScale(start + 10 + x), pulseScale(start + 10 + x + PULSE_PERIOD_FRAMES));
      }
      return firstFail(
        expectEq("pulse(শুরু)", pulseScale(start), 1),
        expectEq("pulse(আগে)", pulseScale(start - 20), 1),
        near("pulse(শিখর)", pulseScale(start + PULSE_PERIOD_FRAMES / 2), PULSE_MAX_SCALE),
        near("pulse(পুরো পিরিয়ড)", pulseScale(start + PULSE_PERIOD_FRAMES), 1),
        expectEq("pulse(NaN)", pulseScale(Number.NaN), 1),
        loop,
      );
    },
  },
  {
    id: "shine-once",
    title: "shine: একবারই চলে, ০…১ এর মধ্যে এগোয় (পিছোয় না), শুরু-শেষে অদৃশ্য",
    rule: `সক্রিয় শুধু ${OUTRO_STEPS.shine}…${OUTRO_STEPS.shine + SHINE_FRAMES} বেস-ফ্রেমে · position বাড়ে, ০…১ · opacity ০…${SHINE_PEAK_OPACITY} · পরে আর কখনো নয় (৪৫০ ফ্রেম)`,
    run: () => {
      const a = OUTRO_STEPS.shine;
      const b = a + SHINE_FRAMES;
      let prevPos = 0;
      let runs = 0;
      let wasActive = false;
      let peak = 0;
      for (let f = 0; f < 450; f++) {
        const p = plan(f, 450).shine;
        if (p.active !== (f > a && f < b)) return `f${f}: active = ${p.active}`;
        if (p.active && !wasActive) runs += 1;
        wasActive = p.active;
        if (p.position < prevPos - 1e-12) return `f${f}: position পিছিয়েছে`;
        prevPos = p.position;
        if (p.position < 0 || p.position > 1) return `f${f}: position ${p.position}`;
        if (p.opacity < 0 || p.opacity > SHINE_PEAK_OPACITY + 1e-12) return `f${f}: opacity ${p.opacity}`;
        peak = Math.max(peak, p.opacity);
      }
      return firstFail(
        expectEq("চলার সংখ্যা", runs, 1),
        peak > SHINE_PEAK_OPACITY * 0.95 ? null : `শিখর opacity ${peak}`,
        expectEq("শুরুতে opacity", shineLook(a).opacity, 0),
        expectEq("শেষে opacity", shineLook(b).opacity, 0),
        expectEq("শেষে position", shineLook(b + 5).position, 1),
      );
    },
  },
  {
    id: "shine-inside",
    title: "shine-এর আলো ফালি ব্যাজের দুই পাশের বাইরে থেকে শুরু ও শেষ হয় (মাস্কের ভেতরেই কাটে)",
    rule: "shineCenter(0) = −band (পুরো বাইরে বাঁয়ে) · shineCenter(1) = 1 + band · মাঝে সমান বাড়ে · position ছেঁটে ০…১",
    run: () =>
      firstFail(
        near("কেন্দ্র(0)", shineCenter(0, 0.22), -0.22),
        near("কেন্দ্র(1)", shineCenter(1, 0.22), 1.22),
        near("কেন্দ্র(0.5)", shineCenter(0.5, 0.22), 0.5),
        near("কেন্দ্র(−3)", shineCenter(-3, 0.22), -0.22),
        near("কেন্দ্র(9)", shineCenter(9, 0.22), 1.22),
        near("কেন্দ্র(NaN)", shineCenter(Number.NaN, 0.22), -0.22),
      ),
  },
  {
    id: "tap-hint",
    title: "ট্যাপ-ইঙ্গিত: ব্যাজ স্থির হওয়ার পর ভেসে ওঠে, ০…১৪ unit দোলে, লুপ করে; বন্ধ করা যায়",
    rule: "আগে ০ · ৮ ফ্রেমে opacity ০ → ১ · offset ০…১৪ · t ও t+৩২ সমান · enabled = false → সবসময় ০",
    run: () => {
      const s = OUTRO_STEPS.tap;
      let loop: string | null = null;
      for (let x = 0; x < TAP_PERIOD_FRAMES; x += 2) {
        const a = tapLook(s + 8 + x);
        const b = tapLook(s + 8 + x + TAP_PERIOD_FRAMES);
        loop = loop ?? firstFail(near("offset", a.offsetUnits, b.offsetUnits), near("opacity", a.opacity, b.opacity));
      }
      for (let t = -5; t <= 300; t += 0.5) {
        const v = tapLook(t);
        if (v.offsetUnits < -1e-12 || v.offsetUnits > TAP_BOB_UNITS + 1e-12) return `offset(${t}) = ${v.offsetUnits}`;
        if (v.opacity < 0 || v.opacity > 1) return `opacity(${t}) = ${v.opacity}`;
        const off = tapLook(t, false);
        if (off.opacity !== 0 || off.offsetUnits !== 0) return `বন্ধ থাকা সত্ত্বেও দৃশ্যমান t=${t}`;
      }
      return firstFail(
        expectEq("আগে", tapLook(s - 3).opacity, 0),
        expectEq("শুরু", tapLook(s).opacity, 0),
        near("৮ ফ্রেম পরে", tapLook(s + 8).opacity, 1),
        near("শিখর offset", tapLook(s + TAP_PERIOD_FRAMES / 2).offsetUnits, TAP_BOB_UNITS),
        expectEq("NaN", tapLook(Number.NaN).opacity, 0),
        loop,
      );
    },
  },
  // ---------- টাইপরাইটার ----------
  {
    id: "typewriter-units",
    title: "টাইপের একক: বাংলা যুক্তাক্ষর, র-ফলা, য-ফলা, ZWJ কখনো ভাঙে না",
    rule: '"স্টোর" → [স্টো, র] · "ইনস্টল" → [ই, ন, স্ট, ল] · "প্লে" → [প্লে] · "বিশ্বকোষ" → [বি, শ্ব, কো, ষ] · "ক্ষ" → [ক্ষ] · "কর্ম" → [ক, র্ম] · "সংখ্যা" → [সং, খ্যা] · "র‍্য" → ১টা',
    run: () =>
      firstFail(
        arrEq("স্টোর", typewriterUnits("স্টোর"), ["স্টো", "র"]),
        arrEq("ইনস্টল", typewriterUnits("ইনস্টল"), ["ই", "ন", "স্ট", "ল"]),
        arrEq("প্লে", typewriterUnits("প্লে"), ["প্লে"]),
        arrEq("বিশ্বকোষ", typewriterUnits("বিশ্বকোষ"), ["বি", "শ্ব", "কো", "ষ"]),
        arrEq("ক্ষ", typewriterUnits("ক্ষ"), ["ক্ষ"]),
        arrEq("কর্ম", typewriterUnits("কর্ম"), ["ক", "র্ম"]),
        arrEq("সংখ্যা", typewriterUnits("সংখ্যা"), ["সং", "খ্যা"]),
        arrEq("ইসলামী", typewriterUnits("ইসলামী"), ["ই", "স", "লা", "মী"]),
        arrEq("র-ZWJ-য", typewriterUnits(`র${ZWJ}${VIRAMA}য`), [`র${ZWJ}${VIRAMA}য`]),
        arrEq("ZWNJ", typewriterUnits(`ক${VIRAMA}${ZWNJ}ষ`), [`ক${VIRAMA}${ZWNJ}ষ`]),
        arrEq("ফাঁকা স্থান", typewriterUnits("ক খ"), ["ক", " ", "খ"]),
        arrEq("হসন্ত + স্পেস", typewriterUnits(`ক${VIRAMA} খ`), [`ক${VIRAMA}`, " ", "খ"]),
        arrEq("খালি", typewriterUnits(""), []),
        arrEq("string নয়", typewriterUnits(undefined as unknown as string), []),
        arrEq("ইংরেজি", typewriterUnits("S2"), ["S", "2"]),
      ),
  },
  {
    id: "typewriter-no-split-real",
    title: "আসল OUTRO_TEXT: প্রতিটা কাটার জায়গায় কোনো চিহ্ন/যুক্তাক্ষর আলাদা হয়ে যায় না; জোড়া দিলে হুবহু লেখা",
    rule: "units.join('') = OUTRO_TEXT · কোনো একক চিহ্ন (\\p{M})/ZWJ/ZWNJ দিয়ে শুরু নয় · হসন্তে শেষ হওয়া এককের পরে ব্যঞ্জন আসে না",
    run: () => {
      const units = typewriterUnits(OUTRO_TEXT);
      if (units.join("") !== OUTRO_TEXT) return "জোড়া দিলে লেখা মেলে না";
      if (units.length < 20) return `ইউনিট খুব কম: ${units.length}`;
      for (let i = 1; i < units.length; i++) {
        const first = Array.from(units[i])[0];
        if (/^\p{M}$/u.test(first) || first === ZWJ || first === ZWNJ) return `ইউনিট ${i} চিহ্ন দিয়ে শুরু: ${JSON.stringify(units[i])}`;
        const prev = Array.from(units[i - 1]);
        let k = prev.length - 1;
        while (k > 0 && (prev[k] === ZWJ || prev[k] === ZWNJ)) k--;
        if (prev[k] === VIRAMA && /^\p{L}$/u.test(first)) return `ইউনিট ${i - 1}|${i} যুক্তাক্ষর ভেঙেছে: ${JSON.stringify(units[i - 1])} | ${JSON.stringify(first)}`;
      }
      // দৃশ্যমান লেখা কোনো ধাপেই হসন্তে শেষ হয় না (মাঝ-যুক্তাক্ষর নয়)
      for (let n = 0; n <= units.length; n++) {
        const shown = units.slice(0, n).join("");
        if (shown.endsWith(VIRAMA) && n < units.length && /^\p{L}$/u.test(Array.from(units[n])[0])) return `ধাপ ${n}: হসন্তে থেমেছে`;
      }
      return null;
    },
  },
  {
    id: "typewriter-intl-cross",
    title: "আমাদের কাটার জায়গা Intl.Segmenter-এর গ্রাফিম সীমানারও একটা (থাকলে); না থাকলে এড়িয়ে যায়",
    rule: "আমাদের প্রতিটা ইউনিট-সীমানা ⊆ Intl গ্রাফিম-সীমানা (নতুন ICU-তে সমান, পুরনোতে আমরা আরও বেশি জোড়া)",
    run: () => {
      const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ index: number }> } }).Segmenter;
      if (!Seg) return null;
      const text = OUTRO_TEXT + " ইসলামী বিশ্বকোষ ও আল হাদিস S2 সংখ্যা কর্ম";
      const bounds = new Set<number>();
      for (const s of new Seg("bn", { granularity: "grapheme" }).segment(text)) bounds.add(s.index);
      bounds.add(text.length);
      let pos = 0;
      for (const u of typewriterUnits(text)) {
        pos += u.length;
        if (!bounds.has(pos)) return `সীমানা ${pos} (${JSON.stringify(u)}) Intl-এ নেই`;
      }
      return null;
    },
  },
  {
    id: "typewriter-count",
    title: "টাইপের গণনা রৈখিক: ০ → ০, ১ → সব, ছেঁটে ০…সব; NaN/খালি নিরাপদ",
    rule: "count(10, 0) = 0 · (10, 1) = 10 · (10, 0.5) = 5 · (10, −1) = 0 · (10, 9) = 10 · (10, NaN) = 0 · (0, 1) = 0 · বাড়তে থাকে",
    run: () => {
      let prev = 0;
      for (let p = 0; p <= 1.0001; p += 0.01) {
        const c = typewriterCount(37, p);
        if (c < prev) return `p=${p}: কমেছে`;
        prev = c;
      }
      return firstFail(
        expectEq("0", typewriterCount(10, 0), 0),
        expectEq("1", typewriterCount(10, 1), 10),
        expectEq("0.5", typewriterCount(10, 0.5), 5),
        expectEq("−1", typewriterCount(10, -1), 0),
        expectEq("9", typewriterCount(10, 9), 10),
        expectEq("NaN", typewriterCount(10, Number.NaN), 0),
        expectEq("খালি", typewriterCount(0, 1), 0),
        expectEq("NaN সংখ্যা", typewriterCount(Number.NaN, 1), 0),
        expectEq("ঠিক ১", typewriterCount(37, 1), 37),
      );
    },
  },
  {
    id: "typewriter-timeline",
    title: "টাইমলাইনে লেখা: শুরুতে খালি, ক্রমে বাড়ে, ধাপ শেষে পুরো OUTRO_TEXT; কখনো কমে না",
    rule: "frame ≤ ২০ → \"\" · frame ≥ ৪৮ → OUTRO_TEXT · মাঝে দৈর্ঘ্য বাড়তে থাকে · প্রতিটা ধাপের লেখা পুরো লেখার প্রিফিক্স",
    run: () => {
      let prevLen = 0;
      for (let f = 0; f <= 130; f++) {
        const shown = typewriterText(OUTRO_TEXT, plan(f, 120).text.typed);
        if (!OUTRO_TEXT.startsWith(shown)) return `f${f}: প্রিফিক্স নয় ${JSON.stringify(shown)}`;
        if (shown.length < prevLen) return `f${f}: কমেছে`;
        prevLen = shown.length;
        if (f <= OUTRO_STEPS.text && shown !== "") return `f${f}: আগেই লেখা এসেছে`;
        if (f >= OUTRO_STEPS.text + OUTRO_STEPS.textFrames && shown !== OUTRO_TEXT) return `f${f}: এখনো পুরো হয়নি`;
      }
      return null;
    },
  },
  // ---------- ব্যাজের মাপ, clear space, লেআউট ----------
  {
    id: "badge-constants",
    title: "ব্যাজের স্থির মান: ফাইলের মাপ ১৬০০×৪৭৪, আস্পেক্ট = ফাইলের রেশিও, clear space = উচ্চতার ¼ (Google)",
    rule: "BADGE_ASPECT = 1600 ÷ 474 · CLEAR_SPACE_RATIO = 0.25 · ব্যাজ প্রস্থ (unit) পোর্ট্রেট ৬৪০ / ল্যান্ডস্কেপ ৫৬০",
    run: () =>
      firstFail(
        expectEq("প্রস্থ", BADGE_PNG_WIDTH, 1600),
        expectEq("উচ্চতা", BADGE_PNG_HEIGHT, 474),
        near("আস্পেক্ট", BADGE_ASPECT, 1600 / 474),
        expectEq("clear", CLEAR_SPACE_RATIO, 0.25),
        expectEq("পোর্ট্রেট প্রস্থ", BADGE_WIDTH_UNITS.portrait, 640),
        expectEq("ল্যান্ডস্কেপ প্রস্থ", BADGE_WIDTH_UNITS.landscape, 560),
      ),
  },
  {
    id: "badge-size",
    title: "badgeSize: উচ্চতা = প্রস্থ ÷ আস্পেক্ট, clear = উচ্চতা ÷ ৪; অবৈধ → সব ০",
    rule: "size(640) → h = 640 ÷ আস্পেক্ট · clear = h ÷ 4 · size(0 | −1 | NaN) = ০ · size(100, NaN) আস্পেক্ট ডিফল্টে",
    run: () => {
      const s = badgeSize(640);
      const d = badgeSize(100, Number.NaN);
      return firstFail(
        near("h", s.height, 640 / BADGE_ASPECT),
        near("clear", s.clear, s.height / 4),
        near("w/h", s.width / s.height, BADGE_ASPECT),
        expectEq("size(0)", JSON.stringify(badgeSize(0)), JSON.stringify({ width: 0, height: 0, clear: 0 })),
        expectEq("size(−1)", badgeSize(-1).height, 0),
        expectEq("size(NaN)", badgeSize(Number.NaN).height, 0),
        expectEq("size(aspect 0)", badgeSize(100, 0).height, 0),
        near("ডিফল্ট আস্পেক্ট", d.width / d.height, BADGE_ASPECT),
      );
    },
  },
  {
    id: "badge-aspect-4sizes",
    title: "ব্যাজের আস্পেক্ট রেশিও ৪ সাইজেই হুবহু ঠিক; clear = উচ্চতা ÷ ৪",
    rule: "১০৮০×১৯২০, ১৯২০×১০৮০, ২১৬০×৩৮৪০, ৩৮৪০×২১৬০: প্রস্থ ÷ উচ্চতা = ১৬০০ ÷ ৪৭৪ (১০⁻⁹) · badgeBox() = layout.badge",
    run: () => {
      for (const s of SIZES) {
        const { layout, o } = layoutAt(s.w, s.h);
        const b = o.badge;
        const miss = firstFail(
          near(`${s.id} রেশিও`, b.width / b.height, BADGE_ASPECT),
          near(`${s.id} aspect ক্ষেত্র`, b.aspect, BADGE_ASPECT),
          near(`${s.id} clear`, b.clear, b.height / 4),
          expectEq(`${s.id} badgeBox`, JSON.stringify(badgeBox(layout)), JSON.stringify(b)),
        );
        if (miss) return miss;
      }
      return null;
    },
  },
  {
    id: "clear-space",
    title: "clear space: ব্যাজ (bounce/pulse-এ বড় হলেও) চারপাশে উচ্চতার ¼ ফাঁকা রাখে; লেখা/লোগো/নাম/ইঙ্গিত সে জায়গায় ঢোকে না",
    rule: "scaledBox(ব্যাজ, s) + ¼ × (বড় উচ্চতা) ⊆ outer, s ∈ {০.৫, ১, ১.০৬, bounce শিখর} · text/name/logo/tap ∩ outer = ∅ · সব ৪ সাইজে",
    run: () => {
      for (const s of SIZES) {
        const { o } = layoutAt(s.w, s.h);
        const b = o.badge;
        for (const sc of [BADGE_SCALE_FROM, 1, PULSE_MAX_SCALE, BADGE_BOUNCE_PEAK]) {
          const sb = scaledBox(b, sc);
          const c = CLEAR_SPACE_RATIO * sb.height;
          const need: Box = { x: sb.x - c, y: sb.y - c, width: sb.width + 2 * c, height: sb.height + 2 * c };
          if (!inside(need, b.outer)) return `${s.id}: স্কেল ${sc}-এ clear space outer-এর বাইরে`;
        }
        for (const { name, box } of contentBoxes(o)) {
          if (name === "badge.outer") continue;
          if (overlaps(box, b.outer)) return `${s.id}: ${name} ব্যাজের clear space-এ ঢুকেছে`;
        }
      }
      return null;
    },
  },
  {
    id: "layout-inside",
    title: "সব বাক্স কম্পোজিশনের ভেতরে ও প্যানেলের ভেতরে; প্যানেল শর্টসের নিরাপদ এলাকায় — ৪ সাইজে",
    rule: "প্যানেল ⊆ [০,W]×[০,H] · নিরাপদ উপর/নিচ মানা · logo/name/text/ব্যাজ outer/tap ⊆ প্যানেল",
    run: () => {
      for (const s of SIZES) {
        const { layout, o } = layoutAt(s.w, s.h);
        const whole: Box = { x: 0, y: 0, width: s.w, height: s.h };
        if (!inside(o.panel, whole)) return `${s.id}: প্যানেল কম্পোজিশনের বাইরে`;
        if (o.panel.y < layout.safe.top - EPS) return `${s.id}: প্যানেল উপরের নিরাপদ মার্জিনে`;
        if (o.panel.y + o.panel.height > s.h - layout.safe.bottom + EPS) return `${s.id}: প্যানেল নিচের নিরাপদ মার্জিনে`;
        for (const { name, box } of contentBoxes(o)) {
          if (!inside(box, o.panel)) return `${s.id}: ${name} প্যানেলের বাইরে`;
          if (!inside(box, whole)) return `${s.id}: ${name} কম্পোজিশনের বাইরে`;
        }
      }
      return null;
    },
  },
  {
    id: "layout-disjoint",
    title: "লোগো, নাম, লেখা, ব্যাজ (outer), ইঙ্গিত — একটা আরেকটার উপর পড়ে না (পোর্ট্রেট কলাম, ল্যান্ডস্কেপ দুই কলাম)",
    rule: "জোড়ায় জোড়ায় ছেদ নেই — ৪ সাইজে · পোর্ট্রেটে উপর→নিচ ক্রম: লোগো, নাম, লেখা, ব্যাজ, ইঙ্গিত",
    run: () => {
      for (const s of SIZES) {
        const { o } = layoutAt(s.w, s.h);
        const boxes = contentBoxes(o);
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            if (overlaps(boxes[i].box, boxes[j].box)) return `${s.id}: ${boxes[i].name} ও ${boxes[j].name} মিলে গেছে`;
          }
        }
        if (o.isPortrait) {
          const ys = boxes.map((b) => b.box.y);
          for (let i = 1; i < ys.length; i++) if (!(ys[i] > ys[i - 1])) return `${s.id}: ক্রম ভাঙা (${boxes[i].name})`;
        } else {
          if (!(o.logo.x + o.logo.size <= o.text.x) || !(o.name.x + o.name.width <= o.text.x + EPS)) return `${s.id}: বাঁ কলাম ডান কলামে ঢুকেছে`;
        }
      }
      return null;
    },
  },
  {
    id: "layout-4k-2x",
    title: "4K = ঠিক HD-র ২× (প্রতিটা বাক্সের প্রতিটা সংখ্যা, ফন্ট সহ)",
    rule: "outroLayout(২১৬০×৩৮৪০) = ২ × outroLayout(১০৮০×১৯২০) · (৩৮৪০×২১৬০) = ২ × (১৯২০×১০৮০) · সহনশীলতা ১০⁻⁶",
    run: () => {
      const pairs: [number, number, number, number][] = [
        [1080, 1920, 2160, 3840],
        [1920, 1080, 3840, 2160],
      ];
      for (const [w1, h1, w2, h2] of pairs) {
        const a = layoutAt(w1, h1).o;
        const b = layoutAt(w2, h2).o;
        if (a.isPortrait !== b.isPortrait) return `${w1}×${h1}: অভিমুখ আলাদা`;
        const fa = flat({ ...a, isPortrait: undefined });
        const fb = flat({ ...b, isPortrait: undefined });
        for (const k of Object.keys(fa)) {
          if (k === "badge.aspect" || k === "unit") {
            if (k === "unit" && Math.abs(fb[k] - 2 * fa[k]) > EPS) return `${w1}×${h1}: unit ${fa[k]} → ${fb[k]}`;
            if (k === "badge.aspect" && Math.abs(fb[k] - fa[k]) > EPS) return `${w1}×${h1}: aspect বদলেছে`;
            continue;
          }
          if (!(k in fb)) return `${w1}×${h1}: ${k} নেই`;
          if (Math.abs(fb[k] - 2 * fa[k]) > EPS) return `${w1}×${h1}: ${k} = ${fa[k]} → ${fb[k]} (২× নয়)`;
        }
      }
      return null;
    },
  },
  {
    id: "badge-sharp",
    title: "4K-তেও ব্যাজ PNG-র আসল পিক্সেলের মধ্যে — বড় করতে হয় না, ঝাপসা নয়",
    rule: "4K প্রদর্শন প্রস্থ ১২৮০ (পোর্ট্রেট) / ১১২০ (ল্যান্ডস্কেপ) ≤ ১৬০০ · badgeIsSharp(১৬০০) = true, (১৬০১) = false, NaN = false",
    run: () => {
      const p4 = layoutAt(2160, 3840).o.badge.width;
      const l4 = layoutAt(3840, 2160).o.badge.width;
      return firstFail(
        near("পোর্ট্রেট 4K প্রস্থ", p4, 1280),
        near("ল্যান্ডস্কেপ 4K প্রস্থ", l4, 1120),
        expectEq("পোর্ট্রেট sharp", badgeIsSharp(p4), true),
        expectEq("ল্যান্ডস্কেপ sharp", badgeIsSharp(l4), true),
        expectEq("১৬০০", badgeIsSharp(1600), true),
        expectEq("১৬০১", badgeIsSharp(1601), false),
        expectEq("NaN", badgeIsSharp(Number.NaN), false),
      );
    },
  },
  {
    id: "layout-bad-input",
    title: "অদ্ভুত/অবৈধ সাইজে লেআউট ভাঙে না — throw নয়, সব সংখ্যা সসীম",
    rule: "outroLayout({}, null, NaN/০/নেগেটিভ মাপ, খুব ছোট ও খুব বড় সাইজ) · badgeSize/scaledBox NaN-নিরাপদ",
    run: () => {
      const weird: unknown[] = [
        {},
        null,
        undefined,
        { width: Number.NaN, height: Number.NaN, unit: Number.NaN },
        { width: 0, height: 0, unit: 0 },
        { width: -100, height: -50, unit: -1 },
        computeLayout(100, 60),
        computeLayout(7680, 4320),
        computeLayout(1080, 1080),
        computeLayout(1000, 1900),
      ];
      for (let i = 0; i < weird.length; i++) {
        const o = outroLayout(weird[i] as Layout);
        const bad = badNumber(o);
        if (bad) return `ইনপুট #${i}: ${bad}`;
        const r = Math.abs(o.badge.width / o.badge.height - BADGE_ASPECT);
        if (o.badge.height > 0 && r > 1e-9) return `ইনপুট #${i}: আস্পেক্ট বিকৃত`;
      }
      const sb = scaledBox({ x: 0, y: 0, width: 10, height: 4 }, Number.NaN);
      return firstFail(expectEq("scaledBox(NaN)", sb.width, 10), near("scaledBox কেন্দ্র", scaledBox({ x: 0, y: 0, width: 10, height: 4 }, 2).x, -5));
    },
  },
  {
    id: "constants-fixed",
    title: "আগের Part-এর মান বদলায়নি: OUTRO_TEXT, ৪ সেকেন্ড = ১২০ ফ্রেম, ফেড ১২, FPS ৩০",
    rule: 'OUTRO_TEXT = "আজই প্লে স্টোর থেকে ইনস্টল করুন:" · DEFAULT_OUTRO_SECONDS × FPS = ১২০ = OUTRO_BASE_FRAMES · TRANSITION_FRAMES = ১২',
    run: () =>
      firstFail(
        expectEq("OUTRO_TEXT", OUTRO_TEXT, "আজই প্লে স্টোর থেকে ইনস্টল করুন:"),
        expectEq("FPS", FPS, 30),
        expectEq("DEFAULT_OUTRO_SECONDS", DEFAULT_OUTRO_SECONDS, 4),
        expectEq("১২০", DEFAULT_OUTRO_SECONDS * FPS, OUTRO_BASE_FRAMES),
        expectEq("TRANSITION_FRAMES", TRANSITION_FRAMES, 12),
      ),
  },
];

export function runOutroCases(): OutroCaseOutcome[] {
  return defs.map((d) => {
    try {
      const detail = d.run();
      return { id: d.id, title: d.title, rule: d.rule, ok: detail === null, detail: detail ?? "" };
    } catch (e) {
      return { id: d.id, title: d.title, rule: d.rule, ok: false, detail: `কেস নিজেই ভেঙেছে: ${String(e)}` };
    }
  });
}

export const OUTRO_CASE_COUNT = defs.length;
