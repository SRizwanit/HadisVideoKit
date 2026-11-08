import React, { useMemo } from "react";
import { Audio, Sequence } from "remotion";
import { hookGain, introOutroGain, planIntroOutroAudio } from "../lib/introOutroAudio";
import type { Timing } from "../lib/timing";

/**
 * Part 14C-audio: Intro ও Outro-র ভয়েস (শুধু অডিও — কোনো ক্যাপশন নেই; ক্যাপশন Main-এ)।
 * Hook (যদি `hookSrc` থাকে): ভিডিওর শুরু (ফ্রেম ০) থেকে Hook-এর শেষ পর্যন্ত · Intro: Hook শেষ হওয়া থেকে (Hook না থাকলে ফ্রেম ০) Intro-র শেষ পর্যন্ত · Outro: Main শেষ হওয়ার ফ্রেম থেকে Outro-র শেষ পর্যন্ত। শেষে ছোট ফেড-আউট।
 * `introSrc`/`outroSrc` = null (ফাইল নেই) হলে সেই দৃশ্যে কিছুই বাজে না।
 *
 * HadisAudio/SfxPlayer-এর মতো ভিডিওর **মূল স্তরে** বসাও (কোনো দৃশ্য-Sequence-এর ভেতরে নয়) — ফ্রেম ভিডিওর শুরু থেকে মাপা।
 */
export type IntroOutroAudioProps = {
  timing: Timing;
  /** hook.wav-এর src (নেই = null/অনুপস্থিত → Hook-এ কিছু বাজে না) */
  hookSrc?: string | null;
  introSrc: string | null;
  outroSrc: string | null;
};

export const IntroOutroAudio: React.FC<IntroOutroAudioProps> = ({ timing, hookSrc = null, introSrc, outroSrc }) => {
  const plan = useMemo(
    () => planIntroOutroAudio(timing),
    // timing প্রতি রেন্ডারে নতুন অবজেক্ট হতে পারে — সংখ্যাগুলো ধরেই মেলানো
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timing.introFrames, timing.hookFrames, timing.mainFrames, timing.outroFrames],
  );
  const hook = plan.hook;
  const intro = plan.intro;
  const outro = plan.outro;
  return (
    <>
      {hook && hookSrc ? (
        <Sequence from={hook.from} durationInFrames={hook.durationFrames} layout="none" name="hook-voice">
          <Audio src={hookSrc} volume={(f) => hookGain(f, hook)} />
        </Sequence>
      ) : null}
      {intro && introSrc ? (
        <Sequence from={intro.from} durationInFrames={intro.durationFrames} layout="none" name="intro-voice">
          <Audio src={introSrc} volume={(f) => introOutroGain(f, intro)} />
        </Sequence>
      ) : null}
      {outro && outroSrc ? (
        <Sequence from={outro.from} durationInFrames={outro.durationFrames} layout="none" name="outro-voice">
          <Audio src={outroSrc} volume={(f) => introOutroGain(f, outro)} />
        </Sequence>
      ) : null}
    </>
  );
};
