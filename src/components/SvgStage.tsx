import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useHadisTimestamp } from "../lib/loadHadis";
import { computeNightFactor } from "../lib/dayNight";
import { useSvgInventory } from "../lib/svgInventory";
import { useSvgSource } from "../lib/svgLoad";
import { pickSvgNames } from "../lib/svgPicker";
import { sanitizeSvg } from "../lib/svgSanitize";
import { floatOffset, stageGlow } from "../lib/svgStage";
import { crossFadeLooks, planStage, type LayerLook, type StageLayerPlan } from "../lib/svgTransition";
import { buildFrameSegments, type Timing } from "../lib/timing";
import { computeLayout } from "../lib/useLayout";
import type { ThemeId } from "../types";
import { AnimatedSvg } from "./AnimatedSvg";
import { FallbackSvg } from "./FallbackSvg";

/**
 * Part 9K-2: SVG স্টেজের কঙ্কাল — প্রতিটা সেগমেন্টের জন্য ঠিক SVG (বা fallback আইকন) ঠিক জায়গায় আঁকে।
 * Part 9K-3: SVG-র পেছনে নরম glow + হালকা ডিস্ক (fallback-এর পেছনেও, একই), আর SVG-র হালকা ভাসা।
 *   - glow/ডিস্ক স্থির থাকে (স্টেজ নোঙর করা মনে হয়), শুধু SVG/fallback ভাসে (`floatOffset`, পরম ফ্রেমে → সেগমেন্ট বদলে লাফ নেই)
 *   - `radial-gradient` (CSS blur নয়) — render-safe; সব মাপ `svgBox.size`/`unit`-এর সমানুপাতিক → 4K-তে ঠিক ২×
 * (cross-fade 9L-এ — এখানে সেগমেন্ট বদলালে SVG সরাসরি বদলায়।)
 * Part 9K-4: ছোট যোগ — ঐচ্ছিক `idScope` prop (প্রিভিউয়ে একই পাতায় অনেক স্টেজের prefix আলাদা রাখে; ডিফল্টে আচরণ অপরিবর্তিত)।
 * Part 9K-5: ছোট যোগ — ঐচ্ছিক dev/test `inventory?: { names; ready }` prop (প্রিভিউ আপনার ফাইল না মুছেই "খালি ফোল্ডার" (N = 0) দেখায়;
 *   ডিফল্টে আসল `useSvgInventory()`-ই চলে, আচরণ অপরিবর্তিত)।
 * Part 9L: সেগমেন্ট বদলে cross-fade (`svgTransition.ts`): পুরনো SVG মিলিয়ে যায় (opacity ১→০, scale ১→১.০৬, ঝাপসা বাড়ে), নতুনটা ফোটে
 *   (opacity ০→১, scale ০.৯৪→১, ঝাপসা কমে); এই সময় **দুই স্তর একসাথে**, প্রতিটার নিজস্ব prefix (`s<run>-`) ও নিজস্ব স্থানীয় ফ্রেম।
 *   transition = `min(12, ⌊সেগমেন্টের দৈর্ঘ্য ÷ 3⌋)` ফ্রেম; পাশাপাশি একই SVG হলে transition নেই, অ্যানিমেশন থামে/আবার শুরু হয় না।
 *   ফেড/স্কেল/ঝাপসা শুধু SVG-স্তরে — glow/ডিস্ক কখনো নয়; ভাসা-wrapper আগের মতোই।
 *
 * পাইপলাইন:
 *   useHadisTimestamp (Part 5) → buildFrameSegments → useSvgInventory (9I) → pickSvgNames (9G–9H, শুধু `ready` হলে)
 *   → activeSegmentIndex (9K-1) → AnimatedSvg (9F) অথবা FallbackSvg (9J)
 *
 * 🔒 আগের Part-এর নিয়ম যা এখানে মানা হয়েছে:
 *  - `pickSvgNames` শুধু `inventory.ready === true` হলে চলে; নইলে কিছু আঁকা হয় না (মিথ্যা "SVG নেই" সতর্কতা আসে না)।
 *  - `names[i] === null` → FallbackSvg (কারণ যা-ই হোক: N = 0, নাম ফোল্ডারে নেই, ...)।
 *  - প্রতিটা সেগমেন্টের নিজস্ব `prefix` (`s<index>-`) — একসাথে দুই SVG থাকলেও (9L) নাম মেলে না।
 *  - এখানে SVG টেক্সট নিজে inline করা হয় না (`dangerouslySetInnerHTML` শুধু AnimatedSvg-এ, memo-সহ)।
 *  - নতুন `delayRender` নেই (আছে `useHadisTimestamp`, `useSvgInventory`, `useSvgSource`, `AnimatedSvg`-এ)।
 *
 * ⚠️ Part 13: Main `<Sequence from={intro}>`-এর ভেতরে বসালে `frameOffset={timing.introFrames}` দিতে হবে
 *    (Header-এর মতোই; নইলে সেগমেন্টের ফ্রেম ও nightFactor ভুল হবে)।
 */

