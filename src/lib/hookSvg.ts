import { pickSvgNames } from "./svgPicker";
import type { TimestampFile } from "../types";

/**
 * ভিজ্যুয়াল হুক: ভিডিওর প্রথম মুহূর্তে (Hook দৃশ্যে) কোন SVG দেখানো হবে — শুদ্ধ লজিক (React/DOM/ফাইল-সিস্টেম ছাড়া, কখনো throw করে না)।
 *
 * লক্ষ্য: বিষয়ের সাথে মেলে এমন SVG এনিমেশন। নতুন কোনো SVG লাগে না — Main-এর জন্য বানানো SVG-ই ব্যবহার হয়:
 *  ১. JSON-এ `"hookSvg": "svg3"` লেখা থাকলে এবং `public/svg/`-এ থাকলে সেটাই (AI/আপনি বিষয় অনুযায়ী বাছেন)  → source `hookSvg`
 *  ২. নইলে টিজারের অংশ যে সেগমেন্টে পড়ে সেই সেগমেন্টের SVG (টিজার = হাদিসের সবচেয়ে শক্তিশালী বাক্যাংশ = বিষয়ের সারকথা) → source `teaser`
 *     (Main-এর সেগমেন্ট-SVG-র একই ক্রম/ঘোরানো নিয়ম মানা হয় — `pickSvgNames` — তাই Main-এর ক্রম বদলায় না)
 *  ৩. নইলে প্রথম সেগমেন্টের SVG → source `first`
 *  SVG ফোল্ডারে কিছুই না থাকলে `name = null` → fallback আইকন (৮-কোণা তারা), তবু প্রথম মুহূর্তে একটা অ্যানিমেশন থাকে।
 */

export type HookSvgSource = "hookSvg" | "teaser" | "first" | "none";
export type HookSvgPick = { name: string | null; source: HookSvgSource };

const NAME_RE = /^[A-Za-z0-9_-]+$/;

/** টিজারের শুরু (সেকেন্ড) যে সেগমেন্টে পড়ে তার সূচক; মেলে না থাকলে `start <= t` এমন শেষ সেগমেন্ট; না পেলে ০ */
export function segmentIndexAt(segments: readonly { start: number; end: number }[], seconds: number): number {
  if (!Array.isArray(segments) || segments.length === 0 || !Number.isFinite(seconds)) return 0;
  let found = 0;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].start <= seconds + 1e-6) found = i;
    else break;
  }
  return found;
}

export function pickHookSvg(
  file: Pick<TimestampFile, "segments"> & { hookSvg?: string },
  available: readonly string[],
  teaserStartSeconds?: number,
): HookSvgPick {
  const segs = file?.segments ?? [];
  if (!Array.isArray(available) || available.length === 0 || segs.length === 0) return { name: null, source: "none" };

  // ১. স্পষ্টভাবে লেখা hookSvg
  const forced = file.hookSvg;
  if (typeof forced === "string" && NAME_RE.test(forced) && available.includes(forced)) {
    return { name: forced, source: "hookSvg" };
  }

  const picks = pickSvgNames(segs, available);

  // ২. টিজারের সেগমেন্টের SVG
  if (typeof teaserStartSeconds === "number" && Number.isFinite(teaserStartSeconds)) {
    const name = picks[segmentIndexAt(segs, teaserStartSeconds)] ?? null;
    if (name) return { name, source: "teaser" };
  }

  // ৩. প্রথম সেগমেন্টের SVG
  return { name: picks[0] ?? null, source: picks[0] ? "first" : "none" };
}
