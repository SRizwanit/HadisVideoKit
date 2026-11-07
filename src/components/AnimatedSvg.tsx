import React, { useEffect, useId, useMemo, useRef } from "react";
import { useCurrentFrame } from "remotion";
import { type SvgLoader, useSvgSource } from "../lib/svgLoad";
import { cleanPrefix, sanitizeSvg } from "../lib/svgSanitize";
import { type SyncCounts, useSvgSync } from "../lib/svgSync";

/**
 * Part 9F: একটা SVG ফাইলকে লোড → সাফ (sanitize + prefix) → inline → ফ্রেমে-ফ্রেমে সিঙ্ক করে আঁকে।
 *   লোড (9E `useSvgSource`) → `sanitizeSvg` (9A–9B, `prefix`-সহ) → `dangerouslySetInnerHTML` (সাফ করার পরেই)
 *   → `useSvgSync` (9C–9D)।
 *
 * props:
 *  - `name`   : "svg1", "svg2" ... (public/svg/<name>.svg)
 *  - `size`   : বর্গ বাক্সের পাশ (px); SVG পুরোটা এতে ভরে (viewBox 0 0 1000 1000)
 *  - `frame?` : এই SVG-র নিজস্ব ফ্রেম (0 থেকে)। না দিলে `useCurrentFrame()` (Composition/Sequence-এর স্থানীয় ফ্রেম)।
 *               Part 9K-তে `frame = বর্তমান ফ্রেম − সেগমেন্টের শুরু` দেওয়া হবে।
 *  - `prefix?`: id/class/@keyframes আলাদা করার prefix (9B)। **একই সময়ে পর্দায় থাকা দুই SVG-র আলাদা হতেই হবে**
 *               (cross-fade, একই SVG দু'বার)। না দিলে প্রতি instance-এর নিজস্ব অনন্য prefix (`useId`) নেওয়া হয়।
 *  - `loader?`, `onReport?`: dev প্রিভিউয়ের জন্য (নকল সার্ভার বসানো / অবস্থা জানা)।
 *
 * ফাইল নেই / HTML ফেরত / অবৈধ SVG হলে কিছুই আঁকে না (`null`) — fallback বসানো 9J/9K-র কাজ।
 * কারণ একবার লগে আসে (লোড-ব্যর্থতা: 9E, অবৈধ SVG: এখানে)।
 */

export type AnimatedSvgStatus = {
  /** `loading` = লোড চলছে; `ready` = আঁকা হয়েছে; `missing` = ফাইল নেই/অবৈধ, কিছু আঁকা হয়নি */
  state: "loading" | "ready" | "missing";
  counts: SyncCounts | null;
  reason: string | null;
};

export type AnimatedSvgProps = {
  name: string;
  size: number;
  frame?: number;
  prefix?: string;
  loader?: SvgLoader;
  onReport?: (status: AnimatedSvgStatus) => void;
  style?: React.CSSProperties;
};

const warnedInvalid = new Set<string>();
function warnInvalidOnce(name: string, reason: string) {
  const key = `${name}|${reason}`;
  if (warnedInvalid.has(key)) return;
  warnedInvalid.add(key);
  console.warn(`⚠️ SVG "${name}" ব্যবহার করা গেল না (public/svg/${name}.svg): ${reason} — fallback আইকন আসবে।`);
}

export const AnimatedSvg: React.FC<AnimatedSvgProps> = ({ name, size, frame, prefix, loader, onReport, style }) => {
  const currentFrame = useCurrentFrame();
  const localFrame = frame ?? currentFrame;

  // প্রতি instance-এর অনন্য ডিফল্ট prefix (ফ্রেমে ফ্রেমে একই থাকে — useId স্থির)
  const uid = useId();
  const effectivePrefix = useMemo(() => {
    const given = cleanPrefix(prefix);
    return given !== "" ? prefix! : `${cleanPrefix(name) || "svg"}-${cleanPrefix(uid) || "x"}-`;
  }, [prefix, name, uid]);

  const source = useSvgSource(name, loader);

  // কাঁচা টেক্সট → সাফ + prefix (শুধু টেক্সট বা prefix বদলালে)
  const sanitized = useMemo(
    () => (source.state === "ready" ? sanitizeSvg(source.text, { prefix: effectivePrefix }) : null),
    [source, effectivePrefix],
  );
  const html = sanitized?.svg ?? "";
  const invalidReason = sanitized && sanitized.svg === null ? (sanitized.warnings[0] ?? "অবৈধ SVG") : null;

  // ⚠️ `{ __html }` object-ও memo করা চাই (9D-র শিক্ষা): প্রতি রেন্ডারে নতুন object দিলে React ভেতরের <svg>
  // নতুন করে বসিয়ে দেয় এবং অ্যানিমেশন বুনো ঘড়িতে চলে।
  const innerHtml = useMemo(() => ({ __html: html }), [html]);

  const ref = useRef<HTMLDivElement>(null);
  const counts = useSvgSync(ref, localFrame, html, name);

  useEffect(() => {
    if (invalidReason) warnInvalidOnce(name, invalidReason);
  }, [name, invalidReason]);

  const state: AnimatedSvgStatus["state"] =
    source.state === "loading" ? "loading" : html !== "" ? "ready" : "missing";
  const reason = source.state === "missing" ? source.reason : invalidReason;

  const reportRef = useRef(onReport);
  reportRef.current = onReport;
  const lastRef = useRef("");
  useEffect(() => {
    if (state === "loading") return;
    const sig = `${state}|${counts?.css ?? "-"}|${counts?.smil ?? "-"}|${reason ?? ""}`;
    if (sig === lastRef.current) return;
    lastRef.current = sig;
    reportRef.current?.({ state, counts: state === "ready" ? counts : null, reason });
  }, [state, counts, reason]);

  if (html === "") return null;
  return (
    <div
      ref={ref}
      data-svg-name={name}
      style={{ width: size, height: size, lineHeight: 0, ...style }}
      dangerouslySetInnerHTML={innerHtml}
    />
  );
};
