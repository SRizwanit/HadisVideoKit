import React, { useMemo } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "./components/Background";
import { HadisAudio } from "./components/HadisAudio";
import { IntroOutroAudio } from "./components/IntroOutroAudio";
import { SfxPlayer } from "./components/SfxPlayer";
import { mainFadeIn, planScenes } from "./lib/sceneFade";
import { useIntroOutroAudio } from "./lib/useIntroOutroAudio";
import { hookFramesOf, introOnlyFrames, timingFromConfig, type Timing } from "./lib/timing";
import { HookScene } from "./scenes/HookScene";
import { IntroScene } from "./scenes/IntroScene";
import { MainScene } from "./scenes/MainScene";
import { OutroScene } from "./scenes/OutroScene";
import type { HadisVideoProps } from "./types";

/**
 * Part 13B: পুরো ভিডিও — Intro + Main + Outro + ব্যাকগ্রাউন্ড + অডিও।
 *
 * স্তরের ক্রম (নিচ → উপর):
 *   `<Background>`  সব দৃশ্যের পেছনে, আসল `timing` সহ (তাই Outro-র আকাশ রাত; `computeNightFactor`)
 *   Hook    `<Sequence from=0 …>` (hook.wav থাকলে)       → `HookScene`    (বড় প্রশ্ন-লেখা; নিজেই শেষে ফেড-আউট)
 *   Intro   `<Sequence from=hook …>`                    → `IntroScene`   (নিজেই শেষে ফেড-আউট; Part 8; Hook না থাকলে from=0)
 *   Main    `<Sequence from=intro …>` + ফেড-ইন মোড়ক   → `MainScene`    (Header + SvgStage + Caption; Part 13A)
 *   Outro   `<Sequence from=intro+main …>`              → `OutroScene`   (নিজেই ১২ ফ্রেমে ফেড-ইন/আউট; Part 12)
 *   `<IntroOutroAudio>` (Part 14C-audio)  Intro/Outro-র ভয়েস — শুধু অডিও, ক্যাপশন নেই; `public/audio/intro.wav`, `outro.wav`
 *   `<HadisAudio>` + `<SfxPlayer>`  **মূল স্তরে, কোনো দৃশ্য-Sequence-এর বাইরে** (এদের ফ্রেম ভিডিওর শুরু থেকে মাপা; Part 11)
 *
 * নিয়ম (fixed):
 *  (১) timing আসে `timingFromConfig(durationInFrames, props)` থেকে (`calculateMetadata`-এর মোট ফ্রেমের সাথে মেলে; .wav আবার পড়তে হয় না)।
 *  (২) প্রতিটা দৃশ্য-`<Sequence>` শুধু তার ফ্রেম-সংখ্যা > ০ হলে আঁকা হয় (`planScenes`) — ০-ফ্রেমের Sequence কখনো নয়।
 *  (৩) Intro ↔ Main ক্রস-ফেড: Main-এর প্রথম `min(12, ⌊Main ÷ 3⌋)` ফ্রেমে পুরো MainScene-এর opacity ০→১ + স্কেল ০.৯৭→১
 *      (`sceneFade.ts`); ফেডের বাইরে মোড়কে কোনো opacity/transform থাকে না (ক্যাপশনের `backdrop-filter` ব্লার অক্ষত)।
 *  (৪) Main → Outro: আলাদা ক্রস-ফেড নেই — Outro নিজেই ফেড-ইন করে।
 *  (৫) `MainScene`/`OutroScene`-এ `frameOffset`/`frame`/`size`/`idScope` দেওয়া হয় না (ডিফল্ট ঠিক সঠিক; Part 12D/13A নোট)।
 *  (৬) এই ফাইলে কোনো সময়/মাপের হিসাব নেই (সব `timing.ts`, `sceneFade.ts`, `computeLayout`, `outroPlan.ts`-এ); কিছুই CSS-অ্যানিমেশন/`Math.random()` নয়।
 *
 * `data-hadis-video` / `data-scene` / `data-main-fade*` শুধু dev যাচাইয়ের (Part 13C) জন্য; আঁকায় প্রভাব নেই।
 * Part 13C: আঁকার অংশ `HadisVideoView`-তে (timing সরাসরি নেয়); `HadisVideo` শুধু `timingFromConfig` করে সেটাকে ডাকে — আসল ভিডিওর আচরণ অপরিবর্তিত।
 */

/** Main সিনের ফেড-ইন মোড়ক — ফেডের বাইরে কোনো style থাকে না */
const MainFadeIn: React.FC<{ timing: Timing; children: React.ReactNode }> = ({ timing, children }) => {
  const localFrame = useCurrentFrame();
  const look = mainFadeIn(localFrame, timing.introFrames, timing.mainFrames);
  return (
    <AbsoluteFill
      data-scene="main"
      data-main-fade={look.active ? "on" : "off"}
      data-main-fade-opacity={look.opacity}
      data-main-fade-scale={look.scale}
      style={look.active ? { opacity: look.opacity, transform: `scale(${look.scale})` } : undefined}
    >
      {children}
    </AbsoluteFill>
  );
};

/**
 * Part 13C: পুরো ভিডিওর আঁকা — `timing` সরাসরি নিয়ে। `HadisVideo` (আসল কম্পোজিশন) এটাকেই ডাকে,
 * আর `HadisVideoPreview` (dev) একই কোড ভিন্ন সাইজ/ফ্রেমে আঁকে — তাই যা যাচাই হয় ঠিক সেটাই রেন্ডার হয়।
 * আসল ভিডিও `size`/`idScope`/`audio`/`sfx` কখনো দেয় না (ডিফল্ট = আগের মতোই; কিছু বদলায়নি)।
 */
