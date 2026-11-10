import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { continueRender, delayRender } from "remotion";
import { FPS } from "../constants";

/**
 * Part 9C (+9D): inline SVG-র CSS ও SMIL অ্যানিমেশনকে প্রতিটা ফ্রেমে ঠিক সময়ে বসানো (frame-sync)।
 *
 * কেন: Remotion ফ্রেম ধরে ধরে রেন্ডার করে; ব্রাউজারের নিজস্ব ঘড়িতে চলা CSS অ্যানিমেশন
 * ভিডিওতে ঠিক সময়ে আসে না। তাই প্রতি ফ্রেমে প্রতিটা অ্যানিমেশন থামিয়ে (pause)
 * `currentTime = (localFrame / FPS) × 1000` বসানো হয়।
 *
 * **Stateless:** সময় প্রতিবার "পরম" (absolute) — আগের ফ্রেমের উপর নির্ভর করে না। তাই Studio-তে
 * আগে-পিছে স্ক্রাব করলে বা Remotion-এর একাধিক ট্যাবে সমান্তরাল রেন্ডারে একই ফ্রেমে একই ছবি আসে।
 *
 * Part 9D: একই ফাইলে SMIL (`<animate>`, `<animateTransform>`, `<animateMotion>`, `<set>`) যোগ হয়েছে।
 * outermost `<svg>`-এ `pauseAnimations()` + `setCurrentTime(localFrame / FPS)` — CSS-এর মতোই stateless।
 * একই `runSync` কলে CSS আর SMIL দুটোই বসে; `{ css, smil }`-এ এখন `smil`-ও আসল সংখ্যা।
 */

/**
 * ⏪ পিং-পং (reverse): SVG-র অ্যানিমেশন শেষ হয়ে গেলেও সেগমেন্টের সময় বাকি থাকলে আবার গোড়া থেকে চলে না —
 * উল্টো দিকে (reverse) চলে, শুরুতে পৌঁছে আবার সামনে, এভাবে সেগমেন্ট শেষ পর্যন্ত (forward → reverse → forward …)।
 *
 * "একবারের দৈর্ঘ্য" (period) = এই SVG-র সব অ্যানিমেশনের মধ্যে সবচেয়ে দেরিতে শেষ হওয়া অ্যানিমেশনের শেষ-সময়
 * (CSS: delay + duration × iterations; SMIL: begin + dur × repeatCount / repeatDur)। অসীম লুপ
 * (`infinite` / `indefinite`) এই হিসাবে এক পাক ধরা হয়; শুধু অসীম লুপই থাকলে সেই এক পাকই period।
 * সব অ্যানিমেশন একই period ধরে একসাথে উল্টোয়, তাই দৃশ্যটা সুসংগত থাকে।
 * বন্ধ করতে: `SVG_PINGPONG = false`। সময় এখনো stateless (পরম) — স্ক্রাব/সমান্তরাল রেন্ডারে একই ছবি।
 */
export const SVG_PINGPONG = true;

export type SyncCounts = { css: number; smil: number };

/** t (ms) কে [0, period]-এর মধ্যে আগে-পিছে ভাঁজ করে: 0→period→0→period… ; period ≤ 0 বা অসীম হলে t-ই ফেরে */
export function pingPongTime(t: number, period: number): number {
  if (!Number.isFinite(t) || t <= 0) return 0;
  if (!(period > 0) || !Number.isFinite(period)) return t;
  const cycle = period * 2;
  const m = t % cycle;
  return m <= period ? m : cycle - m;
}

/**
 * প্রথম sync-এ পাওয়া অ্যানিমেশনের তালিকা (পরের ফ্রেমগুলোতে একই তালিকা ব্যবহার হয়)।
 * `smil` (9D) = SMIL উপাদানের সংখ্যা; একই `key`-তে মার্কআপ বদলায় না, তাই একবার গুনলেই চলে।
 * `root` (9D) = তালিকা যে `<svg>` থেকে নেওয়া — React যদি কখনো `<svg>` নতুন করে বসিয়ে দেয় (যেমন
 * `dangerouslySetInnerHTML={{ __html }}`-এর object প্রতি রেন্ডারে নতুন বানালে), পুরনো তালিকা মৃত
 * উপাদানের; `root` না মিললে তালিকা আবার সংগ্রহ হয়।
 */
export type SyncCache = { key: string; animations: Animation[]; smil: number; root: Element | null };

/** SMIL অ্যানিমেশন-উপাদানের নাম (Part 9D)। inline SVG-তে camelCase নাম ঠিক রেখেই মেলে। */
export const SMIL_SELECTOR = "animate, animateTransform, animateMotion, set";

