/**
 * Part 9A: SVG টেক্সটকে নিরাপদ করা + সাইজ ঠিক করা।
 *
 * খাঁটি টেক্সট-ফাংশন (React/DOM লাগে না) — তাই সহজে যাচাই করা যায়।
 * AI-র বানানো SVG ভিডিওতে inline বসানো হবে (Part 9F), তাই এখানে বিপজ্জনক/বাইরের
 * জিনিস ফেলে দেওয়া হয় এবং `viewBox` / সাইজ ঠিক করা হয়।
 *
 * ভালো SVG-র ভেতরের কনটেন্ট বদলায় না — শুধু নিচের জিনিসগুলো বদলায়:
 *   - <script>, <foreignObject>, <iframe>/<object>/<embed>/<link> বাদ
 *   - on…= ইভেন্ট অ্যাট্রিবিউট বাদ
 *   - javascript: লিংক বাদ
 *   - বাইরের (http(s)/ফাইল) href, CSS @import, url(http…) বাদ
 *   - <!DOCTYPE>, <?xml …?> বাদ
 *   - রুট <svg>-তে viewBox না থাকলে যোগ; width/height সরিয়ে 100% বসানো
 *
 * `prefix` (Part 9B): id / class / @keyframes নাম আলাদা করা — একসঙ্গে দুটো SVG থাকলেও
 * একটা আরেকটাকে নষ্ট করে না (cross-fade-এর জন্য জরুরি)। `prefix` না দিলে ফল 9A-র মতোই।
 */

export type SanitizeOptions = {
  /**
   * Part 9B: id / class / @keyframes নামের আগে বসবে (যেমন "a-" → id="a-g1")।
   * শুধু ইংরেজি অক্ষর/সংখ্যা/`-`/`_` চলে, বাকি চিহ্ন বাদ। সংখ্যা বা `-সংখ্যা` দিয়ে শুরু হলে
   * আগে `s` বসে (নাহলে CSS-এ `#1a-x` অবৈধ)। ফাঁকা/সব-বাদ হলে কিছুই বদলায় না।
   */
  prefix?: string;
};

export type RemovedKind =
  | "script"
  | "foreignObject"
  | "embed-tag"
  | "on-event"
  | "javascript:"
  | "external-href"
  | "@import"
  | "external-url"
  | "doctype"
  | "xml-decl"
  | "width/height"
  | "viewBox-fixed";

export type SanitizeResult = {
  /** নিরাপদ SVG টেক্সট; অবৈধ ইনপুট হলে `null` (ক্র্যাশ নয়) */
  svg: string | null;
  /** কোন ধরনের কতটা জিনিস সরানো/ঠিক করা হয়েছে */
  removed: Partial<Record<RemovedKind, number>>;
  /** অবৈধ SVG-র কারণ (বাংলায়); ভালো SVG-তে ফাঁকা */
  warnings: string[];
  /** viewBox কীভাবে এল: আগে থেকে ছিল / width-height থেকে / ডিফল্ট ১০০০×১০০০ */
  viewBox: "kept" | "from-size" | "default" | null;
  /** Part 9B: prefix চালু থাকলে কয়টা id/class/@keyframes নাম বদলানো হয়েছে; না থাকলে `null` */
  renamed: { ids: number; classes: number; keyframes: number } | null;
  /** Part 9B: প্রকৃতপক্ষে ব্যবহৃত (পরিষ্কার করা) prefix; না থাকলে ফাঁকা */
  prefix: string;
};

export const DEFAULT_VIEWBOX = "0 0 1000 1000";

/* ------------------------------------------------------------------ */
/* ছোট সহায়ক                                                           */
/* ------------------------------------------------------------------ */

type Removed = SanitizeResult["removed"];

const bump = (removed: Removed, kind: RemovedKind, n = 1): void => {
  if (n > 0) removed[kind] = (removed[kind] ?? 0) + n;
};