export type HadisVideoViewProps = HadisVideoProps & {
  timing: Timing;
  /** dev প্রিভিউয়ের জন্য: ভিডিওর সাইজ ছাড়া অন্য সাইজে লেআউট (ডিফল্ট: useVideoConfig) */
  size?: { width: number; height: number };
  /** dev প্রিভিউয়ের জন্য: একই পাতায় একাধিক `SvgStage` থাকলে id আলাদা রাখার prefix */
  idScope?: string;
  /** `false` হলে `HadisAudio` + `SfxPlayer` বসে না (dev প্রিভিউ; ডিফল্ট `true`) */
  audio?: boolean;
  /** `false` হলে Intro/Outro নিজেদের SFX খোঁজে না (dev প্রিভিউ; ডিফল্ট `true`) */
  sfx?: boolean;
};

export const HadisVideoView: React.FC<HadisVideoViewProps> = ({ timing, size, idScope, audio = true, sfx, ...props }) => {
  const hookFrames = hookFramesOf(timing);
  const scenes = planScenes(timing.introFrames, timing.mainFrames, timing.outroFrames, hookFrames);
  // Intro দৃশ্যের নিজের দৈর্ঘ্য (Hook বাদে): `timing.introFrames` = Hook + Intro (Main-এর শুরু), তাই Intro-কে আলাদা timing দিই
  const introTiming = useMemo<Timing>(
    () => ({ ...timing, introFrames: introOnlyFrames(timing), hookFrames: undefined }),
    // timing প্রতি রেন্ডারে নতুন অবজেক্ট হতে পারে — সংখ্যাগুলো ধরেই মেলানো
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timing.fps, timing.introFrames, timing.hookFrames, timing.mainFrames, timing.outroFrames, timing.totalFrames],
  );

  // Part 14C-audio: Intro/Outro-তে শুধু ভয়েস (ক্যাপশন নেই)। ফাইল থাকলে ওই দৃশ্যের নিজস্ব SFX বন্ধ (ভয়েসের উপর চাপে না);
  // খোঁজা শেষ না হওয়া পর্যন্ত (ready=false) SFX মাউন্ট হয় না। `audio=false` (dev প্রিভিউ) হলে কিছু খোঁজে না — আচরণ আগের মতো।
  const voice = useIntroOutroAudio(audio);
  const introSfx = sfx === false ? false : !voice.ready || voice.intro ? false : sfx;
  const outroSfx = sfx === false ? false : !voice.ready || voice.outro ? false : sfx;
  const sfxOptions = useMemo(() => (voice.outro ? { outroSfx: false } : undefined), [voice.outro]);

  return (
    <AbsoluteFill data-hadis-video="" data-hook-frames={hookFrames} data-intro-frames={timing.introFrames} data-main-frames={timing.mainFrames} data-outro-frames={timing.outroFrames}>
      <Background theme={props.theme} timing={timing} size={size} />

      {scenes.hook && (
        <Sequence name="hook" from={scenes.hook.from} durationInFrames={scenes.hook.frames}>
          <AbsoluteFill data-scene="hook">
            <HookScene theme={props.theme} timing={timing} size={size} />
          </AbsoluteFill>
        </Sequence>
      )}

      {scenes.intro && (
        <Sequence name="intro" from={scenes.intro.from} durationInFrames={scenes.intro.frames}>
          <AbsoluteFill data-scene="intro">
            <IntroScene
              theme={props.theme}
              bookname={props.hadisBookname}
              number={props.hadisNumber}
              timing={introTiming}
              size={size}
              sfx={introSfx}
            />
          </AbsoluteFill>
        </Sequence>
      )}

      {scenes.main && (
        <Sequence name="main" from={scenes.main.from} durationInFrames={scenes.main.frames}>
          <MainFadeIn timing={timing}>
            <MainScene
              hadisId={props.hadisId}
              theme={props.theme}
              bookname={props.hadisBookname}
              number={props.hadisNumber}
              timing={timing}
              size={size}
              idScope={idScope}
            />
          </MainFadeIn>
        </Sequence>
      )}

      {scenes.outro && (
        <Sequence name="outro" from={scenes.outro.from} durationInFrames={scenes.outro.frames}>
          <AbsoluteFill data-scene="outro">
            <OutroScene theme={props.theme} timing={timing} size={size} sfx={outroSfx} tapSfx={sfx === false ? false : undefined} />
          </AbsoluteFill>
        </Sequence>
      )}

      {/* ⚠️ মূল স্তরে — কোনো দৃশ্য-Sequence-এর ভেতরে নয় (Part 11) */}
      {audio && <HadisAudio hadisId={props.hadisId} timing={timing} />}
      {audio && <SfxPlayer hadisId={props.hadisId} timing={timing} options={sfxOptions} />}
      {audio && voice.ready && <IntroOutroAudio timing={timing} hookSrc={voice.hook} introSrc={voice.intro} outroSrc={voice.outro} />}
    </AbsoluteFill>
  );
};

export const HadisVideo: React.FC<HadisVideoProps> = (props) => {
  const { durationInFrames } = useVideoConfig();
  const { introSeconds, outroSeconds, hookSeconds } = props;

  const timing = useMemo(
    () => timingFromConfig(durationInFrames, { introSeconds, outroSeconds, hookSeconds }),
    [durationInFrames, introSeconds, outroSeconds, hookSeconds],
  );

  return <HadisVideoView {...props} timing={timing} />;
};
