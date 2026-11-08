import { getAudioDurationInSeconds } from "@remotion/media-utils";
import {
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
  type CalculateMetadataFunction,
} from "remotion";
import { useEffect, useState } from "react";
import {
  BASE_SIZES,
  hadisAudioPath,
  hadisTimestampPath,
  INTRO_AUDIO_PATH,
  INTRO_OUTRO_AUDIO_ENABLED,
  OUTRO_AUDIO_PATH,
} from "../constants";
import { parseTimestampFile, type HadisVideoProps, type TimestampFile } from "../types";
import { fitSecondsToAudio } from "./introOutroAudio";
import { computeTiming } from "./timing";

/**
 * Part 5: hadisId দিয়ে WAV দৈর্ঘ্য + timestamp JSON পড়া, আর ভিডিওর মোট দৈর্ঘ্য/সাইজ ঠিক করা।
 */

/** ডেটা-ফাইল সংক্রান্ত এররের চিহ্ন (scripts/check.mjs এটা দেখে ⚠️ দেখায়, ❌ নয়) */
export const HADIS_DATA_TAG = "[HADIS_DATA]";

export class HadisDataError extends Error {
  constructor(message: string) {
    super(`${HADIS_DATA_TAG} ${message}`);
    this.name = "HadisDataError";
  }
}

export type LoadedHadis = {
  audioSeconds: number;
  timestamp: TimestampFile;
  warnings: string[];
};

const timestampCache = new Map<string, Promise<TimestampFile>>();

/** public/hadis/hadis<ID>_timestamp.json পড়ে যাচাই করে (একই ID বারবার নেটওয়ার্কে যায় না) */
export function loadTimestamp(hadisId: string): Promise<TimestampFile> {
  const cached = timestampCache.get(hadisId);
  if (cached) return cached;

  const rel = hadisTimestampPath(hadisId);
  const promise = (async () => {
    let res: Response;
    try {
      res = await fetch(staticFile(rel));
    } catch (e) {
      throw new HadisDataError(
        `"public/${rel}" পড়া যায়নি (${e instanceof Error ? e.message : String(e)})। ফাইলটা রিপোর public/${rel} পাথে আপলোড করেছো তো?`,
      );
    }
    if (!res.ok) {
      throw new HadisDataError(
        `"public/${rel}" পাওয়া যায়নি (HTTP ${res.status})। ফাইল নাম hadis${hadisId}_timestamp.json হতে হবে এবং public/hadis/ ফোল্ডারে থাকতে হবে।`,
      );
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new HadisDataError(`"public/${rel}" বৈধ JSON নয়। JSON-এ কমা/কোটেশন ঠিক আছে কিনা দেখো।`);
    }
    try {
      return parseTimestampFile(data, `public/${rel}`);
    } catch (e) {
      throw new HadisDataError(e instanceof Error ? e.message : String(e));
    }
  })();

  // ব্যর্থ হলে ক্যাশে রাখা যাবে না (ফাইল আপলোড করে আবার চেষ্টা করলে যেন কাজ করে)
  promise.catch(() => timestampCache.delete(hadisId));
  timestampCache.set(hadisId, promise);
  return promise;
}

/** public/hadis/hadis<ID>.wav-এর দৈর্ঘ্য (সেকেন্ড) */
export async function loadAudioSeconds(hadisId: string): Promise<number> {
  const rel = hadisAudioPath(hadisId);
  try {
    const secs = await getAudioDurationInSeconds(staticFile(rel));
    if (!Number.isFinite(secs) || secs <= 0) {
      throw new Error("দৈর্ঘ্য ০ বা অবৈধ");
    }
    return secs;
  } catch (e) {
    throw new HadisDataError(
      `"public/${rel}" পাওয়া যায়নি বা পড়া যায়নি (${e instanceof Error ? e.message : String(e)})। ফাইল নাম hadis${hadisId}.wav হতে হবে এবং public/hadis/ ফোল্ডারে থাকতে হবে।`,
    );
  }
}

/**
 * Part 14C-audio: Intro/Outro ভয়েসের দৈর্ঘ্য (সেকেন্ড)। ফাইল না থাকলে বা পড়া না গেলে `null` — কখনো throw করে না
 * (Studio-র ডেভ সার্ভার ফাইল না পেলে HTML ফেরত দেয়; তখনও পড়া ব্যর্থ হয় → `null`)।
 */