/** quote-সচেতন ট্যাগ-বডি: অ্যাট্রিবিউটের ভেতরের `>` ট্যাগ শেষ ধরা হয় না */
const TAG_BODY = `(?:[^>"']|"[^"]*"|'[^']*')*`;
/** যেকোনো খোলা ট্যাগ (`<rect …>` / `<rect …/>`) */
const TAG_RE = new RegExp(`<[a-zA-Z][^\\s>/]*${TAG_BODY}>`, "g");
/** একটা অ্যাট্রিবিউট: (শুরুর ফাঁকা)(নাম)(মান?) */
const ATTR_RE = /(\s)([^\s"'<>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
const NS = `(?:[\\w-]+:)?`;

const unquote = (v: string | undefined): string => {
  if (v === undefined) return "";
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'")) return v.slice(1, -1);
  return v;
};

const safeChar = (code: number): string =>
  Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";

/** `java&#115;cript:` ধরনের লুকানো লেখা খুলে, ফাঁকা সরিয়ে, ছোট হাতের করে — শুধু যাচাইয়ের জন্য */
function normalizeForCheck(v: string): string {
  return v
    .replace(/&#x([0-9a-f]+);?/gi, (_, h: string) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d: string) => safeChar(parseInt(d, 10)))
    .replace(/&colon;/gi, ":")
    .replace(/&tab;/gi, "\t")
    .replace(/&newline;/gi, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0020\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, "")
    .toLowerCase();
}

const isJsLike = (v: string): boolean => {
  const d = normalizeForCheck(v);
  return (
    d.startsWith("javascript:") ||
    d.startsWith("vbscript:") ||
    d.startsWith("data:text/html") ||
    d.startsWith("data:application/xhtml")
  );
};

const isExternal = (v: string): boolean => {
  const d = normalizeForCheck(v);
  return /^(https?:)?\/\//.test(d) || /^(https?|ftp|file):/.test(d);
};

/** CSS-এর `url(http…)` / `url(//…)` → `none`; গোনা হয় */
const EXTERNAL_URL_RE = /url\(\s*(?:"\s*(?:(?:https?|ftp|file):|\/\/)[^"]*"|'\s*(?:(?:https?|ftp|file):|\/\/)[^']*'|\s*(?:(?:https?|ftp|file):|\/\/)[^)]*)\s*\)/gi;

function stripExternalUrls(s: string, removed: Removed): string {
  return s.replace(EXTERNAL_URL_RE, () => {
    bump(removed, "external-url");
    return "none";
  });
}

/** একই নামের উপাদান (স্বয়ং-বন্ধ, জোড়া, এবং এতিম ট্যাগ) সরায়। কয়টা উপাদান গেল তা ফেরত দেয়। */
function removeElements(input: string, names: string[]): { out: string; count: number } {
  let out = input;
  let count = 0;
  for (const name of names) {
    const selfClosing = new RegExp(`<${NS}${name}\\b${TAG_BODY}?/>`, "gi");
    const paired = new RegExp(
      `<${NS}${name}\\b${TAG_BODY}>[\\s\\S]*?<\\/${NS}${name}\\s*>`,
      "gi",
    );
    const strayOpen = new RegExp(`<${NS}${name}\\b${TAG_BODY}>`, "gi");
    const strayClose = new RegExp(`<\\/${NS}${name}\\s*>`, "gi");

    out = out.replace(selfClosing, () => {
      count += 1;
      return "";
    });
    // নেস্টেড হলে বারবার (বদল থামা পর্যন্ত)
    for (let guard = 0; guard < 50; guard += 1) {
      let changed = false;
      out = out.replace(paired, () => {
        count += 1;
        changed = true;
        return "";
      });
      if (!changed) break;
    }
    out = out.replace(strayOpen, () => {
      count += 1;
      return "";
    });
    out = out.replace(strayClose, "");
  }
  return { out, count };
}

/** একটা খোলা ট্যাগের অ্যাট্রিবিউট পরিষ্কার করে (বাকি অংশ হুবহু থাকে) */
function cleanTag(tag: string, removed: Removed): string {
  const withUrls = stripExternalUrls(tag, removed);
  return withUrls.replace(ATTR_RE, (full: string, _ws: string, name: string, rawValue?: string) => {
    const n = name.toLowerCase();
    const value = unquote(rawValue);

    if (/^on[a-z]+$/.test(n)) {
      bump(removed, "on-event");
      return "";
    }
    if (n === "href" || n === "xlink:href") {
      if (isJsLike(value)) {
        bump(removed, "javascript:");
        return "";
      }
      if (isExternal(value)) {
        bump(removed, "external-href");
        return "";
      }
      return full;
    }
    // SMIL: <set attributeName="href" to="javascript:…"> ধরনের ফাঁক
    if ((n === "to" || n === "from" || n === "by" || n === "values") && isJsLike(value)) {
      bump(removed, "javascript:");
      return "";
    }
    return full;
  });
}

const parseViewBox = (v: string): string | null => {
  const nums = v
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) return null;
  if (nums[2] <= 0 || nums[3] <= 0) return null;
  return v.trim();
};

/** "200" / "200px" → "200"; অন্য কিছু (%, em, auto…) → null */
const parsePixelSize = (v: string | undefined): string | null => {
  if (v === undefined) return null;
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/i.exec(v);
  if (!m || Number(m[1]) <= 0) return null;
  return m[1];
};

/* ------------------------------------------------------------------ */
/* Part 9B: prefix দিয়ে id / class / @keyframes আলাদা করা                 */
/* ------------------------------------------------------------------ */

/** শুধু অক্ষর/সংখ্যা/-/_ রাখে; সংখ্যা (বা `-সংখ্যা`) দিয়ে শুরু হলে `s` বসায়; ফাঁকা হলে "" */
export function cleanPrefix(prefix: unknown): string {
  if (typeof prefix !== "string") return "";
  const p = prefix.replace(/[^A-Za-z0-9_-]/g, "");
  if (p === "") return "";
  return /^-?[0-9]/.test(p) ? `s${p}` : p;
}

/** CSS-এর `{` এর আগের অংশ (সিলেক্টর / @-নিয়ম) — declaration অংশ নয় */
function mapCssPreludes(css: string, fn: (prelude: string) => string): string {
  return css.replace(/([^{}]*)\{/g, (_m: string, pre: string) => `${fn(pre)}{`);
}

/** `url(#id)` / `url('#id')` / `url("#id")` → prefix সহ (শুধু আমাদের সেটের id হলে) */
function renameUrls(value: string, ids: Set<string>, prefix: string): string {
  return value.replace(
    /url\(\s*(["']?)#([^"')\s]+)\1\s*\)/gi,
    (m: string, q: string, name: string) => (ids.has(name) ? `url(${q}#${prefix}${name}${q})` : m),
  );
}

/** `animation` / `animation-name` মানের ভেতরে @keyframes-এর নাম বদলায় */
function renameAnimationNames(decls: string, keyframes: Set<string>, prefix: string): string {
  return decls.replace(
    /((?:^|[;\s{])(?:-webkit-)?animation(?:-name)?\s*:\s*)([^;}]*)/gi,
    (_m: string, head: string, value: string) =>
      head +
      value.replace(/[A-Za-z_][\w-]*/g, (tok: string) => (keyframes.has(tok) ? `${prefix}${tok}` : tok)),
  );
}

function renameDeclarations(
  body: string,
  ids: Set<string>,
  keyframes: Set<string>,
  prefix: string,
): string {
  return renameAnimationNames(renameUrls(body, ids, prefix), keyframes, prefix);
}

function applyPrefix(
  svg: string,
  prefix: string,
): { svg: string; counts: { ids: number; classes: number; keyframes: number } } {
  const ids = new Set<string>();
  const classes = new Set<string>();
  const keyframes = new Set<string>();
  const STYLE_RE = /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi;

  // ১) নাম সংগ্রহ: অ্যাট্রিবিউট থেকে id/class, CSS থেকে @keyframes ও সিলেক্টরের class
  svg.replace(TAG_RE, (tag: string) => {
    tag.replace(ATTR_RE, (full: string, _ws: string, name: string, raw?: string) => {
      const n = name.toLowerCase();
      const v = unquote(raw);
      if (n === "id" && v.trim()) ids.add(v.trim());
      if (n === "class") for (const c of v.split(/\s+/)) if (c) classes.add(c);
      return full;
    });
    return tag;
  });
  svg.replace(STYLE_RE, (m: string, _o: string, css: string) => {
    mapCssPreludes(css, (pre) => {
      for (const k of pre.matchAll(/@(?:-[a-z]+-)?keyframes\s+([A-Za-z_][\w-]*)/gi)) keyframes.add(k[1]);
      if (!/^\s*@/.test(pre)) for (const c of pre.matchAll(/\.([A-Za-z_][\w-]*)/g)) classes.add(c[1]);
      return pre;
    });
    return m;
  });

  // ২) <style> বদলানো: সিলেক্টর (#id, .class), @keyframes নাম, declaration-এর url(#…) ও animation নাম
  let out = svg.replace(STYLE_RE, (_m: string, open: string, css: string, close: string) => {
    let c = mapCssPreludes(css, (pre) => {
      if (/@(?:-[a-z]+-)?keyframes\b/i.test(pre)) {
        return pre.replace(
          /(@(?:-[a-z]+-)?keyframes\s+)([A-Za-z_][\w-]*)/i,
          (m: string, head: string, name: string) => (keyframes.has(name) ? `${head}${prefix}${name}` : m),
        );
      }
      if (/^\s*@/.test(pre)) return pre;
      return pre.replace(/([#.])([A-Za-z_][\w-]*)/g, (m: string, sym: string, name: string) =>
        (sym === "#" ? ids : classes).has(name) ? `${sym}${prefix}${name}` : m,
      );
    });
    c = c.replace(/\{([^{}]*)\}/g, (_b: string, body: string) => `{${renameDeclarations(body, ids, keyframes, prefix)}}`);
    return open + c + close;
  });

  // ৩) ট্যাগের অ্যাট্রিবিউট: id, class, href="#id", SMIL begin/end="id.end", url(#id), style="…"
  out = out.replace(TAG_RE, (tag: string) =>
    tag.replace(ATTR_RE, (full: string, ws: string, name: string, raw?: string) => {
      if (raw === undefined) return full;
      const n = name.toLowerCase();
      const q = raw[0] === '"' || raw[0] === "'" ? raw[0] : '"';
      const v = unquote(raw);
      let nv = v;

      if (n === "id") {
        nv = ids.has(v.trim()) ? `${prefix}${v.trim()}` : v;
      } else if (n === "class") {
        nv = v.replace(/\S+/g, (c: string) => (classes.has(c) ? `${prefix}${c}` : c));
      } else if (n === "href" || n === "xlink:href") {
        const t = v.trim();
        nv = t.startsWith("#") && ids.has(t.slice(1)) ? `#${prefix}${t.slice(1)}` : v;
      } else if (n === "begin" || n === "end") {
        nv = v.replace(/(^|[;\s])([A-Za-z_][\w-]*)\.(?=[A-Za-z])/g, (m: string, sep: string, id: string) =>
          ids.has(id) ? `${sep}${prefix}${id}.` : m,
        );
      } else if (n === "style") {
        nv = renameDeclarations(v, ids, keyframes, prefix);
      } else if (v.includes("url(")) {
        nv = renameUrls(v, ids, prefix);
      }
      return nv === v ? full : `${ws}${name}=${q}${nv}${q}`;
    }),
  );

  return { svg: out, counts: { ids: ids.size, classes: classes.size, keyframes: keyframes.size } };
}

/* ------------------------------------------------------------------ */
/* মূল ফাংশন                                                            */
/* ------------------------------------------------------------------ */

const invalid = (reason: string, removed: Removed): SanitizeResult => ({
  svg: null,
  removed,
  warnings: [`অবৈধ SVG: ${reason}`],
  viewBox: null,
  renamed: null,
  prefix: "",
});

/**
 * SVG টেক্সটকে নিরাপদ করে। কখনো throw করে না।
 * অবৈধ ইনপুটে `svg: null` + `warnings`-এ কারণ (Part 9F তখন fallback-এ যাবে)।
 */
export function sanitizeSvg(text: unknown, options: SanitizeOptions = {}): SanitizeResult {
  const removed: Removed = {};

  if (typeof text !== "string") return invalid("টেক্সট নয়", removed);
  let out = text.replace(/^\uFEFF/, "");
  if (out.trim() === "") return invalid("ফাঁকা ফাইল", removed);

  // ১) <?xml …?> / অন্য প্রসেসিং-নির্দেশ এবং <!DOCTYPE …>
  out = out.replace(/<\?[\s\S]*?\?>/g, () => {
    bump(removed, "xml-decl");
    return "";
  });
  out = out.replace(/<!DOCTYPE(?:[^>\[]|\[[\s\S]*?\])*>/gi, () => {
    bump(removed, "doctype");
    return "";
  });

  // ২) বিপজ্জনক উপাদান
  const scripts = removeElements(out, ["script"]);
  out = scripts.out;
  bump(removed, "script", scripts.count);

  const foreign = removeElements(out, ["foreignObject"]);
  out = foreign.out;
  bump(removed, "foreignObject", foreign.count);

  const embeds = removeElements(out, ["iframe", "object", "embed", "link"]);
  out = embeds.out;
  bump(removed, "embed-tag", embeds.count);

  // ৩) <style>-এর ভেতরে @import ও বাইরের url(…)
  out = out.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
    (_m: string, open: string, css: string, close: string) => {
      let c = css.replace(/@import\b[^;}<]*;?/gi, () => {
        bump(removed, "@import");
        return "";
      });
      c = stripExternalUrls(c, removed);
      return open + c + close;
    },
  );

  // ৪) প্রতিটা ট্যাগের অ্যাট্রিবিউট (on…=, javascript:, বাইরের href, style="…url(http…)")
  out = out.replace(TAG_RE, (tag: string) => cleanTag(tag, removed));

  // ৫) রুট <svg> খুঁজে ছেঁটে নেওয়া
  const rootRe = new RegExp(`<svg(?=[\\s>/])${TAG_BODY}>`, "i");
  const rootMatch = rootRe.exec(out);
  if (!rootMatch) return invalid("<svg> ট্যাগ পাওয়া যায়নি", removed);

  const start = rootMatch.index;
  let end: number;
  if (rootMatch[0].endsWith("/>")) {
    end = start + rootMatch[0].length;
  } else {
    let lastClose = -1;
    let lastCloseLen = 0;
    const closeRe = /<\/svg\s*>/gi;
    for (let m = closeRe.exec(out); m; m = closeRe.exec(out)) {
      lastClose = m.index;
      lastCloseLen = m[0].length;
    }
    if (lastClose < start) return invalid("</svg> বন্ধ ট্যাগ নেই", removed);
    end = lastClose + lastCloseLen;
  }

  // ৬) রুট ট্যাগ ঠিক করা: viewBox নিশ্চিত, width/height → 100%
  let width: string | undefined;
  let height: string | undefined;
  let viewBox: string | null = null;
  let sawSize = false;

  let rootTag = rootMatch[0].replace(
    ATTR_RE,
    (full: string, _ws: string, name: string, rawValue?: string) => {
      const n = name.toLowerCase();
      if (n === "width") {
        width = unquote(rawValue).trim();
        sawSize = true;
        return "";
      }
      if (n === "height") {
        height = unquote(rawValue).trim();
        sawSize = true;
        return "";
      }
      if (n === "viewbox") {
        const ok = parseViewBox(unquote(rawValue));
        if (ok) {
          viewBox = ok;
          return full;
        }
        return ""; // ভাঙা viewBox ফেলে নতুন বসবে
      }
      return full;
    },
  );

  let viewBoxKind: SanitizeResult["viewBox"] = "kept";
  let viewBoxAttr = "";
  if (viewBox === null) {
    const w = parsePixelSize(width);
    const h = parsePixelSize(height);
    if (w !== null && h !== null) {
      viewBox = `0 0 ${w} ${h}`;
      viewBoxKind = "from-size";
    } else {
      viewBox = DEFAULT_VIEWBOX;
      viewBoxKind = "default";
    }
    viewBoxAttr = ` viewBox="${viewBox}"`;
    bump(removed, "viewBox-fixed");
  }

  if (sawSize && (width !== "100%" || height !== "100%")) bump(removed, "width/height");

  rootTag = rootTag.replace(/^<svg/i, (m) => `${m} width="100%" height="100%"${viewBoxAttr}`);

  const safeSvg = rootTag + out.slice(start + rootMatch[0].length, end);

  // ৭) Part 9B: prefix থাকলে id / class / @keyframes আলাদা করা
  const prefix = cleanPrefix(options?.prefix);
  if (prefix) {
    const scoped = applyPrefix(safeSvg, prefix);
    return {
      svg: scoped.svg,
      removed,
      warnings: [],
      viewBox: viewBoxKind,
      renamed: scoped.counts,
      prefix,
    };
  }

  return { svg: safeSvg, removed, warnings: [], viewBox: viewBoxKind, renamed: null, prefix: "" };
}

/** `{ script: 2, "on-event": 1 }` → "script×2, on-event×1" (লগ/ছবির জন্য) */
export function describeRemoved(removed: SanitizeResult["removed"]): string {
  const parts = Object.entries(removed)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([k, n]) => `${k}×${n}`);
  return parts.length ? parts.join(", ") : "কিছু সরেনি";
}
