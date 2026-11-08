import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { hadisAudioPath, TEASER_TAIL_SECONDS } from "../constants";
import { teaserGain } from "../lib/teaser";
import { teaserFramesOf, hookFramesOf, type Timing } from "../lib/timing";

/**
 * অডিও টিজার (cold open): হাদিসের `.wav`-এর [start, end] অংশ Hook-এর ঠিক পরে (টিজার-দৃশ্যের শুরু থেকে) বাজে।
 * `HadisAudio` পরে Main-এ হাদিস শুরু থেকে পুরোটা বাজায় (আলাদা `<Audio>`, আলাদা `<Sequence>` — কোনো সংঘর্ষ নেই)।
 *
 * ভিডিওর **মূল স্তরে** বসাও (ফ্রেম ভিডিওর শুরু থেকে মাপা)। `startSeconds`/`endSeconds` = `props.teaserStartSeconds/EndSeconds`
 * (`calculateMetadata` ছাঁটা মান)। টিজার-ফ্রেম ০ বা সময় নেই → কিছুই বাজে না।
 * `trimBefore`/`trimAfter` = উৎস-অডিওর ফ্রেম (fps = ভিডিওর fps)। অংশের শেষে ও শুরুতে ছোট ফেড (`teaserGain`)।
 */
export type TeaserAudioProps = {
  hadisId: string;
  timing: Timing;
  startSeconds?: number;
  endSeconds?: number;
  /** শুধু dev-প্রিভিউ/টেস্টের জন্য */
  src?: string;
};

export const TeaserAudio: React.FC<TeaserAudioProps> = ({ hadisId, timing, startSeconds, endSeconds, src }) => {
  const frames = teaserFramesOf(timing);
  if (
    frames < 1 ||
    typeof startSeconds !== "number" ||
    typeof endSeconds !== "number" ||
    !Number.isFinite(startSeconds) ||
    !Number.isFinite(endSeconds) ||
    endSeconds <= startSeconds
  ) {
    return null;
  }
  const fps = timing.fps;
  const from = hookFramesOf(timing);
  const trimBefore = Math.max(0, Math.round(startSeconds * fps));
  // অংশের শেষ শব্দের পরের ছোট বাড়তি (TEASER_TAIL_SECONDS) পর্যন্তও বাজে — ফেড-আউট পড়ে ওই বাড়তি অংশে, শেষ শব্দের ওপর নয়
  // (আগে অংশ ঠিক `end`-এ কাটত ও ফেড শেষ শব্দেই পড়ত → কথা মাঝপথে কাটা শোনাত)।
  const audioFrames = Math.max(1, Math.min(frames, Math.ceil((endSeconds - startSeconds + TEASER_TAIL_SECONDS) * fps)));
  const url = src ?? staticFile(hadisAudioPath(hadisId));
  return (
    <Sequence from={from} durationInFrames={frames} layout="none" name="teaser-voice">
      <Audio src={url} trimBefore={trimBefore} trimAfter={trimBefore + audioFrames} volume={(f) => teaserGain(f, audioFrames)} />
    </Sequence>
  );
};
