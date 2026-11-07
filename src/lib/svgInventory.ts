import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { continueRender, delayRender, getStaticFiles } from "remotion";
import { SVG_DIR } from "../constants";
import { createSvgLoader, type SvgLoader } from "./svgLoad";
import { normalizeAvailable } from "./svgPicker";

/**
 * Part 9I-1: `public/svg/`-এ কী কী SVG আছে — ফলাফলের ধরন ও নামের নিয়ম (শুদ্ধ ফাংশন; React/DOM/remotion/`fetch` ছাড়া,
 * কখনো throw করে না)।
 *
 *  - ফোল্ডার ছোঁয়া হয় না। ফাইল তালিকা পাওয়া 9I-2 (`getStaticFiles()`), `svg1, svg2, …` প্রোব করা 9I-3,
 *    দুটো জোড়া + ক্যাশ + `useSvgInventory()` হুক 9I-4, যাচাইয়ের ছবি 9I-5।
 *  - ফলাফল `{ names, count }`: `names` সরাসরি 9G–9H-র `pickSvgNames(segments, available)`-এর `available`।
 *    নামে `.svg` থাকে না (`svg1.svg` → `svg1`), সংখ্যা ধরে সাজানো (`svg2` < `svg10`), গ্যাপ থাকলে সবই ধরা
 *    (`svg1`, `svg3` থাকলে দুটোই), ডুপ্লিকেট ও অবৈধ নাম বাদ — সাজানো/ছাঁটার কাজ 9G-র `normalizeAvailable`-ই করে,
 *    তাই দুই জায়গায় দুই রকম নিয়ম হওয়ার ভয় নেই।
 *  - `source` ("static" | "probe") `pickSvgNames`-এর দরকার নেই; শুধু 9I-5-এর ছবিতে দেখানোর জন্য — কোন উপায়ে পাওয়া গেল।
 *
 * Part 9I-2 (এই ফাইলের নিচের অংশ): প্রথম উপায় — Remotion-এর `getStaticFiles()` দিয়ে `public/svg/` তালিকা।
 *  ⚠️ `getStaticFiles()` শুধু **Remotion Studio**-তে তালিকা দেয় (`window.remotion_staticFiles` Studio-র HTML বসায়)।
 *     `remotion render` / `renderStill` (আসল রেন্ডার ও `action = check`), Player ও সার্ভারে এটা কাজ করে না
 *     (`undefined` বা `[]` + ওয়ার্নিং)। তাই সেসব জায়গায় ফল "unusable" — তখন 9I-3-এর প্রোব (`svg1, svg2, …`) চলবে।
 *     এখানে কখনো throw/ওয়ার্নিং নেই (রেন্ডারে "কাজ করেনি" স্বাভাবিক, ওয়ার্নিং দিলে শুধু বিরক্তি)।
 *
 * Part 9I-3: দ্বিতীয় উপায় — `svg1, svg2, …` ক্রমান্বয়ে প্রোব (`probeSvgFiles`)। আসল রেন্ডার ও `action = check`-এ
 *  (যেখানে প্রথম উপায় কাজ করে না) এটাই আসলে চলে। প্রথম মিস বা HTML-ফেরতে থামে, সর্বোচ্চ 60; কখনো reject করে না,
 *  ঝুলে থাকে না (প্রতি ফেচে 9E-র টাইমআউট)। `delayRender` ধরা 9I-4-এর কাজ — এখানে শুধু async ফাংশন।
 *
 * Part 9I-4: দুই উপায় জোড়া + ক্যাশ + `useSvgInventory()` হুক (`createSvgInventoryLoader`, `svgInventoryLoader`)।
 *  প্রথম উপায় (`scanStaticFiles`) `ok` দিলে সেটাই (খালি হলেও) — প্রোব হয় না, `delayRender`-ও লাগে না; `unusable` হলে
 *  `probeSvgFilesDetailed()` একবারই চলে, ফল ক্যাশ হয়, প্রোব চলাকালীন হুক `delayRender` ধরে রাখে।
 *  কখনো reject/throw করে না; কোনো ব্যর্থতায় `count = 0` (তখন 9H-র স্বাভাবিক "no SVG" পথ), `delayRender` আটকে থাকে না।
 */

