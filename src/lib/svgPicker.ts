/**
 * Part 9G + 9H: কোন সেগমেন্টে কোন SVG — শুদ্ধ লজিক (React/DOM/ফাইল-সিস্টেম ছাড়া, কখনো throw করে না)।
 *
 * নিয়ম (9G — অপরিবর্তিত):
 *  1. সেগমেন্টে `svg` লেখা থাকলে (JSON: `"svg": "svg3"`) সেটাই চাওয়া হয়।
 *  2. বাকিগুলোয় `available` তালিকা (`svg1 … svgN`, সংখ্যা ধরে সাজানো) সিরিয়ালে ঘোরে; শেষে আবার প্রথমটায়।
 *     `svg` লেখা সেগমেন্ট ঘোরার গণনায় **ধরা হয় না** — তাই ক্রম এলোমেলো হয় না।
 *  3. N > 1 হলে পাশাপাশি দুই সেগমেন্টে একই SVG নয় (বাধ্যতামূলক নাম ছাড়া): ঘোরানো প্রার্থী আগের সেগমেন্টের
 *     SVG-র সমান হলে এক ধাপ এগিয়ে পরেরটা নেওয়া হয় (দুই ধাপই গণনায় ধরা হয়, তাই ক্রম একই দিকে চলতে থাকে)।
 *     বাধ্যতামূলক নাম দুটো পাশাপাশি একই হলে তা মানা হয়। N = 1 হলে সবই একই (এড়ানোর উপায় নেই)।
 *
 * কোণার কেস (9H):
 *  4. N = 0 (ফোল্ডারে কোনো SVG নেই): **সব** সেগমেন্টে `null` (= fallback আইকন) — লেখা নামও (ফাইলই নেই)।
 *     পুরো দৌড়ে মাত্র **একটা** ওয়ার্নিং (প্রতি নামের আলাদা ওয়ার্নিং নয়)।
 *  5. লেখা নাম `available`-এ না থাকলে সেই সেগমেন্টে `null` (fallback) + ওই নামের জন্য **একটা** ওয়ার্নিং
 *     (একই নাম আবার এলে আর নয়)। এমন সেগমেন্ট ঘোরার গণনায় ধরা হয় না (লেখা নামের মতোই)।
 *     বড়/ছোট হাতের অক্ষরের তফাত (`SVG1` ↔ `svg1`) ধরা হয় না, তবে ওয়ার্নিংয়ে ইঙ্গিত থাকে।
 *  6. `svg`-তে অবৈধ নাম লেখা (যেমন `svg3.svg`, `a b`, `../x`) আগের মতোই "লেখা নেই" (ঘোরানো হয়),
 *     তবে এখন তার জন্যও একটা ওয়ার্নিং — ভুলটা যেন চোখে পড়ে।
 *
 * ওয়ার্নিং: `console.warn` (বা `options.warn`) — একই বার্তা একই "warned" সেটে একবারই; ডিফল্টে মডিউল-স্তরের
 * সেট, তাই ভিডিওর প্রতি ফ্রেমে `useMemo` আবার চললেও একই বার্তা ফের ছাপা হয় না। `warn` ফাংশন নিজে throw করলেও
 * এই ফাইল ভাঙে না।
 *
 * `available`-এর উৎস Part 9I (`useSvgInventory().names`); এখানে ফোল্ডার ছোঁয়া হয় না।
 */

export type SegmentLike = { svg?: string | null };

/**
 * forced   = JSON-এ লেখা নাম, ফোল্ডারে আছে → সেটাই
 * rotation = সিরিয়ালে ঘোরানো
 * fallback = লেখা ছিল না, কিন্তু একটাও SVG নেই (N = 0) → fallback আইকন
 * missing  = JSON-এ লেখা নাম ফোল্ডারে নেই (বা N = 0) → fallback আইকন; `requested`-এ চাওয়া নামটা থাকে
 */
export type PickSource = "forced" | "rotation" | "fallback" | "missing";
export type PickedSvg = { name: string | null; source: PickSource; requested?: string };

/** একটা ওয়ার্নিং: `key` দিয়ে একই ওয়ার্নিং চেনা যায় (`empty`, `name:<নাম>`, `bad:<মান>`), `message` বাংলা বাক্য */
export type PickWarning = { key: string; message: string };
export type PickReport = { picks: PickedSvg[]; warnings: PickWarning[] };

export type PickOptions = {
  /** ওয়ার্নিং কোথায় যাবে; ডিফল্ট `console.warn` */
  warn?: (message: string) => void;
  /**
   * যেসব ওয়ার্নিং-key আগেই ছাপা হয়েছে। দিলে দুই কলের মধ্যেও একই ওয়ার্নিং একবারই ছাপা হয়।
   * না দিলে: `warn` দেওয়া থাকলে প্রতি কলে নতুন খালি সেট (পরীক্ষার জন্য নির্ধারিত আচরণ), না দিলে মডিউল-স্তরের সেট।
   */
  warned?: Set<string>;
};

