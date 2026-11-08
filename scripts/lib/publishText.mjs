// প্রকাশের টেক্সট: ইউটিউব/ফেসবুকের জন্য শিরোনাম, বিবরণ, ট্যাগ, হ্যাশট্যাগ — একটা .txt ফাইলে।
// ব্রাউজার/Remotion ছাড়া চলে (শুধু hadis<id>_timestamp.json পড়ে), কখনো throw করে না। scripts/test-render-plan.mjs-এ পরীক্ষা হয়।
// ⚠️ হাদিসের লেখা JSON থেকে হুবহু নেওয়া হয় (কিছু বদলানো হয় না)। প্রকাশের আগে লেখা, সূত্র ও নম্বর নিজে যাচাই করে নিয়ো।
import {
  APP_NAME,
  HOOK_TEXT,
  NUMBER_LABEL,
  OUTRO_TEXT,
  SERIES_LABEL,
  TAGLINE,
} from "./renderPlan.mjs";
import { splitWords, teaserWordList } from "./srt.mjs";

/** ইউটিউব সীমা */
export const YT_TITLE_MAX = 100;
export const YT_TAGS_MAX = 500;

/** src/lib/displayText.ts `buildHadisLabel`-এর কপি: "সহীহ বুখারী হাদিস নং : ১২৩" */
export function hadisLabel(book, number) {
  const b = String(book ?? "").trim();
  const n = String(number ?? "").trim();
  if (b && n) return `${b} ${NUMBER_LABEL} ${n}`;
  if (n) return `${NUMBER_LABEL} ${n}`;
  return b;
}

/** পুরো হাদিসের লেখা: segment-এর লেখা পরপর (JSON থেকে হুবহু) */
export function fullHadisText(file) {
  return (file?.segments ?? [])
    .map((s) => String(s?.text ?? "").trim())
    .filter((t) => t.length > 0)
    .join(" ");
}

/** একটা হ্যাশট্যাগ: স্পেস → _, অক্ষর/চিহ্ন/সংখ্যা/_ ছাড়া সব বাদ (ZWJ/ZWNJ থাকে — বাংলা যুক্তাক্ষর) */
export function toHashtag(text) {
  const body = String(text ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{M}\p{N}_‌‍]/gu, "")
    .replace(/^_+|_+$/g, "");
  return body ? `#${body}` : "";
}

