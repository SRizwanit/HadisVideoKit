import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { HadisAudio } from "../components/HadisAudio";
import { SfxPlayer } from "../components/SfxPlayer";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { timingFromConfig } from "../lib/timing";
import { getThemeColors, skyGradient } from "../themes";
import type { HadisVideoProps } from "../types";

/**
 * Part 11 (dev টুল): আসল `HadisAudio` + `SfxPlayer` একটা কম্পোজিশনে মাউন্ট হয় কিনা (ক্র্যাশ ছাড়া) — বান্ডল/রেন্ডার-যাচাই।
 * নমুনা `hadis0000` দিয়ে (WAV + JSON); না থাকলে `calculateHadisMetadata`-এর `[HADIS_DATA]` এরর → `check.mjs` ⚠️ বাদ দেয়, রান সবুজ থাকে।
 * ছবি (still)-তে শব্দ থাকে না; আসল শোনা Studio-তে বা Part 13/14-র ভিডিওতে। SFX ফাইল না থাকলে (zip-এ নেই) কিউ চুপচাপ বাদ — কনসোলে ⚠️।
 */
export const AudioSmoke: React.FC<HadisVideoProps> = (props) => {
  const { durationInFrames, fps } = useVideoConfig();
  const timing = timingFromConfig(durationInFrames, props, fps);
  const p = getThemeColors(props.theme, 0);
  return (
    <AbsoluteFill style={{ background: skyGradient(p), justifyContent: "center", alignItems: "center", gap: 24, fontFamily: FONT_BODY, color: p.text, padding: 60, textAlign: "center" }}>
      <HadisAudio hadisId={props.hadisId} timing={timing} />
      <SfxPlayer hadisId={props.hadisId} timing={timing} />
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 64, color: p.accent }}>AudioSmoke ✅</div>
      <div style={{ fontSize: 34 }}>HadisAudio + SfxPlayer মাউন্ট হয়েছে (hadisId {props.hadisId})</div>
      <div style={{ fontSize: 28, color: p.textMuted }}>
        Intro {timing.introFrames} · Main {timing.mainFrames} · Outro {timing.outroFrames} ফ্রেম
      </div>
    </AbsoluteFill>
  );
};
