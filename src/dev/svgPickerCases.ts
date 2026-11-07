import {
  forcedName,
  normalizeAvailable,
  pickSvgDetailed,
  pickSvgForSegment,
  pickSvgNames,
  pickSvgReport,
  resetPickWarnings,
} from "../lib/svgPicker";

/**
 * Part 9G (dev): svgPicker-এর পরীক্ষার কেস — React ছাড়া, তাই সাধারণ Node-এও চলে; `SvgPickerCheck` শুধু আঁকে।
 * Part 9H এই তালিকায় নতুন কেস যোগ করেছে (N = 0, ফোল্ডারে নেই এমন নাম, ওয়ার্নিং একবারই); 9G-র দুটো কেসের প্রত্যাশা
 * 9H-র নিয়মে বদলেছে (নিচে `n-zero-safe`, `long-mixed`-এ মন্তব্য দেখুন)।
 * `segs`: প্রতি সেগমেন্টে JSON-এর `svg` (`null` = লেখা নেই)।
 */

export type PickCaseOutcome = {
  id: string;
  title: string;
  ok: boolean;
  segs: (string | null)[];
  available: string[];
  got: (string | null)[];
  expected: (string | null)[] | null;
  sources: string[];
  /** এই কলে যে ওয়ার্নিংগুলো উঠেছে (বার্তা) */
  warnings: string[];
  /** প্রত্যাশিত ওয়ার্নিং-সংখ্যা */
  expectedWarnings: number;
  note: string;
};

type Def = {
  id: string;
  title: string;
  segs: (string | null)[];
  available: string[];
  expected: (string | null)[];
  /** প্রত্যাশিত ওয়ার্নিং-সংখ্যা (না দিলে 0) */
  warns?: number;
  /** শুধু এই কেসের অতিরিক্ত শর্ত (ব্যর্থ হলে বার্তা); `warnings` = এই কলের ওয়ার্নিং-বার্তা */
  extra?: (got: (string | null)[], warnings: string[]) => string | null;
};

const mk = (segs: (string | null)[]) => segs.map((s) => (s === null ? {} : { svg: s }));

const S12 = ["svg1", "svg2"];
const S123 = ["svg1", "svg2", "svg3"];