/** `max` অক্ষরের মধ্যে, শব্দের সীমানায় ছাঁটা; ছাঁটলে শেষে "…" */
export function truncate(text, max) {
  const chars = [...String(text ?? "")];
  if (chars.length <= max) return chars.join("");
  const cut = chars.slice(0, max - 1).join("");
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,|\-–—:।]+$/u, "")}…`;
}

/** শব্দ-তালিকা থেকে প্রথম `n` শব্দ */
const firstWords = (text, n) => splitWords(text).slice(0, n).join(" ");

/** হ্যাশট্যাগের তালিকা (ডুপ্লিকেট ছাড়া)। portrait থাকলে Shorts ট্যাগ */
export function buildHashtags({ book, series, orientations = ["portrait"] }) {
  const tags = [toHashtag(book), "#হাদিস", "#আজকের_হাদিস", "#Hadith", "#ইসলাম", "#Islam", "#IslamicVideo"];
  if (series) tags.push(toHashtag(`${SERIES_LABEL} ${series}`));
  if (orientations.includes("portrait")) tags.push("#Shorts", "#IslamicShorts");
  const seen = new Set();
  return tags.filter((t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
}

/** ইউটিউব ট্যাগ (কমা দিয়ে; মোট ≤ ৫০০ অক্ষর) */
export function buildYoutubeTags({ book, label, series }) {
  const candidates = [
    label,
    book,
    "হাদিস",
    "আজকের হাদিস",
    "hadith",
    "hadis",
    "islamic video",
    "islamic shorts",
    "ইসলামিক ভিডিও",
    APP_NAME,
    series ? `${SERIES_LABEL} ${series}` : "",
  ];
  const out = [];
  let len = 0;
  const seen = new Set();
  for (const raw of candidates) {
    const t = String(raw ?? "").trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    const add = [...t].length + (out.length ? 2 : 0); // ", "
    if (len + add > YT_TAGS_MAX) break;
    out.push(t);
    seen.add(t.toLowerCase());
    len += add;
  }
  return out;
}

/**
 * পুরো টেক্সট ফাইলের লেখা।
 * @param {object} a
 * @param {{segments: any[], teaser?: any}} a.file  পার্স করা timestamp JSON
 * @param {string} [a.book] @param {string} [a.number] (বাংলা সংখ্যা) @param {string} [a.series] (বাংলা সংখ্যা)
 * @param {string} [a.hookText] @param {string} [a.appLink] @param {string[]} [a.orientations]
 */
export function buildPublishText(a) {
  const book = String(a.book ?? "").trim();
  const number = String(a.number ?? "").trim();
  const series = a.series ? String(a.series).trim() : "";
  const label = hadisLabel(book, number);
  const hook = typeof a.hookText === "string" && a.hookText.trim() !== "" ? a.hookText.trim() : HOOK_TEXT;
  const orientations = a.orientations?.length ? a.orientations : ["portrait"];
  const link = a.appLink ? String(a.appLink).trim() : "";

  const hadis = fullHadisText(a.file);
  const teaser = a.file?.teaser ? teaserWordList(a.file).join(" ") : "";
  const snippet = teaser || firstWords(hadis, 14);

  const tags = buildHashtags({ book, series, orientations });
  const seriesPrefix = series ? `${SERIES_LABEL} ${series} | ` : "";
  const labelPart = label || TAGLINE;

  // ---- শিরোনামের তিনটা বিকল্প (ইউটিউব ≤ ১০০ অক্ষর) ----
  // ৩ নম্বর: লেবেল অক্ষত রেখে হাদিসের শুরুর অংশ বাকি জায়গায় (সীমা পেরোলে শুধু উদ্ধৃতি ছাঁটা হয়)
  const tail = ` | ${seriesPrefix}${labelPart}`;
  const quoteBudget = YT_TITLE_MAX - [...tail].length - 2; // দুই উদ্ধৃতি-চিহ্ন
  const quoted = snippet && quoteBudget >= 12 ? `“${truncate(snippet, quoteBudget)}”${tail}` : "";
  const titles = [
    `${seriesPrefix}${labelPart} | ${TAGLINE}`,
    `${hook} | ${labelPart}`,
    quoted || `${seriesPrefix}${TAGLINE} | ${labelPart}`,
  ].map((t) => truncate(t, YT_TITLE_MAX));

  const promo = link
    ? `📲 ${APP_NAME}\n${OUTRO_TEXT} ${link}`
    : `📲 ${OUTRO_TEXT.replace(/:\s*$/, "")} — ${APP_NAME}`;

  const ytDescription = [
    hook,
    "",
    label ? `📖 ${label}` : "",
    hadis ? `\n“${hadis}”` : "",
    label ? `\n📚 সূত্র: ${label}` : "",
    "",
    promo,
    "",
    tags.join(" "),
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();

  const fbCaption = [
    hook,
    "",
    snippet ? `“${truncate(snippet, 220)}”` : "",
    "",
    label ? `📖 ${label}` : "",
    promo,
    "",
    tags.slice(0, 6).join(" "),
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();

  const ytTags = buildYoutubeTags({ book, label, series });
  const rule = "=".repeat(60);

  return [
    `${rule}`,
    `প্রকাশের টেক্সট — ${label || "হাদিস"}${series ? ` (${SERIES_LABEL} ${series})` : ""}`,
    `⚠️ প্রকাশের আগে হাদিসের লেখা, সূত্র ও নম্বর নিজে যাচাই করে নিন (লেখা JSON থেকে হুবহু নেওয়া)।`,
    `${rule}`,
    "",
    "▶ ইউটিউব — শিরোনামের ৩টা বিকল্প (একটা বেছে নিন; সীমা ১০০ অক্ষর)",
    ...titles.map((t, i) => `  ${i + 1}) ${t}   [${[...t].length}/${YT_TITLE_MAX}]`),
    "",
    "▶ ইউটিউব — বিবরণ (Description)",
    "-".repeat(60),
    ytDescription,
    "-".repeat(60),
    "",
    `▶ ইউটিউব — ট্যাগ (কমা দিয়ে; ${[...ytTags.join(", ")].length}/${YT_TAGS_MAX} অক্ষর)`,
    ytTags.join(", "),
    "",
    "▶ ফেসবুক — ক্যাপশন",
    "-".repeat(60),
    fbCaption,
    "-".repeat(60),
    "",
    "▶ হ্যাশট্যাগ (সব)",
    tags.join(" "),
    "",
    "ℹ️ সাবটাইটেল: একই নামের .srt ফাইলটা ইউটিউব স্টুডিওতে Subtitles → Upload file (With timing) দিয়ে দিন।",
    "",
  ].join("\n");
}
