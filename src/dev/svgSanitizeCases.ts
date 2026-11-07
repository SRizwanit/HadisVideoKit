import { describeRemoved, sanitizeSvg, type RemovedKind, type SanitizeResult } from "../lib/svgSanitize";

/**
 * Part 9A (dev টুল): sanitizeSvg-র যাচাই-কেসের তালিকা (খাঁটি টেক্সট, React লাগে না)।
 * `SvgSanitizeCheck.tsx` এগুলো ছবিতে ✅/❌ দেখায়। Part 9A: নিরাপত্তা/সাইজের কেস; Part 9B: prefix-এর কেস।
 */

export type CaseOutcome = {
  id: string;
  title: string;
  ok: boolean;
  failures: string[];
  /** কী কী সরানো হলো (সংক্ষেপে) */
  removedText: string;
};

type Case = {
  id: string;
  title: string;
  input: unknown;
  verify: (r: SanitizeResult, input: string) => string[];
};

/* ---------- যাচাইয়ের ছোট সহায়ক ---------- */

const must =
  (cond: boolean, msg: string): string[] =>
    cond ? [] : [msg];

const removedIs = (r: SanitizeResult, kind: RemovedKind, n: number): string[] =>
  must((r.removed[kind] ?? 0) === n, `${kind}: আশা ${n}, পেলাম ${r.removed[kind] ?? 0}`);

const has = (r: SanitizeResult, needle: string): string[] =>
  must((r.svg ?? "").includes(needle), `থাকার কথা: ${needle}`);

const lacks = (r: SanitizeResult, needle: string | RegExp): string[] => {
  const svg = r.svg ?? "";
  const found = typeof needle === "string" ? svg.toLowerCase().includes(needle.toLowerCase()) : needle.test(svg);
  return must(!found, `থাকার কথা নয়: ${String(needle)}`);
};

const notNull = (r: SanitizeResult): string[] => must(r.svg !== null, "svg null এল");

/* ---------- নমুনা ইনপুট ---------- */

export const GOOD_SVG = `<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f5d77a"/><stop offset="1" stop-color="#2ecc71"/></linearGradient>
    <style>@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}} .s{animation:spin 4s linear infinite;transform-origin:500px 500px}</style>
  </defs>
  <g class="s"><circle cx="500" cy="500" r="300" fill="url(#g1)"/></g>
  <text x="500" y="520" text-anchor="middle" fill="#fff">আল্লাহু আকবার onclick=1</text>
</svg>`;

/** Part 9B-র নমুনা: id, class, @keyframes, url(#…), href, SMIL begin, style="…" সব আছে */
export const PREFIX_SVG = `<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="g1"><stop offset="0" stop-color="#f5d77a"/><stop offset="1" stop-color="#2ecc71"/></linearGradient>
    <clipPath id="c1"><circle cx="500" cy="500" r="400"/></clipPath>
    <circle id="dot" r="20"/>
    <style>@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}} #big{opacity:.9} .s,.t > rect{animation:spin 4s linear infinite;fill:#2ecc71} .u{animation-name:spin;fill:url(#g1)}</style>
  </defs>
  <g class="s t" clip-path="url(#c1)" id="big"><circle cx="500" cy="500" r="300" fill="url(#g1)" style="stroke:url('#g1');animation:spin 2s infinite"/></g>
  <use href="#dot" x="10"/><use xlink:href="#dot" x="20"/><use href="#missing"/><rect fill="url(#missing)"/>
  <rect class="u" width="10" height="10"><animate id="a1" attributeName="x" from="0" to="100" dur="2s" begin="0s;a2.end"/></rect>
  <rect width="10" height="10"><animate id="a2" attributeName="x" from="0" to="100" dur="2s" begin="a1.end+0.5s"/></rect>
  <text x="5" y="5">#big .s a1.end</text>
</svg>`;

/** আউটপুট SVG থেকে id / class / @keyframes নামের সেট (যাচাইয়ের জন্য) */
function collectNames(svg: string): { ids: Set<string>; classes: Set<string>; keyframes: Set<string> } {
  const ids = new Set<string>();
  const classes = new Set<string>();
  const keyframes = new Set<string>();
  for (const m of svg.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]);
  for (const m of svg.matchAll(/\sclass="([^"]+)"/g)) for (const c of m[1].split(/\s+/)) if (c) classes.add(c);
  for (const m of svg.matchAll(/@keyframes\s+([\w-]+)/g)) keyframes.add(m[1]);
  return { ids, classes, keyframes };
}

