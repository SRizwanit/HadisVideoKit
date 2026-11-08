// সাবটাইটেল (.srt) — ব্রাউজার/Remotion ছাড়া চলে, তাই সাধারণ Node-এই পরীক্ষা করা যায় (scripts/test-render-plan.mjs)।
// ইউটিউবে CC (বন্ধ ক্যাপশন) হিসেবে আপলোড করা যায়; ভিডিওর সব ওরিয়েন্টেশন/কোয়ালিটিতে সময় একই, তাই হাদিস-প্রতি একটা ফাইল।
//
// সময়ের হিসাব src/lib/timing.ts-এর `timingFromConfig` + `buildFrameSegments`-এর ঠিক কপি:
//   [ Hook ][ Teaser ][ Intro ][ Main = .wav ][ Outro ]
//   hookFrames = round(hookSeconds × fps), teaserFrames = round(teaserSeconds × fps),
//   introFrames (Main শুরুর আগের সব) = hook + teaser + round(introSeconds × fps),
//   outroFrames = round(outroSeconds × fps), mainFrames = max(1, total − intro − outro)
//   segment-এর ফ্রেম = introFrames + round(সেকেন্ড × fps), Main-এর ভেতরে ছাঁটা, কমপক্ষে ১ ফ্রেম।
// ক্যু: Hook-এর প্রশ্ন (Hook-এর সময়ে), Teaser-এর বাক্যাংশ (Teaser-এর সময়ে), তারপর প্রতিটা segment।
// Intro/Outro-তে কোনো ক্যু নেই (ওখানকার ভয়েসের লেখা কিটের কাছে নেই)।
import { FPS, HOOK_TEXT } from "./renderPlan.mjs";

/** টেক্সট স্পেস ধরে শব্দে ভাগ (src/lib/timing.ts `splitWords`-এর কপি) */
export const splitWords = (text) => String(text ?? "").split(/\s+/).filter((w) => w.length > 0);

const secondsToFrames = (seconds, fps) => Math.round(seconds * fps);
const num = (v, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** টিজারের সময়-পরিসর (সেকেন্ড, .wav-এর শুরু থেকে) — JSON-এর `teaser`; অবৈধ হলে null (src/lib/teaser.ts-এর নিয়ম, ১২ সেকেন্ডে ছাঁটা) */
export function teaserRangeOf(file, start, end) {
  const s = Math.max(0, num(start ?? file?.teaser?.start, Number.NaN));
  let e = num(end ?? file?.teaser?.end, Number.NaN);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
  e = Math.min(e, s + 12);
  return e > s ? { start: s, end: e } : null;
}

/** [start, end)-এর ভেতরের শব্দ-তালিকা (src/lib/teaser.ts `teaserWords`-এর নিয়ম); কিছু না মিললে `teaser.text` */
export function teaserWordList(file, start, end) {
  const range = teaserRangeOf(file, start, end);
  if (!range) return [];
  const out = [];
  const take = (word, ws, we) => {
    const mid = (ws + we) / 2;
    if (mid >= range.start && mid < range.end) out.push(word);
  };
  for (const seg of file?.segments ?? []) {
    if (seg.end <= range.start || seg.start >= range.end) continue;
    if (Array.isArray(seg.words) && seg.words.length > 0) {
      for (const w of seg.words) take(w.word, w.start, w.end);
    } else {
      const ws = splitWords(seg.text);
      const span = seg.end - seg.start;
      ws.forEach((w, i) => take(w, seg.start + (span * i) / ws.length, seg.start + (span * (i + 1)) / ws.length));
    }
  }
  if (out.length === 0 && file?.teaser?.text) return splitWords(file.teaser.text);
  return out;
}

/** সেকেন্ড → "HH:MM:SS,mmm" */
export function formatSrtTime(seconds) {
  const totalMs = Math.max(0, Math.round(num(seconds) * 1000));
  const ms = totalMs % 1000;
  const s = Math.floor(totalMs / 1000) % 60;
  const m = Math.floor(totalMs / 60000) % 60;
  const h = Math.floor(totalMs / 3600000);
  const p2 = (n) => String(n).padStart(2, "0");
  return `${p2(h)}:${p2(m)}:${p2(s)},${String(ms).padStart(3, "0")}`;
}

/** শব্দের সীমানায় লাইন ভাঙা (বাংলা যুক্তাক্ষর কখনো ভাঙে না); প্রতি লাইন প্রায় `max` অক্ষর */
export function wrapLines(text, max = 42) {
  const words = splitWords(text);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (cur && [...cur].length + 1 + [...w].length > max) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) lines.push(cur);
  return lines.join("\n");
}

