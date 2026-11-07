import {
  DEFAULT_SFX_VOLUME,
  FPS,
  OUTRO_SFX_ENABLED,
  OUTRO_SFX_NAME,
  SFX_FADE_OUT_FRAMES,
  SFX_MAX_SECONDS,
  VOICE_FADE_OUT_FRAMES,
  VOICE_VOLUME,
} from "../constants";
import type { FrameSegment, Timing } from "./timing";

/**
 * Part 11: অডিওর বিশুদ্ধ (pure) হিসাব — React/Remotion ছাড়া, তাই সাধারণ Node-এও চলে।
 *
 * - ভয়েস: `.wav` Main-এর শুরুতে (Intro-র পরে) বাজে, Main-এর শেষে ছোট ফেড-আউট।
 * - SFX: প্রতিটা segment-এর `sfx` সেই segment-এর শুরুর ফ্রেমে; Main ছাড়িয়ে Outro-তে যায় না।
 * - Main → Outro বদলে ঐচ্ছিক একটা SFX (`OUTRO_SFX_NAME`)।
 * সব ফ্রেম **ভিডিওর শুরু থেকে** মাপা (Intro-র অফসেটসহ) — `SfxPlayer`/`HadisAudio` ভিডিওর মূল স্তরে বসে, কোনো অফসেট-`<Sequence>`-এর ভেতরে নয়।
 */

/** ফাইলের নামের নিরাপদ ধাঁচ (types.ts-এর স্কিমার মতোই) */
const SAFE_NAME = /^[A-Za-z0-9_-]+$/;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Main-এর শেষ কত ফ্রেমে ভয়েস ফেড হবে: `VOICE_FADE_OUT_FRAMES`, তবে Main-এর ¼-এর বেশি নয় */
export function voiceFadeFrames(mainFrames: number, fade: number = VOICE_FADE_OUT_FRAMES): number {
  if (!Number.isFinite(mainFrames) || !Number.isFinite(fade) || fade <= 0 || mainFrames < 4) return 0;
  return Math.min(Math.floor(fade), Math.floor(mainFrames / 4));
}

/**
 * ভয়েসের ভলিউম — `localFrame` = ভয়েসের নিজের ফ্রেম (Main-এর শুরু = ০; Remotion `<Audio volume={(f)=>…}>`-এর `f`)।
 * শেষ `voiceFadeFrames` ফ্রেমে রৈখিক ১ → ০, বাকিটা `VOICE_VOLUME`। কখনো NaN বা ০–১-এর বাইরে নয়।
 */
export function voiceGain(localFrame: number, mainFrames: number, fadeFrames: number = voiceFadeFrames(mainFrames)): number {
  const base = clamp01(VOICE_VOLUME);
  if (!Number.isFinite(localFrame) || !Number.isFinite(mainFrames)) return base;
  if (fadeFrames <= 0) return base;
  const left = mainFrames - localFrame; // বাকি ফ্রেম (শেষ ফ্রেমে ১)
  if (left >= fadeFrames) return base;
  return clamp01(left / fadeFrames) * base;
}

export type SfxPlan = {
  /** একক কী (React key) */
  key: string;
  kind: "segment" | "outro";
  /** segment হলে তার ক্রম (০ থেকে), outro হলে -1 */
  segmentIndex: number;
  name: string;
  /** ভিডিওর শুরু থেকে শুরুর ফ্রেম */
  from: number;
  /** `<Sequence durationInFrames>` — কমপক্ষে ১ */
  durationFrames: number;
  /** ০ < volume ≤ ১ */
  volume: number;
};

export type AudioPlan = {
  cues: SfxPlan[];
  /** বাদ পড়া/ছাঁটা কিউয়ের কারণ (বাংলায়) — `SfxPlayer` একবার `console.warn` করে */
  warnings: string[];
};

export type PlanOptions = {
  /** Main → Outro বদলের SFX চালু? (ডিফল্ট `OUTRO_SFX_ENABLED`) */
  outroSfx?: boolean;
  /** SFX-এর সর্বোচ্চ দৈর্ঘ্য (সেকেন্ড; ডিফল্ট `SFX_MAX_SECONDS`) */
  maxSeconds?: number;
};