const overlap = (a: Set<string>, b: Set<string>): string[] => [...a].filter((x) => b.has(x));

/** সব `url(#x)` / `href="#x"` রেফারেন্স (dangling `missing` বাদে) আউটপুটের কোনো id-তে যায় কিনা */
function danglingRefs(svg: string): string[] {
  const { ids } = collectNames(svg);
  const refs: string[] = [];
  for (const m of svg.matchAll(/url\(\s*["']?#([^"')\s]+)["']?\s*\)/g)) refs.push(m[1]);
  for (const m of svg.matchAll(/href="#([^"]+)"/g)) refs.push(m[1]);
  return refs.filter((r) => !ids.has(r) && !r.endsWith("missing"));
}

const CASES: Case[] = [
  {
    id: "good",
    title: "ভালো SVG: ভেতরের কনটেন্ট হুবহু, শুধু রুটে width/height 100%",
    input: GOOD_SVG,
    verify: (r, input) => [
      ...notNull(r),
      ...must(
        r.svg === input.replace("<svg", '<svg width="100%" height="100%"'),
        "কনটেন্ট বদলে গেছে",
      ),
      ...must(Object.keys(r.removed).length === 0, `কিছু সরেছে: ${describeRemoved(r.removed)}`),
      ...must(r.viewBox === "kept", `viewBox=${r.viewBox}`),
      ...has(r, 'xmlns="http://www.w3.org/2000/svg"'),
      ...has(r, "আল্লাহু আকবার onclick=1"), // টেক্সট নোডের "onclick=" অক্ষত
      ...has(r, "@keyframes spin"),
    ],
  },
  {
    id: "script",
    title: "<script> (জোড়া, স্বয়ং-বন্ধ, বড় হাতের, CDATA)",
    input: `<svg viewBox="0 0 1000 1000"><script>alert(1)</script><rect id="keep"/><script src="x.js"/><circle id="keep2"/><SCRIPT type="text/javascript">//<![CDATA[\nalert(2)\n//]]></SCRIPT></svg>`,
    verify: (r) => [
      ...notNull(r),
      ...removedIs(r, "script", 3),
      ...lacks(r, "<script"),
      ...lacks(r, "alert"),
      ...has(r, '<rect id="keep"/>'),
      ...has(r, '<circle id="keep2"/>'), // স্বয়ং-বন্ধ script পরের উপাদান খায়নি
    ],
  },
  {
    id: "onevent",
    title: "on…= ইভেন্ট (onload, onclick, ONMOUSEOVER, বিনা-কোটেশন)",
    input: `<svg viewBox="0 0 1000 1000" onload="alert(1)"><rect onclick="x()" ONMOUSEOVER='y()' onfocus=z() width="1"/></svg>`,
    verify: (r) => [
      ...notNull(r),
      ...removedIs(r, "on-event", 4),
      ...lacks(r, /\son[a-z]+=/i),
      ...has(r, 'width="1"'),
    ],
  },
  {
    id: "javascript",
    title: "javascript: লিংক (href, xlink:href, লুকানো &#…; / &colon;) + SMIL set",
    input:
      `<svg viewBox="0 0 1000 1000"><a href="javascript:alert(1)"><rect/></a>` +
      `<a xlink:href=" JaVa&#115;cript:alert(2)"><rect/></a>` +
      `<a href="java&#x73;cript&colon;alert(3)"><rect/></a>` +
      `<set attributeName="href" to="javascript:alert(4)"/></svg>`,
    verify: (r) => [
      ...notNull(r),
      ...removedIs(r, "javascript:", 4),
      ...lacks(r, "alert"),
      ...lacks(r, "javascript"),
    ],
  },
  {
    id: "href",
    title: "বাইরের href বাদ; #id ও data:image থাকে",
    input:
      `<svg viewBox="0 0 1000 1000"><image href="https://e.com/a.png" width="10"/>` +
      `<image xlink:href="//e.com/b.png"/><use href="#sym"/><image href="data:image/png;base64,iVBOR"/></svg>`,
    verify: (r) => [
      ...notNull(r),
      ...removedIs(r, "external-href", 2),
      ...lacks(r, "e.com"),
      ...has(r, 'href="#sym"'),
      ...has(r, "data:image/png;base64,iVBOR"),
    ],
  },
  {
    id: "css",
    title: "CSS @import ও বাইরের url(http…) বাদ; url(#id) থাকে",
    input:
      `<svg viewBox="0 0 1000 1000"><style>@import url("https://fonts.googleapis.com/css?family=X");@import 'x.css'; .a{fill:url(http://evil/x.svg#a)}</style>` +
      `<rect fill="url(https://e.com/a)"/><circle style="fill:url('//e.com/b')"/><circle fill="url(#g1)"/></svg>`,
    verify: (r) => [
      ...notNull(r),
      ...removedIs(r, "@import", 2),
      ...removedIs(r, "external-url", 3),
      ...lacks(r, "@import"),
      ...lacks(r, "evil"),
      ...lacks(r, "e.com"),
      ...has(r, "url(#g1)"),
    ],
  },
  {
    id: "foreign",
    title: "<foreignObject> (ভেতরের HTML সহ) এবং <iframe>/<object>",
    input:
      `<svg viewBox="0 0 1000 1000"><foreignObject width="10" height="10"><div onclick="x()">hi</div></foreignObject><rect id="keep"/>` +
      `<iframe src="x"></iframe><object data="y"/></svg>`,
    verify: (r) => [
      ...notNull(r),
      ...removedIs(r, "foreignObject", 1),
      ...removedIs(r, "embed-tag", 2),
      ...lacks(r, "foreignObject"),
      ...lacks(r, "<div"),
      ...lacks(r, "iframe"),
      ...has(r, '<rect id="keep"/>'),
    ],
  },
  {
    id: "doctype",
    title: "<!DOCTYPE …[ENTITY]> এবং <?xml …?>",
    input:
      `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" [<!ENTITY x "y">]>\n` +
      `<svg viewBox="0 0 1000 1000"><rect/></svg>`,
    verify: (r) => [
      ...notNull(r),
      ...removedIs(r, "xml-decl", 1),
      ...removedIs(r, "doctype", 1),
      ...lacks(r, "<?xml"),
      ...lacks(r, "DOCTYPE"),
      ...lacks(r, "ENTITY"),
      ...must((r.svg ?? "").startsWith("<svg"), "<svg দিয়ে শুরু হয়নি"),
    ],
  },
  {
    id: "novb",
    title: "viewBox নেই, সাইজও নেই → 0 0 1000 1000",
    input: `<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>`,
    verify: (r) => [
      ...notNull(r),
      ...has(r, 'viewBox="0 0 1000 1000"'),
      ...must(r.viewBox === "default", `viewBox=${r.viewBox}`),
      // ভেতরের <rect width/height> অক্ষত থাকবে
      ...has(r, '<rect width="10" height="10"/>'),
    ],
  },
  {
    id: "size",
    title: "viewBox নেই, width/height=200 → viewBox 0 0 200 200, সাইজ 100%",
    input: `<svg width="200" height="200"><rect width="10" height="10"/></svg>`,
    verify: (r) => [
      ...notNull(r),
      ...has(r, 'viewBox="0 0 200 200"'),
      ...has(r, 'width="100%" height="100%"'),
      ...must(r.viewBox === "from-size", `viewBox=${r.viewBox}`),
      ...removedIs(r, "width/height", 1),
    ],
  },
  {
    id: "vbsize",
    title: "viewBox আছে + width/height=500px → viewBox রাখা, সাইজ 100%",
    input: `<svg viewBox="0 0 800 600" width="500px" height="500px"><rect/></svg>`,
    verify: (r) => [
      ...notNull(r),
      ...has(r, 'viewBox="0 0 800 600"'),
      ...lacks(r, "500px"),
      ...has(r, 'width="100%" height="100%"'),
      ...must(r.viewBox === "kept", `viewBox=${r.viewBox}`),
    ],
  },
  {
    id: "badvb",
    title: "ভাঙা viewBox (\"abc\") → ডিফল্ট viewBox",
    input: `<svg viewBox="abc"><rect/></svg>`,
    verify: (r) => [...notNull(r), ...has(r, 'viewBox="0 0 1000 1000"'), ...lacks(r, "abc")],
  },
  {
    id: "nosvg",
    title: "<svg> নেই (HTML / সাধারণ লেখা) → null + সতর্কতা, ক্র্যাশ নয়",
    input: `<html><body><p>hello</p></body></html>`,
    verify: (r) => [
      ...must(r.svg === null, "null আশা করেছিলাম"),
      ...must(r.warnings.length === 1, `warnings=${r.warnings.length}`),
    ],
  },
  {
    id: "empty",
    title: "ফাঁকা ফাইল ও টেক্সট-নয় (null/undefined/সংখ্যা) → null + সতর্কতা",
    input: "   \n ",
    verify: (r) => {
      const others = [null, undefined, 42].map((x) => sanitizeSvg(x));
      return [
        ...must(r.svg === null && r.warnings.length === 1, "ফাঁকা ফাইল ধরা পড়েনি"),
        ...must(
          others.every((o) => o.svg === null && o.warnings.length === 1),
          "টেক্সট-নয় ইনপুট ধরা পড়েনি",
        ),
      ];
    },
  },
  {
    id: "unclosed",
    title: "</svg> নেই (কাটা ফাইল) → null + সতর্কতা",
    input: `<svg viewBox="0 0 1000 1000"><rect/>`,
    verify: (r) => must(r.svg === null && r.warnings.length === 1, "null আশা করেছিলাম"),
  },
  {
    id: "case",
    title: "বড় হাতের <SVG VIEWBOX …> ও BOM — ঠিকঠাক চলে",
    input: `\uFEFF<SVG VIEWBOX="0 0 1000 1000" ONLOAD="x()"><rect/></SVG>`,
    verify: (r) => [...notNull(r), ...removedIs(r, "on-event", 1), ...lacks(r, "ONLOAD"), ...must(r.viewBox === "kept", `viewBox=${r.viewBox}`)],
  },
  /* ---------------- Part 9B: prefix ---------------- */
  {
    id: "p-none",
    title: "prefix না দিলে / ফাঁকা / সব-বাদ (\"!!\") → 9A-র ফলের সঙ্গে হুবহু এক",
    input: PREFIX_SVG,
    verify: (r, input) => {
      const base = sanitizeSvg(input).svg;
      return [
        ...notNull(r),
        ...must(r.svg === base, "prefix ছাড়া ফল বদলে গেছে"),
        ...must(r.renamed === null && r.prefix === "", "renamed/prefix ঠিক নয়"),
        ...must(sanitizeSvg(input, { prefix: "" }).svg === base, 'prefix:"" ফল বদলেছে'),
        ...must(sanitizeSvg(input, { prefix: "!! /" }).svg === base, 'prefix:"!! /" ফল বদলেছে'),
        ...must(sanitizeSvg(input, {}).svg === base, "{} ফল বদলেছে"),
      ];
    },
  },
  {
    id: "p-rename",
    title: "prefix \"a-\": id, url(#), href/xlink:href, class, CSS #id/.class, @keyframes, animation, SMIL begin, style=\"\"",
    input: PREFIX_SVG,
    verify: (_r, input) => {
      const r = sanitizeSvg(input, { prefix: "a-" });
      const f = [
        ...notNull(r),
        ...has(r, 'id="a-g1"'),
        ...has(r, 'id="a-c1"'),
        ...has(r, 'id="a-big"'),
        ...has(r, 'id="a-dot"'),
        ...has(r, 'clip-path="url(#a-c1)"'),
        ...has(r, 'fill="url(#a-g1)"'),
        ...has(r, "stroke:url('#a-g1')"), // style="…" ও কোটেশন অক্ষত
        ...has(r, 'href="#a-dot" x="10"'),
        ...has(r, 'xlink:href="#a-dot" x="20"'),
        ...has(r, 'class="a-s a-t"'),
        ...has(r, 'class="a-u"'),
        ...has(r, "#a-big{opacity:.9}"),
        ...has(r, ".a-s,.a-t > rect{"),
        ...has(r, "@keyframes a-spin{"),
        ...has(r, "animation:a-spin 4s linear infinite"),
        ...has(r, "animation-name:a-spin"),
        ...has(r, "animation:a-spin 2s infinite"), // style="animation:…"
        ...has(r, "fill:url(#a-g1)"), // CSS declaration-এর ভেতরে
        ...has(r, 'id="a-a1"'),
        ...has(r, 'begin="0s;a-a2.end"'),
        ...has(r, 'begin="a-a1.end+0.5s"'),
        // যা বদলানো চলবে না
        ...has(r, "#f5d77a"),
        ...has(r, "fill:#2ecc71"),
        ...has(r, "transform:rotate(0)"),
        ...has(r, 'xmlns:xlink="http://www.w3.org/1999/xlink"'),
        ...has(r, ">#big .s a1.end</text>"), // টেক্সট নোড অক্ষত
        ...has(r, 'href="#missing"'), // dangling রেফারেন্স অক্ষত
        ...has(r, 'fill="url(#missing)"'),
        ...lacks(r, /\sid="(?!a-)/),
        ...lacks(r, /class="(?!a-)/),
        ...lacks(r, "@keyframes spin"),
        ...must(r.prefix === "a-", `prefix=${r.prefix}`),
        ...must(
          r.renamed?.ids === 6 && r.renamed?.classes === 3 && r.renamed?.keyframes === 1,
          `renamed=${JSON.stringify(r.renamed)} (আশা: ids 6, classes 3, keyframes 1)`,
        ),
      ];
      return f;
    },
  },
  {
    id: "p-two",
    title: "একই SVG দুই prefix (a-, b-) → কোনো id/class/@keyframes নাম মেলে না; সব রেফারেন্স নিজের id-তে যায়",
    input: PREFIX_SVG,
    verify: (_r, input) => {
      const a = sanitizeSvg(input, { prefix: "a-" }).svg ?? "";
      const b = sanitizeSvg(input, { prefix: "b-" }).svg ?? "";
      const na = collectNames(a);
      const nb = collectNames(b);
      return [
        ...must(na.ids.size > 0 && na.classes.size > 0 && na.keyframes.size > 0, "a-তে নাম পাওয়া যায়নি"),
        ...must(overlap(na.ids, nb.ids).length === 0, `id মিলেছে: ${overlap(na.ids, nb.ids)}`),
        ...must(overlap(na.classes, nb.classes).length === 0, `class মিলেছে: ${overlap(na.classes, nb.classes)}`),
        ...must(overlap(na.keyframes, nb.keyframes).length === 0, "@keyframes মিলেছে"),
        ...must(danglingRefs(a).length === 0, `a-তে ভাঙা রেফারেন্স: ${danglingRefs(a)}`),
        ...must(danglingRefs(b).length === 0, `b-তে ভাঙা রেফারেন্স: ${danglingRefs(b)}`),
        ...must(a !== b, "দুটো একই"),
      ];
    },
  },
  {
    id: "p-chars",
    title: "prefix-এ অবৈধ চিহ্ন বাদ (\"a b!/\" → ab); সংখ্যা দিয়ে শুরু (\"9x\" → s9x)",
    input: PREFIX_SVG,
    verify: (_r, input) => {
      const x = sanitizeSvg(input, { prefix: "a b!/" });
      const y = sanitizeSvg(input, { prefix: "9x" });
      const z = sanitizeSvg(input, { prefix: "<script>" });
      return [
        ...must(x.prefix === "ab", `prefix=${x.prefix}`),
        ...has(x, 'id="abg1"'),
        ...must(y.prefix === "s9x", `prefix=${y.prefix}`),
        ...has(y, 'id="s9xg1"'),
        ...has(y, "@keyframes s9xspin{"),
        ...must(z.prefix === "script", `prefix=${z.prefix}`),
        ...lacks(z, "<script"),
      ];
    },
  },
  {
    id: "p-safe",
    title: "prefix থাকলেও 9A-র নিরাপত্তা একই: script/onload/javascript: বাদ; অবৈধ ইনপুটে null",
    input: `<svg viewBox="0 0 1000 1000" onload="x()"><script>alert(1)</script><a href="javascript:alert(2)"><rect id="r" class="k"/></a></svg>`,
    verify: (_r, input) => {
      const r = sanitizeSvg(input, { prefix: "q-" });
      const bad = sanitizeSvg("hello", { prefix: "q-" });
      return [
        ...notNull(r),
        ...lacks(r, "alert"),
        ...lacks(r, "onload"),
        ...has(r, 'id="q-r"'),
        ...has(r, 'class="q-k"'),
        ...must(bad.svg === null && bad.warnings.length === 1 && bad.renamed === null, "অবৈধ ইনপুট ঠিক নয়"),
      ];
    },
  },
  {
    id: "p-edge",
    title: "কোণার কেস: id ছাড়া SVG, নেস্টেড @media-র ভেতরের সিলেক্টর, -webkit-animation, ' ও \" কোটেশন",
    input:
      `<svg viewBox="0 0 1000 1000"><style>@media (min-width:1px){.m{-webkit-animation:w 1s}} @-webkit-keyframes w{0%{opacity:0}100%{opacity:1}} @keyframes w{0%{opacity:0}100%{opacity:1}}</style>` +
      `<rect class='m' fill='url("#none")'/><circle class="m" id='c'/><use href='#c'/></svg>`,
    verify: (_r, input) => {
      const r = sanitizeSvg(input, { prefix: "e-" });
      return [
        ...notNull(r),
        ...has(r, ".e-m{"),
        ...has(r, "-webkit-animation:e-w 1s"),
        ...has(r, "@-webkit-keyframes e-w{"),
        ...has(r, "@keyframes e-w{"),
        ...has(r, "class='e-m'"),
        ...has(r, 'class="e-m"'),
        ...has(r, "id='e-c'"),
        ...has(r, "href='#e-c'"),
        ...has(r, `fill='url("#none")'`),
        ...must(r.renamed?.ids === 1 && r.renamed?.classes === 1 && r.renamed?.keyframes === 1, `renamed=${JSON.stringify(r.renamed)}`),
        ...must(sanitizeSvg(`<svg viewBox="0 0 1000 1000"><rect/></svg>`, { prefix: "e-" }).renamed?.ids === 0, "id ছাড়া SVG-তে ids ≠ 0"),
      ];
    },
  },
  {
    id: "twice",
    title: "দুইবার sanitize করলেও ফল একই (idempotent), সব বিপজ্জনক জিনিসসহ",
    input:
      `<?xml version="1.0"?><svg width="300" height="300" onload="x()"><script>1</script><image href="http://e.com/a.png"/><style>@import 'a';</style></svg>`,
    verify: (r) => {
      const again = sanitizeSvg(r.svg);
      return [
        ...notNull(r),
        ...must(again.svg === r.svg, "দ্বিতীয়বারে ফল বদলে গেছে"),
        ...must(Object.keys(again.removed).length === 0, "দ্বিতীয়বারে নতুন কিছু সরেছে"),
      ];
    },
  },
];

export const SANITIZE_CASE_COUNT = CASES.length;

export function runSanitizeCases(): CaseOutcome[] {
  return CASES.map((c) => {
    let failures: string[] = [];
    let removedText = "";
    try {
      const r = sanitizeSvg(c.input);
      removedText = r.svg === null ? `null · ${r.warnings[0] ?? ""}` : describeRemoved(r.removed);
      if (c.id.startsWith("p-") && c.id !== "p-none" && typeof c.input === "string") {
        const pr = sanitizeSvg(c.input, { prefix: "a-" });
        removedText = pr.renamed
          ? `prefix "${pr.prefix}" → id ${pr.renamed.ids}, class ${pr.renamed.classes}, @keyframes ${pr.renamed.keyframes} নাম বদলেছে`
          : "prefix ছাড়া (কিছু বদলায়নি)";
      }
      failures = c.verify(r, typeof c.input === "string" ? c.input : "");
    } catch (err) {
      failures = [`ক্র্যাশ: ${String((err as Error)?.message ?? err)}`];
    }
    return { id: c.id, title: c.title, ok: failures.length === 0, failures, removedText };
  });
}
