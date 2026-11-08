import {
  FPS,
  MAX_INTRO_OUTRO_SECONDS,
  TEASER_AUDIO_FADE_FRAMES,
  TEASER_AUDIO_VOLUME,
  TEASER_ENABLED,
  TEASER_MAX_SECONDS,
  TEASER_MIN_SECONDS,
  TEASER_TAIL_SECONDS,
} from "../constants";
import type { TimestampFile } from "../types";
import { splitWords } from "./timing";

/**
 * অডিও টিজার (cold open) — বিশুদ্ধ (pure) হিসাব: React/Remotion ছাড়া, কখনো throw করে না।
 *
 * ধারণা: হাদিসের সবচেয়ে শক্তিশালী বাক্যাংশ (timestamp JSON-এর `teaser: { start, end }`) Hook-এর পরে আগে একবার বাজে,
 * তারপর Intro → হাদিস শুরু থেকে পুরোটা। সিলেক্ট করা = JSON-এ `teaser` থাকা; না থাকলে টিজার নেই (ভিডিও আগের মতো)।
 *
 * নিয়ম (স্থির):
 *  (১) `start`/`end` সেকেন্ড, হাদিসের `.wav`-এর শুরু থেকে মাপা (segment-এর সময়ের মতোই; Intro-র অফসেট কোড নিজে যোগ করে)।
 *  (২) `start` < 0 → ০; `end` > .wav-এর দৈর্ঘ্য → দৈর্ঘ্যে ছাঁটা; দৈর্ঘ্য > `TEASER_MAX_SECONDS` → `start + MAX`-এ ছাঁটা;
 *      ছাঁটার পর দৈর্ঘ্য < `TEASER_MIN_SECONDS` (বা `start` ≥ .wav-এর দৈর্ঘ্য) → টিজার নেই (null; সতর্কতা `loadHadis`-এ)।
 *  (৩) দৃশ্যের দৈর্ঘ্য = ceil((অংশের দৈর্ঘ্য + `TEASER_TAIL_SECONDS`) × fps) ÷ fps (শেষ শব্দ কেটে যায় না; ≤ ১৫s)।
 *  (৪) দেখানো শব্দ: JSON-এর `words` থেকে — যে শব্দের মাঝবিন্দু [start, end)-এর ভেতরে; segment-এ `words` না থাকলে তার লেখা
 *      segment-সময়ে সমান ভাগ করে একইভাবে বাছা হয়। কোনো শব্দ না মিললে `teaser.text` সমান ভাগে; তাও না থাকলে শব্দ-তালিকা খালি।
 *  (৫) শব্দের সময় টিজার-অংশের শুরু থেকে মাপা (সেকেন্ড, ০…দৈর্ঘ্যের মধ্যে)।
 *  (৬) অডিও: শুরুতে ও শেষে `TEASER_AUDIO_FADE_FRAMES` ফ্রেমের ফেড (বাক্যের মাঝখান কাটলে "ক্লিক" শোনা যায় না); অংশ শেষে নীরব।
 */

export type TeaserWord = { word: string; start: number; end: number };

export type TeaserRange = {
  /** .wav-এর শুরু থেকে (সেকেন্ড) */
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
};

export type TeaserPlan = TeaserRange & {
  text: string;
  /** টিজার-অংশের শুরু থেকে মাপা */
  words: TeaserWord[];
};

const finite = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** `start`/`end` ছাঁটাই (নিয়ম ২)। অবৈধ হলে null */
export function clampTeaserRange(
  start: unknown,
  end: unknown,
  audioSeconds: unknown,
): TeaserRange | null {
  if (!TEASER_ENABLED) return null;
  const a = finite(audioSeconds, 0);
  if (!(a > 0)) return null;
  const s = Math.max(0, finite(start, Number.NaN));
  let e = Math.min(a, finite(end, Number.NaN));
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
  e = Math.min(e, s + TEASER_MAX_SECONDS);
  const d = e - s;
  if (!(d >= TEASER_MIN_SECONDS) || s >= a) return null;
  return { startSeconds: s, endSeconds: e, durationSeconds: d };
}

