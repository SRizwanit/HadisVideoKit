import React, { useEffect, useMemo } from "react";
import { Audio, Sequence } from "remotion";
import { planSfx, sfxGain, type PlanOptions, type SfxPlan } from "../lib/audioPlan";
import { useHadisTimestamp } from "../lib/loadHadis";
import { buildFrameSegments, type FrameSegment, type Timing } from "../lib/timing";
import { useSfxSrc } from "../lib/useSfxSrc";

/**
 * Part 11: প্রতিটা segment-এর SFX (+ Main → Outro বদলের ঐচ্ছিক SFX)।
 *
 * - `SfxPlayer`   = `useHadisTimestamp` (Part 5) + `buildFrameSegments` + `SfxPlayerView`.
 * - `SfxPlayerView` = একই কাজ, ডেটা লোড ছাড়া (segments হাতে দেওয়া; dev-প্রিভিউ ও টেস্টের জন্য)।
 * - প্রতিটা কিউ নিজের `useSfxSrc(name)` (Part 8) দিয়ে `public/sfx/<name>.mp3` (না থাকলে `.wav`) খোঁজে;
 *   **ফাইল না থাকলে ক্র্যাশ নয়** — কিউ চুপচাপ বাদ, কনসোলে একবার ⚠️ (useSfxSrc-ই ছাপে)।
 *
 * Part 13-এ ভিডিওর **মূল স্তরে** বসাও (অফসেট `<Sequence>`-এর ভেতরে নয়; ফ্রেমগুলো ভিডিওর শুরু থেকে মাপা):
 *   <SfxPlayer hadisId={props.hadisId} timing={timing} />
 */
export type SfxPlayerProps = {
  hadisId: string;
  timing: Timing;
  options?: PlanOptions;
};

export type SfxPlayerViewProps = {
  segments: FrameSegment[];
  timing: Timing;
  options?: PlanOptions;
};

/** একটা কিউ: ফাইল পাওয়া গেলে `<Sequence><Audio/></Sequence>`, নইলে কিছুই নয় */
const SfxCueAudio: React.FC<{ cue: SfxPlan }> = ({ cue }) => {
  const src = useSfxSrc(cue.name);
  if (!src) return null;
  return (
    <Sequence from={cue.from} durationInFrames={cue.durationFrames} layout="none" name={`sfx-${cue.name}`}>
      <Audio src={src} volume={(f) => sfxGain(f, cue)} />
    </Sequence>
  );
};

export const SfxPlayerView: React.FC<SfxPlayerViewProps> = ({ segments, timing, options }) => {
  const plan = useMemo(
    () => planSfx(segments, timing, options),
    [segments, timing, options],
  );

  // বাদ পড়া কিউয়ের সতর্কতা: একবারই। `timing` প্রতি ফ্রেমে নতুন অবজেক্ট হলেও লেখা একই থাকলে আবার ছাপে না।
  const warnKey = plan.warnings.join("\n");
  useEffect(() => {
    if (warnKey) for (const w of warnKey.split("\n")) console.warn(`⚠️ ${w}`);
  }, [warnKey]);

  return (
    <>
      {plan.cues.map((cue) => (
        <SfxCueAudio key={cue.key} cue={cue} />
      ))}
    </>
  );
};

export const SfxPlayer: React.FC<SfxPlayerProps> = ({ hadisId, timing, options }) => {
  const file = useHadisTimestamp(hadisId);
  const segments = useMemo(() => (file ? buildFrameSegments(file, timing) : []), [file, timing]);
  if (!file) return null;
  return <SfxPlayerView segments={segments} timing={timing} options={options} />;
};