const DEFS: Def[] = [
  { id: "all-forced", title: "সব সেগমেন্টে `svg` লেখা → ঠিক সেগুলোই", segs: ["svg3", "svg1", "svg2", "svg3"], available: S123, expected: ["svg3", "svg1", "svg2", "svg3"] },
  { id: "none-5-2", title: "কোনোটায় লেখা নেই: ৫ সেগমেন্ট + ২ SVG → svg1, svg2, svg1, svg2, svg1", segs: [null, null, null, null, null], available: S12, expected: ["svg1", "svg2", "svg1", "svg2", "svg1"] },
  { id: "more-segs", title: "ফাইলের চেয়ে সেগমেন্ট বেশি: ৭ সেগমেন্ট, ৩ SVG → ঘুরে ঘুরে", segs: [null, null, null, null, null, null, null], available: S123, expected: ["svg1", "svg2", "svg3", "svg1", "svg2", "svg3", "svg1"] },
  { id: "mixed", title: "মিশ্র: লেখা নেই / svg3 / … / svg1 / … — লেখাগুলো গণনায় ধরা হয় না, লেখা নামের পাশে সমান নাম এড়ানো", segs: [null, "svg3", null, null, "svg1", null], available: S123, expected: ["svg1", "svg3", "svg2", "svg3", "svg1", "svg2"] },
  { id: "forced-neighbor", title: "লেখা svg1-এর পরে ঘোরানো প্রার্থী svg1 হলে এক ধাপ এগোয়: [svg1, –, –] → svg1, svg2, svg1", segs: ["svg1", null, null], available: S12, expected: ["svg1", "svg2", "svg1"] },
  { id: "forced-twice", title: "লেখা নাম পাশাপাশি একই হলে তা মানা হয় (ব্যতিক্রম): [svg2, svg2, –]", segs: ["svg2", "svg2", null], available: S123, expected: ["svg2", "svg2", "svg1"] },
  { id: "single", title: "মাত্র ১টা SVG (N = 1): সবাই svg1 (পাশাপাশি একই এড়ানো অসম্ভব)", segs: [null, null, null], available: ["svg1"], expected: ["svg1", "svg1", "svg1"] },
  { id: "gaps-unsorted", title: "ফাঁকসহ ও এলোমেলো তালিকা [svg10, svg3, svg1] → সংখ্যা ধরে svg1, svg3, svg10 ঘোরে", segs: [null, null, null, null], available: ["svg10", "svg3", "svg1"], expected: ["svg1", "svg3", "svg10", "svg1"] },
  // 9H-তে বদলেছে: ফোল্ডার ফাঁকা হলে লেখা নামের ফাইলও নেই, তাই সেটাও fallback (৯জি-তে ছিল [null, "svg2", null]); ওয়ার্নিং একটাই
  { id: "n-zero-safe", title: "SVG নেই (N = 0): লেখা নামসহ সব সেগমেন্টে null (fallback), কোনো ক্র্যাশ নেই, ওয়ার্নিং ১টা", segs: [null, "svg2", null], available: [], expected: [null, null, null], warns: 1 },
  { id: "empty", title: "সেগমেন্ট নেই → খালি তালিকা", segs: [], available: S12, expected: [] },
  {
    id: "dirty-input",
    title: "নোংরা ইনপুট: `svg` খালি/null/সংখ্যা/অবৈধ অক্ষর = লেখা নেই; `available`-এ ডুপ্লিকেট ও অবৈধ নাম বাদ",
    segs: ["", null, "../x", "svg2"],
    available: ["svg1", "svg1", "bad name", "svg2", ""],
    expected: ["svg1", "svg2", "svg1", "svg2"],
    warns: 1, // 9H: "../x" অবৈধ নাম → ঘোরানো হয় (আগের মতোই) + একটা ওয়ার্নিং
    extra: () => {
      const quiet = { warn: () => {} }; // নোংরা ইনপুটের ওয়ার্নিং এখানে ছাপার দরকার নেই
      const weird = pickSvgNames([{ svg: 5 as unknown as string }, { svg: null }, { svg: undefined }], S12, quiet);
      const bad = pickSvgNames(null as unknown as [], S12, quiet);
      const badAvail = pickSvgNames([{}, {}], "x" as unknown as string[], quiet);
      return weird.join() === "svg1,svg2,svg1" && bad.length === 0 && badAvail.join() === "," ? null : `weird=${weird} bad=${bad} badAvail=${badAvail}`;
    },
  },
  {
    id: "pure",
    title: "বিশুদ্ধ: একই ইনপুট দু'বার → একই ফল; ইনপুটের তালিকা বদলায় না",
    segs: [null, "svg2", null, null],
    available: ["svg3", "svg1", "svg2"],
    expected: ["svg1", "svg2", "svg3", "svg1"],
    extra: () => {
      const segs = mk([null, "svg2", null, null]);
      const avail = ["svg3", "svg1", "svg2"];
      const a = pickSvgNames(segs, avail).join();
      const b = pickSvgNames(segs, avail).join();
      return a === b && avail.join() === "svg3,svg1,svg2" && JSON.stringify(segs) === JSON.stringify(mk([null, "svg2", null, null])) ? null : `a=${a} b=${b} avail=${avail}`;
    },
  },
  {
    id: "for-segment",
    title: "`pickSvgForSegment(i)` = তালিকার i-তম; সীমার বাইরে/ভগ্নাংশ/ঋণাত্মক → null",
    segs: [null, "svg3", null],
    available: S123,
    expected: ["svg1", "svg3", "svg2"],
    extra: () => {
      const segs = mk([null, "svg3", null]);
      const one = [0, 1, 2].map((i) => pickSvgForSegment(segs, i, S123)).join();
      const out = [pickSvgForSegment(segs, 3, S123), pickSvgForSegment(segs, -1, S123), pickSvgForSegment(segs, 0.5, S123)];
      return one === "svg1,svg3,svg2" && out.every((v) => v === null) ? null : `one=${one} out=${out}`;
    },
  },
  {
    id: "long-4",
    title: "লম্বা ক্রম: ২০০ সেগমেন্ট, ৪ SVG, কোনোটায় লেখা নেই → পাশাপাশি কখনো একই নয়; প্রতিটা সমান ব্যবহার",
    segs: Array.from({ length: 200 }, () => null),
    available: ["svg1", "svg2", "svg3", "svg4"],
    expected: Array.from({ length: 200 }, (_, i) => `svg${(i % 4) + 1}`),
    extra: (got) => {
      for (let i = 1; i < got.length; i++) if (got[i] === got[i - 1]) return `${i}-এ পাশাপাশি একই (${got[i]})`;
      const c: Record<string, number> = {};
      got.forEach((g) => (c[g ?? "null"] = (c[g ?? "null"] ?? 0) + 1));
      const v = Object.values(c);
      return Math.max(...v) - Math.min(...v) <= 1 ? null : `অসম ব্যবহার ${JSON.stringify(c)}`;
    },
  },
  {
    id: "long-mixed",
    title: "লম্বা মিশ্র ক্রম (প্রতি ৩য়-য় লেখা নাম): লেখা নাম সবসময় মানা; ঘোরানোগুলো পাশের সঙ্গে একই নয়",
    // 9H-তে লেখা নামগুলো এখন সবই ফোল্ডারে থাকা নাম (svg1–svg3), নইলে সেগুলো fallback হয়ে যেত (৯জি-তে svg4/svg5-ও ছিল)
    segs: Array.from({ length: 60 }, (_, i) => (i % 3 === 2 ? `svg${(Math.floor(i / 3) % 3) + 1}` : null)),
    available: ["svg1", "svg2", "svg3"],
    expected: [],
    extra: (got) => {
      const segs = Array.from({ length: 60 }, (_, i) => (i % 3 === 2 ? `svg${(Math.floor(i / 3) % 3) + 1}` : null));
      for (let i = 0; i < segs.length; i++) {
        if (segs[i] !== null && got[i] !== segs[i]) return `${i}: লেখা ${segs[i]} মানা হয়নি (${got[i]})`;
        if (segs[i] === null && i > 0 && got[i] === got[i - 1]) return `${i}: ঘোরানো ${got[i]} পাশেরটার সমান`;
      }
      return got.length === 60 ? null : "দৈর্ঘ্য মেলেনি";
    },
  },

  // ───────── Part 9H: কোণার কেস ─────────
  {
    id: "n0-all",
    title: "9H · N = 0, কোনোটায় লেখা নেই: সব null (fallback) + ওয়ার্নিং ঠিক ১টা (ফোল্ডারের কথা বলে)",
    segs: [null, null, null, null],
    available: [],
    expected: [null, null, null, null],
    warns: 1,
    extra: (_g, w) => (w.length === 1 && w[0].includes("public/svg/") && w[0].includes("4টা") ? null : `warnings=${JSON.stringify(w)}`),
  },
  {
    id: "n0-forced",
    title: "9H · N = 0, তিনটায় তিন রকম নাম লেখা: সবই fallback, তবু ওয়ার্নিং ১টাই (নামপ্রতি ৩টা নয়)",
    segs: ["svg1", null, "svg2", "svg7"],
    available: [],
    expected: [null, null, null, null],
    warns: 1,
    extra: (_g, w) => {
      const src = pickSvgDetailed(mk(["svg1", null, "svg2", "svg7"]), [], { warn: () => {} }).map((x) => x.source).join();
      return w.length === 1 && w[0].includes('"svg1"') && w[0].includes('"svg7"') && src === "missing,fallback,missing,missing" ? null : `src=${src} w=${JSON.stringify(w)}`;
    },
  },
  {
    id: "n0-no-segs",
    title: "9H · N = 0 আর সেগমেন্টও নেই: খালি তালিকা, ওয়ার্নিং নেই (ছাপার মতো কিছু নেই)",
    segs: [],
    available: [],
    expected: [],
    warns: 0,
  },
  {
    id: "missing-name",
    title: "9H · লেখা `svg9` ফোল্ডারে নেই (svg1, svg2 আছে): সেই সেগমেন্টে null (fallback) + ওয়ার্নিং ১টা; ঘোরানো ক্রম এলোমেলো হয় না",
    segs: [null, "svg9", null, null],
    available: S12,
    expected: ["svg1", null, "svg2", "svg1"],
    warns: 1,
    extra: (_g, w) => {
      const d = pickSvgDetailed(mk([null, "svg9", null, null]), S12, { warn: () => {} });
      const one = pickSvgForSegment(mk([null, "svg9", null, null]), 1, S12, { warn: () => {} });
      return w.length === 1 && w[0].includes('"svg9"') && w[0].includes("সেগমেন্ট 2") && d[1].source === "missing" && d[1].requested === "svg9" && one === null
        ? null
        : `w=${JSON.stringify(w)} d1=${JSON.stringify(d[1])} one=${one}`;
    },
  },
  {
    id: "missing-repeat",
    title: "9H · একই ভুল নাম ৩ বার + আরেকটা ভুল নাম ১ বার: ওয়ার্নিং ২টা (নামপ্রতি ১টা, বারবার নয়)",
    segs: ["svg9", null, "svg9", "svg8", "svg9"],
    available: S12,
    expected: [null, "svg1", null, null, null],
    warns: 2,
    extra: (_g, w) => (w.length === 2 && w[0].includes("সেগমেন্ট 1, 3, 5") && w[1].includes('"svg8"') ? null : `w=${JSON.stringify(w)}`),
  },
  {
    id: "missing-case",
    title: "9H · `SVG1` লেখা কিন্তু ফোল্ডারে `svg1`: নিজে ঠিক করা হয় না (fallback), ওয়ার্নিংয়ে বড়/ছোট হাতের ইঙ্গিত",
    segs: ["SVG1", null],
    available: S12,
    expected: [null, "svg1"],
    warns: 1,
    extra: (_g, w) => (w.length === 1 && w[0].includes("বড়/ছোট") && w[0].includes('"svg1"') ? null : `w=${JSON.stringify(w)}`),
  },
  {
    id: "bad-ext",
    title: "9H · `svg3.svg` (অবৈধ নাম) লেখা: আগের মতো \"লেখা নেই\" ধরে ঘোরানো হয় + ওয়ার্নিং ১টা (\".svg লিখবেন না\")",
    segs: [null, "svg3.svg", null],
    available: S123,
    expected: ["svg1", "svg2", "svg3"],
    warns: 1,
    extra: (_g, w) => (w.length === 1 && w[0].includes("অবৈধ") && w[0].includes(".svg") ? null : `w=${JSON.stringify(w)}`),
  },
  {
    id: "missing-long",
    title: "9H · চাপ-পরীক্ষা: ২০০ সেগমেন্ট, প্রতি ৭টায় `svg99` (নেই) — ক্র্যাশ নেই, ওয়ার্নিং ১টা, ঘোরানোগুলো পাশের সঙ্গে একই নয়",
    segs: Array.from({ length: 200 }, (_, i) => (i % 7 === 3 ? "svg99" : null)),
    available: ["svg1", "svg2", "svg3"],
    expected: [],
    warns: 1,
    extra: (got, w) => {
      for (let i = 0; i < got.length; i++) {
        const missing = i % 7 === 3;
        if (missing && got[i] !== null) return `${i}: fallback হওয়ার কথা (${got[i]})`;
        if (!missing && got[i] === null) return `${i}: ঘোরানো হওয়ার কথা, null এসেছে`;
        if (!missing && i > 0 && got[i] === got[i - 1]) return `${i}: ঘোরানো ${got[i]} পাশেরটার সমান`;
      }
      return got.length === 200 && w.length === 1 && w[0].includes("সেগমেন্ট 4, 11, 18, 25, 32 …") ? null : `len=${got.length} w=${JSON.stringify(w)}`;
    },
  },
  {
    id: "warn-once",
    title: "9H · ছাপা: একই ওয়ার্নিং-সেটে ২য় কলে আর ছাপে না; ডিফল্ট `console.warn` পথেও একবারই; রিসেটের পর আবার",
    segs: [null, "svg9", "svg9"],
    available: S12,
    expected: ["svg1", null, null],
    warns: 1,
    extra: () => {
      const segs = mk([null, "svg9", "svg9"]);
      // (ক) ইনজেক্ট করা warn + ভাগ করা সেট → প্রথম কলে ১টা, দ্বিতীয় কলে ০টা
      const got1: string[] = [];
      const shared = new Set<string>();
      pickSvgNames(segs, S12, { warn: (m) => got1.push(m), warned: shared });
      pickSvgNames(segs, S12, { warn: (m) => got1.push(m), warned: shared });
      // (খ) ভাগ করা সেট ছাড়া (কিন্তু warn দেওয়া) → প্রতি কলে নতুন সেট: ২ কলে ২টা
      const got2: string[] = [];
      pickSvgNames(segs, S12, { warn: (m) => got2.push(m) });
      pickSvgNames(segs, S12, { warn: (m) => got2.push(m) });
      // (গ) কোনো options ছাড়া → console.warn, মডিউল-স্তরের সেট: ৩ কলে ১টা; রিসেটের পর আবার ১টা
      const got3: string[] = [];
      const realWarn = console.warn;
      resetPickWarnings();
      try {
        console.warn = (...a: unknown[]) => {
          got3.push(a.map(String).join(" "));
        };
        pickSvgNames(segs, S12);
        pickSvgNames(segs, S12);
        pickSvgDetailed(segs, S12);
        const afterThree = got3.length;
        resetPickWarnings();
        pickSvgNames(segs, S12);
        resetPickWarnings();
        return got1.length === 1 && got2.length === 2 && afterThree === 1 && got3.length === 2
          ? null
          : `inject=${got1.length} fresh=${got2.length} console=${afterThree}/${got3.length}`;
      } finally {
        console.warn = realWarn;
        resetPickWarnings();
      }
    },
  },
  {
    id: "warn-throws",
    title: "9H · `warn` ফাংশন নিজে throw করলেও কিছু ভাঙে না, ফল একই; `pickSvgReport` কিছুই ছাপে না",
    segs: ["svg9", null, "svg1.svg"],
    available: S12,
    expected: [null, "svg1", "svg2"],
    warns: 2,
    extra: () => {
      const segs = mk(["svg9", null, "svg1.svg"]);
      const names = pickSvgNames(segs, S12, {
        warn: () => {
          throw new Error("warn ভেঙেছে");
        },
      });
      let printed = 0;
      const realWarn = console.warn;
      resetPickWarnings();
      try {
        console.warn = () => {
          printed += 1;
        };
        pickSvgReport(segs, S12); // শুদ্ধ: কিছু ছাপার কথা নয়
      } finally {
        console.warn = realWarn;
        resetPickWarnings();
      }
      return names.join() === ",svg1,svg2" && printed === 0 ? null : `names=${names} printed=${printed}`;
    },
  },
  {
    id: "helpers",
    title: "সহায়ক: normalizeAvailable (সংখ্যা-ক্রম, svgN-ছাড়া নাম পরে), forcedName",
    segs: [],
    available: [],
    expected: [],
    extra: () => {
      const n = normalizeAvailable(["zeta", "svg10", "svg2", "alpha", "svg2", "svg1"]).join();
      const f = [forcedName({ svg: "svg4" }), forcedName({ svg: "" }), forcedName({ svg: "a b" }), forcedName(null)].join();
      return n === "svg1,svg2,svg10,alpha,zeta" && f === "svg4,,," ? null : `n=${n} f=${f}`;
    },
  },
];

