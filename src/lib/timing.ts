import { FPS } from "../constants";
import type { HadisVideoProps, SfxCue, TimestampFile } from "../types";

/**
 * Part 5: সময় (সেকেন্ড) ↔ ফ্রেম হিসাব।
 *
 * ভিডিওর গঠন:  [ Hook ][ Intro ][ Main = .wav-এর দৈর্ঘ্য ][ Outro ]   (Hook ঐচ্ছিক — hook.wav থাকলে; `introFrames` = Hook + Intro)
 * Timestamp JSON-এর সময় .wav-এর শুরু থেকে মাপা, তাই ভিডিও-ফ্রেম পেতে Intro-র অফসেট যোগ হয়।
 */

export type Timing = {
  fps: number;
  /**
   * Main শুরুর আগের সব ফ্রেম = Hook + Intro (Main, Caption, SVG, অডিও, দিন-রাত — সবাই এটাকেই "Main কোথায় শুরু" ধরে;
   * তাই Hook যোগ হলেও ওই কোড বদলাতে হয়নি)। শুধু Intro-র নিজের দৈর্ঘ্য = `introFrames − hookFrames` (`introOnlyFrames`)।
   */
  introFrames: number;
  /** Hook-এর ফ্রেম (ভিডিওর শুরুতে; `introFrames`-এর ভেতরেই ধরা)। নেই/০ = Hook নেই */
  hookFrames?: number;
  mainFrames: number;
  outroFrames: number;
  totalFrames: number;
};

export type FrameWord = {
  word: string;
  /** ভিডিওর শুরু থেকে মাপা ফ্রেম (Intro-র অফসেটসহ) */
  startFrame: number;
  endFrame: number;
};

export type FrameSegment = {
  /** ০ থেকে শুরু ক্রমিক নম্বর */
  index: number;
  /** JSON-এর id (না থাকলে index + 1) */
  id: number;
  startFrame: number;
  endFrame: number;
  text: string;
  /** JSON-এ words না থাকলে segment-এর সময় সমান ভাগ করে বানানো */
  words: FrameWord[];
  /** "svg1" ইত্যাদি (না থাকলে undefined; Part 9-এর svgPicker সিরিয়ালি ঘোরাবে) */
  svg?: string;
  sfx?: SfxCue;
};

export const secondsToFrames = (seconds: number, fps: number = FPS): number =>
  Math.round(seconds * fps);

/** Hook-এর ফ্রেম (নেই/অবৈধ = ০; `introFrames`-এর বেশি হয় না) */
export const hookFramesOf = (t: Pick<Timing, "introFrames" | "hookFrames">): number => {
  const h = t.hookFrames;
  if (typeof h !== "number" || !Number.isFinite(h) || h <= 0) return 0;
  return Math.min(Math.floor(h), Math.max(0, Math.floor(t.introFrames)));
};

/** শুধু Intro দৃশ্যের ফ্রেম (Hook বাদ দিয়ে) */
export const introOnlyFrames = (t: Pick<Timing, "introFrames" | "hookFrames">): number =>
  Math.max(0, Math.floor(t.introFrames) - hookFramesOf(t));

/** Intro/Main/Outro ফ্রেম। Main কমপক্ষে ১ ফ্রেম (ফাঁকা অডিওতেও ভিডিও ভাঙে না) */
export function computeTiming(args: {
  introSeconds: number;
  outroSeconds: number;
  audioSeconds: number;
  /** Hook-এর সেকেন্ড (ঐচ্ছিক; নেই/০ = Hook নেই) */
  hookSeconds?: number;
  fps?: number;
}): Timing {
  const fps = args.fps ?? FPS;
  const hookFrames = Math.max(0, secondsToFrames(args.hookSeconds ?? 0, fps));
  const introFrames = hookFrames + secondsToFrames(args.introSeconds, fps);
  const outroFrames = secondsToFrames(args.outroSeconds, fps);
  const mainFrames = Math.max(1, Math.ceil(args.audioSeconds * fps));
  return {
    fps,
    introFrames,
    ...(hookFrames > 0 ? { hookFrames } : {}),
    mainFrames,
    outroFrames,
    totalFrames: introFrames + mainFrames + outroFrames,
  };
}