export async function loadVoiceSeconds(rel: string): Promise<number | null> {
  try {
    const secs = await getAudioDurationInSeconds(staticFile(rel));
    return Number.isFinite(secs) && secs > 0 ? secs : null;
  } catch {
    return null;
  }
}

/** WAV + JSON একসাথে। JSON-এর শেষ segment WAV ছাড়ালে ওয়ার্নিং (ক্র্যাশ নয়, timing.ts ছেঁটে দেয়) */
export async function loadHadis(hadisId: string): Promise<LoadedHadis> {
  const [audioSeconds, timestamp] = await Promise.all([
    loadAudioSeconds(hadisId),
    loadTimestamp(hadisId),
  ]);

  const warnings: string[] = [];
  const lastEnd = Math.max(...timestamp.segments.map((s) => s.end));
  if (lastEnd > audioSeconds + 0.5) {
    warnings.push(
      `JSON-এর শেষ segment ${lastEnd.toFixed(1)}s পর্যন্ত, কিন্তু WAV মাত্র ${audioSeconds.toFixed(1)}s — অতিরিক্ত অংশ ছেঁটে ফেলা হবে।`,
    );
  }
  return { audioSeconds, timestamp, warnings };
}

/**
 * Composition-এর calculateMetadata:
 *   durationInFrames = (intro + .wav + outro) × FPS  (intro/outro = max(দেওয়া সেকেন্ড, ভয়েসের দৈর্ঘ্য) — Part 14C-audio)
 *   width/height     = orientation অনুযায়ী (বেস HD সাইজ; 4K-তে render scale=2)
 * Studio-তে props প্যানেলে hadisId/orientation/intro/outro বদলালে নিজে নিজে আবার চলে।
 */
export const calculateHadisMetadata: CalculateMetadataFunction<HadisVideoProps> = async ({
  props,
}) => {
  const { audioSeconds, warnings } = await loadHadis(props.hadisId);
  for (const w of warnings) console.warn(`⚠️ ${w}`);

  // Part 14C-audio: Intro/Outro ভয়েস থাকলে দৃশ্য অন্তত অডিওর সমান লম্বা (অডিও কাটে না); ব্যবহারকারীর সেকেন্ড বেশি হলে সেটাই থাকে;
  // ০ সেকেন্ড (দৃশ্য বন্ধ) হলে ০-ই। ফল `props`-এ ফেরত যায়, তাই কম্পোনেন্টের `timingFromConfig` ঠিক একই সংখ্যা পায়।
  const [introAudio, outroAudio] = INTRO_OUTRO_AUDIO_ENABLED
    ? await Promise.all([loadVoiceSeconds(INTRO_AUDIO_PATH), loadVoiceSeconds(OUTRO_AUDIO_PATH)])
    : [null, null];
  const introSeconds = fitSecondsToAudio(props.introSeconds, introAudio);
  const outroSeconds = fitSecondsToAudio(props.outroSeconds, outroAudio);

  const timing = computeTiming({ introSeconds, outroSeconds, audioSeconds });
  const size = BASE_SIZES[props.orientation];

  return {
    durationInFrames: timing.totalFrames,
    width: size.width,
    height: size.height,
    props: { ...props, introSeconds, outroSeconds },
  };
};

/**
 * কম্পোনেন্টের জন্য timestamp JSON (Part 9–11 ব্যবহার করবে)।
 * লোড শেষ না হওয়া পর্যন্ত ফ্রেম রেন্ডার আটকে থাকে (delayRender); ব্যর্থ হলে রেন্ডার থামে।
 * লোড হওয়ার আগে null ফেরত দেয়।
 */
export function useHadisTimestamp(hadisId: string): TimestampFile | null {
  const [state, setState] = useState<{ id: string; data: TimestampFile } | null>(null);
  const [handle] = useState(() => delayRender(`timestamp json লোড হচ্ছে (${hadisId})`));

  useEffect(() => {
    let alive = true;
    loadTimestamp(hadisId)
      .then((data) => {
        if (!alive) return;
        setState({ id: hadisId, data });
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
    return () => {
      alive = false;
    };
  }, [hadisId, handle]);

  return state && state.id === hadisId ? state.data : null;
}