/** কোন উপায়ে তালিকা পাওয়া গেল: `getStaticFiles()` (9I-2) নাকি `svg1, svg2, …` প্রোব (9I-3) */
export type InventorySource = "static" | "probe";

/** স্ক্যানের ফলাফল। `count === names.length` সবসময় */
export type SvgInventory = {
  /** `available`-এর জন্য তৈরি নাম (`.svg`-ছাড়া, সংখ্যা ধরে সাজানো) */
  names: string[];
  count: number;
  source: InventorySource;
};

/** SVG ফাইলের এক্সটেনশন (ছোট হাতের; 9E `svgPath` ঠিক এটাই লোড করে, তাই `X.SVG` ধরা হয় না) */
export const SVG_FILE_EXT = ".svg";

/** নামের নিয়ম 9E-র `SVG_NAME_PATTERN`/`isValidSvgName`-এর মতোই (ইংরেজি অক্ষর, সংখ্যা, `-`, `_`)।
 *  এই ফাইল import-মুক্ত রাখতে (প্লেইন Node-এও চলে) এখানে আলাদা লেখা — `svgPicker.ts`-ও একই কাজ করেছে। */
const NAME_RE = /^[A-Za-z0-9_-]+$/;

/**
 * একটা ফাইল/পাথ স্ট্রিং থেকে SVG-র নাম: `"svg/svg1.svg"` → `"svg1"`, `"svg1.svg"` → `"svg1"`।
 * শুধু `<বৈধ-নাম>.svg` ফাইল ধরা হয়; বাকি সব (`.gitkeep`, `.png`, `readme.md`, `X.SVG`, `a b.svg`, `x.svg.svg`,
 * খালি/স্ট্রিং-নয় এমন মান) → `null`। `\` আর `/` দুটোই পাথ-বিভাজক (শেষ অংশটাই ফাইলের নাম)।
 * কোন ফোল্ডারের ফাইল সেটা এখানে দেখা হয় না — শুধু `svg/` ফোল্ডারের এন্ট্রি বেছে নেওয়া 9I-2-র কাজ।
 */
export function svgNameFromFile(file: unknown): string | null {
  if (typeof file !== "string") return null;
  const base = file.slice(Math.max(file.lastIndexOf("/"), file.lastIndexOf("\\")) + 1);
  if (base.length <= SVG_FILE_EXT.length || !base.endsWith(SVG_FILE_EXT)) return null;
  const name = base.slice(0, -SVG_FILE_EXT.length);
  return NAME_RE.test(name) ? name : null;
}

/**
 * ফাইল/পাথ তালিকা → `names` (`available`-এ সরাসরি দেওয়ার মতো): `.svg`-ফাইল ছাড়া সব বাদ, `.svg` কাটা,
 * ডুপ্লিকেট বাদ, সংখ্যা ধরে সাজানো, গ্যাপ ঠিক রাখা। খালি তালিকা বা অ্যারে-নয় এমন মান → `[]`, ক্র্যাশ নয়।
 * মূল তালিকা বদলায় না।
 */
export function namesFromFileList(files: unknown): string[] {
  if (!Array.isArray(files)) return [];
  const names: string[] = [];
  for (const file of files) {
    const name = svgNameFromFile(file);
    if (name !== null) names.push(name);
  }
  return normalizeAvailable(names);
}

/**
 * নাম-তালিকা + উৎস → `SvgInventory`। নামগুলো আবার ছেঁকে নেয় (`normalizeAvailable`), তাই `count` সবসময় `names.length`-এর
 * সমান। 9I-2 ও 9I-3 দুটোই ফলাফল এই ফাংশন দিয়ে বানাবে।
 */
export function makeInventory(names: unknown, source: InventorySource): SvgInventory {
  const clean = normalizeAvailable(names);
  return { names: clean, count: clean.length, source };
}

/** ফাইল/পাথ তালিকা থেকে সরাসরি `SvgInventory` (= `makeInventory(namesFromFileList(files), source)`) */
export function inventoryFromFileList(files: unknown, source: InventorySource): SvgInventory {
  return makeInventory(namesFromFileList(files), source);
}

// ---------- 9I-2: প্রথম উপায় — getStaticFiles() ----------

