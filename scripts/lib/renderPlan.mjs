// Part 14A: রেন্ডারের "পরিকল্পনা" — ব্রাউজার ছাড়া চলে, তাই সাধারণ Node-এই পরীক্ষা করা যায়।
// কাজ: আর্গুমেন্ট পার্স → যাচাই → জবের তালিকা → ইনপুট ফাইল আগেভাগে দেখা → --dry-run টেবিল।
// scripts/ ফোল্ডারে TypeScript চলে না, তাই src/constants.ts-এর মানগুলো এখানে কপি করা আছে;
// scripts/test-render-plan.mjs সেগুলো constants.ts-এর টেক্সটের সাথে মিলিয়ে দেখে।
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// ---------- src/constants.ts থেকে কপি (টেস্টে মিলিয়ে দেখা হয়) ----------
export const THEME_IDS = ["emerald", "navy", "greenDayNight"];
export const ORIENTATIONS = ["portrait", "landscape"];
export const QUALITIES = ["hd", "4k"];
export const ORIENTATION_LABEL = { portrait: "9x16", landscape: "16x9" };
export const QUALITY_LABEL = { hd: "HD", "4k": "4K" };
export const QUALITY_SCALE = { hd: 1, "4k": 2 };
export const BASE_SIZES = {
  portrait: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
};
export const DEFAULT_INTRO_SECONDS = 3;
export const DEFAULT_OUTRO_SECONDS = 4;
export const MAX_INTRO_OUTRO_SECONDS = 15;
export const HADIS_DIR = "hadis";
export const SVG_DIR = "svg";
export const SFX_DIR = "sfx";
export const COMPOSITION_IDS = {
  portrait: "HadisPortrait",
  landscape: "HadisLandscape",
};

// ---------- রেন্ডারের নিজস্ব ডিফল্ট ----------
export const DEFAULT_OUT_DIR = "out";
export const DEFAULT_CRF = 18;
export const CRF_RANGE = { min: 1, max: 51 };
/** 4K ভারী, তাই কম concurrency (মেমরি বাঁচাতে) */
export const DEFAULT_CONCURRENCY = { hd: 4, "4k": 2 };
export const CONCURRENCY_RANGE = { min: 1, max: 8 };

/** ইনপুট ফাইল (প্রজেক্টের রুট থেকে) */
export const LOGO_FILE = "src/logo.jpg";
export const BADGE_FILE = "src/google-play-badge.png";

// ---------- আর্গুমেন্টের তালিকা ----------
/** মান নেয় এমন আর্গুমেন্ট: কমান্ড-লাইন নাম → ভেতরের নাম */
const VALUE_ARGS = {
  id: "id",
  book: "book",
  number: "number",
  theme: "theme",
  orientation: "orientation",
  quality: "quality",
  intro: "intro",
  outro: "outro",
  concurrency: "concurrency",
  crf: "crf",
  "out-dir": "outDir",
  frames: "frames",
};
/** মান ছাড়া ফ্ল্যাগ */
const FLAG_ARGS = { "dry-run": "dryRun" };

// ---------- টেক্সট পরিষ্কার (src/lib/bnDigits.ts-এর কপি) ----------
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
// ZWSP, word joiner, BOM, LRM/RLM, bidi নিয়ন্ত্রণ, soft hyphen। ZWJ/ZWNJ ইচ্ছে করে নেই (যুক্তাক্ষর)।
const INVISIBLE = /[\u200B\u2060\uFEFF\u200E\u200F\u202A-\u202E\u2066-\u2069\u00AD]/g;
const SPACES = /[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g;

export function cleanText(input) {
  return String(input ?? "")
    .replace(INVISIBLE, "")
    .replace(SPACES, " ")
    .trim();
}

/** ইংরেজি, আরবি-ইন্ডিক, ফার্সি সংখ্যা → বাংলা সংখ্যা */
export function toBnDigits(input) {
  return String(input).replace(/[0-9\u0660-\u0669\u06F0-\u06F9]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code >= 0x30 && code <= 0x39) return BN_DIGITS[code - 0x30];
    if (code >= 0x660 && code <= 0x669) return BN_DIGITS[code - 0x660];
    return BN_DIGITS[code - 0x6f0];
  });
}

