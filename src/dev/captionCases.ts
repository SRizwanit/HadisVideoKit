import { getThemeColors, parseColor, THEMES } from "../themes";
import type { ThemeId } from "../types";
import { computeLayout } from "../lib/useLayout";
import { buildFrameSegments, computeTiming } from "../lib/timing";
import type { FrameSegment, FrameWord } from "../lib/timing";
import {
  ACTIVE_HOLD_FRAMES,
  CAPTION_LINE_HEIGHT,
  CAPTION_MAX_LINES,
  ENTER_FRAMES,
  EXIT_FRAMES,
  LINE_FILL,
  PAGE_FADE_FROM,
  POP_SCALE,
  SLIDE_UNITS,
  UPCOMING_OPACITY,
  WORD_RELAX_FRAMES,
  activeWordIndex,
  clampBoxToSafe,
  fitCaption,
  pageIndexAt,
  pageTextOpacity,
  paginateCaption,
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

  // ---- (ক্যাপশন-ফিক্স) পেজিং: সর্বোচ্চ ২ লাইন, শব্দ ধরে ----
  {
    id: "page-max2",
    title: "যত লম্বা লেখাই হোক: প্রতি পেজে ≤ ২ লাইন, প্রতিটা শব্দ ঠিক একবার, ক্রম ঠিক, লাইন প্রস্থের ভেতরে",
    rule: "১…৩০০ শব্দ × ৩ রকম প্রস্থ-ছাঁদ: পেজ লাইন ≤ ২; পেজগুলো ০…n জুড়ে ফাঁক/ওভারল্যাপ ছাড়া; প্রতি লাইনের প্রস্থ ≤ maxWidth × LINE_FILL (একক শব্দ বাদে)",
    run: () => {
      const spans = [120, 150, 190];
      for (const n of [1, 2, 3, 5, 8, 13, 40, 120, 300]) {
        for (const seed of [1, 2, 3]) {
          const widths = Array.from({ length: n }, (_, i) => 60 + ((i * 37 * seed + 11 * seed) % spans[seed - 1]));
          const r = paginateCaption({ wordWidths: widths, spaceWidth: 18, maxWidth: 898, maxHeight: 389, baseSize: 66 });
          let next = 0;
          for (const pg of r.pages) {
            if (pg.start !== next) return `n=${n} seed=${seed}: পেজ ${pg.start} থেকে শুরু (চাই ${next})`;
            if (pg.lines.length < 1 || pg.lines.length > CAPTION_MAX_LINES) return `n=${n} seed=${seed}: পেজে ${pg.lines.length} লাইন`;
            let li = pg.start;
            for (const ln of pg.lines) {
              if (ln.start !== li || ln.end <= ln.start) return `n=${n}: লাইন ভাঙা (${ln.start}…${ln.end})`;
              li = ln.end;
              let w = 0;
              for (let k = ln.start; k < ln.end; k += 1) w += widths[k] * r.scale + (k > ln.start ? 18 * r.scale : 0);
              if (ln.end - ln.start > 1 && w > 898 * LINE_FILL + 1e-6) return `n=${n} seed=${seed}: লাইন ${w.toFixed(0)} > ${(898 * LINE_FILL).toFixed(0)}`;
            }
            if (li !== pg.end) return `n=${n}: লাইন পেজ শেষ ছোঁয় না`;
            next = pg.end;
          }
          if (next !== n) return `n=${n} seed=${seed}: শব্দ ঢাকা পড়েছে ${next}/${n}`;
        }
      }
      return null;
    },
  },
  {
    id: "page-short",
    title: "ছোট লেখা → এক পেজ, বেস ফন্ট (scale ১); লম্বা → একাধিক পেজ, ফন্ট তবু বেস",
    rule: "৬টা ছোট শব্দ → pages = ১, scale = ১; ৪০টা শব্দ → pages ≥ ২, scale = ১ (ফন্ট ছোট হয় না)",
    run: () => {
      const short = paginateCaption({ wordWidths: [150, 120, 130, 160, 140, 200], spaceWidth: 18, maxWidth: 898, maxHeight: 389, baseSize: 66 });
      const long = paginateCaption({ wordWidths: Array.from({ length: 40 }, () => 150), spaceWidth: 18, maxWidth: 898, maxHeight: 389, baseSize: 66 });
      return firstFail(
        expectEq("ছোট: পেজ", short.pages.length, 1),
        expectEq("ছোট: scale", short.scale, 1),
        long.pages.length >= 2 ? null : `লম্বা: পেজ ${long.pages.length}`,
        expectEq("লম্বা: scale", long.scale, 1),
        expectEq("লম্বা: overflow", long.overflow, false),
      );
    },
  },
  {
    id: "page-no-orphan",
    title: "শেষ পেজে একলা শব্দ পড়ে থাকে না (আগের পেজ থেকে একটা এসে জোড়া বাঁধে)",
    rule: "৫টা শব্দ ২ লাইনে + ১টা বাড়তি → শেষ পেজে ≥ ২ শব্দ; আগের পেজ ≤ ২ লাইন",
    run: () => {
      // প্রতি শব্দ ৩৫০ → লাইনে ২টা (৭০০+১৮ ≤ ৭৭২); পেজে ৪টা; ৫ শব্দ → ৪ + ১ (orphan)
      const r = paginateCaption({ wordWidths: [350, 350, 350, 350, 350], spaceWidth: 18, maxWidth: 898, maxHeight: 389, baseSize: 66 });
      const last = r.pages[r.pages.length - 1];
      const prev = r.pages[r.pages.length - 2];
      return firstFail(
        expectEq("পেজ সংখ্যা", r.pages.length, 2),
        last && last.end - last.start >= 2 ? null : `শেষ পেজে ${last ? last.end - last.start : 0} শব্দ`,
        expectEq("ক্রম: আগের শেষ = শেষের শুরু", prev?.end, last?.start),
        prev && prev.lines.length <= CAPTION_MAX_LINES && last.lines.length <= CAPTION_MAX_LINES ? null : "লাইন সীমা ভেঙেছে",
        expectEq("মোট শব্দ", last?.end, 5),
      );
    },
  },
  {
    id: "page-wide-word",
    title: "খুব চওড়া একটা শব্দ → ফন্ট নামে যাতে এক লাইনে আঁটে; ২ লাইনের উচ্চতাও মানে",
    rule: "শব্দ ১৫০০ > ৭৭২ → scale < ১ ও শব্দ আঁটে (overflow নয়); ছোট বাক্সে (উচ্চতা ১০০) ২ × ফন্ট × lineHeight ≤ ১০০",
    run: () => {
      const r = paginateCaption({ wordWidths: [200, 1500, 200], spaceWidth: 18, maxWidth: 898, maxHeight: 389, baseSize: 66 });
      const widest = 1500 * r.scale;
      const h = paginateCaption({ wordWidths: [200, 200, 200], spaceWidth: 18, maxWidth: 898, maxHeight: 100, baseSize: 66 });
      return firstFail(
        r.scale < 1 ? null : `scale ${r.scale}`,
        widest <= 898 * LINE_FILL + 1e-6 ? null : `শব্দ ${widest.toFixed(0)} আঁটেনি`,
        expectEq("overflow", r.overflow, false),
        2 * 66 * h.scale * CAPTION_LINE_HEIGHT <= 100 + 1e-6 ? null : `উচ্চতা ${(2 * 66 * h.scale * CAPTION_LINE_HEIGHT).toFixed(1)} > ১০০`,
        h.pages.every((pg) => pg.lines.length <= CAPTION_MAX_LINES) ? null : "ছোট বাক্সে লাইন > ২",
        paginateCaption({ wordWidths: [1e7], spaceWidth: 18, maxWidth: 898, maxHeight: 389, baseSize: 66 }).overflow ? null : "অসম্ভব চওড়া শব্দে overflow জানায়নি",
      );
    },
  },
  {
    id: "page-safe",
    title: "ভুল ইনপুটে (খালি, NaN, ঋণাত্মক, ০ প্রস্থ) ক্র্যাশ নেই; খালি → পেজ নেই",
    rule: "খালি → pages = []; NaN/ঋণাত্মক প্রস্থ → ০ ধরে; maxWidth ০ → প্রতি লাইনে ১ শব্দ, তবু ≤ ২ লাইন/পেজ",
    run: () => {
      try {
        const empty = paginateCaption({ wordWidths: [], spaceWidth: 18, maxWidth: 898, maxHeight: 389, baseSize: 66 });
        const junk = paginateCaption({ wordWidths: [NaN, -5, Infinity, 100], spaceWidth: NaN, maxWidth: 898, maxHeight: 389, baseSize: 66 });
        const zero = paginateCaption({ wordWidths: [100, 100, 100, 100, 100], spaceWidth: 10, maxWidth: 0, maxHeight: 0, baseSize: 66 });
        const bad = paginateCaption(null as unknown as Parameters<typeof paginateCaption>[0]);
        return firstFail(
          expectEq("খালি", empty.pages.length, 0),
          expectEq("junk: শব্দ ঢাকা", junk.pages[junk.pages.length - 1]?.end, 4),
          zero.pages.every((pg) => pg.lines.length <= CAPTION_MAX_LINES) ? null : "maxWidth ০: লাইন > ২",
          expectEq("maxWidth ০: শব্দ ঢাকা", zero.pages[zero.pages.length - 1]?.end, 5),
          expectEq("null ইনপুট", bad.pages.length, 0),
        );
      } catch (e) {
        return `throw: ${String(e)}`;
      }
    },
  },
  {
    id: "page-index",
    title: "পেজ বদলায় ঠিক সেই পেজের প্রথম শব্দের শুরুর ফ্রেমে; পিছনে যায় না; পেজ ০ শুরু থেকেই",
    rule: "পেজ ১-এর প্রথম শব্দ ১৩০-এ → ১২৯ পর্যন্ত পেজ ০, ১৩০ থেকে পেজ ১; ফ্রেম বাড়লে সূচক কমে না",
    run: () => {
      const words = [W(100, 115), W(115, 130), W(130, 145), W(145, 160), W(160, 175)];
      const pages = [
        { start: 0, end: 2, lines: [{ start: 0, end: 2 }] },
        { start: 2, end: 4, lines: [{ start: 2, end: 4 }] },
        { start: 4, end: 5, lines: [{ start: 4, end: 5 }] },
      ];
      let last = 0;
      for (let f = 90; f < 200; f += 1) {
        const k = pageIndexAt(pages, words, f);
        if (k < last) return `ফ্রেম ${f}: পেজ পিছিয়েছে (${last} → ${k})`;
        last = k;
      }
      return firstFail(
        expectEq("শুরুর আগেও পেজ ০", pageIndexAt(pages, words, 50), 0),
        expectEq("১২৯", pageIndexAt(pages, words, 129), 0),
        expectEq("১৩০", pageIndexAt(pages, words, 130), 1),
        expectEq("১৫৯", pageIndexAt(pages, words, 159), 1),
        expectEq("১৬০", pageIndexAt(pages, words, 160), 2),
        expectEq("পেজ নেই", pageIndexAt([], words, 130), -1),
        expectEq("NaN ফ্রেম", pageIndexAt(pages, words, NaN), 0),
      );
    },
  },
  {
    id: "page-fade",
    title: "নতুন পেজের লেখা আসে ধীরে (০.৩ → ১, ৬ ফ্রেমে); পেজ ০ সবসময় ১",
    rule: "pageTextOpacity(০, …) = ১; পেজ ১ শুরুর ফ্রেমে = ০.৩; ৬ ফ্রেম পরে = ১; মাঝে ক্রমে বাড়ে",
    run: () =>
      firstFail(
        expectEq("পেজ ০", pageTextOpacity(0, 100, 100), 1),
        near("পেজ ১ শুরু", pageTextOpacity(1, 130, 130), PAGE_FADE_FROM, 1e-9),
        expectEq("৬ ফ্রেম পরে", pageTextOpacity(1, 130, 136), 1),
        pageTextOpacity(1, 130, 132) > pageTextOpacity(1, 130, 131) ? null : "opacity ক্রমে বাড়ছে না",
        pageTextOpacity(1, 130, 120) >= PAGE_FADE_FROM - 1e-9 ? null : "শুরুর আগে ০.৩-এর নিচে",
        expectEq("NaN", Number.isFinite(pageTextOpacity(2, NaN, NaN)), true),
      ),
  },
  {
    id: "page-real-segments",
    title: "আসল buildFrameSegments + আন্দাজ-প্রস্থ: প্রতি সেগমেন্টে প্রতিটা শব্দ কোনো পেজে আছে, পেজ-ক্রমে active শব্দও এগোয়",
    rule: "পেজ সূচক সময়ের সাথে কমে না; active শব্দ সবসময় বর্তমান পেজের [start, end)-এ",
    run: () => {
      const timing = computeTiming({ introSeconds: 3, outroSeconds: 4, audioSeconds: 12 });
      const text = Array.from({ length: 36 }, (_, i) => "শব্দ".repeat(1 + (i % 3)) + String(i)).join(" ");
      const segs = buildFrameSegments({ segments: [{ id: 1, start: 0, end: 12, text }] }, timing);
      const s = segs[0];
      const widths = s.words.map((w) => w.word.length * 40);
      const r = paginateCaption({ wordWidths: widths, spaceWidth: 16, maxWidth: 898, maxHeight: 389, baseSize: 66 });
      if (r.pages.length < 2) return `পেজ ${r.pages.length}`;
      let last = 0;
      for (let f = s.startFrame; f < s.endFrame; f += 1) {
        const k = pageIndexAt(r.pages, s.words, f);
        if (k < last) return `ফ্রেম ${f}: পেজ পিছিয়েছে`;
        last = k;
        const a = activeWordIndex(s.words, f, timing.fps);
        if (a >= 0 && (a < r.pages[k].start || a >= r.pages[k].end)) return `ফ্রেম ${f}: active শব্দ ${a} পেজ ${k} (${r.pages[k].start}…${r.pages[k].end})-এর বাইরে`;
      }
      return null;
    },
  },

  // ---- (ক্যাপশন-ফিক্স) নিরাপদ মার্জিন ----
  {
    id: "safe-clamp",
    title: "বাক্স layout.safe-এর ভেতরে: ভেতরে থাকলে হুবহু একই; বাইরে গেলে টেনে আনা",
    rule: "আসল ৪টা layout-এ clampBoxToSafe(captionBox) = captionBox; বাইরের বাক্স safe-এর ভেতরে আসে; ভুল ইনপুটে throw নেই",
    run: () => {
      for (const [w, h] of [[1080, 1920], [1920, 1080], [2160, 3840], [3840, 2160]] as const) {
        const L = computeLayout(w, h);
        const c = clampBoxToSafe(L.captionBox, L.safe, { width: w, height: h });
        for (const k of ["x", "y", "width", "height"] as const) {
          if (Math.abs(c[k] - L.captionBox[k]) > 1e-6) return `${w}×${h}: ${k} বদলে গেছে (${L.captionBox[k]} → ${c[k]})`;
        }
        if (c.x < L.safe.left - 1e-6 || c.x + c.width > w - L.safe.right + 1e-6) return `${w}×${h}: ডান-বাঁ মার্জিনের বাইরে`;
        if (c.y < L.safe.top - 1e-6 || c.y + c.height > h - L.safe.bottom + 1e-6) return `${w}×${h}: উপর-নিচ মার্জিনের বাইরে`;
      }
      const safe = { top: 67, bottom: 163, left: 59, right: 59 };
      const out = clampBoxToSafe({ x: -20, y: 1700, width: 1200, height: 400 }, safe, { width: 1080, height: 1920 });
      try {
        clampBoxToSafe({ x: NaN, y: NaN, width: NaN, height: NaN }, safe, { width: 1080, height: 1920 });
        clampBoxToSafe(null as unknown as Parameters<typeof clampBoxToSafe>[0], safe, { width: 1080, height: 1920 });
      } catch (e) {
        return `throw: ${String(e)}`;
      }
      return firstFail(
        out.x >= 59 && out.x + out.width <= 1080 - 59 ? null : `ডান-বাঁ: ${out.x}…${out.x + out.width}`,
        out.y >= 67 && out.y + out.height <= 1920 - 163 ? null : `উপর-নিচ: ${out.y}…${out.y + out.height}`,
        out.width > 0 && out.height > 0 ? null : "শূন্য মাপ",
      );
    },
  },
  {
    id: "safe-two-lines-fit",
    title: "আসল layout-এ বেস ফন্টে ২ লাইন ক্যাপশন-বাক্সের ভেতরের উচ্চতায় আঁটে (৪টা সাইজেই)",
    rule: "২ × captionMax × lineHeight ≤ captionBox.height − ২ × padding",
    run: () => {
      for (const [w, h] of [[1080, 1920], [1920, 1080], [2160, 3840], [3840, 2160]] as const) {
        const L = computeLayout(w, h);
        const inner = L.captionBox.height - 2 * 36 * L.unit;
        const need = CAPTION_MAX_LINES * L.fontSizes.captionMax * CAPTION_LINE_HEIGHT;
        if (need > inner + 1e-6) return `${w}×${h}: ২ লাইন ${need.toFixed(1)} > ভেতরের উচ্চতা ${inner.toFixed(1)}`;
      }
      return null;
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