/**
 * সব SFX কিউ: segment-এর `sfx` + (ঐচ্ছিক) Outro-র শুরুর SFX।
 * নিয়ম (স্থির):
 *  1. কিউ segment-এর `startFrame`-এ শুরু; `volume` না থাকলে `DEFAULT_SFX_VOLUME`; ০–১-এর মধ্যে ছাঁটা; `volume = 0` হলে কিউ বাদ (নীরব, সতর্কতা নেই)।
 *  2. দৈর্ঘ্য = min(সর্বোচ্চ সেকেন্ড × FPS, Main-এর শেষ − শুরু) — Outro-তে ঢোকে না। ≥ ১ ফ্রেম।
 *  3. অবৈধ নাম (`../x`, ফাঁকা, স্পেস…) বাদ + সতর্কতা। ফাইল ফোল্ডারে আছে কিনা এখানে দেখা হয় না (সেটা `useSfxSrc`-এর কাজ)।
 *  4. Outro SFX: `outroFrames ≥ 1` ও চালু থাকলে Outro-র প্রথম ফ্রেমে; দৈর্ঘ্য ≤ Outro-র দৈর্ঘ্য।
 *  5. কখনো throw করে না।
 */
export function planSfx(segments: FrameSegment[], timing: Timing, opts: PlanOptions = {}): AudioPlan {
  const cues: SfxPlan[] = [];
  const warnings: string[] = [];
  const fps = Number.isFinite(timing.fps) && timing.fps > 0 ? timing.fps : FPS;
  const maxSec = opts.maxSeconds ?? SFX_MAX_SECONDS;
  const maxFrames = Math.max(1, Math.round((Number.isFinite(maxSec) ? maxSec : SFX_MAX_SECONDS) * fps));
  const mainEnd = timing.introFrames + timing.mainFrames;

  for (const seg of segments) {
    const cue = seg.sfx;
    if (!cue) continue;
    const name = typeof cue.name === "string" ? cue.name : "";
    if (!SAFE_NAME.test(name)) {
      warnings.push(`segment ${seg.index + 1}: SFX নাম "${String(cue.name)}" অবৈধ (শুধু ইংরেজি অক্ষর, সংখ্যা, - ও _) — বাদ দেওয়া হলো।`);
      continue;
    }
    const raw = cue.volume;
    const volume = clamp01(typeof raw === "number" && Number.isFinite(raw) ? raw : DEFAULT_SFX_VOLUME);
    if (volume <= 0) continue;
    const from = Math.max(timing.introFrames, seg.startFrame);
    const room = mainEnd - from;
    if (room < 1) {
      warnings.push(`segment ${seg.index + 1}: SFX "${name}" Main-এর বাইরে পড়ে — বাদ দেওয়া হলো।`);
      continue;
    }
    cues.push({
      key: `sfx-${seg.index}-${name}`,
      kind: "segment",
      segmentIndex: seg.index,
      name,
      from,
      durationFrames: Math.max(1, Math.min(maxFrames, room)),
      volume,
    });
  }

  const outroOn = opts.outroSfx ?? OUTRO_SFX_ENABLED;
  if (outroOn && timing.outroFrames >= 1 && SAFE_NAME.test(OUTRO_SFX_NAME)) {
    cues.push({
      key: `sfx-outro-${OUTRO_SFX_NAME}`,
      kind: "outro",
      segmentIndex: -1,
      name: OUTRO_SFX_NAME,
      from: mainEnd,
      durationFrames: Math.max(1, Math.min(maxFrames, timing.outroFrames)),
      volume: clamp01(DEFAULT_SFX_VOLUME),
    });
  }

  return { cues, warnings };
}

/**
 * SFX-এর ভলিউম — `localFrame` = কিউয়ের নিজের ফ্রেম (শুরু = ০)।
 * শেষ `SFX_FADE_OUT_FRAMES` (কিউ ছোট হলে ¼) ফ্রেমে রৈখিক ফেড-আউট; কখনো NaN বা ০–১-এর বাইরে নয়।
 */
export function sfxGain(localFrame: number, cue: Pick<SfxPlan, "durationFrames" | "volume">): number {
  const vol = clamp01(cue.volume);
  if (!Number.isFinite(localFrame)) return vol;
  const fade = Math.min(Math.max(0, Math.floor(SFX_FADE_OUT_FRAMES)), Math.floor(cue.durationFrames / 4));
  if (fade <= 0) return vol;
  const left = cue.durationFrames - localFrame;
  if (left >= fade) return vol;
  return clamp01(left / fade) * vol;
}