/** দৃশ্যের সেকেন্ড = অংশ + ছোট বাড়তি, পুরো ফ্রেমে (নিয়ম ৩); অংশ না থাকলে ০ */
export function fitTeaserSeconds(durationSeconds: number | null | undefined, fps: number = FPS): number {
  const d = finite(durationSeconds, 0);
  if (!TEASER_ENABLED || !(d > 0)) return 0;
  const f = finite(fps, FPS) > 0 ? finite(fps, FPS) : FPS;
  return Math.min(MAX_INTRO_OUTRO_SECONDS, Math.ceil((d + TEASER_TAIL_SECONDS) * f) / f);
}

/** [start, end)-এর ভেতরের শব্দ, সময় টিজারের শুরু থেকে মাপা (নিয়ম ৪–৫) */
export function teaserWords(
  file: Pick<TimestampFile, "segments"> & { teaser?: { text?: string } },
  range: Pick<TeaserRange, "startSeconds" | "endSeconds">,
): TeaserWord[] {
  const { startSeconds: s, endSeconds: e } = range;
  const d = e - s;
  const out: TeaserWord[] = [];
  const take = (word: string, ws: number, we: number) => {
    const mid = (ws + we) / 2;
    if (mid < s || mid >= e) return;
    out.push({
      word,
      start: Math.min(d, Math.max(0, ws - s)),
      end: Math.min(d, Math.max(0, we - s)),
    });
  };
  for (const seg of file.segments ?? []) {
    if (seg.end <= s || seg.start >= e) continue;
    if (seg.words && seg.words.length > 0) {
      for (const w of seg.words) take(w.word, w.start, w.end);
    } else {
      const ws = splitWords(seg.text);
      const span = seg.end - seg.start;
      ws.forEach((w, i) => take(w, seg.start + (span * i) / ws.length, seg.start + (span * (i + 1)) / ws.length));
    }
  }
  if (out.length === 0 && file.teaser?.text) {
    const ws = splitWords(file.teaser.text);
    ws.forEach((w, i) => out.push({ word: w, start: (d * i) / ws.length, end: (d * (i + 1)) / ws.length }));
  }
  return out;
}

/** পুরো টিজার-পরিকল্পনা। JSON-এ `teaser` না থাকলে বা অবৈধ হলে null */
export function buildTeaser(file: TimestampFile, audioSeconds: number): TeaserPlan | null {
  if (!file?.teaser) return null;
  const range = clampTeaserRange(file.teaser.start, file.teaser.end, audioSeconds);
  if (!range) return null;
  const words = teaserWords(file, range);
  const text = words.length > 0 ? words.map((w) => w.word).join(" ") : (file.teaser.text ?? "");
  return { ...range, text, words };
}

/**
 * এখন কোন শব্দ বলা হচ্ছে: `localFrame` টিজার-দৃশ্যের নিজের ফ্রেম (০ থেকে)।
 * ফেরত: যে শব্দের `start ≤ সময়` তার সর্বশেষ সূচক (কিছু শুরু না হলে −১); শব্দ না থাকলে −১।
 */
export function teaserActiveIndex(words: TeaserWord[], localFrame: number, fps: number = FPS): number {
  if (!words.length) return -1;
  const t = Math.max(0, finite(localFrame, 0)) / (finite(fps, FPS) > 0 ? finite(fps, FPS) : FPS);
  let idx = -1;
  for (let i = 0; i < words.length; i++) if (words[i].start <= t) idx = i;
  return idx;
}

/**
 * টিজার-অডিওর ভলিউম (নিয়ম ৬): `audioFrames` = অংশের দৈর্ঘ্য (ফ্রেম); শুরু/শেষে রৈখিক ফেড; অংশের পরে ০।
 * `fadeFrames` অংশের ¼-এর বেশি হয় না। কখনো NaN বা ০–১-এর বাইরে নয়।
 */
export function teaserGain(localFrame: number, audioFrames: number, fadeFrames: number = TEASER_AUDIO_FADE_FRAMES): number {
  const base = clamp01(TEASER_AUDIO_VOLUME);
  const n = Math.floor(finite(audioFrames, 0));
  const f = finite(localFrame, Number.NaN);
  if (n < 1 || !Number.isFinite(f) || f < 0 || f >= n) return 0;
  const fade = Math.min(Math.max(0, Math.floor(finite(fadeFrames, 0))), Math.floor(n / 4));
  if (fade < 1) return base;
  const inG = clamp01((f + 1) / (fade + 1));
  const outG = clamp01((n - f) / (fade + 1));
  return base * Math.min(inG, outG);
}