/** localFrame → মিলিসেকেন্ড। ঋণাত্মক/NaN হলে 0। */
export function frameToMs(localFrame: number, fps: number = FPS): number {
  const f = Number.isFinite(localFrame) ? Math.max(0, localFrame) : 0;
  return (f / fps) * 1000;
}

/** container-এর ভেতরের সব CSS/Web অ্যানিমেশন (subtree সহ)। API না থাকলে ফাঁকা। */
export function collectAnimations(container: Element): Animation[] {
  if (typeof container.getAnimations !== "function") return [];
  return container.getAnimations({ subtree: true });
}

/** এক CSS অ্যানিমেশনের শেষ-সময় (ms) — finite হলে delay + duration × iterations; অসীম হলে `null`; আন্দাজ না হলে 0 */
function cssAnimationEndMs(a: Animation): { end: number; infinite: boolean; oneCycle: number } {
  try {
    const ct = a.effect?.getComputedTiming?.();
    if (!ct) return { end: 0, infinite: false, oneCycle: 0 };
    const delay = Number(ct.delay) || 0;
    const dur = typeof ct.duration === "number" ? ct.duration : Number(ct.duration) || 0;
    const end = Number(ct.endTime);
    const infinite = !Number.isFinite(end);
    return { end: infinite ? 0 : Math.max(0, end), infinite, oneCycle: Math.max(0, delay + dur) };
  } catch {
    return { end: 0, infinite: false, oneCycle: 0 };
  }
}

/** SMIL ঘড়ি-মান ("2s", "500ms", "1.5", "0:03", "1min") → মিলিসেকেন্ড; বোঝা না গেলে null (যেমন "indefinite", "click", "a.end") */
export function parseClockMs(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const v = raw.split(";")[0].trim();
  if (!v) return null;
  let m = v.match(/^(-?\d+(?:\.\d+)?)\s*(ms|s|min|h)?$/i);
  if (m) {
    const n = parseFloat(m[1]);
    const u = (m[2] ?? "s").toLowerCase();
    return u === "ms" ? n : u === "min" ? n * 60000 : u === "h" ? n * 3600000 : n * 1000;
  }
  m = v.match(/^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/);
  if (m) return ((m[1] ? parseInt(m[1], 10) * 3600 : 0) + parseInt(m[2], 10) * 60 + parseFloat(m[3])) * 1000;
  return null;
}

/** container-এর SMIL উপাদানগুলোর মধ্যে সবচেয়ে দেরির শেষ-সময় (ms) ও অসীম-লুপের এক পাক */
function smilPeriods(container: Element): { end: number; oneCycle: number } {
  let end = 0;
  let oneCycle = 0;
  container.querySelectorAll(SMIL_SELECTOR).forEach((el) => {
    const begin = Math.max(0, parseClockMs(el.getAttribute("begin")) ?? 0);
    const dur = parseClockMs(el.getAttribute("dur"));
    if (dur === null || dur <= 0) {
      end = Math.max(end, begin); // `set` বা dur-ছাড়া
      return;
    }
    oneCycle = Math.max(oneCycle, begin + dur);
    const rc = el.getAttribute("repeatCount");
    const rd = el.getAttribute("repeatDur");
    const count = rc && rc !== "indefinite" ? parseFloat(rc) : rc === "indefinite" ? 0 : 1;
    const repeatDur = rd && rd !== "indefinite" ? parseClockMs(rd) : null;
    if (rc === "indefinite" || rd === "indefinite") return; // অসীম — শুধু oneCycle ধরা হলো
    end = Math.max(end, begin + (repeatDur ?? dur * (Number.isFinite(count) && count > 0 ? count : 1)));
  });
  return { end, oneCycle };
}

/**
 * পিং-পং-এর "একবারের দৈর্ঘ্য" (ms): CSS + SMIL মিলিয়ে সবচেয়ে দেরিতে শেষ হওয়া অ্যানিমেশনের শেষ-সময়;
 * finite কিছু না থাকলে অসীম লুপের এক পাক; কিছুই না থাকলে 0 (= পিং-পং নেই, আগের মতো)।
 */
export function computePeriodMs(animations: readonly Animation[], container: Element): number {
  let finiteEnd = 0;
  let cycle = 0;
  for (const a of animations) {
    const r = cssAnimationEndMs(a);
    if (r.infinite) cycle = Math.max(cycle, r.oneCycle);
    else finiteEnd = Math.max(finiteEnd, r.end);
  }
  const sm = smilPeriods(container);
  finiteEnd = Math.max(finiteEnd, sm.end);
  cycle = Math.max(cycle, sm.oneCycle);
  return finiteEnd > 0 ? finiteEnd : cycle;
}

