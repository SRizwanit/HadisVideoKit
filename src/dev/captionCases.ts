import { getThemeColors, parseColor, THEMES } from "../themes";
import type { ThemeId } from "../types";
import { computeLayout } from "../lib/useLayout";
import { buildFrameSegments, computeTiming } from "../lib/timing";
import type { FrameSegment, FrameWord } from "../lib/timing";
import {
  ACTIVE_HOLD_FRAMES,
  CAPTION_LINE_HEIGHT,
  ENTER_FRAMES,
  EXIT_FRAMES,
  POP_SCALE,
  SLIDE_UNITS,
  UPCOMING_OPACITY,
  WORD_RELAX_FRAMES,
  activeWordIndex,
  fitCaption,
  planCaption,
  popScale,
  springValue,
  wordColorIndex,
  wordLook,
  wordReleaseFrame,
} from "../lib/captionWords";

/**
 * Part 10 (dev): captionWords.ts-এর পরীক্ষার কেস — React ছাড়া, তাই সাধারণ Node-এও চলে।
 * `CaptionPreview` এগুলো সারি হিসেবে আঁকে। কেস `null` ফেরালে ✅, বার্তা ফেরালে ❌। `runCaptionCases()` কখনো throw করে না।
 */

export type CaptionCaseOutcome = { id: string; title: string; ok: boolean; detail: string; rule: string };
type Def = { id: string; title: string; rule: string; run: () => string | null };

const THEME_LIST: ThemeId[] = ["emerald", "navy", "greenDayNight"];
const NIGHTS = [0, 0.5, 1];

const seg = (index: number, startFrame: number, endFrame: number): FrameSegment => ({
  index,
  id: index + 1,
  startFrame,
  endFrame,
  text: `s${index}`,
  words: [],
});

const W = (start: number, end: number, word = "ক"): FrameWord => ({ word, startFrame: start, endFrame: end });

const expectEq = (what: string, got: unknown, want: unknown): string | null =>
  got === want ? null : `${what}: পাওয়া ${String(got)}, প্রত্যাশা ${String(want)}`;
const near = (what: string, got: number, want: number, tol: number): string | null =>
  Math.abs(got - want) <= tol ? null : `${what}: পাওয়া ${got.toFixed(4)}, প্রত্যাশা ${want} ± ${tol}`;
const firstFail = (...checks: (string | null)[]): string | null => checks.find((c) => c !== null) ?? null;