/** বাংলা/আরবি-ইন্ডিক/ফার্সি সংখ্যা → ইংরেজি (0-9) — শুধু সেকেন্ড পার্স করার জন্য */
function toAsciiDigits(input) {
  return String(input).replace(/[\u09E6-\u09EF\u0660-\u0669\u06F0-\u06F9]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code >= 0x9e6 && code <= 0x9ef) return String(code - 0x9e6);
    if (code >= 0x660 && code <= 0x669) return String(code - 0x660);
    return String(code - 0x6f0);
  });
}

// ---------- ১. আর্গুমেন্ট পার্স ----------
/**
 * `--key value` ও `--key=value` দুটোই চলে। `--dry-run` মান ছাড়া ফ্ল্যাগ।
 * খালি মান ("") বৈধ (যেমন `--intro ""`)। অজানা আর্গুমেন্ট → errors-এ বাংলা বার্তা।
 * কখনো throw করে না।
 * @param {string[]} argv  যেমন process.argv.slice(2)
 * @returns {{ raw: Record<string,string|boolean>, errors: string[], warnings: string[] }}
 */
export function parseArgs(argv) {
  const raw = {};
  const errors = [];
  const warnings = [];
  const list = Array.isArray(argv) ? argv.map((a) => String(a ?? "")) : [];

  for (let i = 0; i < list.length; i++) {
    const token = list[i];
    if (!token.startsWith("--")) {
      errors.push(
        `অপ্রত্যাশিত মান "${token}" — আর্গুমেন্ট অবশ্যই \`--নাম মান\` আকারে দিতে হবে।`,
      );
      continue;
    }
    const body = token.slice(2);
    const eq = body.indexOf("=");
    const name = eq === -1 ? body : body.slice(0, eq);

    if (name in FLAG_ARGS) {
      if (eq !== -1) {
        const v = body.slice(eq + 1).toLowerCase();
        raw[FLAG_ARGS[name]] = !(v === "false" || v === "0" || v === "no");
      } else {
        raw[FLAG_ARGS[name]] = true;
      }
      continue;
    }

    if (!(name in VALUE_ARGS)) {
      errors.push(
        `অজানা আর্গুমেন্ট \`--${name}\` — চলবে: ${[...Object.keys(VALUE_ARGS), ...Object.keys(FLAG_ARGS)]
          .map((k) => `--${k}`)
          .join(" ")}`,
      );
      // মানটা (যদি থাকে) পরের আর্গুমেন্ট হিসেবে ভুল ধরা এড়াতে বাদ দিই
      if (eq === -1 && i + 1 < list.length && !list[i + 1].startsWith("--")) i++;
      continue;
    }

    let value;
    if (eq !== -1) {
      value = body.slice(eq + 1);
    } else if (i + 1 < list.length && !list[i + 1].startsWith("--")) {
      value = list[i + 1];
      i++;
    } else {
      value = ""; // শেষে বা পরেই আরেকটা `--` আর্গুমেন্ট: মান খালি ধরি
    }
    if (VALUE_ARGS[name] in raw) {
      warnings.push(`\`--${name}\` একাধিকবার দেওয়া হয়েছে — শেষেরটা ধরা হলো।`);
    }
    raw[VALUE_ARGS[name]] = value;
  }

  return { raw, errors, warnings };
}

// ---------- ২. একেকটা মান যাচাই ----------
/**
 * সেকেন্ড: খালি → ডিফল্ট; ইংরেজি/বাংলা/আরবি-ইন্ডিক সংখ্যা; দশমিক চলবে ("2.5", "২.৫", "2,5")।
 * @returns {{ value?: number, error?: string }}
 */
export function parseSeconds(rawValue, argName, defaultValue) {
  const text = cleanText(rawValue);
  if (text === "") return { value: defaultValue };
  const ascii = toAsciiDigits(text).replace(/[,\u066B]/g, ".");
  if (!/^\d+(\.\d+)?$/.test(ascii)) {
    return {
      error: `\`--${argName}\` ("${text}") একটি সংখ্যা হতে হবে (০ থেকে ${MAX_INTRO_OUTRO_SECONDS}, যেমন 3 বা 2.5)। খালি রাখলে ডিফল্ট ${defaultValue} সেকেন্ড।`,
    };
  }
  const value = Number(ascii);
  if (!Number.isFinite(value) || value < 0 || value > MAX_INTRO_OUTRO_SECONDS) {
    return {
      error: `\`--${argName}\` (${text}) ০ থেকে ${MAX_INTRO_OUTRO_SECONDS} সেকেন্ডের মধ্যে হতে হবে।`,
    };
  }
  return { value };
}

