import React from "react";
import { AbsoluteFill } from "remotion";
import { Caption } from "../components/Caption";
import { Header } from "../components/Header";
import { SvgStage } from "../components/SvgStage";
import type { Timing } from "../lib/timing";
import type { ThemeId } from "../types";

/**
 * Part 13A: Main সিন — ভিডিওর মাঝের হাদিস-অংশ।
 *   উপরে  `Header`   (Part 7: লোগো + অ্যাপের নাম + "আজকের হাদিস" + "(কিতাব) নং : (সংখ্যা)")
 *   মাঝে  `SvgStage` (Part 9K–9L: সেগমেন্টের SVG, glow + ভাসা + cross-fade; ভেতরে `AnimatedSvg` ও `svgPicker`)
 *   নিচে  `Caption`  (Part 10: রঙিন অ্যানিমেটেড ক্যাপশন)
 *
 * ⚠️ এটা Main `<Sequence from={timing.introFrames}>`-এর ভেতরে বসে, তাই `useCurrentFrame()` ০ থেকে শুরু হয়।
 *    তিনটাতেই `frameOffset = timing.introFrames` যায় (Part 7 নোট) — না হলে দিন-রাতের রঙ, SVG ও ক্যাপশনের সেগমেন্ট ভুল হতো।
 *    `frameOffset` না দিলে ডিফল্ট ঠিক `timing.introFrames` (Part 12D-র `OutroScene`-এর মতো), তাই Part 13B শুধু
 *    `<MainScene hadisId theme bookname number timing />` বসাবে।
 *
 * - ব্যাকগ্রাউন্ড এখানে আঁকা হয় না (Part 13B-র `<Background>` পেছনে থাকবে); সব স্তর স্বচ্ছ।
 * - কোনো সময়/মাপের হিসাব নেই: বক্সের জায়গা প্রতিটা কম্পোনেন্ট নিজে `computeLayout()` থেকে নেয় (4K = ঠিক ২× HD)।
 * - স্তরের ক্রম: নিচে `SvgStage` (তার glow বক্সের বাইরেও ছড়ায়), তার উপরে `Header`, সবার উপরে `Caption` —
 *   তাই glow কখনো লেখা ঢাকে না।
 * - শুধু Main-এর ভেতরে আঁকার কথা: `SvgStage`/`Caption` Main-এর বাইরে নিজেরাই কিছু আঁকে না।
 * - `size`/`idScope` শুধু dev প্রিভিউয়ের জন্য (অন্য সাইজে লেআউট; একই পাতায় অনেক স্টেজের id আলাদা রাখা); আসল ভিডিওতে কখনো দিতে হয় না।
 * - `data-main-scene` / `data-main-slot` / `data-frame-offset` শুধু `MainSceneCheck`-এর স্বয়ংক্রিয় যাচাইয়ের জন্য; আঁকায় কোনো প্রভাব নেই।
 */

export type MainSceneProps = {
  hadisId: string;
  theme: ThemeId;
  bookname: string;
  number: string;
  timing: Timing;
  /** `<Sequence from>`-এর অফসেট (ফ্রেম)। ডিফল্ট `timing.introFrames` (Main যেখানে শুরু) */
  frameOffset?: number;
  /** dev প্রিভিউয়ের জন্য: ভিডিওর সাইজ ছাড়া অন্য সাইজে লেআউট (ডিফল্ট: useVideoConfig) */
  size?: { width: number; height: number };
  /** dev প্রিভিউয়ের জন্য: একই পাতায় একাধিক `SvgStage` থাকলে id/class আলাদা রাখার prefix (ডিফল্ট `""`) */
  idScope?: string;
};

export const MainScene: React.FC<MainSceneProps> = ({
  hadisId,
  theme,
  bookname,
  number,
  timing,
  frameOffset,
  size,
  idScope,
}) => {
  const offset = frameOffset ?? timing.introFrames;

  return (
    <AbsoluteFill data-main-scene="" data-frame-offset={offset}>
      <AbsoluteFill data-main-slot="stage" data-frame-offset={offset}>
        <SvgStage
          hadisId={hadisId}
          theme={theme}
          timing={timing}
          frameOffset={offset}
          size={size}
          idScope={idScope}
        />
      </AbsoluteFill>
      <AbsoluteFill data-main-slot="header" data-frame-offset={offset}>
        <Header
          theme={theme}
          bookname={bookname}
          number={number}
          timing={timing}
          frameOffset={offset}
          size={size}
        />
      </AbsoluteFill>
      <AbsoluteFill data-main-slot="caption" data-frame-offset={offset}>
        <Caption hadisId={hadisId} theme={theme} timing={timing} frameOffset={offset} size={size} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
