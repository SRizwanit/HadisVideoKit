import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { hadisAudioPath } from "../constants";
import { voiceFadeFrames, voiceGain } from "../lib/audioPlan";
import type { Timing } from "../lib/timing";

/**
 * Part 11: হাদিসের ভয়েস (`public/hadis/hadis<ID>.wav`)।
 * Intro শেষ হলে (`timing.introFrames`) শুরু, ঠিক Main-এর দৈর্ঘ্য বাজে (Outro-তে ঢোকে না);
 * Main-এর শেষে ছোট ফেড-আউট (`VOICE_FADE_OUT_FRAMES`)।
 *
 * Part 13-এ ভিডিওর **মূল স্তরে** বসাও (কোনো অফসেট `<Sequence>`-এর ভেতরে নয়):
 *   <HadisAudio hadisId={props.hadisId} timing={timing} />
 * WAV আছে কিনা `calculateMetadata` (Part 5) আগেই যাচাই করে, তাই এখানে আলাদা যাচাই নেই।
 * `src?` শুধু dev-প্রিভিউ/টেস্টের জন্য (আসল ভিডিও এটা দেয় না)।
 */
export type HadisAudioProps = {
  hadisId: string;
  timing: Timing;
  src?: string;
};

export const HadisAudio: React.FC<HadisAudioProps> = ({ hadisId, timing, src }) => {
  const main = Math.max(1, Math.floor(timing.mainFrames));
  const fade = voiceFadeFrames(main);
  const url = src ?? staticFile(hadisAudioPath(hadisId));
  return (
    <Sequence from={timing.introFrames} durationInFrames={main} layout="none" name="hadis-voice">
      <Audio src={url} volume={(f) => voiceGain(f, main, fade)} />
    </Sequence>
  );
};