/** পূর্ণসংখ্যা (concurrency/crf): খালি → undefined (ডিফল্ট), সীমার বাইরে হলে সীমায় এনে সতর্কতা */
function parseClampedInt(rawValue, argName, range, warnings) {
  const text = cleanText(rawValue);
  if (text === "") return { value: undefined };
  const ascii = toAsciiDigits(text);
  if (!/^\d+$/.test(ascii)) {
    return {
      error: `\`--${argName}\` ("${text}") একটি পূর্ণসংখ্যা হতে হবে (${range.min} থেকে ${range.max})।`,
    };
  }
  const n = Number(ascii);
  const clamped = Math.min(range.max, Math.max(range.min, n));
  if (clamped !== n) {
    warnings.push(
      `\`--${argName}\` (${n}) সীমার বাইরে ছিল, ${clamped} ধরা হলো (সীমা ${range.min}–${range.max})।`,
    );
  }
  return { value: clamped };
}

/** `--frames`: "0-59" বা একটি সংখ্যা "30"। খালি → undefined (পুরো ভিডিও) */
function parseFrames(rawValue) {
  const text = cleanText(rawValue);
  if (text === "") return { value: undefined };
  const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(toAsciiDigits(text));
  if (!m) {
    return {
      error: `\`--frames\` ("${text}") এই আকারে দাও: 0-59 (শুরু-শেষ ফ্রেম) অথবা একটি ফ্রেম নম্বর, যেমন 30।`,
    };
  }
  const start = Number(m[1]);
  const end = m[2] === undefined ? start : Number(m[2]);
  if (end < start) {
    return { error: `\`--frames\` ("${text}")-এ শেষ ফ্রেম শুরুর ফ্রেমের চেয়ে ছোট হতে পারে না।` };
  }
  return { value: [start, end] };
}

function pickFromList(rawValue, argName, list, defaultValue) {
  const text = cleanText(rawValue);
  if (text === "") return { value: defaultValue };
  if (!list.includes(text)) {
    return {
      error: `\`--${argName}\` ("${text}") ঠিক নয় — চলবে: ${list.join(", ")}`,
    };
  }
  return { value: text };
}

// ---------- ৩. পুরো পরিকল্পনা ----------
/**
 * আর্গুমেন্ট (argv তালিকা) → { ok, errors, warnings, plan }।
 * ভুল থাকলে সব ভুল একসাথে errors-এ আসে (একটা সারালে পরেরটা দেখা — এই ঝামেলা নেই)। কখনো throw করে না।
 * @param {string[]} argv
 * @returns {{ ok: boolean, errors: string[], warnings: string[], plan: object|null }}
 */