/** তালিকার প্রতিটা অ্যানিমেশন থামিয়ে সময় বসায়; কয়টা অ্যানিমেশন পেল তা ফেরত দেয়। `periodMs > 0` হলে পিং-পং (reverse)। */
export function applyAnimationTime(
  animations: readonly Animation[],
  localFrame: number,
  fps: number = FPS,
  periodMs = 0,
): number {
  const t = pingPongTime(frameToMs(localFrame, fps), periodMs);
  for (const a of animations) {
    a.pause();
    a.currentTime = t;
  }
  return animations.length;
}

/**
 * container-এর সবচেয়ে বাইরের (outermost) `<svg>` উপাদানগুলো। SMIL-এর ঘড়ি (time container) থাকে
 * শুধু outermost `<svg>`-এ; ভেতরে nested `<svg>` থাকলে সেটার আলাদা ঘড়ি নেই।
 */
export function findSvgRoots(container: Element): SVGSVGElement[] {
  const roots: SVGSVGElement[] = [];
  container.querySelectorAll("svg").forEach((el) => {
    const parent = el.parentElement;
    if (!parent || !parent.closest("svg")) roots.push(el as SVGSVGElement);
  });
  // container নিজেই `<svg>` হলে (কেউ সরাসরি svg-তে ref দিলে) সেটাও ধরা হয়
  if (container instanceof SVGSVGElement && !container.parentElement?.closest("svg")) {
    roots.unshift(container);
  }
  return roots;
}

/** container-এর ভেতরের SMIL উপাদানের সংখ্যা (`animate`, `animateTransform`, `animateMotion`, `set`) */
export function countSmilAnimations(container: Element): number {
  return container.querySelectorAll(SMIL_SELECTOR).length;
}

/**
 * SMIL ঘড়ি থামিয়ে সময় বসায়: `svg.pauseAnimations(); svg.setCurrentTime(localFrame / FPS)`।
 * সময় প্রতিবার "পরম" — CSS-এর মতোই stateless; SMIL পেছনেও যেতে পারে, তাই এখানে cache লাগে না।
 * ফেরত: সময় বসানো SVG-র সংখ্যা (API না থাকলে বা SVG না থাকলে 0)।
 */
export function applySmilTime(container: Element, localFrame: number, fps: number = FPS, periodMs = 0): number {
  const seconds = pingPongTime(frameToMs(localFrame, fps), periodMs) / 1000;
  let applied = 0;
  for (const svg of findSvgRoots(container)) {
    if (typeof svg.pauseAnimations !== "function" || typeof svg.setCurrentTime !== "function") continue;
    svg.pauseAnimations();
    svg.setCurrentTime(seconds);
    applied += 1;
  }
  return applied;
}

/**
 * এক ধাপে (cache ছাড়া) sync — যাচাই/ডিবাগের জন্য সহজ রূপ।
 * ⚠️ cache ছাড়া ফিনিশ-হয়ে-যাওয়া (finite, fill নেই) অ্যানিমেশন আর "relevant" থাকে না, তাই
 * পিছনে স্ক্রাব করতে হলে `runSync` + cache ব্যবহার করো (useSvgSync তা-ই করে)।
 */
export function syncSvgToFrame(container: Element, localFrame: number, fps: number = FPS): SyncCounts {
  const anims = collectAnimations(container);
  const period = SVG_PINGPONG ? computePeriodMs(anims, container) : 0;
  const css = applyAnimationTime(anims, localFrame, fps, period);
  const smil = countSmilAnimations(container);
  if (smil > 0) applySmilTime(container, localFrame, fps, period);
  return { css, smil };
}

/**
 * cache-সহ sync (CSS + SMIL একসাথে)। `key` বদলালে (নতুন SVG মার্কআপ) বা ভেতরের `<svg>` উপাদানটাই
 * বদলে গেলে (DOM নতুন করে বসলে) অ্যানিমেশন আবার সংগ্রহ হয়।
 * প্রথম sync পেজ লোডের ঠিক পরেই হয়, তখন সব অ্যানিমেশন সক্রিয় — তাই সবই ধরা পড়ে।
 */