/**
 * ক্যুর তালিকা: [{ start, end, text }] (সেকেন্ড, ভিডিওর শুরু থেকে)। কখনো throw করে না।
 * @param {object} a
 * @param {{segments: any[], teaser?: any}} a.file  hadis<id>_timestamp.json (পার্স করা)
 * @param {number} a.totalFrames  composition.durationInFrames
 * @param {number} [a.fps]
 * @param {number} [a.hookSeconds] @param {number} [a.teaserSeconds] @param {number} [a.introSeconds] @param {number} [a.outroSeconds]
 *   — composition.props থেকে (calculateMetadata-র ফল; wav-এর দৈর্ঘ্য মিলিয়ে বসানো)
 * @param {string} [a.hookText] ফাঁকা = HOOK_TEXT
 * @param {number} [a.teaserStartSeconds] @param {number} [a.teaserEndSeconds]
 */
export function buildSrtCues(a) {
  const fps = num(a.fps, FPS) > 0 ? num(a.fps, FPS) : FPS;
  const hookFrames = Math.max(0, secondsToFrames(num(a.hookSeconds), fps));
  const teaserFrames = Math.max(0, secondsToFrames(num(a.teaserSeconds), fps));
  const introFrames = hookFrames + teaserFrames + secondsToFrames(num(a.introSeconds), fps);
  const outroFrames = secondsToFrames(num(a.outroSeconds), fps);
  const totalFrames = Math.max(1, Math.floor(num(a.totalFrames, introFrames + 1 + outroFrames)));
  const mainFrames = Math.max(1, totalFrames - introFrames - outroFrames);
  const mainEnd = introFrames + mainFrames;

  const cues = [];
  const push = (startFrame, endFrame, text) => {
    const clean = String(text ?? "").trim();
    if (!clean || !(endFrame > startFrame)) return;
    cues.push({ start: startFrame / fps, end: endFrame / fps, text: clean });
  };

  // Hook — প্রশ্ন
  if (hookFrames > 0) {
    const t = typeof a.hookText === "string" && a.hookText.trim() !== "" ? a.hookText : HOOK_TEXT;
    push(0, hookFrames, t);
  }

  // Teaser — হাদিসের শক্তিশালী বাক্যাংশ
  if (teaserFrames > 0) {
    const words = teaserWordList(a.file, a.teaserStartSeconds, a.teaserEndSeconds);
    push(hookFrames, hookFrames + teaserFrames, words.join(" "));
  }

  // Main — প্রতিটা segment (src/lib/timing.ts `buildFrameSegments`-এর ঠিক নিয়ম)
  const clampFrame = (secs) => Math.min(mainEnd, Math.max(introFrames, introFrames + secondsToFrames(secs, fps)));
  for (const seg of a.file?.segments ?? []) {
    const startFrame = Math.min(clampFrame(num(seg.start)), mainEnd - 1);
    const endFrame = Math.max(startFrame + 1, clampFrame(num(seg.end)));
    push(startFrame, endFrame, seg.text);
  }

  // ক্যু যেন একটার উপর আরেকটা না চড়ে (JSON-এর segment ওভারল্যাপ করলে আগেরটা ছেঁটে দিই)
  cues.sort((x, y) => x.start - y.start);
  for (let i = 0; i < cues.length - 1; i++) {
    if (cues[i].end > cues[i + 1].start) cues[i].end = cues[i + 1].start;
  }
  return cues.filter((c) => c.end > c.start);
}

/** ক্যু → .srt টেক্সট (UTF-8; প্রতিটা ক্যুতে সর্বোচ্চ ~৪২ অক্ষরের লাইন) */
export function formatSrt(cues) {
  return (
    cues
      .map((c, i) => `${i + 1}\n${formatSrtTime(c.start)} --> ${formatSrtTime(c.end)}\n${wrapLines(c.text)}\n`)
      .join("\n") + (cues.length ? "" : "")
  );
}
