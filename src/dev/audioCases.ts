import {
  DEFAULT_SFX_VOLUME,
  OUTRO_SFX_ENABLED,
  OUTRO_SFX_NAME,
  SFX_FADE_OUT_FRAMES,
  SFX_MAX_SECONDS,
  VOICE_FADE_OUT_FRAMES,
  VOICE_VOLUME,
} from "../constants";
import { planSfx, sfxGain, voiceFadeFrames, voiceGain } from "../lib/audioPlan";
import { buildFrameSegments, computeTiming } from "../lib/timing";
import type { FrameSegment, Timing } from "../lib/timing";
import type { SfxCue } from "../types";

/**
 * Part 11 (dev): audioPlan.ts-এর পরীক্ষার কেস — React ছাড়া, তাই সাধারণ Node-এও চলে।
 * `AudioPreview` এগুলো সারি হিসেবে আঁকে। কেস `null` ফেরালে ✅, বার্তা ফেরালে ❌। `runAudioCases()` কখনো throw করে না।
 */

export type AudioCaseOutcome = { id: string; title: string; ok: boolean; detail: string; rule: string };
type Def = { id: string; title: string; rule: string; run: () => string | null };

/** Intro 90 · Main 420 (14 s) · Outro 120 · মোট 630; Main শেষ = ফ্রেম 510 */
export const CASE_TIMING: Timing = computeTiming({ introSeconds: 3, outroSeconds: 4, audioSeconds: 14 });

const seg = (index: number, startFrame: number, endFrame: number, sfx?: SfxCue | { name: unknown; volume?: unknown }): FrameSegment => ({
  index,
  id: index + 1,
  startFrame,
  endFrame,
  text: `s${index}`,
  words: [],
  sfx: sfx as SfxCue | undefined,
});

const expectEq = (what: string, got: unknown, want: unknown): string | null =>
  got === want ? null : `${what}: পাওয়া ${String(got)}, প্রত্যাশা ${String(want)}`;
const near = (what: string, got: number, want: number, tol = 1e-9): string | null =>
  Math.abs(got - want) <= tol ? null : `${what}: পাওয়া ${got.toFixed(4)}, প্রত্যাশা ${want} ± ${tol}`;
const firstFail = (...checks: (string | null)[]): string | null => checks.find((c) => c !== null) ?? null;

const noOutro: Timing = { ...CASE_TIMING, outroFrames: 0, totalFrames: CASE_TIMING.introFrames + CASE_TIMING.mainFrames };

