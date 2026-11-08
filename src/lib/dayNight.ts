import { DEFAULT_TIME_MODE, type TimeMode } from "../constants";

/**
 * Part 3: দিন-রাতের অগ্রগতি (nightFactor)। সময়ের মোড (`timeMode`) অনুযায়ী চার রকম:
 *   dayToNight (ডিফল্ট, আগের আচরণ):
 *     Intro        → ০ (সকাল)
 *     Main         → ০ থেকে MAIN_END_NIGHT (০.৯৫) পর্যন্ত মসৃণভাবে বাড়ে
 *     Outro        → ১ (Outro-র শুরুর ১৫ ফ্রেমে ০.৯৫ → ১ হয়ে যায়)
 *     মান কখনো কমে না।
 *   nightToDay: dayToNight-এর ঠিক উল্টো (১ − মান): Intro ১ (রাত) → Main-এ ধীরে ০.০৫-এ (ভোর → দিন) → Outro ০ (উজ্জ্বল দিন); মান কখনো বাড়ে না।
 *   day  : পুরো ভিডিও জুড়ে ০ (দিন)
 *   night: পুরো ভিডিও জুড়ে ১ (রাত)
 */

export const MAIN_END_NIGHT = 0.95;
const OUTRO_RAMP_FRAMES = 15;

export type DayNightInput = {
  frame: number;
  introFrames: number;
  mainFrames: number;
  outroFrames: number;
  /** না দিলে `dayToNight` (আগের আচরণ) */
  timeMode?: TimeMode;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (p: number) => p * p * (3 - 2 * p);

/** দিন → রাত (`dayToNight`) — আগের হিসাব হুবহু; বাকি মোড এর উপর দাঁড়িয়ে */
function dayToNightFactor({ frame, introFrames, mainFrames, outroFrames }: DayNightInput): number {
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

/**
 * বর্তমান ফ্রেমের nightFactor (০ = দিন, ১ = রাত), `timeMode` অনুযায়ী।
 * মোড না দিলে = `dayToNight` — আগের মতোই।
 */
export function computeNightFactor(input: DayNightInput): number {
  const mode: TimeMode = input.timeMode ?? DEFAULT_TIME_MODE;
  if (mode === "day") return 0;
  if (mode === "night") return 1;
  const base = dayToNightFactor(input);
  return mode === "nightToDay" ? 1 - base : base;
}
