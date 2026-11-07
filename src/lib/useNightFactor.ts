import { useCurrentFrame } from "remotion";
import { computeNightFactor } from "./dayNight";
import type { Timing } from "./timing";

/**
 * বর্তমান ফ্রেমের nightFactor (০ = দিন, ১ = রাত)। Background, Header, Caption সবাই এটা ব্যবহার করবে।
 * `frameOffset`: কম্পোনেন্ট `<Sequence from={N}>`-এর ভেতরে থাকলে N দিতে হয় (ডিফল্ট ০)।
 */
export function useNightFactor(timing: Timing, frameOffset = 0): number {
  // Part 7: <Sequence>-এর ভেতরে useCurrentFrame() লোকাল (০ থেকে) হয়; frameOffset = Sequence-এর `from`
  const frame = useCurrentFrame() + frameOffset;
  return computeNightFactor({
    frame,
    introFrames: timing.introFrames,
    mainFrames: timing.mainFrames,
    outroFrames: timing.outroFrames,
  });
}
