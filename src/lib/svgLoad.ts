import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { svgPath } from "../constants";

/**
 * Part 9E: `public/svg/<name>.svg` ফাইলের টেক্সট নিরাপদে লোড করা।
 *
 *  - ফাইল না থাকলে (404), সার্ভার HTML ফেরত দিলে (Studio-র dev সার্ভার), বডিতে `<svg` না থাকলে,
 *    নেটওয়ার্ক-এরর বা সময় শেষ হলে → ক্র্যাশ নয়, `delayRender` আটকে থাকে না, একবার ওয়ার্নিং, ফলাফল "missing"।
 *    (Part 8-র `useSfxSrc`-এর একই ধারণা।)
 *  - সফল লোড ক্যাশ হয় (একই নাম একবারই ফেচ; একসঙ্গে অনেকে চাইলেও একটাই ফেচ)। ব্যর্থতা ক্যাশ হয় না।
 *  - এই ফাইল শুধু লোড করে। সাফ করা (sanitize) Part 9A–9B, ফ্রেম-সিঙ্ক 9C–9D, জোড়া লাগানো 9F-এ।
 *
 * ব্যবহার (Part 9F `AnimatedSvg`):  `const src = useSvgSource(name); if (src.state !== "ready") return null;`
 */

/** SVG-র নামে শুধু ইংরেজি অক্ষর, সংখ্যা, `-`, `_` (types.ts-এর নিয়মের মতোই; `../` আটকানো) */
export const SVG_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;
/** এর বেশি সময় লাগলে "সময় শেষ" ধরে missing (render আটকে থাকে না) */
export const SVG_FETCH_TIMEOUT_MS = 15000;

export const isValidSvgName = (name: unknown): name is string =>
  typeof name === "string" && SVG_NAME_PATTERN.test(name);

// ---------- ফলাফলের ধরন ----------

export type SvgReady = { state: "ready"; text: string; reason: null };
export type SvgMissing = { state: "missing"; text: null; reason: string };
export type SvgLoading = { state: "loading"; text: null; reason: null };
/** লোডারের চূড়ান্ত ফলাফল */
export type SvgLoadResult = SvgReady | SvgMissing;
/** হুকের ফলাফল (loading সহ) */
export type SvgSource = SvgLoadResult | SvgLoading;

const LOADING: SvgLoading = { state: "loading", text: null, reason: null };

const missing = (reason: string): SvgMissing => ({ state: "missing", text: null, reason });

// ---------- উত্তর যাচাই (শুদ্ধ ফাংশন, DOM/React ছাড়া) ----------

export type ResponseInfo = {
  ok: boolean;
  status: number;
  /** `content-type` হেডার ("" হলে নেই) */
  contentType: string;
  /** উত্তরের বডি (পড়া না হলে "") */
  text: string;
};

/**
 * উত্তরটা ব্যবহারযোগ্য SVG কিনা: ঠিক হলে `ready` (BOM ছাঁটা টেক্সট), নইলে `missing` + কারণ (বাংলায়)।
 * "HTML ফেরত" ধরা হয় `content-type: text/html` অথবা বডির শুরু `<!doctype html` / `<html` দেখে।
 */
export function classifySvgResponse(info: ResponseInfo): SvgLoadResult {
  if (!info.ok) return missing(`ফাইল পাওয়া যায়নি (HTTP ${info.status})`);
  const type = info.contentType.toLowerCase();
  if (type.includes("text/html")) return missing("সার্ভার SVG-র বদলে HTML ফেরত দিয়েছে");
  const text = info.text.replace(/^﻿/, "");
  const head = text.trimStart().slice(0, 200).toLowerCase();
  if (head.startsWith("<!doctype html") || head.startsWith("<html")) {
    return missing("সার্ভার SVG-র বদলে HTML ফেরত দিয়েছে");
  }
  if (text.trim() === "") return missing("ফাইল ফাঁকা");
  if (!/<svg[\s>/]/i.test(text)) return missing("ফাইলে <svg> নেই");
  return { state: "ready", text, reason: null };
}

