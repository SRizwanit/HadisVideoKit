import { useMemo } from "react";
import { buildFrameInfographics, infographicLayoutMix } from "./infographic";
import { useHadisTimestamp } from "./loadHadis";
import type { Timing } from "./timing";

/**
 * ইনফোগ্রাফিক-লেআউট মিশ্রণ (০–১) — `SvgStage` ও `Caption` একই সংখ্যা পায়, তাই SVG ছোট হওয়া আর ক্যাপশন-বক্স বদলানো একসাথে ঘটে।
 * JSON-এ `infographics` না থাকলে সবসময় ০ (লেআউট হুবহু আগের মতো)। `absFrame` = ভিডিওর পরম ফ্রেম।
 */
export function useInfographicMix(hadisId: string, timing: Timing, absFrame: number): number {
  const timestamp = useHadisTimestamp(hadisId);
  const list = useMemo(
    () => (timestamp ? buildFrameInfographics(timestamp, timing) : []),
    // timing object প্রতি রেন্ডারে নতুন হতে পারে — তাই তার সংখ্যাগুলো ধরেই মেলানো
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timestamp, timing.fps, timing.introFrames, timing.mainFrames, timing.outroFrames, timing.totalFrames],
  );
  return infographicLayoutMix(list, absFrame);
}