export type SvgStageProps = {
  hadisId: string;
  theme: ThemeId;
  timing: Timing;
  /** `<Sequence from>`-এর অফসেট (ফ্রেম) — ভিডিওর পরম ফ্রেম = useCurrentFrame() + frameOffset */
  frameOffset?: number;
  /** dev প্রিভিউয়ের জন্য: ভিডিওর সাইজ ছাড়া অন্য সাইজে লেআউট (ডিফল্ট: useVideoConfig) */
  size?: { width: number; height: number };
  /** dev প্রিভিউয়ের জন্য: ভিডিওর পরম ফ্রেম সরাসরি (useCurrentFrame() + frameOffset-কে ছাপিয়ে যায়) */
  frame?: number;
  /**
   * Part 9K-4 (ছোট যোগ): একই পাতায় একাধিক `SvgStage` থাকলে (প্রিভিউয়ের অনেক ঘর) প্রতিটার id/class/keyframe-নাম আলাদা রাখতে
   * prefix-এর সামনে বসে (যেমন `"c3-"` → `c3-s0-…`)। ডিফল্ট `""` — আসল ভিডিওতে (একটাই স্টেজ) কিছু বদলায় না।
   */
  idScope?: string;
  /**
   * Part 9K-5 (dev/test): আসল `useSvgInventory()`-এর বদলে এই তালিকা ব্যবহার করে — যেমন `{ names: [], ready: true }` = খালি ফোল্ডার (N = 0),
   * আপনার `public/svg/` ফাইল না মুছেই। না দিলে আসল ইনভেন্টরি (আসল ভিডিওতে কখনো দিতে হয় না)।
   * 🔒 `ready: false` দিলে আগের মতোই কিছু আঁকা হয় না (`pickSvgNames` চলে না)।
   */
  inventory?: { names: readonly string[]; ready: boolean };
};

/** এক সেগমেন্টের স্তর: SVG আঁকা, না পারলে (ফাইল নেই / অবৈধ / নাম null) fallback আইকন */
const StageLayer: React.FC<{
  name: string | null;
  segmentIndex: number;
  localFrame: number;
  boxSize: number;
  theme: ThemeId;
  nightFactor: number;
  idScope: string;
}> = ({ name, segmentIndex, localFrame, boxSize, theme, nightFactor, idScope }) => {
  // একই shared cache AnimatedSvg-ও ব্যবহার করে — তাই দ্বিতীয়বার ফাইল আনা হয় না
  const source = useSvgSource(name);
  const prefix = `${idScope}s${segmentIndex}-`;

  // ফাইল লোড হলো কিন্তু সাফ করার পর অবৈধ (যেমন `<svg` আছে, `</svg>` নেই) → fallback
  const invalid = useMemo(
    () => source.state === "ready" && sanitizeSvg(source.text, { prefix }).svg === null,
    [source, prefix],
  );

  if (source.state === "loading") return null; // useSvgSource নিজে delayRender ধরে রেখেছে

  const fallback = (
    <FallbackSvg frame={localFrame} size={boxSize} theme={theme} nightFactor={nightFactor} />
  );

  if (source.state === "missing" || name === null) return fallback;

  return (
    <>
      {invalid ? fallback : null}
      <AnimatedSvg name={name} size={boxSize} frame={localFrame} prefix={prefix} />
    </>
  );
};