// ---------- লোডার ----------

/** `fetch`-এর মতো ফাংশন (পরীক্ষায় নকল বসানো যায়) */
export type SvgFetcher = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

export type SvgLoaderOptions = {
  /** ডিফল্ট: global `fetch` */
  fetcher?: SvgFetcher;
  /** নাম → URL; ডিফল্ট: `staticFile("svg/<name>.svg")` (ডাকার সময় হিসাব হয়) */
  urlFor?: (name: string) => string;
  timeoutMs?: number;
  /** ওয়ার্নিং কোথায় যাবে; ডিফল্ট `console.warn` */
  warn?: (message: string) => void;
};

export type SvgLoader = {
  /** নাম → ফলাফল। কখনো reject করে না। সফল হলে ক্যাশ, ব্যর্থ হলে নয়। */
  load: (name: string) => Promise<SvgLoadResult>;
  /** ক্যাশে সফল ফলাফল থাকলে তখনই (বিনা অপেক্ষায়) দেয়, নইলে `null` */
  peek: (name: string) => SvgReady | null;
  /** এ পর্যন্ত আসল নেটওয়ার্ক-ফেচ কতবার হয়েছে (ক্যাশ যাচাইয়ের জন্য) */
  fetchCount: () => number;
  clear: () => void;
};

/** `ms` মিলিসেকেন্ডে শেষ না হলে `onTimeout()` দিয়ে সংকেত + `"timeout"` ফেরত */
function raceTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => void): Promise<T | "timeout"> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout();
      resolve("timeout");
    }, ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export function createSvgLoader(options: SvgLoaderOptions = {}): SvgLoader {
  const timeoutMs = options.timeoutMs ?? SVG_FETCH_TIMEOUT_MS;
  const warn = options.warn ?? ((m: string) => console.warn(m));
  const ready = new Map<string, SvgReady>();
  const inflight = new Map<string, Promise<SvgLoadResult>>();
  const warned = new Set<string>();
  let fetches = 0;

  const warnOnce = (name: string, reason: string) => {
    if (warned.has(name)) return;
    warned.add(name);
    warn(`⚠️ SVG "${name}" ব্যবহার করা গেল না (public/svg/${name}.svg): ${reason} — fallback আইকন আসবে।`);
  };

  const fetchOne = async (name: string): Promise<SvgLoadResult> => {
    const fetcher: SvgFetcher =
      options.fetcher ?? ((url, init) => fetch(url, init as RequestInit | undefined));
    const url = (options.urlFor ?? ((n: string) => staticFile(svgPath(n))))(name);
    const ctrl = new AbortController();
    fetches += 1;
    try {
      const work = (async (): Promise<SvgLoadResult> => {
        const res = await fetcher(url, { signal: ctrl.signal });
        const contentType = res.headers.get("content-type") ?? "";
        const text = res.ok ? await res.text() : "";
        return classifySvgResponse({ ok: res.ok, status: res.status, contentType, text });
      })();
      const out = await raceTimeout(work, timeoutMs, () => ctrl.abort());
      if (out === "timeout") {
        work.catch(() => undefined); // দেরিতে আসা ব্যর্থতা চুপচাপ
        return missing(`সময় শেষ (${+(timeoutMs / 1000).toFixed(2)} সেকেন্ডে সাড়া নেই)`);
      }
      return out;
    } catch (err) {
      return missing(`লোড করা গেল না (${err instanceof Error ? err.message : String(err)})`);
    }
  };

  const load = (name: string): Promise<SvgLoadResult> => {
    if (!isValidSvgName(name)) {
      const why = 'নাম ঠিক নেই (শুধু ইংরেজি অক্ষর, সংখ্যা, - ও _ চলবে)';
      warnOnce(String(name), why);
      return Promise.resolve(missing(why));
    }
    const hit = ready.get(name);
    if (hit) return Promise.resolve(hit);
    const running = inflight.get(name);
    if (running) return running;

    const p: Promise<SvgLoadResult> = fetchOne(name)
      .then((r) => {
        if (r.state === "ready") ready.set(name, r);
        else warnOnce(name, r.reason);
        return r;
      })
      .finally(() => {
        inflight.delete(name);
      });
    inflight.set(name, p);
    return p;
  };

  return {
    load,
    peek: (name) => ready.get(name) ?? null,
    fetchCount: () => fetches,
    clear: () => {
      ready.clear();
      inflight.clear();
      warned.clear();
    },
  };
}