const NAME_RE = /^[A-Za-z0-9_-]+$/;
const NUM_RE = /^svg(\d+)$/;

/** `svg2` < `svg10` (সংখ্যা ধরে), `svgN`-ছাড়া নাম পরে (বর্ণানুক্রমে); ডুপ্লিকেট ও অবৈধ নাম বাদ; মূল তালিকা বদলায় না */
export function normalizeAvailable(available: unknown): string[] {
  if (!Array.isArray(available)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of available) {
    if (typeof n === "string" && NAME_RE.test(n) && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  const key = (n: string): [number, string] => {
    const m = NUM_RE.exec(n);
    return m ? [Number(m[1]), n] : [Number.POSITIVE_INFINITY, n];
  };
  return out.sort((a, b) => {
    const [na, sa] = key(a);
    const [nb, sb] = key(b);
    return na !== nb ? na - nb : sa < sb ? -1 : sa > sb ? 1 : 0;
  });
}

/** সেগমেন্টে লেখা বাধ্যতামূলক নাম (খালি/অবৈধ/অন্য ধরনের মান = লেখা নেই) */
export function forcedName(seg: SegmentLike | null | undefined): string | null {
  const v = seg?.svg;
  return typeof v === "string" && NAME_RE.test(v) ? v : null;
}

/** সেগমেন্টে এমন নাম লেখা যা **অবৈধ** (খালি নয়, কিন্তু `[A-Za-z0-9_-]+` নয়) → সেই লেখা; নইলে `null` */
function badWrittenName(seg: SegmentLike | null | undefined): string | null {
  const v = seg?.svg;
  return typeof v === "string" && v.trim() !== "" && !NAME_RE.test(v) ? v : null;
}

/** `SVG1` লেখা, ফোল্ডারে `svg1` → `svg1` (শুধু ইঙ্গিতের জন্য; নিজে থেকে ঠিক করা হয় না — Linux-এ ফাইলের নাম বড়/ছোট হাতের ধরে) */
function caseTwin(name: string, list: readonly string[]): string | null {
  const low = name.toLowerCase();
  return list.find((x) => x.toLowerCase() === low) ?? null;
}

/** "সেগমেন্ট 2, 5, 9-এ" (বেশি হলে প্রথম ৫টা + "…") */
function segLabel(indices: readonly number[]): string {
  const shown = indices.slice(0, 5).map((i) => String(i + 1));
  return `সেগমেন্ট ${shown.join(", ")}${indices.length > 5 ? " …" : ""}-এ`;
}

function shorten(text: string, max = 40): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * প্রতি সেগমেন্টের SVG + কোথা থেকে এল + ওয়ার্নিংয়ের তালিকা — **কিছু ছাপে না** (শুদ্ধ ফাংশন)।
 * `warnings` এই কলের মধ্যেই ডুপ্লিকেট-মুক্ত (একই নাম/কারণ একবার)। ছাপার কাজ `pickSvgDetailed`-এর।
 */
export function pickSvgReport(segments: readonly SegmentLike[], available: readonly string[]): PickReport {
  const list = normalizeAvailable(available);
  const n = list.length;
  const have = new Set(list);
  const segs = Array.isArray(segments) ? segments : [];

  const picks: PickedSvg[] = [];
  // key → যেসব সেগমেন্টে ঘটেছে (প্রথম ঘটার ক্রমে)
  const where = new Map<string, number[]>();
  const info = new Map<string, { kind: "missing" | "bad"; value: string }>();
  const note = (key: string, kind: "missing" | "bad", value: string, index: number) => {
    const list2 = where.get(key);
    if (list2) list2.push(index);
    else {
      where.set(key, [index]);
      info.set(key, { kind, value });
    }
  };

  let idx = 0; // ঘোরার গণনা — শুধু ঘোরানো সেগমেন্টে এগোয়
  let prev: string | null = null;

  segs.forEach((seg, i) => {
    const forced = forcedName(seg);
    let picked: PickedSvg;
    if (forced !== null && have.has(forced)) {
      picked = { name: forced, source: "forced" };
    } else if (forced !== null) {
      // লেখা নাম ফোল্ডারে নেই (বা ফোল্ডারই ফাঁকা) → fallback; ঘোরার গণনা এগোয় না
      picked = { name: null, source: "missing", requested: forced };
      if (n > 0) note(`name:${forced}`, "missing", forced, i);
    } else {
      const bad = badWrittenName(seg);
      if (bad !== null) note(`bad:${bad}`, "bad", bad, i);
      if (n === 0) {
        picked = { name: null, source: "fallback" };
      } else {
        let cand = list[idx % n];
        idx += 1;
        if (n > 1 && cand === prev) {
          cand = list[idx % n];
          idx += 1;
        }
        picked = { name: cand, source: "rotation" };
      }
    }
    picks.push(picked);
    prev = picked.name;
  });

  const warnings: PickWarning[] = [];

  // N = 0: একটাই ওয়ার্নিং (সেগমেন্ট থাকলে)
  if (n === 0 && segs.length > 0) {
    const written = Array.from(new Set(segs.map((sg) => forcedName(sg)).filter((x): x is string => x !== null)));
    warnings.push({
      key: "empty",
      message:
        `⚠️ public/svg/ ফোল্ডারে কোনো SVG পাওয়া যায়নি — ${segs.length}টা সেগমেন্টেই fallback আইকন আসবে` +
        (written.length ? ` (JSON-এ লেখা ${written.map((w) => `"${w}"`).join(", ")}-ও ব্যবহার করা গেল না)` : "") +
        `। svg1.svg, svg2.svg … ফাইল public/svg/-এ দিন।`,
    });
  }

  for (const [key, indices] of where) {
    const f = info.get(key);
    if (!f) continue;
    if (f.kind === "missing") {
      const twin = caseTwin(f.value, list);
      warnings.push({
        key,
        message:
          `⚠️ ${segLabel(indices)} svg "${f.value}" লেখা আছে, কিন্তু public/svg/${f.value}.svg নেই — ` +
          `এই সেগমেন্টে fallback আইকন আসবে। ফোল্ডারে আছে: ${list.join(", ")}।` +
          (twin ? ` (বড়/ছোট হাতের অক্ষর মিলছে না? "${twin}" আছে — ফাইলের নাম হুবহু লিখুন)` : ""),
      });
    } else {
      warnings.push({
        key,
        message:
          `⚠️ ${segLabel(indices)} svg "${shorten(f.value)}" নামটি অবৈধ (শুধু ইংরেজি অক্ষর, সংখ্যা, _ ও - চলে` +
          (/\.svg$/i.test(f.value) ? `; নামে ".svg" লিখবেন না` : "") +
          `) — এটাকে "লেখা নেই" ধরে সিরিয়াল ঘোরানো SVG নেওয়া হলো।`,
      });
    }
  }

  return { picks, warnings };
}

// ───────── ওয়ার্নিং ছাপা (পুনরাবৃত্তি ছাড়া) ─────────

const sharedWarned = new Set<string>();

/** ডিফল্ট ("কোনো options নেই") ওয়ার্নিং-সেট খালি করে — শুধু পরীক্ষার জন্য */
export function resetPickWarnings(): void {
  sharedWarned.clear();
}

function defaultWarn(message: string): void {
  if (typeof console !== "undefined" && typeof console.warn === "function") console.warn(message);
}

function emitWarnings(warnings: readonly PickWarning[], options?: PickOptions): void {
  if (warnings.length === 0) return;
  const warn = typeof options?.warn === "function" ? options.warn : defaultWarn;
  const seen = options?.warned ?? (options?.warn ? new Set<string>() : sharedWarned);
  for (const w of warnings) {
    if (seen.has(w.key)) continue;
    seen.add(w.key);
    try {
      warn(w.message);
    } catch {
      // ওয়ার্নিং-ফাংশন ভাঙলেও বাছাই থামে না
    }
  }
}

/** প্রতি সেগমেন্টের SVG + কোথা থেকে এল (forced/rotation/fallback/missing); ওয়ার্নিং থাকলে একবার ছাপে */
export function pickSvgDetailed(
  segments: readonly SegmentLike[],
  available: readonly string[],
  options?: PickOptions,
): PickedSvg[] {
  const { picks, warnings } = pickSvgReport(segments, available);
  emitWarnings(warnings, options);
  return picks;
}

/** প্রতি সেগমেন্টের SVG-র নাম (`null` = fallback) */
export function pickSvgNames(
  segments: readonly SegmentLike[],
  available: readonly string[],
  options?: PickOptions,
): (string | null)[] {
  return pickSvgDetailed(segments, available, options).map((p) => p.name);
}

/** একটা সেগমেন্টের SVG (`null` = fallback বা সূচক সীমার বাইরে)। ঘোরার ক্রম আগের সব সেগমেন্টের ওপর নির্ভর করে, তাই পুরো তালিকা দিতে হয় */
export function pickSvgForSegment(
  segments: readonly SegmentLike[],
  index: number,
  available: readonly string[],
  options?: PickOptions,
): string | null {
  const names = pickSvgNames(segments, available, options);
  return Number.isInteger(index) && index >= 0 && index < names.length ? names[index] : null;
}