export function runSync(
  container: Element,
  localFrame: number,
  cache: { current: SyncCache | null },
  key: string,
  fps: number = FPS,
): SyncCounts {
  const root = container.querySelector("svg");
  if (!cache.current || cache.current.key !== key || cache.current.root !== root) {
    cache.current = {
      key,
      animations: collectAnimations(container),
      smil: countSmilAnimations(container),
      root,
    };
  }
  // পিং-পং (reverse): অ্যানিমেশনের সময় ফুরালে উল্টো দিকে চলে (SVG_PINGPONG = false দিলে আগের মতো)
  const period = SVG_PINGPONG ? computePeriodMs(cache.current.animations, container) : 0;
  const css = applyAnimationTime(cache.current.animations, localFrame, fps, period);
  // SMIL (9D): উপাদান থাকলেই ঘড়ি বসে। CSS-এর মতো cache-এর ঝামেলা নেই — SMIL ঘড়ি পেছনে যেতে পারে।
  const smil = cache.current.smil;
  if (smil > 0) applySmilTime(container, localFrame, fps, period);
  return { css, smil };
}

const warned = new Set<string>();

/** স্থির (অ্যানিমেশনহীন) SVG-র জন্য প্রতি label-এ একবারই সতর্কতা */
export function warnIfStatic(counts: SyncCounts, label: string): void {
  if (counts.css === 0 && counts.smil === 0 && !warned.has(label)) {
    warned.add(label);
    console.warn(
      `⚠️ SVG "${label}": কোনো অ্যানিমেশন পাওয়া যায়নি (CSS: 0, SMIL: 0) — স্থির ছবি হিসেবে দেখানো হচ্ছে।`,
    );
  }
}

/**
 * হুক: inline করা SVG-র container-এ প্রতি ফ্রেমে (useLayoutEffect — DOM বসার পর, ফ্রেম আঁকার আগে) সময় বসায়।
 *
 * - `ref`: SVG যে `div`-এর ভেতরে inline বসানো আছে তার ref
 * - `localFrame`: এই SVG-র নিজস্ব ফ্রেম (0 থেকে শুরু)
 * - `contentKey`: inline মার্কআপ (বা তার পরিচয়); বদলালে অ্যানিমেশন আবার সংগ্রহ হয়
 * - `label`: সতর্কতার বার্তায় নাম
 *
 * প্রতিটা commit-এর পর সময় আবার বসে (deps নেই — DOM বদলে গেলেও ঠিক থাকে, নিচে দেখো)।
 * প্রথম sync শেষ না হওয়া পর্যন্ত `delayRender` ধরে রাখে (অ্যানিমেশনহীন ফ্রেম ভিডিওতে যাবে না);
 * `ref` খালি থাকলেও ছেড়ে দেয় (রেন্ডার আটকে থাকে না)।
 * ফেরত: সর্বশেষ { css, smil } সংখ্যা (প্রথম sync-এর আগে `null`)।
 */
export function useSvgSync(
  ref: RefObject<Element | null>,
  localFrame: number,
  contentKey: string,
  label = "svg",
): SyncCounts | null {
  const [counts, setCounts] = useState<SyncCounts | null>(null);
  const handleRef = useRef<number | null>(null);
  const releasedRef = useRef(false);
  const cacheRef = useRef<SyncCache | null>(null);

  if (handleRef.current === null && !releasedRef.current) {
    handleRef.current = delayRender(`SVG sync (${label})`);
  }

  // ⚠️ deps নেই — ইচ্ছা করেই: প্রতিটা commit-এর পর চলে। React যদি কোনো রেন্ডারে ভেতরের `<svg>` নতুন করে বসায়
  // (innerHTML রিসেট), নতুন DOM বুনো ঘড়িতে চলত; এখানে প্রতি commit-এ সময় আবার বসে এবং `runSync` বদলে-যাওয়া
  // `<svg>` টের পেয়ে অ্যানিমেশন আবার সংগ্রহ করে। খরচ সামান্য (এক ফ্রেমে একবার রেন্ডার), আর `setCounts`-এর
  // তুলনায় একই সংখ্যা হলে নতুন রেন্ডার হয় না।
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) {
      const next = runSync(el, localFrame, cacheRef, contentKey);
      warnIfStatic(next, label);
      setCounts((prev) => (prev && prev.css === next.css && prev.smil === next.smil ? prev : next));
    }
    if (handleRef.current !== null) {
      continueRender(handleRef.current);
      handleRef.current = null;
      releasedRef.current = true;
    }
  });

  useLayoutEffect(
    () => () => {
      if (handleRef.current !== null) {
        continueRender(handleRef.current);
        handleRef.current = null;
        releasedRef.current = true;
      }
    },
    [],
  );

  return counts;
}
