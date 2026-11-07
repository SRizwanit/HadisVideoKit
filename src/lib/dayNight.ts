/**
 * Part 3: দিন-রাতের অগ্রগতি (nightFactor)।
 *   Intro        → ০ (সকাল)
 *   Main         → ০ থেকে MAIN_END_NIGHT (০.৯৫) পর্যন্ত মসৃণভাবে বাড়ে
 *   Outro        → ১ (Outro-র শুরুর ১৫ ফ্রেমে ০.৯৫ → ১ হয়ে যায়)
 * মান কখনো কমে না।
 */

export const MAIN_END_NIGHT = 0.95;
const OUTRO_RAMP_FRAMES = 15;

export type DayNightInput = {
  frame: number;
  introFrames: number;
  mainFrames: number;
  outroFrames: number;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (p: number) => p * p * (3 - 2 * p);

export function computeNightFactor({
  frame,
  introFrames,
  mainFrames,
  outroFrames,
}: DayNightInput): number {
  if (frame < introFrames) return 0;

  const mainEnd = introFrames + mainFrames;
  if (frame < mainEnd) {
    if (mainFrames <= 0) return 0;
    return MAIN_END_NIGHT * smooth(clamp01((frame - introFrames) / mainFrames));
  }

  // Outro (এবং তার পরের যেকোনো ফ্রেম)
  const ramp = Math.max(1, Math.min(OUTRO_RAMP_FRAMES, outroFrames));
  const t = clamp01((frame - mainEnd) / ramp);
  return MAIN_END_NIGHT + (1 - MAIN_END_NIGHT) * t;
}