export function buildPlan(argv) {
  const parsed = parseArgs(argv);
  const errors = [...parsed.errors];
  const warnings = [...parsed.warnings];
  const raw = parsed.raw;

  // --- id ---
  const id = cleanText(raw.id);
  if (id === "") {
    errors.push("`--id` দিতে হবে (যেমন 0101 — এটা দিয়েই hadis0101.wav খোঁজা হয়)।");
  } else if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    errors.push(
      `\`--id\` ("${id}") ঠিক নয় — শুধু ইংরেজি অক্ষর, সংখ্যা, - ও _ চলবে (স্পেস, / বা .. চলবে না)।`,
    );
  }

  // --- theme / orientation / quality (খালি হলে ডিফল্ট) ---
  const theme = pickFromList(raw.theme, "theme", THEME_IDS, "emerald");
  const orientation = pickFromList(
    raw.orientation,
    "orientation",
    [...ORIENTATIONS, "both"],
    "portrait",
  );
  const quality = pickFromList(raw.quality, "quality", [...QUALITIES, "both"], "hd");
  for (const r of [theme, orientation, quality]) if (r.error) errors.push(r.error);

  // --- intro / outro ---
  const intro = parseSeconds(raw.intro, "intro", DEFAULT_INTRO_SECONDS);
  const outro = parseSeconds(raw.outro, "outro", DEFAULT_OUTRO_SECONDS);
  for (const r of [intro, outro]) if (r.error) errors.push(r.error);

  // --- book / number (Part 4-এর মতো পরিষ্কার) ---
  const book = cleanText(raw.book);
  const number = toBnDigits(cleanText(raw.number));
  if (book === "" && number === "") {
    warnings.push(
      "`--book` ও `--number` দুটোই খালি — ভিডিওতে হাদিসের লেবেল (যেমন \"সহীহ বুখারী নং : ১\") কিছু দেখাবে না।",
    );
  }

  // --- concurrency / crf / frames / out-dir ---
  const concurrencyOverride = parseClampedInt(
    raw.concurrency,
    "concurrency",
    CONCURRENCY_RANGE,
    warnings,
  );
  const crfOverride = parseClampedInt(raw.crf, "crf", CRF_RANGE, warnings);
  const frames = parseFrames(raw.frames);
  for (const r of [concurrencyOverride, crfOverride, frames]) if (r.error) errors.push(r.error);

  const outDirText = cleanText(raw.outDir);
  const outDir = outDirText === "" ? DEFAULT_OUT_DIR : outDirText;

  if (errors.length > 0) return { ok: false, errors, warnings, plan: null };

  // --- জবের তালিকা: portrait আগে, HD আগে ---
  const orientations = orientation.value === "both" ? [...ORIENTATIONS] : [orientation.value];
  const qualities = quality.value === "both" ? [...QUALITIES] : [quality.value];

  const jobs = [];
  for (const o of orientations) {
    for (const q of qualities) {
      const base = BASE_SIZES[o];
      const scale = QUALITY_SCALE[q];
      jobs.push({
        index: jobs.length + 1,
        compositionId: COMPOSITION_IDS[o],
        orientation: o,
        quality: q,
        scale,
        width: base.width * scale,
        height: base.height * scale,
        label: `${ORIENTATION_LABEL[o]} ${QUALITY_LABEL[q]}`,
        inputProps: {
          hadisId: id,
          hadisBookname: book,
          hadisNumber: number,
          theme: theme.value,
          orientation: o,
          introSeconds: intro.value,
          outroSeconds: outro.value,
        },
        outputFile: join(outDir, `hadis${id}_${ORIENTATION_LABEL[o]}_${QUALITY_LABEL[q]}.mp4`),
        concurrency: concurrencyOverride.value ?? DEFAULT_CONCURRENCY[q],
        crf: crfOverride.value ?? DEFAULT_CRF,
        frameRange: frames.value ?? null,
      });
    }
  }

  return {
    ok: true,
    errors: [],
    warnings,
    plan: { id, outDir, dryRun: raw.dryRun === true, jobs },
  };
}

// ---------- ৪. ইনপুট ফাইল আগেভাগে দেখা ----------
function fileSize(path) {
  try {
    const st = statSync(path);
    return st.isFile() ? st.size : -1;
  } catch {
    return -1;
  }
}

function countFiles(dir, filter) {
  try {
    return readdirSync(dir).filter((f) => filter(f) && fileSize(join(dir, f)) >= 0).length;
  } catch {
    return 0;
  }
}

/**
 * ব্রাউজার/বান্ডেল শুরুর আগেই দরকারি ফাইল আছে কিনা দেখে — ভুল সেকেন্ডেই ধরা পড়ে।
 * errors = থামাতে হবে; warnings/notes = শুধু জানানো (কখনো থামায় না)।
 * JSON-এর পুরো schema পরীক্ষা calculateMetadata-তেই থাকে; এখানে শুধু "পার্স হয় কিনা"।
 * কখনো throw করে না।
 * @param {{ id: string }} plan
 * @param {string} rootDir প্রজেক্টের রুট (সাধারণত process.cwd())
 */