/** `public/` ফোল্ডারে `svg/` উপ-ফোল্ডারের নাম-শুরু (`"svg/"`); `staticFile(svgPath(n))`-এর পাথের সাথে মেলে */
export const SVG_STATIC_PREFIX = `${SVG_DIR}/`;

/** প্রথম উপায়ের ফল: তালিকা পাওয়া গেল (`ok`; খালি হলেও `count = 0` ধরে নেওয়া হয়) অথবা কাজ করেনি (`unusable` + কারণ, বাংলায়) */
export type StaticScan =
  | { state: "ok"; inventory: SvgInventory }
  | { state: "unusable"; reason: string };

/** `StaticFile`-এর `name` (`"svg/svg1.svg"`) বা সাধারণ স্ট্রিং → পরিষ্কার পাথ (`\` → `/`, শুরুর `/` ও `./` বাদ); অন্য ধরন → `null` */
function entryPath(entry: unknown): string | null {
  const raw =
    typeof entry === "string"
      ? entry
      : entry !== null && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string"
        ? (entry as { name: string }).name
        : null;
  if (raw === null) return null;
  return raw.replace(/\\/g, "/").replace(/^(?:\.?\/)+/, "");
}

/**
 * `getStaticFiles()`-এর তালিকা (বা ফাইল-পাথের স্ট্রিং) থেকে শুধু **`svg/` ফোল্ডারের সরাসরি ভেতরের** এন্ট্রির পাথ।
 * `hadis/…`, `sfx/…`, অন্য ফোল্ডার ও `svg/উপ-ফোল্ডার/…` বাদ (`staticFile("svg/<নাম>.svg")` শুধু সরাসরি ফাইলই লোড করে)।
 * অ্যারে-নয় → `[]`। (9I-1-এর নিয়ম ৩: ফোল্ডার বাছার কাজ এখানে।)
 */
export function svgDirEntries(files: unknown): string[] {
  if (!Array.isArray(files)) return [];
  const out: string[] = [];
  for (const entry of files) {
    const path = entryPath(entry);
    if (path === null || !path.startsWith(SVG_STATIC_PREFIX)) continue;
    const rest = path.slice(SVG_STATIC_PREFIX.length);
    if (rest.length > 0 && !rest.includes("/")) out.push(path); // সরাসরি ফাইল; ফোল্ডারের নিজের এন্ট্রি (`svg/`) ও উপ-ফোল্ডার বাদ
  }
  return out;
}

/** আসল `getStaticFiles()` ডাকার আগে দেখে নেয় এটা ব্রাউজারে Studio-তে চলছে কিনা (নইলে Remotion নিজে ওয়ার্নিং ছাপে); না হলে `undefined` */
function defaultGetFiles(): unknown {
  if (typeof document === "undefined" || typeof window === "undefined") return undefined; // সার্ভার/Node
  if ((window as unknown as { remotion_isPlayer?: boolean }).remotion_isPlayer) return undefined; // Player
  return getStaticFiles();
}

/**
 * প্রথম উপায়ে `public/svg/`-এর তালিকা। কখনো throw করে না, কিছু ছাপে না।
 *  - তালিকা (অ্যারে) পাওয়া গেলে → `{ state: "ok", inventory }` (`source: "static"`; গ্যাপ গোনা হয়; খালি অ্যারে/`svg/`-এ কিছু নেই → `count = 0`)
 *  - `getStaticFiles()` throw করলে, অ্যারে না দিলে (Studio-ছাড়া `undefined`), বা সার্ভার/Player-এ → `{ state: "unusable", reason }`
 *    → ডাকনেওয়ালা (9I-4) দ্বিতীয় উপায় (9I-3) নেবে।
 * `getFiles` শুধু পরীক্ষার জন্য (নকল তালিকা দিতে); না দিলে আসল `getStaticFiles()`।
 */
export function scanStaticFiles(getFiles: () => unknown = defaultGetFiles): StaticScan {
  let files: unknown;
  try {
    files = getFiles();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { state: "unusable", reason: `getStaticFiles() ডাকতে গিয়ে এরর (${msg.slice(0, 120)})` };
  }
  if (!Array.isArray(files)) {
    return {
      state: "unusable",
      reason: "getStaticFiles() তালিকা দেয়নি (এটা শুধু Remotion Studio-তে চলে; রেন্ডার/Player/সার্ভারে নয়)",
    };
  }
  return { state: "ok", inventory: inventoryFromFileList(svgDirEntries(files), "static") };
}