export const PICK_CASE_COUNT = DEFS.length;

export function runPickCases(): PickCaseOutcome[] {
  return DEFS.map((d) => {
    let got: (string | null)[] = [];
    let sources: string[] = [];
    let warnings: string[] = [];
    let note = "";
    let ok = false;
    const expectedWarnings = d.warns ?? 0;
    try {
      // শুদ্ধ রিপোর্ট (কিছু ছাপে না) থেকে ফল + ওয়ার্নিং
      const report = pickSvgReport(mk(d.segs), d.available);
      got = report.picks.map((x) => x.name);
      sources = report.picks.map((x) => x.source);
      warnings = report.warnings.map((x) => x.message);
      // pickSvgDetailed একই ফল দিতে হবে (ছাপা-স্তর ফল বদলায় না)
      const viaDetailed = pickSvgDetailed(mk(d.segs), d.available, { warn: () => {} }).map((x) => x.name);
      const sameAsExpected = d.expected.length === 0 && (d.id === "long-mixed" || d.id === "missing-long") ? true : JSON.stringify(got) === JSON.stringify(d.expected);
      const extraMsg = d.extra ? d.extra(got, warnings) : null;
      const warnOk = warnings.length === expectedWarnings;
      const sameDetailed = JSON.stringify(viaDetailed) === JSON.stringify(got);
      ok = sameAsExpected && extraMsg === null && warnOk && sameDetailed;
      if (ok) note = "ঠিক";
      else if (!sameAsExpected) note = "প্রত্যাশিত ক্রম মেলেনি";
      else if (!warnOk) note = `ওয়ার্নিং ${warnings.length}টা, প্রত্যাশিত ${expectedWarnings}টা`;
      else if (!sameDetailed) note = "pickSvgDetailed আলাদা ফল দিয়েছে";
      else note = `অতিরিক্ত শর্ত ব্যর্থ: ${extraMsg}`;
    } catch (err) {
      note = `ভেঙে পড়েছে: ${err instanceof Error ? err.message : String(err)}`;
    }
    return {
      id: d.id,
      title: d.title,
      ok,
      segs: d.segs,
      available: d.available,
      got,
      expected: d.expected.length ? d.expected : null,
      sources,
      warnings,
      expectedWarnings,
      note,
    };
  });
}