export function checkInputs(plan, rootDir) {
  const errors = [];
  const warnings = [];
  const notes = [];
  const id = plan.id;

  const wavRel = `public/${HADIS_DIR}/hadis${id}.wav`;
  const jsonRel = `public/${HADIS_DIR}/hadis${id}_timestamp.json`;

  const wavSize = fileSize(join(rootDir, wavRel));
  if (wavSize < 0) {
    errors.push(
      `অডিও ফাইল পাওয়া যায়নি: ${wavRel} — .wav ফাইলটা public/${HADIS_DIR}/ ফোল্ডারে এই নামে রাখো, আর \`hadis_id\` ঠিক আছে কিনা দেখো।`,
    );
  } else if (wavSize === 0) {
    errors.push(`অডিও ফাইল খালি (০ বাইট): ${wavRel} — ঠিক ফাইলটা আবার আপলোড করো।`);
  }

  const jsonSize = fileSize(join(rootDir, jsonRel));
  if (jsonSize < 0) {
    errors.push(
      `টাইমস্ট্যাম্প ফাইল পাওয়া যায়নি: ${jsonRel} — AI-এর বানানো JSON-টা public/${HADIS_DIR}/ ফোল্ডারে এই নামে রাখো।`,
    );
  } else if (jsonSize === 0) {
    errors.push(`টাইমস্ট্যাম্প ফাইল খালি (০ বাইট): ${jsonRel} — ঠিক ফাইলটা আবার আপলোড করো।`);
  } else {
    try {
      JSON.parse(readFileSync(join(rootDir, jsonRel), "utf8"));
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      errors.push(
        `টাইমস্ট্যাম্প ফাইল (${jsonRel}) বৈধ JSON নয়: ${reason} — AI-কে আবার বলো "শুধু JSON দাও, কোনো ব্যাখ্যা বা \`\`\` ছাড়া"।`,
      );
    }
  }

  for (const rel of [LOGO_FILE, BADGE_FILE]) {
    const size = fileSize(join(rootDir, rel));
    if (size < 0) errors.push(`দরকারি ছবি পাওয়া যায়নি: ${rel} — এই ফাইলটা প্রজেক্টে রাখো।`);
    else if (size === 0) errors.push(`দরকারি ছবি খালি (০ বাইট): ${rel} — আবার আপলোড করো।`);
  }

  // শুধু জানানো (কখনো থামায় না)
  const svgCount = countFiles(join(rootDir, "public", SVG_DIR), (f) => /^svg.*\.svg$/i.test(f));
  const sfxCount = countFiles(join(rootDir, "public", SFX_DIR), (f) => !f.startsWith("."));
  notes.push(`public/${SVG_DIR}/ এ ${svgCount}টি svg*.svg ফাইল পাওয়া গেছে।`);
  notes.push(`public/${SFX_DIR}/ এ ${sfxCount}টি SFX ফাইল পাওয়া গেছে।`);
  if (svgCount === 0) {
    warnings.push(
      `public/${SVG_DIR}/ এ কোনো SVG নেই — অ্যানিমেটেড ছবির জায়গায় ডিফল্ট তারা (fallback) দেখানো হবে।`,
    );
  }
  if (sfxCount === 0) {
    warnings.push(`public/${SFX_DIR}/ খালি — ভিডিও SFX ছাড়া (নীরব) হবে।`);
  }

  return { ok: errors.length === 0, errors, warnings, notes };
}

// ---------- ৫. --dry-run টেবিল ----------
/** নম্বর দেওয়া জবের টেবিল (টেক্সট)। কিছু লেখে না, শুধু স্ট্রিং ফেরত দেয়। */
export function formatDryRun(plan) {
  const lines = [];
  lines.push(`রেন্ডার পরিকল্পনা — হাদিস আইডি: ${plan.id} | জব: ${plan.jobs.length}টি | আউটপুট ফোল্ডার: ${plan.outDir}`);
  lines.push("");
  plan.jobs.forEach((job) => {
    const frames = job.frameRange ? `${job.frameRange[0]}-${job.frameRange[1]}` : "পুরো ভিডিও";
    lines.push(`${job.index}. ${job.label}`);
    lines.push(`   কম্পোজিশন : ${job.compositionId}`);
    lines.push(`   সাইজ      : ${job.width}x${job.height} (scale ${job.scale})`);
    lines.push(`   আউটপুট    : ${job.outputFile}`);
    lines.push(`   concurrency: ${job.concurrency} | crf: ${job.crf} | ফ্রেম: ${frames}`);
  });
  const p = plan.jobs[0]?.inputProps;
  if (p) {
    lines.push("");
    lines.push(
      `ইনপুট: কিতাব="${p.hadisBookname}" নম্বর="${p.hadisNumber}" থিম=${p.theme} ইন্ট্রো=${p.introSeconds}s আউট্রো=${p.outroSeconds}s`,
    );
  }
  return lines.join("\n");
}

/** সব বার্তা এক রিপোর্টে (14B এটাই কনসোলে/Summary-তে ছাপবে) */
export function formatReport({ errors = [], warnings = [], notes = [] }) {
  const lines = [];
  for (const e of errors) lines.push(`❌ ${e}`);
  for (const w of warnings) lines.push(`⚠️ ${w}`);
  for (const n of notes) lines.push(`ℹ️ ${n}`);
  return lines.join("\n");
}