// ---------- 9I-3: দ্বিতীয় উপায় — svg1, svg2, … প্রোব ----------

/** প্রোবের সর্বোচ্চ সংখ্যা: `svg1 … svg60`। এর বেশি থাকলেও এখানেই থামে (অনন্ত লুপ আটকানো) */
export const SVG_PROBE_MAX = 60;

export type ProbeOptions = {
  /** কটা পর্যন্ত প্রোব (0 … `SVG_PROBE_MAX`-এর মধ্যে ছাঁটা); ডিফল্ট `SVG_PROBE_MAX`। শুধু পরীক্ষায় কমানোর জন্য */
  max?: number;
  /** ফাইল লোড করার জিনিস (`{ load(name) }`); ডিফল্ট: প্রতিবার নতুন চুপচাপ লোডার — নিচের নোট দেখুন। পরীক্ষায় নকল বসে */
  loader?: Pick<SvgLoader, "load">;
};

/** প্রোবের বিস্তারিত: `inventory` (source `"probe"`), থেমেছে কোন নামে ও কেন (`null` = থামেনি, সীমায় পৌঁছেছে), কটা প্রোব হয়েছে */
export type ProbeResult = {
  inventory: SvgInventory;
  /** যে নামে প্রথম মিস হয়েছে (যেমন `"svg3"`); সীমায় পৌঁছালে বা `max = 0` হলে `null` */
  stoppedAt: string | null;
  /** মিসের কারণ (বাংলায়, 9E-র `reason`) — `stoppedAt` `null` হলে `null` */
  reason: string | null;
  /** মোট কটা ফাইল প্রোব হয়েছে (শেষের মিস সহ) */
  probes: number;
};

/**
 * প্রোবের ডিফল্ট লোডার — **প্রতিবার নতুন, চুপচাপ (`warn` বন্ধ) ও খালি ক্যাশের**। কেন:
 *  - চুপচাপ: প্রোব সবসময় শেষে একটা না-থাকা ফাইলে (`svg3`) থামে; 9E-র সাধারণ লোডার (`svgLoader`) প্রতিটা মিসে
 *    "SVG ব্যবহার করা গেল না" ওয়ার্নিং ছাপে, ফলে প্রতিটা রেন্ডারে একটা ভুয়া ওয়ার্নিং আসত।
 *  - নতুন ক্যাশ: প্রোব যেন সবসময় ফোল্ডারের আসল অবস্থা দেখে (Studio-তে ফাইল মুছলে/যোগ হলে পুরনো ক্যাশ ভুল তালিকা দিত)।
 *    ফলাফলের ক্যাশ 9I-4 একবারই করবে।
 * (মূল `svgLoader`-এর ক্যাশ/ওয়ার্নিং 9E-তে যেমন ছিল তেমনই — এই ফাইল সেটা বদলায় না।)
 */
const newProbeLoader = (): Pick<SvgLoader, "load"> => createSvgLoader({ warn: () => undefined });

const clampMax = (max: number | undefined): number => {
  if (typeof max !== "number" || !Number.isFinite(max)) return SVG_PROBE_MAX;
  return Math.min(SVG_PROBE_MAX, Math.max(0, Math.floor(max)));
};

/**
 * `svg1, svg2, …` ক্রমানুসারে (একটার পর একটা, একসঙ্গে নয়) প্রোব করে; **প্রথম মিস বা HTML-ফেরতে থামে**
 * (HTML-ফেরত = 9E-র `classifySvgResponse`-এ `missing`), সর্বোচ্চ `SVG_PROBE_MAX` (60)। কখনো reject করে না:
 * `load` নিজে throw/reject করলেও সেটা মিস ধরা হয়। ঝুলে থাকে না — প্রতিটা ফেচের নিজের টাইমআউট (9E, ১৫ সেকেন্ড)।
 * ফল `source: "probe"` (`makeInventory`, 9I-1)। কিছুই না পেলে `count = 0`।
 *
 * ⚠️ সীমা (ইচ্ছাকৃত): গ্যাপে থামে — `svg1`, `svg3` থাকলে শুধু `svg1` মেলে; গ্যাপ-সহ তালিকা পেতে প্রথম উপায় (Studio) লাগে।
 * নেটওয়ার্ক-এরর/টাইমআউটও মিস গণ্য হয় (তখন তালিকা ছোট হতে পারে)।
 */