/**
 * কম্পোনেন্টের ভেতরে (useVideoConfig থেকে) টাইমিং ফিরে পাওয়ার উপায়:
 * Intro/Outro আসে প্রপস থেকে, Main = মোট ফ্রেম − Intro − Outro। তাই .wav আবার পড়তে হয় না।
 */
export function timingFromConfig(
  durationInFrames: number,
  props: Pick<HadisVideoProps, "introSeconds" | "outroSeconds"> & { hookSeconds?: number },
  fps: number = FPS,
): Timing {
  const hookFrames = Math.max(0, secondsToFrames(props.hookSeconds ?? 0, fps));
  const introFrames = hookFrames + secondsToFrames(props.introSeconds, fps);
  const outroFrames = secondsToFrames(props.outroSeconds, fps);
  const mainFrames = Math.max(1, durationInFrames - introFrames - outroFrames);
  return {
    fps,
    introFrames,
    ...(hookFrames > 0 ? { hookFrames } : {}),
    mainFrames,
    outroFrames,
    totalFrames: durationInFrames,
  };
}

/** টেক্সট স্পেস ধরে শব্দে ভাগ (বাংলা অক্ষর কখনো ভাঙে না; ZWJ/ZWNJ অক্ষত) */
export const splitWords = (text: string): string[] =>
  text.split(/\s+/).filter((w) => w.length > 0);

/** start..end ফ্রেমকে n ভাগে সমান করে (শেষ ভাগ ঠিক end-এ শেষ হয়) */
function evenWords(words: string[], startFrame: number, endFrame: number): FrameWord[] {
  const n = words.length;
  const span = endFrame - startFrame;
  return words.map((word, i) => ({
    word,
    startFrame: startFrame + Math.round((span * i) / n),
    endFrame: startFrame + Math.round((span * (i + 1)) / n),
  }));
}

/**
 * JSON-এর segment → ফ্রেম-ভিত্তিক segment (Intro অফসেটসহ)।
 * - Main-এর বাইরে গেলে ছেঁটে Main-এর ভেতরে আনা হয়
 * - প্রতিটা segment ও শব্দ কমপক্ষে ১ ফ্রেম লম্বা
 */
export function buildFrameSegments(
  file: Pick<TimestampFile, "segments">,
  timing: Timing,
): FrameSegment[] {
  const { fps, introFrames, mainFrames } = timing;
  const mainEnd = introFrames + mainFrames;

  const clampFrame = (secs: number) =>
    Math.min(mainEnd, Math.max(introFrames, introFrames + secondsToFrames(secs, fps)));

  return file.segments.map((seg, index) => {
    const startFrame = Math.min(clampFrame(seg.start), mainEnd - 1);
    const endFrame = Math.max(startFrame + 1, clampFrame(seg.end));

    let words: FrameWord[];
    if (seg.words && seg.words.length > 0) {
      words = seg.words.map((w) => {
        const ws = Math.min(Math.max(startFrame, clampFrame(w.start)), endFrame - 1);
        const we = Math.min(endFrame, Math.max(ws + 1, clampFrame(w.end)));
        return { word: w.word, startFrame: ws, endFrame: we };
      });
    } else {
      words = evenWords(splitWords(seg.text), startFrame, endFrame);
    }

    return {
      index,
      id: seg.id ?? index + 1,
      startFrame,
      endFrame,
      text: seg.text,
      words,
      svg: seg.svg,
      sfx: seg.sfx,
    };
  });
}

/** বর্তমান ফ্রেমে কোন segment চলছে (না থাকলে null — দুই segment-এর ফাঁকে বা Intro/Outro-তে) */
export function findActiveSegment(
  segments: FrameSegment[],
  frame: number,
): FrameSegment | null {
  for (const s of segments) {
    if (frame >= s.startFrame && frame < s.endFrame) return s;
  }
  return null;
}