export const SvgStage: React.FC<SvgStageProps> = ({
  hadisId,
  theme,
  timing,
  frameOffset = 0,
  size,
  frame,
  idScope = "",
  inventory: inventoryOverride,
}) => {
  const currentFrame = useCurrentFrame();
  const video = useVideoConfig();
  const L = computeLayout(size?.width ?? video.width, size?.height ?? video.height);

  // ভিডিওর পরম ফ্রেম (Intro-সহ)
  const absFrame = frame ?? currentFrame + frameOffset;

  const nightFactor = computeNightFactor({
    frame: absFrame,
    introFrames: timing.introFrames,
    mainFrames: timing.mainFrames,
    outroFrames: timing.outroFrames,
  });

  const timestamp = useHadisTimestamp(hadisId);
  // hook সবসময় ডাকা হয় (hook-এর ক্রম বদলায় না); override থাকলে তারটাই ব্যবহার হয়
  const realInventory = useSvgInventory();
  const inventory = inventoryOverride ?? realInventory;

  const frameSegments = useMemo(
    () => (timestamp ? buildFrameSegments(timestamp, timing) : []),
    // timing object প্রতি রেন্ডারে নতুন হতে পারে — তাই তার সংখ্যাগুলো ধরেই মেলানো
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timestamp, timing.fps, timing.introFrames, timing.mainFrames, timing.outroFrames, timing.totalFrames],
  );

  // 🔒 শুধু ইনভেন্টরি লোড শেষ হলে (`ready`) — নইলে লোডিং-এর ফাঁকা তালিকাকে N = 0 ভেবে মিথ্যা সতর্কতা ছাপা হতো
  const namesKey = inventory.names.join("|");
  const names = useMemo(
    () => (inventory.ready && timestamp ? pickSvgNames(frameSegments, inventory.names) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inventory.ready, namesKey, timestamp, frameSegments],
  );

  // শুধু Main অংশ: Intro/Outro-তে (বা Main-এর বাইরে) কিছু আঁকা হয় না — কখন দেখাবে তা Part 13-এর `Sequence` ঠিক করে
  const mainStart = timing.introFrames;
  const mainEnd = timing.introFrames + timing.mainFrames;
  const inMain = absFrame >= mainStart && absFrame < mainEnd;

  // Part 9L: কোন কোন স্তর আঁকা হবে (সক্রিয় সেগমেন্ট + চলমান transition-এর পুরনো স্তর); 9K-1-এর নিয়মগুলোই ভেতরে চলে
  const plan = names ? planStage(frameSegments, names, absFrame) : null;
  const activeIndex = plan ? plan.active : -1;

  const { x, y, size: boxSize } = L.svgBox;

  if (!inMain || !names || !plan) return null;

  const looks = plan.outgoing ? crossFadeLooks(plan.progress, L.unit) : null;
  const glow = stageGlow(theme, nightFactor, boxSize);
  const floatY = floatOffset(absFrame, L.unit);
  // glow-এর বর্গের কেন্দ্র = svgBox-এর কেন্দ্র (`closest-side` হওয়ায় গ্রেডিয়েন্ট ঠিক glowRadius-এ শেষ)
  const glowShift = glow.glowRadius - boxSize / 2;
  const discShift = glow.discRadius - boxSize / 2;

  // 🔒 key = run-এর শুরু: transition শেষ হলেও নতুন স্তর একই element থাকে (remount/আবার-শুরু নেই); পুরনো স্তর শেষে সরে যায়
  const renderLayer = (kind: "in" | "out", lp: StageLayerPlan, look: LayerLook | null) => (
    <div
      key={lp.run}
      data-stage-layer={kind}
      data-name={lp.name ?? "fallback"}
      data-prefix={`${idScope}s${lp.run}-`}
      data-opacity={look ? look.opacity.toFixed(3) : "1"}
      data-scale={look ? look.scale.toFixed(3) : "1"}
      data-blur={look ? look.blur.toFixed(3) : "0"}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: boxSize,
        height: boxSize,
        transformOrigin: "50% 50%",
        // transition না চললে কিছুই বসে না (filter-স্তর/transform ছাড়া, আগের মতো)
        opacity: look ? look.opacity : undefined,
        transform: look ? `scale(${look.scale})` : undefined,
        filter: look && look.blur > 0.01 ? `blur(${look.blur}px)` : undefined,
      }}
    >
      <StageLayer
        name={lp.name}
        segmentIndex={lp.run}
        localFrame={lp.localFrame}
        boxSize={boxSize}
        theme={theme}
        nightFactor={nightFactor}
        idScope={idScope}
      />
    </div>
  );

  return (
    <div
      data-svg-stage=""
      data-segment={activeIndex}
      data-svg={names[activeIndex] ?? "fallback"}
      data-float={floatY.toFixed(3)}
      data-transition={plan.progress.toFixed(3)}
      data-transition-frames={plan.frames}
      data-layers={plan.outgoing ? 2 : 1}
      data-local={plan.incoming.localFrame}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: boxSize,
        height: boxSize,
      }}
    >
      {/* পেছনে: নরম glow (বাক্সের বাইরেও ছড়ায়, ছাঁটা হয় না) */}
      <div
        data-stage-glow=""
        style={{
          position: "absolute",
          left: -glowShift,
          top: -glowShift,
          width: glow.glowRadius * 2,
          height: glow.glowRadius * 2,
          background: glow.glowBackground,
          pointerEvents: "none",
        }}
      />
      {/* তার উপর: হালকা ভেতরের ডিস্ক */}
      <div
        data-stage-disc=""
        style={{
          position: "absolute",
          left: -discShift,
          top: -discShift,
          width: glow.discRadius * 2,
          height: glow.discRadius * 2,
          borderRadius: "50%",
          background: glow.discBackground,
          pointerEvents: "none",
        }}
      />
      {/* সামনে: SVG বা fallback — শুধু এটাই ভাসে */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: boxSize,
          height: boxSize,
          transform: `translateY(${floatY}px)`,
        }}
      >
        {/* ⚠️ এক array + `key` (= run) — transition শুরুতে আগের স্তর "in" থেকে "out" হলেও একই element থাকে (remount/ঝলক নেই) */}
        {[
          plan.outgoing ? renderLayer("out", plan.outgoing, looks ? looks.outgoing : null) : null,
          renderLayer("in", plan.incoming, looks ? looks.incoming : null),
        ]}
      </div>
    </div>
  );
};
