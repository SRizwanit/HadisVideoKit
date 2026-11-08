import {
  FPS,
  INTRO_OUTRO_AUDIO_ENABLED,
  INTRO_OUTRO_AUDIO_FADE_OUT_FRAMES,
  INTRO_OUTRO_AUDIO_TAIL_SECONDS,
  INTRO_OUTRO_AUDIO_VOLUME,
  MAX_INTRO_OUTRO_SECONDS,
} from "../constants";
import type { Timing } from "./timing";

/**
 * Part 14C-audio: Intro/Outro ভয়েসের বিশুদ্ধ (pure) হিসাব — React/Remotion ছাড়া, কখনো throw করে না।
 *
 *  - দৃশ্যের দৈর্ঘ্য: ব্যবহারকারীর দেওয়া সেকেন্ড অডিওর চেয়ে ছোট হলে অডিও (+ ছোট বাড়তি) পর্যন্ত বাড়ে — অডিও কাটা পড়ে না।
 *    ব্যবহারকারীর সেকেন্ড বড় হলে সেটাই থাকে। সেকেন্ড ০ (দৃশ্য বন্ধ) হলে ০-ই থাকে (অডিওও বাজে না)।
 *  - অডিও Intro-তে ভিডিওর শুরু (ফ্রেম ০) থেকে, Outro-তে Main শেষ হওয়ার ফ্রেম থেকে; দৃশ্যের বাইরে যায় না।
 */

const finite = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** দৃশ্যের (Intro বা Outro) সেকেন্ড, অডিওর দৈর্ঘ্য মিলিয়ে। অডিও না থাকলে (null/০) সেকেন্ড অপরিবর্তিত */
export function fitSecondsToAudio(setSeconds: number, audioSeconds: number | null | undefined, fps: number = FPS): number {
  const s = finite(setSeconds, 0);
  if (!INTRO_OUTRO_AUDIO_ENABLED || !(s > 0)) return s;
  const a = finite(audioSeconds, 0);
  if (!(a > 0)) return s;
  const f = finite(fps, FPS) > 0 ? finite(fps, FPS) : FPS;
  const need = Math.ceil((a + INTRO_OUTRO_AUDIO_TAIL_SECONDS) * f) / f;
  return Math.min(MAX_INTRO_OUTRO_SECONDS, Math.max(s, need));
}

export type VoiceCue = {
  /** ভিডিওর শুরু থেকে শুরুর ফ্রেম */
  from: number;
  /** `<Sequence durationInFrames>` = দৃশ্যের ফ্রেম */
  durationFrames: number;
  /** শেষের ফেড-আউট (ফ্রেম; ০ = ফেড নেই) */
  fadeFrames: number;
};

export type IntroOutroAudioPlan = { intro: VoiceCue | null; outro: VoiceCue | null };

function cue(from: number, frames: number): VoiceCue | null {
  const n = Math.floor(finite(frames, 0));
  if (n < 1) return null;
  const fade = Math.min(Math.max(0, Math.floor(INTRO_OUTRO_AUDIO_FADE_OUT_FRAMES)), Math.floor(n / 4));
  return { from: Math.max(0, Math.floor(finite(from, 0))), durationFrames: n, fadeFrames: fade };
}

/** Intro ০ ফ্রেম হলে `intro: null`, Outro ০ ফ্রেম হলে `outro: null` */
export function planIntroOutroAudio(timing: Pick<Timing, "introFrames" | "mainFrames" | "outroFrames">): IntroOutroAudioPlan {
  const intro = finite(timing?.introFrames, 0);
  const main = finite(timing?.mainFrames, 0);
  const outro = finite(timing?.outroFrames, 0);
  return { intro: cue(0, intro), outro: cue(intro + main, outro) };
}

/** কিউয়ের নিজের ফ্রেমে (শুরু = ০) ভলিউম: শেষে রৈখিক ফেড-আউট; কখনো NaN বা ০–১-এর বাইরে নয় */
export function introOutroGain(localFrame: number, c: Pick<VoiceCue, "durationFrames" | "fadeFrames">): number {
  const base = clamp01(INTRO_OUTRO_AUDIO_VOLUME);
  if (!Number.isFinite(localFrame) || c.fadeFrames <= 0) return base;
  const left = c.durationFrames - localFrame;
  if (left >= c.fadeFrames) return base;
  return clamp01(left / c.fadeFrames) * base;
}
