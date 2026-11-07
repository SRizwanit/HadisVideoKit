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

export type SyncCounts = { css: number; smil: number };

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

/** তালিকার প্রতিটা অ্যানিমেশন থামিয়ে সময় বসায়; কয়টা অ্যানিমেশন পেল তা ফেরত দেয়। */
export function applyAnimationTime(
  animations: readonly Animation[],
  localFrame: number,
  fps: number = FPS,
): number {
  const t = frameToMs(localFrame, fps);
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
export function applySmilTime(container: Element, localFrame: number, fps: number = FPS): number {
  const seconds = frameToMs(localFrame, fps) / 1000;
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
  const css = applyAnimationTime(collectAnimations(container), localFrame, fps);
  const smil = countSmilAnimations(container);
  if (smil > 0) applySmilTime(container, localFrame, fps);
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
  const css = applyAnimationTime(cache.current.animations, localFrame, fps);
  // SMIL (9D): উপাদান থাকলেই ঘড়ি বসে। CSS-এর মতো cache-এর ঝামেলা নেই — SMIL ঘড়ি পেছনে যেতে পারে।
  const smil = cache.current.smil;
  if (smil > 0) applySmilTime(container, localFrame, fps);
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