export async function probeSvgFilesDetailed(options: ProbeOptions = {}): Promise<ProbeResult> {
  const loader = options.loader ?? newProbeLoader();
  const max = clampMax(options.max);
  const found: string[] = [];
  let stoppedAt: string | null = null;
  let reason: string | null = null;
  let probes = 0;
  for (let n = 1; n <= max; n += 1) {
    const name = `svg${n}`;
    probes += 1;
    let miss: string | null = null;
    try {
      const r = await loader.load(name);
      if (r.state === "ready") found.push(name);
      else miss = typeof r.reason === "string" && r.reason !== "" ? r.reason : "ফাইল পাওয়া যায়নি";
    } catch (err) {
      miss = `লোড করা গেল না (${err instanceof Error ? err.message : String(err)})`;
    }
    if (miss !== null) {
      stoppedAt = name;
      reason = miss;
      break;
    }
  }
  return { inventory: makeInventory(found, "probe"), stoppedAt, reason, probes };
}

/** `probeSvgFilesDetailed(options).inventory` — শুধু ফলাফল দরকার হলে (9I-4 এটাই ডাকবে) */
export async function probeSvgFiles(options: ProbeOptions = {}): Promise<SvgInventory> {
  return (await probeSvgFilesDetailed(options)).inventory;
}

// ---------- 9I-4: দুই উপায় জোড়া + ক্যাশ + হুক ----------

/** স্ক্যানের বাড়তি তথ্য (9I-5-এর ছবির জন্য): কেন প্রথম উপায় চলেনি, আর প্রোব কোথায় ও কেন থেমেছে */
export type InventoryDetails = {
  /** প্রথম উপায় `unusable` হলে তার কারণ (বাংলায়); `ok` হলে বা এখনো দেখা না হলে `null` */
  staticReason: string | null;
  /** প্রোব যে নামে থেমেছে (`ProbeResult.stoppedAt`); প্রোব চলেনি/সীমায় পৌঁছালে `null` */
  stoppedAt: string | null;
  /** প্রোবের থামার কারণ (বাংলায়); প্রোব চলেনি হলে `null` */
  probeReason: string | null;
  /** কটা ফাইল প্রোব হয়েছে; প্রোব চলেনি হলে `null` */
  probes: number | null;
};

/** `createSvgInventoryLoader`-এর অপশন — দুটোই শুধু পরীক্ষায় নকল বসাতে */
export type InventoryLoaderOptions = {
  /** প্রথম উপায় (ডিফল্ট `scanStaticFiles`) */
  scan?: () => StaticScan;
  /** দ্বিতীয় উপায় (ডিফল্ট `probeSvgFilesDetailed`) */
  probe?: () => Promise<ProbeResult>;
};

/** গণনা (পরীক্ষা ও 9I-5-এর জন্য): `scans` = আসল প্রথম-উপায় ডাক, `probes` = দ্বিতীয় উপায় কতবার শুরু হয়েছে */
export type InventoryStats = { scans: number; probes: number };

export type SvgInventoryLoader = {
  /** তালিকা দেয়; কখনো reject করে না। ক্যাশে বা Studio-র তালিকায় থাকলে সঙ্গে সঙ্গে, নইলে প্রোব শেষে */
  load: () => Promise<SvgInventory>;
  /** এখনই (সিঙ্ক্রোনাস) জানা তালিকা, না জানলে `null` — Studio-র তালিকা বা ক্যাশ। `null` মানে "প্রোব দরকার" */
  peek: () => SvgInventory | null;
  details: () => InventoryDetails;
  stats: () => InventoryStats;
  /** ক্যাশ মোছে (শুধু পরীক্ষায়) */
  clear: () => void;
};

const sameNames = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((n, i) => n === b[i]);