const defs: Def[] = [
  // ---------- ভয়েসের ফেড ----------
  {
    id: "fade-default",
    title: "ফেডের দৈর্ঘ্য: সাধারণ Main-এ ১০ ফ্রেম",
    rule: "voiceFadeFrames(420) = VOICE_FADE_OUT_FRAMES = 10",
    run: () => firstFail(expectEq("fade(420)", voiceFadeFrames(420), 10), expectEq("ধ্রুবক", VOICE_FADE_OUT_FRAMES, 10)),
  },
  {
    id: "fade-short-main",
    title: "খুব ছোট Main-এ ফেড ছোট হয় (≤ ¼); ৪ ফ্রেমের নিচে ফেড নেই",
    rule: "fade(20) = 5 · fade(8) = 2 · fade(4) = 1 · fade(3) = 0 · fade(1) = 0",
    run: () =>
      firstFail(
        expectEq("fade(20)", voiceFadeFrames(20), 5),
        expectEq("fade(8)", voiceFadeFrames(8), 2),
        expectEq("fade(4)", voiceFadeFrames(4), 1),
        expectEq("fade(3)", voiceFadeFrames(3), 0),
        expectEq("fade(1)", voiceFadeFrames(1), 0),
      ),
  },
  {
    id: "fade-off-bad",
    title: "ফেড বন্ধ (০) বা অবৈধ ইনপুটে ০",
    rule: "fade(420, 0) = 0 · fade(420, −5) = 0 · fade(NaN) = 0 · fade(420, NaN) = 0",
    run: () =>
      firstFail(
        expectEq("fade(420,0)", voiceFadeFrames(420, 0), 0),
        expectEq("fade(420,-5)", voiceFadeFrames(420, -5), 0),
        expectEq("fade(NaN)", voiceFadeFrames(Number.NaN), 0),
        expectEq("fade(420,NaN)", voiceFadeFrames(420, Number.NaN), 0),
      ),
  },
  {
    id: "voice-steady",
    title: "ভয়েস: ফেডের আগে পুরো ভলিউম (VOICE_VOLUME = 1)",
    rule: "voiceGain(0…409, 420) = 1",
    run: () => {
      for (const f of [0, 1, 100, 300, 409]) {
        const e = near(`gain(${f})`, voiceGain(f, 420), VOICE_VOLUME);
        if (e) return e;
      }
      return null;
    },
  },
  {
    id: "voice-ramp",
    title: "ভয়েস: শেষ ১০ ফ্রেমে রৈখিক ১ → ০",
    rule: "gain(410) = 1 · gain(415) = 0.5 · gain(419) = 0.1 · gain(420) = 0",
    run: () =>
      firstFail(
        near("gain(410)", voiceGain(410, 420), 1),
        near("gain(415)", voiceGain(415, 420), 0.5),
        near("gain(419)", voiceGain(419, 420), 0.1, 1e-9),
        near("gain(420)", voiceGain(420, 420), 0),
      ),
  },
  {
    id: "voice-monotone",
    title: "ভয়েস: কখনো বাড়ে না, সবসময় ০–১ (সব ফ্রেমে)",
    rule: "f = 0…430: gain ∈ [0,1], gain(f+1) ≤ gain(f)",
    run: () => {
      let prev = 1;
      for (let f = 0; f <= 430; f += 1) {
        const g = voiceGain(f, 420);
        if (!(g >= 0 && g <= 1)) return `gain(${f}) = ${g} ০–১-এর বাইরে`;
        if (g > prev + 1e-12) return `gain(${f}) = ${g} > আগের ${prev}`;
        prev = g;
      }
      return null;
    },
  },
  {
    id: "voice-safe",
    title: "ভয়েস: অদ্ভুত ইনপুটে NaN নয়",
    rule: "gain(−5) = 1 · gain(500) = 0 · gain(NaN) = 1 · gain(10, NaN) = 1 · gain(5, 20, 0) = 1",
    run: () =>
      firstFail(
        near("gain(-5)", voiceGain(-5, 420), 1),
        near("gain(500)", voiceGain(500, 420), 0),
        near("gain(NaN)", voiceGain(Number.NaN, 420), 1),
        near("gain(10,NaN)", voiceGain(10, Number.NaN), 1),
        near("gain(5,20,fade 0)", voiceGain(19, 20, 0), 1),
      ),
  },
  // ---------- SFX কিউ ----------
  {
    id: "sfx-start",
    title: "SFX শুরু হয় ঠিক segment-এর শুরুর ফ্রেমে",
    rule: "cue.from = segment.startFrame; segmentIndex ঠিক; kind = segment",
    run: () => {
      const { cues } = planSfx([seg(0, 90, 180, { name: "pop" }), seg(1, 200, 300), seg(2, 300, 400, { name: "chime", volume: 0.2 })], CASE_TIMING, { outroSfx: false });
      return firstFail(
        expectEq("কিউ-সংখ্যা", cues.length, 2),
        expectEq("cue0.from", cues[0]?.from, 90),
        expectEq("cue0.segmentIndex", cues[0]?.segmentIndex, 0),
        expectEq("cue1.from", cues[1]?.from, 300),
        expectEq("cue1.segmentIndex", cues[1]?.segmentIndex, 2),
        expectEq("kind", cues[0]?.kind, "segment"),
      );
    },
  },
  {
    id: "sfx-default-volume",
    title: "volume না থাকলে ডিফল্ট ০.৪",
    rule: "sfx { name } → volume = DEFAULT_SFX_VOLUME = 0.4",
    run: () => {
      const { cues } = planSfx([seg(0, 90, 180, { name: "pop" })], CASE_TIMING, { outroSfx: false });
      return firstFail(near("volume", cues[0]?.volume ?? -1, DEFAULT_SFX_VOLUME), near("ধ্রুবক", DEFAULT_SFX_VOLUME, 0.4));
    },
  },
  {
    id: "sfx-volume-clamp",
    title: "volume ০–১-এ ছাঁটা; NaN → ডিফল্ট",
    rule: "1.7 → 1 · 0.6 → 0.6 · NaN → 0.4 · \"x\" (স্ট্রিং) → 0.4",
    run: () => {
      const { cues } = planSfx(
        [seg(0, 90, 120, { name: "a", volume: 1.7 }), seg(1, 120, 150, { name: "b", volume: 0.6 }), seg(2, 150, 180, { name: "c", volume: Number.NaN }), seg(3, 180, 210, { name: "d", volume: "x" })],
        CASE_TIMING,
        { outroSfx: false },
      );
      return firstFail(
        expectEq("কিউ-সংখ্যা", cues.length, 4),
        near("1.7", cues[0]?.volume ?? -1, 1),
        near("0.6", cues[1]?.volume ?? -1, 0.6),
        near("NaN", cues[2]?.volume ?? -1, 0.4),
        near("স্ট্রিং", cues[3]?.volume ?? -1, 0.4),
      );
    },
  },
  {
    id: "sfx-zero-silent",
    title: "volume ০ বা নেগেটিভ হলে কিউ বাদ — নীরবে (সতর্কতা নেই)",
    rule: "volume 0 / −0.3 → কিউ নেই, warnings = []",
    run: () => {
      const r = planSfx([seg(0, 90, 120, { name: "a", volume: 0 }), seg(1, 120, 150, { name: "b", volume: -0.3 })], CASE_TIMING, { outroSfx: false });
      return firstFail(expectEq("কিউ", r.cues.length, 0), expectEq("সতর্কতা", r.warnings.length, 0));
    },
  },
  {
    id: "sfx-bad-name",
    title: "অবৈধ নাম বাদ + প্রতিটায় একটা সতর্কতা; বৈধটা থাকে",
    rule: "\"../x\", \"a b\", \"\", 5 (সংখ্যা) → বাদ, ৪ সতর্কতা · \"ok_1-b\" থাকে",
    run: () => {
      const r = planSfx(
        [seg(0, 90, 120, { name: "../x" }), seg(1, 120, 150, { name: "a b" }), seg(2, 150, 180, { name: "" }), seg(3, 180, 210, { name: 5 }), seg(4, 210, 240, { name: "ok_1-b" })],
        CASE_TIMING,
        { outroSfx: false },
      );
      return firstFail(expectEq("কিউ", r.cues.length, 1), expectEq("নাম", r.cues[0]?.name, "ok_1-b"), expectEq("সতর্কতা", r.warnings.length, 4));
    },
  },
  {
    id: "sfx-skip-none",
    title: "sfx-ছাড়া segment ও ফাঁকা তালিকা কিছু বাজায় না",
    rule: "sfx নেই → কিউ নেই · segments = [] ও outro বন্ধ → কিউ নেই",
    run: () =>
      firstFail(
        expectEq("sfx নেই", planSfx([seg(0, 90, 180), seg(1, 180, 300)], CASE_TIMING, { outroSfx: false }).cues.length, 0),
        expectEq("খালি", planSfx([], CASE_TIMING, { outroSfx: false }).cues.length, 0),
      ),
  },
  {
    id: "sfx-max-length",
    title: "লম্বা জায়গায় SFX সর্বোচ্চ ৪ সেকেন্ড (১২০ ফ্রেম)",
    rule: "ফ্রেম 100-এ শুরু → durationFrames = SFX_MAX_SECONDS × 30 = 120",
    run: () => {
      const { cues } = planSfx([seg(0, 100, 400, { name: "pop" })], CASE_TIMING, { outroSfx: false });
      return firstFail(expectEq("durationFrames", cues[0]?.durationFrames, 120), expectEq("ধ্রুবক", SFX_MAX_SECONDS, 4), expectEq("maxSeconds=1", planSfx([seg(0, 100, 400, { name: "p" })], CASE_TIMING, { outroSfx: false, maxSeconds: 1 }).cues[0]?.durationFrames, 30));
    },
  },
  {
    id: "sfx-main-end",
    title: "Main-এর শেষে শুরু হওয়া SFX ছাঁটা হয় — Outro-তে ঢোকে না",
    rule: "ফ্রেম 500-এ শুরু → durationFrames = 510 − 500 = 10; ফ্রেম 509 → 1; কোনো segment-কিউ ফ্রেম 510 ছাড়ায় না",
    run: () => {
      const r = planSfx([seg(0, 500, 510, { name: "pop" }), seg(1, 509, 510, { name: "pop2" }), seg(2, 300, 510, { name: "chime" })], CASE_TIMING, { outroSfx: false });
      const over = r.cues.find((c) => c.from + c.durationFrames > 510);
      return firstFail(expectEq("500", r.cues[0]?.durationFrames, 10), expectEq("509", r.cues[1]?.durationFrames, 1), over ? `কিউ ${over.key} Main ছাড়িয়েছে` : null);
    },
  },
  {
    id: "sfx-outro",
    title: "Outro-র প্রথম ফ্রেমে ঐচ্ছিক SFX (whoosh, ০.৪)",
    rule: "from = 510 · duration = min(120, Outro 120) = 120 · volume 0.4 · kind = outro · name = OUTRO_SFX_NAME",
    run: () => {
      const c = planSfx([], CASE_TIMING).cues[0];
      return firstFail(
        expectEq("চালু-ধ্রুবক", OUTRO_SFX_ENABLED, true),
        expectEq("নাম-ধ্রুবক", OUTRO_SFX_NAME, "whoosh"),
        expectEq("from", c?.from, 510),
        expectEq("duration", c?.durationFrames, 120),
        near("volume", c?.volume ?? -1, 0.4),
        expectEq("kind", c?.kind, "outro"),
        expectEq("segmentIndex", c?.segmentIndex, -1),
        expectEq("name", c?.name, "whoosh"),
      );
    },
  },
  {
    id: "sfx-outro-off",
    title: "Outro SFX বন্ধ করা যায়; Outro ০ ফ্রেম হলে নেই",
    rule: "outroSfx:false → নেই · outroSeconds 0 → নেই",
    run: () =>
      firstFail(
        expectEq("বন্ধ", planSfx([], CASE_TIMING, { outroSfx: false }).cues.length, 0),
        expectEq("Outro ০", planSfx([], noOutro).cues.length, 0),
      ),
  },
  {
    id: "sfx-outro-short",
    title: "ছোট Outro-তে SFX Outro-র দৈর্ঘ্যের বেশি নয়",
    rule: "Outro 3 ফ্রেম → duration 3",
    run: () => {
      const t: Timing = { ...CASE_TIMING, outroFrames: 3, totalFrames: CASE_TIMING.introFrames + CASE_TIMING.mainFrames + 3 };
      return expectEq("duration", planSfx([], t).cues[0]?.durationFrames, 3);
    },
  },
  {
    id: "sfx-keys",
    title: "একই নামের দুই কিউয়ের কী আলাদা (React key)",
    rule: "pop @ segment 0 ও 1 → দুই আলাদা key; সব key অনন্য",
    run: () => {
      const { cues } = planSfx([seg(0, 90, 150, { name: "pop" }), seg(1, 150, 210, { name: "pop" }), seg(2, 210, 270, { name: "pop" })], CASE_TIMING);
      const keys = new Set(cues.map((c) => c.key));
      return firstFail(expectEq("কিউ (৩ + outro)", cues.length, 4), expectEq("অনন্য key", keys.size, 4));
    },
  },
  {
    id: "sfx-real-build",
    title: "আসল buildFrameSegments-এর সাথে: Intro-র অফসেট ঠিক, ছাঁটা segment-ও Main-এর ভেতরে",
    rule: "JSON 0 s → 90; 3.4 s → 90 + 102 = 192; Main ছাড়ানো (13.9 s) → ≤ 510; সব কিউ [90, 510]-এর ভেতরে",
    run: () => {
      const segs = buildFrameSegments(
        {
          segments: [
            { id: 1, start: 0, end: 3.4, text: "ক খ", sfx: { name: "whoosh", volume: 0.6 } },
            { id: 2, start: 3.4, end: 8, text: "গ ঘ", sfx: { name: "pop" } },
            { id: 3, start: 13.9, end: 20, text: "ঙ চ", sfx: { name: "chime" } },
          ],
        },
        CASE_TIMING,
      );
      const { cues } = planSfx(segs, CASE_TIMING, { outroSfx: false });
      const bad = cues.find((c) => c.from < 90 || c.from + c.durationFrames > 510);
      return firstFail(
        expectEq("cue0.from", cues[0]?.from, 90),
        expectEq("cue1.from", cues[1]?.from, 192),
        expectEq("cue2.from", cues[2]?.from, 90 + Math.round(13.9 * 30)),
        near("cue0.volume", cues[0]?.volume ?? -1, 0.6),
        expectEq("কিউ-সংখ্যা", cues.length, 3),
        bad ? `কিউ ${bad.key} সীমার বাইরে (${bad.from}+${bad.durationFrames})` : null,
      );
    },
  },
  {
    id: "sfx-never-throws",
    title: "অদ্ভুত ডেটায় কখনো throw করে না",
    rule: "sfx = {} / null-নাম / অদ্ভুত timing (NaN fps) → panic নয়, কিউ বাদ",
    run: () => {
      try {
        planSfx([seg(0, 90, 120, {} as unknown as SfxCue), seg(1, 120, 150, { name: null })], CASE_TIMING);
        planSfx([seg(0, 90, 120, { name: "pop" })], { ...CASE_TIMING, fps: Number.NaN });
        return null;
      } catch (e) {
        return `throw করেছে: ${String(e)}`;
      }
    },
  },
  // ---------- SFX-এর ফেড ----------
  {
    id: "sfx-gain-fade",
    title: "SFX: শেষ ৬ ফ্রেমে রৈখিক ফেড, আগে পুরো কিউ-ভলিউম",
    rule: "120 ফ্রেম, ০.৬: gain(0) = gain(114) = 0.6 · gain(117) = 0.3 · gain(119) = 0.1 · gain(120) = 0",
    run: () => {
      const c = { durationFrames: 120, volume: 0.6 };
      return firstFail(
        expectEq("ধ্রুবক", SFX_FADE_OUT_FRAMES, 6),
        near("gain(0)", sfxGain(0, c), 0.6),
        near("gain(114)", sfxGain(114, c), 0.6),
        near("gain(117)", sfxGain(117, c), 0.3),
        near("gain(119)", sfxGain(119, c), 0.1, 1e-9),
        near("gain(120)", sfxGain(120, c), 0),
      );
    },
  },
  {
    id: "sfx-gain-short",
    title: "ছোট কিউতে ফেড ছোট (¼); ৪ ফ্রেমের নিচে ফেড নেই",
    rule: "duration 8 → ফেড 2: gain(6) = ভলিউম, gain(7) = ½ · duration 3 → ফেড নেই (সবসময় ভলিউম)",
    run: () =>
      firstFail(
        near("d8 gain(6)", sfxGain(6, { durationFrames: 8, volume: 1 }), 1),
        near("d8 gain(7)", sfxGain(7, { durationFrames: 8, volume: 1 }), 0.5),
        near("d3 gain(2)", sfxGain(2, { durationFrames: 3, volume: 0.4 }), 0.4),
        near("d1 gain(0)", sfxGain(0, { durationFrames: 1, volume: 0.4 }), 0.4),
      ),
  },
  {
    id: "sfx-gain-safe",
    title: "SFX ভলিউম: NaN/নেগেটিভ/১-এর বেশি ইনপুটে সুরক্ষিত",
    rule: "gain(NaN) = ভলিউম · volume 3 → ১-এ ছাঁটা · volume −1 → 0 · সব ফ্রেমে ০–১",
    run: () => {
      const c = { durationFrames: 40, volume: 0.5 };
      for (let f = -3; f <= 45; f += 1) {
        const g = sfxGain(f, c);
        if (!(g >= 0 && g <= 1)) return `gain(${f}) = ${g}`;
      }
      return firstFail(
        near("NaN", sfxGain(Number.NaN, c), 0.5),
        near("volume 3", sfxGain(0, { durationFrames: 40, volume: 3 }), 1),
        near("volume -1", sfxGain(0, { durationFrames: 40, volume: -1 }), 0),
      );
    },
  },
  // ---------- ভয়েসের জায়গা ----------
  {
    id: "voice-slot",
    title: "ভয়েসের জায়গা: Intro-র পরে শুরু, ঠিক Main-এ শেষ, Outro-তে বাজে না",
    rule: "from = introFrames (90) · duration = mainFrames (420) · from + duration = মোট − Outro (510) · intro + main + outro = মোট",
    run: () =>
      firstFail(
        expectEq("from", CASE_TIMING.introFrames, 90),
        expectEq("duration", CASE_TIMING.mainFrames, 420),
        expectEq("শেষ", CASE_TIMING.introFrames + CASE_TIMING.mainFrames, CASE_TIMING.totalFrames - CASE_TIMING.outroFrames),
        expectEq("মোট", CASE_TIMING.introFrames + CASE_TIMING.mainFrames + CASE_TIMING.outroFrames, CASE_TIMING.totalFrames),
      ),
  },
  {
    id: "constants-fixed",
    title: "অডিওর স্থির মান বদলায়নি (ভয়েস ১.০, SFX ০.৪)",
    rule: "VOICE_VOLUME = 1 · DEFAULT_SFX_VOLUME = 0.4 — SFX ভয়েস ঢেকে ফেলে না",
    run: () => firstFail(expectEq("VOICE_VOLUME", VOICE_VOLUME, 1), expectEq("DEFAULT_SFX_VOLUME", DEFAULT_SFX_VOLUME, 0.4)),
  },
];

export function runAudioCases(): AudioCaseOutcome[] {
  return defs.map((d) => {
    try {
      const detail = d.run();
      return { id: d.id, title: d.title, rule: d.rule, ok: detail === null, detail: detail ?? "" };
    } catch (e) {
      return { id: d.id, title: d.title, rule: d.rule, ok: false, detail: `কেস নিজেই ভেঙেছে: ${String(e)}` };
    }
  });
}

export const AUDIO_CASE_COUNT = defs.length;