/** WCAG আপেক্ষিক উজ্জ্বলতা ও কনট্রাস্ট */
const lum = (c: { r: number; g: number; b: number }): number => {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
const contrast = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number => {
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
const over = (top: { r: number; g: number; b: number; a: number }, under: { r: number; g: number; b: number }) => ({
  r: top.r * top.a + under.r * (1 - top.a),
  g: top.g * top.a + under.g * (1 - top.a),
  b: top.b * top.a + under.b * (1 - top.a),
});

/** প্যানেলের নিচে আকাশের সবচেয়ে খারাপ (সবচেয়ে উজ্জ্বল) রঙ ধরে কনট্রাস্টের সবচেয়ে কম মান */
function worstContrast(theme: ThemeId, nf: number, pick: (p: ReturnType<typeof getThemeColors>) => string, textAlpha = 1): number {
  const p = getThemeColors(theme, nf);
  const panel = parseColor(p.panelBg);
  const txt = parseColor(pick(p));
  let worst = Infinity;
  for (const sky of [p.skyTop, p.skyMid, p.skyBottom]) {
    const bg = over(panel, parseColor(sky));
    const fg = over({ ...txt, a: textAlpha }, bg);
    worst = Math.min(worst, contrast(fg, bg));
  }
  return worst;
}

const defs: Def[] = [
  // ---- বাক্সের পরিকল্পনা (planCaption) ----
  {
    id: "plan-inside",
    title: "সেগমেন্টের ভেতরে → সেটাই; ফাঁকে ও Main-এর বাইরে → কিছু নয়",
    rule: "ফাঁকে/শুরুর আগে/শেষের পরে planCaption = null; ভেতরে সঠিক index ও localFrame",
    run: () => {
      const s = [seg(0, 100, 160), seg(1, 200, 260)];
      const a = planCaption(s, 130);
      return firstFail(
        expectEq("ভেতরে index", a?.index, 0),
        expectEq("ভেতরে localFrame", a?.localFrame, 30),
        expectEq("দ্বিতীয়", planCaption(s, 230)?.index, 1),
        expectEq("ফাঁক (170)", planCaption(s, 170), null),
        expectEq("শুরুর আগে (50)", planCaption(s, 50), null),
        expectEq("শেষের পরে (300)", planCaption(s, 300), null),
        expectEq("শেষ ফ্রেম (159) আছে", planCaption(s, 159)?.index, 0),
        expectEq("end ফ্রেম (160) নেই", planCaption(s, 160), null),
        expectEq("খালি তালিকা", planCaption([], 10), null),
      );
    },
  },
  {
    id: "plan-enter",
    title: "শুরুতে নিচ থেকে উঠে আসে + ফেড-ইন (১০ ফ্রেম), তারপর জায়গায়",
    rule: "ফ্রেম ০: opacity 0, slide = 36 unit; ১০+: opacity 1, slide 0; মাঝে ক্রমে বাড়ে",
    run: () => {
      const s = [seg(0, 100, 200)];
      const f0 = planCaption(s, 100)!;
      const f4 = planCaption(s, 104)!;
      const f10 = planCaption(s, 110)!;
      const f50 = planCaption(s, 150)!;
      return firstFail(
        expectEq("enterFrames", f0.enterFrames, ENTER_FRAMES),
        expectEq("ফ্রেম ০ opacity", f0.opacity, 0),
        near("ফ্রেম ০ slide", f0.slideUnits, SLIDE_UNITS, 1e-9),
        f4.opacity > 0 && f4.opacity < 1 ? null : `ফ্রেম ৪ opacity ০…১-এর মাঝে নয়: ${f4.opacity}`,
        f4.slideUnits > 0 && f4.slideUnits < SLIDE_UNITS ? null : `ফ্রেম ৪ slide মাঝে নয়: ${f4.slideUnits}`,
        expectEq("ফ্রেম ১০ opacity", f10.opacity, 1),
        expectEq("ফ্রেম ১০ slide", f10.slideUnits, 0),
        expectEq("মাঝখানে opacity", f50.opacity, 1),
        f4.opacity > planCaption(s, 102)!.opacity ? null : "opacity ক্রমে বাড়ছে না",
      );
    },
  },
  {
    id: "plan-exit",
    title: "শেষে মিলিয়ে যায় (৮ ফ্রেম): শেষ ফ্রেমে opacity 0",
    rule: "শেষের ৮ ফ্রেমে opacity কমে; ঠিক শেষ ফ্রেমে ০; তার আগে ১",
    run: () => {
      const s = [seg(0, 100, 200)];
      const before = planCaption(s, 191)!; // remaining 9
      const first = planCaption(s, 192)!; // remaining 8
      const last = planCaption(s, 199)!; // remaining 1
      const mid = planCaption(s, 195)!;
      return firstFail(
        expectEq("exitFrames", before.exitFrames, EXIT_FRAMES),
        expectEq("৯ ফ্রেম বাকি → opacity", before.opacity, 1),
        first.opacity < 1 ? null : "ফেড শুরু হয়নি",
        mid.opacity < first.opacity ? null : "opacity কমছে না",
        expectEq("শেষ ফ্রেম opacity", last.opacity, 0),
      );
    },
  },
  {
    id: "plan-contiguous",
    title: "গায়ে-গায়ে সেগমেন্ট: ফেড নেই (শুধু উঠে আসা), বাক্স জ্বলে-নেভে না",
    rule: "আগের end ≥ শুরু → fadeIn=false (opacity ১, slide > 0); পরের শুরু ≤ end → fadeOut=false",
    run: () => {
      const s = [seg(0, 100, 160), seg(1, 160, 220), seg(2, 220, 280)];
      const mid = planCaption(s, 160)!; // সেগমেন্ট ১-এর প্রথম ফ্রেম
      const lastOfMid = planCaption(s, 219)!;
      const first = planCaption(s, 100)!;
      const lastSeg = planCaption(s, 279)!;
      return firstFail(
        expectEq("মাঝেরটা fadeIn", mid.fadeIn, false),
        expectEq("মাঝেরটা fadeOut", mid.fadeOut, false),
        expectEq("মাঝেরটার শুরুর opacity", mid.opacity, 1),
        mid.slideUnits > 0 ? null : "গায়ে-গায়ে হলেও উঠে আসতে হবে",
        expectEq("মাঝেরটার শেষ ফ্রেমের opacity", lastOfMid.opacity, 1),
        expectEq("প্রথমটা fadeIn", first.fadeIn, true),
        expectEq("প্রথমটা fadeOut", first.fadeOut, false),
        expectEq("শেষেরটা fadeOut", lastSeg.fadeOut, true),
        expectEq("শেষেরটার শেষ opacity", lastSeg.opacity, 0),
      );
    },
  },
  {
    id: "plan-short",
    title: "ছোট সেগমেন্টে transition ⌊দৈর্ঘ্য ÷ ৩⌋ ফ্রেমে ছোট; ১–২ ফ্রেমে সরাসরি",
    rule: "দৈর্ঘ্য ৬ → ২ ফ্রেম; দৈর্ঘ্য ২ → ০ (opacity ১ সব ফ্রেমে)",
    run: () => {
      const a = planCaption([seg(0, 100, 106)], 100)!;
      const b = planCaption([seg(0, 100, 102)], 100)!;
      const c = planCaption([seg(0, 100, 102)], 101)!;
      return firstFail(
        expectEq("৬ ফ্রেম enterFrames", a.enterFrames, 2),
        expectEq("৬ ফ্রেম exitFrames", a.exitFrames, 2),
        expectEq("২ ফ্রেম enterFrames", b.enterFrames, 0),
        expectEq("২ ফ্রেম opacity (প্রথম)", b.opacity, 1),
        expectEq("২ ফ্রেম opacity (শেষ)", c.opacity, 1),
        expectEq("২ ফ্রেম slide", b.slideUnits, 0),
      );
    },
  },
  {
    id: "plan-safe",
    title: "NaN/Infinity/ভুল ইনপুটে ক্র্যাশ নেই",
    rule: "অসংখ্যা ফ্রেম → null; throw নেই",
    run: () => {
      const s = [seg(0, 10, 50)];
      return firstFail(
        expectEq("NaN", planCaption(s, NaN), null),
        expectEq("Infinity", planCaption(s, Infinity), null),
        expectEq("string", planCaption(s, "x" as unknown as number), null),
        expectEq("null তালিকা", planCaption(null as unknown as FrameSegment[], 5), null),
      );
    },
  },

  // ---- শব্দের অবস্থা ----
  {
    id: "word-states",
    title: "শব্দ: আগে upcoming → শুরুতে active → পরে read",
    rule: "শুরুর আগে upcoming (opacity 0.45); [শুরু, release) active; তারপর read",
    run: () => {
      const words = [W(100, 130), W(130, 160), W(160, 190)];
      return firstFail(
        expectEq("শুরুর আগে", wordLook(words, 1, 129).state, "upcoming"),
        expectEq("upcoming opacity", wordLook(words, 1, 129).opacity, UPCOMING_OPACITY),
        expectEq("শুরুতে", wordLook(words, 1, 130).state, "active"),
        expectEq("মাঝে", wordLook(words, 1, 145).state, "active"),
        expectEq("পরের শব্দ শুরু → read", wordLook(words, 1, 160).state, "read"),
        expectEq("প্রথম শব্দ (১৩০-এ) read", wordLook(words, 0, 130).state, "read"),
        expectEq("তৃতীয় শব্দ (১৬০-এ) active", wordLook(words, 2, 160).state, "active"),
      );
    },
  },
  {
    id: "word-one-active",
    title: "গায়ে-গায়ে শব্দে প্রতি ফ্রেমে সর্বোচ্চ একটাই active; ক্রম ঠিক",
    rule: "১০০…২০০ প্রতি ফ্রেমে active সংখ্যা ≤ ১; active শব্দের অবস্থান কমে না",
    run: () => {
      const words = [W(100, 130), W(130, 160), W(160, 190)];
      let last = -1;
      for (let f = 100; f < 200; f += 1) {
        const n = words.filter((_, i) => wordLook(words, i, f).state === "active").length;
        if (n > 1) return `ফ্রেম ${f}: active ${n}টা`;
        const idx = activeWordIndex(words, f);
        if (idx !== -1 && idx < last) return `ফ্রেম ${f}: active পিছিয়ে গেছে (${last} → ${idx})`;
        if (idx !== -1) last = idx;
      }
      return firstFail(
        expectEq("১১০-এ active", activeWordIndex(words, 110), 0),
        expectEq("১৪০-এ active", activeWordIndex(words, 140), 1),
        expectEq("১৭০-এ active", activeWordIndex(words, 170), 2),
        expectEq("শুরুর আগে কেউ নয়", activeWordIndex(words, 50), -1),
      );
    },
  },
  {
    id: "word-hold",
    title: "ছোট ফাঁকে হাইলাইট থাকে (≤ ৬ ফ্রেম), লম্বা বিরতিতে নিভে যায়",
    rule: "release = min(পরের শুরু, শেষ + ৬); লম্বা ফাঁকে শব্দ read",
    run: () => {
      const small = [W(100, 120), W(124, 150)]; // ফাঁক ৪
      const long = [W(100, 120), W(160, 190)]; // ফাঁক ৪০
      return firstFail(
        expectEq("ছোট ফাঁকে ১২২-এ আগের active", wordLook(small, 0, 122).state, "active"),
        expectEq("ছোট ফাঁকের release", wordReleaseFrame(small, 0), 124),
        expectEq("লম্বা ফাঁকের release", wordReleaseFrame(long, 0), 120 + ACTIVE_HOLD_FRAMES),
        expectEq("লম্বা ফাঁকে ১৩০-এ read", wordLook(long, 0, 130).state, "read"),
        expectEq("লম্বা ফাঁকে ১৩০-এ কেউ active নয়", activeWordIndex(long, 130), -1),
        expectEq("ওভারল্যাপ: পরের শুরুতেই release", wordReleaseFrame([W(100, 140), W(120, 160)], 0), 120),
      );
    },
  },
  {
    id: "word-pop",
    title: "pop: শুরুতে ১ → ≈ ১.১৫ ছুঁয়ে একটু ছাড়ায় → স্থির; read হলে ১-এ ফেরে",
    rule: "springValue(0)=0, শীর্ষ ≤ ১.২, শেষে ≈ ১; popScale ≈ ১.১৫; relax-এর পর pop ≈ ০",
    run: () => {
      let peak = 0;
      for (let f = 0; f < 60; f += 1) peak = Math.max(peak, springValue(f / 30));
      const words = [W(100, 400), W(400, 430)];
      const late = wordLook(words, 0, 300); // অনেক পরে, এখনো active
      const done = wordLook(words, 0, 400 + WORD_RELAX_FRAMES + 2);
      return firstFail(
        expectEq("springValue(0)", springValue(0), 0),
        expectEq("springValue(-1)", springValue(-1), 0),
        peak > 1 && peak < 1.2 ? null : `শীর্ষ ${peak.toFixed(3)} (চাই ১…১.২)`,
        near("স্থির মান", springValue(2), 1, 0.005),
        near("popScale স্থির", popScale(late.pop), POP_SCALE, 0.01),
        expectEq("read-এর পর pop", done.pop, 0),
        expectEq("read-এর পর activeMix", done.activeMix, 0),
        expectEq("read-এর পর underline", done.underline, 0),
        expectEq("read-এর পর opacity", done.opacity, 1),
        expectEq("popScale(0)", popScale(0), 1),
      );
    },
  },
  {
    id: "word-smooth",
    title: "active হওয়া ও নামার সময় opacity/রঙ/আন্ডারলাইন লাফায় না",
    rule: "পাশাপাশি ফ্রেমে activeMix, opacity, underline-এর পরিবর্তন ≤ ০.৫",
    run: () => {
      const words = [W(100, 104), W(104, 150)]; // প্রথম শব্দ খুব ছোট (৪ ফ্রেম)
      let prev = wordLook(words, 0, 90);
      for (let f = 91; f < 140; f += 1) {
        const cur = wordLook(words, 0, f);
        for (const k of ["activeMix", "opacity", "underline"] as const) {
          if (Math.abs(cur[k] - prev[k]) > 0.5) return `ফ্রেম ${f}: ${k} লাফিয়েছে (${prev[k].toFixed(2)} → ${cur[k].toFixed(2)})`;
        }
        prev = cur;
      }
      return null;
    },
  },
  {
    id: "word-color",
    title: "active রঙ captionColors থেকে ঘুরে ঘুরে; পরপর সেগমেন্ট আলাদা রঙে শুরু",
    rule: "(সেগমেন্ট + শব্দ) mod ৬; ঋণাত্মক/অসংখ্যায় ০-তে",
    run: () =>
      firstFail(
        expectEq("seg0 word0", wordColorIndex(0, 0, 6), 0),
        expectEq("seg0 word5", wordColorIndex(0, 5, 6), 5),
        expectEq("seg0 word6 ঘুরে", wordColorIndex(0, 6, 6), 0),
        expectEq("seg1 word0", wordColorIndex(1, 0, 6), 1),
        expectEq("ঋণাত্মক", wordColorIndex(-1, 0, 6), 5),
        expectEq("রঙ ০টা", wordColorIndex(2, 3, 0), 0),
        expectEq("NaN", wordColorIndex(NaN, NaN, 6), 0),
      ),
  },

  // ---- ফন্ট আঁটানো ----
  {
    id: "fit-short",
    title: "ছোট লেখা → বেস ফন্ট, ১ লাইন",
    rule: "naturalWidth ≤ ব্যবহারযোগ্য প্রস্থ → fontSize = base, lines 1, clipped নয়",
    run: () => {
      const r = fitCaption({ naturalWidth: 500, baseSize: 66, minSize: 40, maxWidth: 898, maxHeight: 389 });
      return firstFail(expectEq("fontSize", r.fontSize, 66), expectEq("lines", r.lines, 1), expectEq("clipped", r.clipped, false));
    },
  },
  {
    id: "fit-long",
    title: "লম্বা লেখা → ফন্ট ছোট; লাইন বেশি হলে আরও ছোট (মনোটোনিক)",
    rule: "প্রস্থ বাড়লে fontSize কমে (কখনো বাড়ে না); প্রতিটা ফল জায়গায় আঁটে: লাইন × ফন্ট × lineHeight ≤ উচ্চতা",
    run: () => {
      let prev = Infinity;
      for (let n = 400; n <= 9000; n += 200) {
        const r = fitCaption({ naturalWidth: n, baseSize: 66, minSize: 40, maxWidth: 898, maxHeight: 389 });
        if (r.fontSize > prev) return `প্রস্থ ${n}: ফন্ট বেড়েছে (${prev} → ${r.fontSize})`;
        prev = r.fontSize;
        if (!r.clipped && r.lines * r.fontSize * CAPTION_LINE_HEIGHT > 389 + 1e-9) return `প্রস্থ ${n}: জায়গায় আঁটে না`;
        if (r.fontSize < 40 || r.fontSize > 66) return `প্রস্থ ${n}: ফন্ট সীমার বাইরে ${r.fontSize}`;
      }
      const mid = fitCaption({ naturalWidth: 5000, baseSize: 66, minSize: 40, maxWidth: 898, maxHeight: 389 });
      return mid.fontSize < 66 && mid.lines >= 2 ? null : `লম্বা লেখায় ফন্ট ${mid.fontSize}, লাইন ${mid.lines}`;
    },
  },
  {
    id: "fit-clip",
    title: "অতি লম্বা লেখা → minSize-এ থেমে ছাঁটা (clipped), নিচে নয়",
    rule: "minSize-এও না আঁটলে fontSize = min, clipped = true, maxLines = ⌊উচ্চতা ÷ (min × lineHeight)⌋",
    run: () => {
      const r = fitCaption({ naturalWidth: 60000, baseSize: 66, minSize: 40, maxWidth: 898, maxHeight: 389 });
      return firstFail(
        expectEq("fontSize", r.fontSize, 40),
        expectEq("clipped", r.clipped, true),
        expectEq("maxLines", r.maxLines, Math.floor(389 / (40 * CAPTION_LINE_HEIGHT))),
      );
    },
  },
  {
    id: "fit-4k",
    title: "4K = ঠিক ২×: সব মাপ ×২ করলে ফল ঠিক ×২",
    rule: "fitCaption(×২ ইনপুট) = ২ × fitCaption(ইনপুট) (ফন্ট), লাইন সমান",
    run: () => {
      for (const n of [500, 2400, 4800, 9000]) {
        const a = fitCaption({ naturalWidth: n, baseSize: 66, minSize: 40, maxWidth: 898, maxHeight: 389 });
        const b = fitCaption({ naturalWidth: n * 2, baseSize: 132, minSize: 80, maxWidth: 1796, maxHeight: 778 });
        // ১ px ধাপ বলে ফন্ট ঠিক ২× নাও হতে পারে (±২ px), তবে লাইন সংখ্যা সমান
        if (Math.abs(b.fontSize - a.fontSize * 2) > 2) return `প্রস্থ ${n}: ${a.fontSize} → ${b.fontSize}`;
        if (a.lines !== b.lines && !a.clipped) return `প্রস্থ ${n}: লাইন ${a.lines} ≠ ${b.lines}`;
      }
      return null;
    },
  },
  {
    id: "fit-real-layout",
    title: "আসল লেআউটে (Portrait/Landscape) বাক্সের ভেতরের জায়গা পজিটিভ ও ফন্ট-সীমা ঠিক",
    rule: "captionBox − ২ × padding > 0; captionMin ≤ captionMax",
    run: () => {
      for (const [w, h] of [[1080, 1920], [1920, 1080], [2160, 3840], [3840, 2160]] as const) {
        const L = computeLayout(w, h);
        const pad = 36 * L.unit;
        if (!(L.captionBox.width - 2 * pad > 0 && L.captionBox.height - 2 * pad > 0)) return `${w}×${h}: ভেতরের জায়গা নেই`;
        if (!(L.fontSizes.captionMin <= L.fontSizes.captionMax)) return `${w}×${h}: min > max`;
      }
      return null;
    },
  },
  {
    id: "fit-safe",
    title: "ভুল ইনপুটে (০, NaN, ঋণাত্মক) ক্র্যাশ নেই, বেস সাইজ",
    rule: "naturalWidth ০/NaN → fontSize = base, lines 1; min > base হলে base",
    run: () => {
      const a = fitCaption({ naturalWidth: 0, baseSize: 66, minSize: 40, maxWidth: 898, maxHeight: 389 });
      const b = fitCaption({ naturalWidth: NaN, baseSize: 66, minSize: 40, maxWidth: 898, maxHeight: 389 });
      const c = fitCaption({ naturalWidth: 800, baseSize: 50, minSize: 90, maxWidth: 898, maxHeight: 389 });
      const d = fitCaption({ naturalWidth: 800, baseSize: 66, minSize: 40, maxWidth: -5, maxHeight: -5 });
      return firstFail(
        expectEq("০ → base", a.fontSize, 66),
        expectEq("NaN → base", b.fontSize, 66),
        expectEq("min > base → base", c.fontSize, 50),
        expectEq("ঋণাত্মক জায়গা → base", d.fontSize, 66),
        expectEq("ঋণাত্মক জায়গা maxLines ≥ ১", d.maxLines >= 1, true),
      );
    },
  },

  // ---- থিমে পাঠযোগ্যতা ----
  ...THEME_LIST.map(
    (theme): Def => ({
      id: `contrast-${theme}`,
      title: `${theme}: দিন/গোধূলি/রাতে লেখার কনট্রাস্ট (প্যানেলের নিচে সবচেয়ে উজ্জ্বল আকাশ ধরে)`,
      rule: "মূল লেখা ও ৬ active রঙ ≥ ৪.৫; upcoming (৪৫% স্বচ্ছ) ≥ ৩",
      run: () => {
        for (const nf of theme === "greenDayNight" ? NIGHTS : [0]) {
          const text = worstContrast(theme, nf, (p) => p.text);
          if (text < 4.5) return `nf ${nf}: মূল লেখা ${text.toFixed(2)} < ৪.৫`;
          for (let i = 0; i < 6; i += 1) {
            const c = worstContrast(theme, nf, (p) => p.captionColors[i]);
            if (c < 4.5) return `nf ${nf}: active রঙ #${i} ${c.toFixed(2)} < ৪.৫`;
          }
          const up = worstContrast(theme, nf, (p) => p.text, UPCOMING_OPACITY);
          if (up < 3) return `nf ${nf}: upcoming ${up.toFixed(2)} < ৩`;
        }
        return null;
      },
    }),
  ),
  {
    id: "theme-colors",
    title: "প্রতি থিমে ৬টা active রঙ আছে (দিন-রাতের সেট সমান দৈর্ঘ্যের)",
    rule: "captionColors.length = ৬ (day/night দুই সেটেই)",
    run: () => {
      for (const t of THEME_LIST) {
        const th = THEMES[t];
        if (th.day.captionColors.length !== 6 || th.night.captionColors.length !== 6) return `${t}: ৬টা নয়`;
      }
      return null;
    },
  },

  // ---- আসল buildFrameSegments-এর সাথে ----
  {
    id: "real-segments",
    title: "আসল computeTiming + buildFrameSegments: প্রতিটা শব্দ কোনো সেগমেন্টের ভেতরে ঠিক একবার active হয়",
    rule: "words না থাকলে সমান ভাগ; প্রতি সেগমেন্টে প্রতিটা শব্দ অন্তত এক ফ্রেম active",
    run: () => {
      const timing = computeTiming({ introSeconds: 3, outroSeconds: 4, audioSeconds: 6 });
      const segs = buildFrameSegments(
        {
          segments: [
            { id: 1, start: 0, end: 2, text: "এক দুই তিন চার পাঁচ" },
            { id: 2, start: 2, end: 6, text: "ছয় সাত আট নয় দশ এগারো" },
          ],
        },
        timing,
      );
      for (const s of segs) {
        const seen = new Set<number>();
        for (let f = s.startFrame; f < s.endFrame; f += 1) {
          const i = activeWordIndex(s.words, f, timing.fps);
          if (i >= 0) seen.add(i);
        }
        if (seen.size !== s.words.length) return `সেগমেন্ট ${s.index}: ${seen.size}/${s.words.length} শব্দ active হয়েছে`;
      }
      return null;
    },
  },
  {
    id: "never-throws",
    title: "ভুল/খালি/অসংখ্যা ইনপুটে কোনো ফাংশন throw করে না",
    rule: "wordLook/activeWordIndex/wordReleaseFrame/planCaption — junk ইনপুটে নিরাপদ",
    run: () => {
      try {
        wordLook([], 0, 10);
        wordLook([W(1, 2)], 5, 10);
        wordLook([W(1, 2)], 0, NaN);
        activeWordIndex([], 10);
        wordReleaseFrame([], 3);
        planCaption([seg(0, 5, 5)], 5);
        planCaption([seg(0, 5, 5)], 4);
        return null;
      } catch (e) {
        return `throw: ${String(e)}`;
      }
    },
  },
];

export const CAPTION_CASE_COUNT = defs.length;

export function runCaptionCases(): CaptionCaseOutcome[] {
  return defs.map((d) => {
    try {
      const detail = d.run();
      return { id: d.id, title: d.title, rule: d.rule, ok: detail === null, detail: detail ?? "" };
    } catch (e) {
      return { id: d.id, title: d.title, rule: d.rule, ok: false, detail: `কেস নিজেই ভেঙেছে: ${String(e)}` };
    }
  });
}