/**
 * তালিকা-লোডার: প্রথম উপায়, না হলে দ্বিতীয় উপায়, ক্যাশ সহ।
 *  - প্রথম উপায় `ok` (খালি হলেও) → সেটাই; প্রোব হয় না। **এই ফল ক্যাশ হয় না** (Studio-তে সিঙ্ক্রোনাস ও সস্তা, তাই ফাইল
 *    যোগ/মোছা পরের রেন্ডারেই ধরা পড়ে); শুধু `names` অ্যারের পরিচয় ঠিক রাখা হয় (নাম একই থাকলে একই অ্যারে ফেরে)।
 *  - প্রথম উপায় `unusable` (আসল রেন্ডার/`action = check`-এ স্বাভাবিক) → এই কারণ একবার মনে রাখা হয়, আর ডাকা হয় না;
 *    প্রোব **একবারই** চলে (একসঙ্গে অনেক `load()` একই প্রোব ভাগ করে), ফল ক্যাশ হয় — খালি (`count = 0`) ফলও।
 *  - প্রোব নিজে throw/reject করলে (নকল/অস্বাভাবিক) `count = 0` ক্যাশ হয়; `load()` কখনো reject করে না।
 */
export function createSvgInventoryLoader(options: InventoryLoaderOptions = {}): SvgInventoryLoader {
  const scan = options.scan ?? (() => scanStaticFiles());
  const probe = options.probe ?? (() => probeSvgFilesDetailed());
  let cached: SvgInventory | null = null; // প্রোবের ফল
  let lastStatic: SvgInventory | null = null;
  let staticReason: string | null = null;
  let staticUnusable = false;
  let inflight: Promise<SvgInventory> | null = null;
  let probeInfo: { stoppedAt: string | null; reason: string | null; probes: number } | null = null;
  const stats: InventoryStats = { scans: 0, probes: 0 };

  const peek = (): SvgInventory | null => {
    if (cached) return cached;
    if (staticUnusable) return null;
    stats.scans += 1;
    let result: StaticScan;
    try {
      result = scan();
    } catch (err) {
      result = { state: "unusable", reason: `প্রথম উপায় ভেঙেছে (${err instanceof Error ? err.message : String(err)})` };
    }
    if (result.state === "ok") {
      staticReason = null;
      const inv = result.inventory;
      if (lastStatic && sameNames(lastStatic.names, inv.names)) return lastStatic;
      lastStatic = inv;
      return inv;
    }
    staticUnusable = true;
    staticReason = typeof result.reason === "string" ? result.reason : "প্রথম উপায় কাজ করেনি";
    return null;
  };

  const load = (): Promise<SvgInventory> => {
    const known = peek();
    if (known) return Promise.resolve(known);
    if (inflight) return inflight;
    stats.probes += 1;
    const p: Promise<SvgInventory> = (async () => {
      try {
        const r = await probe();
        probeInfo = { stoppedAt: r.stoppedAt, reason: r.reason, probes: r.probes };
        cached = makeInventory(r.inventory?.names, "probe");
      } catch (err) {
        probeInfo = {
          stoppedAt: null,
          reason: `প্রোব ভেঙেছে (${err instanceof Error ? err.message : String(err)})`,
          probes: 0,
        };
        cached = makeInventory([], "probe");
      }
      return cached;
    })().finally(() => {
      inflight = null;
    });
    inflight = p;
    return p;
  };

  return {
    load,
    peek,
    details: () => ({
      staticReason,
      stoppedAt: probeInfo?.stoppedAt ?? null,
      probeReason: probeInfo?.reason ?? null,
      probes: probeInfo?.probes ?? null,
    }),
    stats: () => ({ ...stats }),
    clear: () => {
      cached = null;
      lastStatic = null;
      staticReason = null;
      staticUnusable = false;
      inflight = null;
      probeInfo = null;
      stats.scans = 0;
      stats.probes = 0;
    },
  };
}

/** প্রকল্পের সবার ব্যবহারের তালিকা-লোডার (ক্যাশ একটাই) */
export const svgInventoryLoader: SvgInventoryLoader = createSvgInventoryLoader();

/** হুক ছাড়া সহজ রাস্তা: `const { names } = await loadSvgInventory()` */
export const loadSvgInventory = (): Promise<SvgInventory> => svgInventoryLoader.load();