/** প্রকল্পের সবার ব্যবহারের লোডার (ক্যাশ একটাই) */
export const svgLoader: SvgLoader = createSvgLoader();

/** হুক ছাড়া সহজ রাস্তা: `await loadSvgText("svg1")` */
export const loadSvgText = (name: string): Promise<SvgLoadResult> => svgLoader.load(name);

// ---------- হুক ----------

const NO_NAME = missing("SVG-র নাম দেওয়া হয়নি");

/**
 * `name`-এর SVG টেক্সট লোড করে।
 *  - লোড চলাকালীন `{ state: "loading" }` + `delayRender` (ফ্রেম আটকে থাকে, ভিডিওতে খালি ফ্রেম যায় না)
 *  - সফল → `{ state: "ready", text }`; ফাইল নেই/অবৈধ → `{ state: "missing", reason }` (ক্র্যাশ নয়)
 *  - ক্যাশে থাকলে `delayRender` ছাড়াই সঙ্গে সঙ্গে `ready`
 *  - `delayRender` ছাড়া হয় state commit হওয়ার পরে (`useLayoutEffect`), তাই ফলাফল ছাড়া ফ্রেম ধরা পড়ে না;
 *    আনমাউন্ট বা নাম বদলালেও ছাড়া হয় — কোনো পথেই আটকে থাকে না
 *  - `name = null` → `missing` (কিছু ফেচ হয় না, ওয়ার্নিংও নয়)
 *  - `loader` দেওয়া যায় (ডিফল্ট `svgLoader`) — dev প্রিভিউ নকল সার্ভার বসাতে এটা ব্যবহার করে
 */
export function useSvgSource(name: string | null, loader: SvgLoader = svgLoader): SvgSource {
  const [state, setState] = useState<{ name: string; loader: SvgLoader; result: SvgLoadResult } | null>(null);
  const handleRef = useRef<number | null>(null);

  const cached = name !== null ? loader.peek(name) : null;
  const done = state !== null && state.name === name && state.loader === loader;
  const needsLoad = name !== null && cached === null && !done;

  // রেন্ডারের মুহূর্তেই ফ্রেম আটকানো (প্রথম commit-এর আগেই), যাতে এক ফ্রেমও ফাঁক না যায়
  if (needsLoad && handleRef.current === null) {
    handleRef.current = delayRender(`SVG লোড হচ্ছে (${name})`);
  }

  const release = () => {
    if (handleRef.current !== null) {
      const h = handleRef.current;
      handleRef.current = null;
      continueRender(h);
    }
  };

  useEffect(() => {
    if (name === null || loader.peek(name)) return;
    let alive = true;
    // নাম বদলের cleanup পুরনো handle ছেড়ে দেয়; তাই এখানে দরকার হলে নতুন করে ধরা (StrictMode-এও নিরাপদ)
    if (handleRef.current === null) handleRef.current = delayRender(`SVG লোড হচ্ছে (${name})`);
    loader.load(name).then((result) => {
      if (alive) setState({ name, loader, result });
    });
    return () => {
      alive = false;
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, loader]);

  // ফলাফল commit হওয়ার পরেই ছাড়া (সফল/ব্যর্থ দুই ক্ষেত্রেই)
  useLayoutEffect(() => {
    if (!needsLoad) release();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  if (name === null) return NO_NAME;
  if (cached) return cached;
  if (done && state) return state.result;
  return LOADING;
}