/**
 * `useSvgInventory()`-এর ফল: `SvgInventory` + `ready`।
 *  - `ready: false` (প্রোব চলছে): `names = []`, `count = 0`, `source = null` — এই অবস্থার `names` **`pickSvgNames`-এ দেওয়া যাবে না**
 *    (খালি তালিকা N = 0-র মতো দেখাত ও ভুয়া "no SVG" ওয়ার্নিং ছাপত)। `delayRender` ধরা থাকায় এই অবস্থার ফ্রেম ভিডিওতে যায় না,
 *    কিন্তু কম্পোনেন্ট তবু একবার রেন্ডার হয় — তাই `ready` দেখে নিতে হবে।
 *  - `ready: true`: `names`/`count`/`source` চূড়ান্ত।
 */
export type SvgInventoryState = {
  names: string[];
  count: number;
  source: InventorySource | null;
  ready: boolean;
};

const LOADING_INVENTORY: SvgInventoryState = Object.freeze({
  names: [] as string[],
  count: 0,
  source: null,
  ready: false,
}) as SvgInventoryState;

const INVENTORY_DELAY_LABEL = "SVG তালিকা তৈরি হচ্ছে (public/svg/)";

/**
 * `public/svg/`-এর তালিকা (`{ names, count, source, ready }`), `names` সরাসরি `pickSvgNames`-এর `available`।
 *  - Studio-তে (প্রথম উপায় চলে) বা ক্যাশ থাকলে সঙ্গে সঙ্গে `ready: true`, কোনো `delayRender` ছাড়াই।
 *  - নইলে প্রোব চলাকালীন `ready: false` + `delayRender` (ফ্রেম আটকে থাকে); ফল state-এ বসার (commit) **পরে**ই `delayRender` ছাড়া হয়
 *    (সফল/ব্যর্থ দুই ক্ষেত্রে), আনমাউন্ট বা `loader` বদলালেও ছাড়া হয় — কোনো পথে আটকে থাকে না (StrictMode-এও নিরাপদ)।
 *  - ফল ক্যাশ হয়, তাই একই রেন্ডারে একাধিক কম্পোনেন্ট/ফ্রেমে আবার `delayRender`/স্ক্যান হয় না।
 *  - `names` অ্যারে ক্যাশ থাকাকালীন একই অবজেক্ট (`useMemo`-এর dependency-তে নিরাপদ)।
 * `loader` শুধু dev প্রিভিউ/পরীক্ষায় নকল বসাতে।
 */
export function useSvgInventory(loader: SvgInventoryLoader = svgInventoryLoader): SvgInventoryState {
  const [state, setState] = useState<{ loader: SvgInventoryLoader; inventory: SvgInventory } | null>(null);
  const handleRef = useRef<number | null>(null);

  const known = loader.peek();
  const done = state !== null && state.loader === loader;
  const needsLoad = known === null && !done;

  // রেন্ডারের মুহূর্তেই ফ্রেম আটকানো (প্রথম commit-এর আগেই), যাতে এক ফ্রেমও ফাঁক না যায়
  if (needsLoad && handleRef.current === null) {
    handleRef.current = delayRender(INVENTORY_DELAY_LABEL);
  }

  const release = () => {
    if (handleRef.current !== null) {
      const h = handleRef.current;
      handleRef.current = null;
      continueRender(h);
    }
  };

  useEffect(() => {
    if (loader.peek() !== null) return;
    let alive = true;
    // cleanup পুরনো handle ছেড়ে দেয়; তাই দরকার হলে নতুন করে ধরা (StrictMode-এও নিরাপদ)
    if (handleRef.current === null) handleRef.current = delayRender(INVENTORY_DELAY_LABEL);
    loader
      .load()
      .then((inventory) => {
        if (alive) setState({ loader, inventory });
      })
      .catch(() => {
        // load() reject করে না; তবু ঝুলে না থাকতে খালি তালিকা বসানো (→ 9H-র স্বাভাবিক "no SVG" পথ)
        if (alive) setState({ loader, inventory: makeInventory([], "probe") });
      });
    return () => {
      alive = false;
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loader]);

  // ফলাফল commit হওয়ার পরেই ছাড়া (সফল/ব্যর্থ দুই ক্ষেত্রেই)
  useLayoutEffect(() => {
    if (!needsLoad) release();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  const inventory = known ?? (done && state ? state.inventory : null);
  return useMemo(
    () => (inventory ? { names: inventory.names, count: inventory.count, source: inventory.source, ready: true } : LOADING_INVENTORY),
    [inventory],
  );
}
