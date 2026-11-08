import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { BASE_SIZES, FPS } from "./constants";
import { ANIMATED_SVG_PREVIEW_HEIGHT, AnimatedSvgPreview } from "./dev/AnimatedSvgPreview";
import { AUDIO_PREVIEW_HEIGHT, AudioPreview } from "./dev/AudioPreview";
import { AudioSmoke } from "./dev/AudioSmoke";
import { BackgroundPreview } from "./dev/BackgroundPreview";
import { CAPTION_PREVIEW_HEIGHT, CaptionPreview } from "./dev/CaptionPreview";
import { DataCheck } from "./dev/DataCheck";
import { HEADER_PREVIEW_HEIGHT, HeaderPreview } from "./dev/HeaderPreview";
import { ensureVideoPreviewData, HADIS_VIDEO_PREVIEW_HEIGHT, HadisVideoPreview } from "./dev/HadisVideoPreview";
import { INTRO_PREVIEW_HEIGHT, IntroPreview } from "./dev/IntroPreview";
import { ensureMainSceneCheckData, MAIN_SCENE_CHECK_HEIGHT, MainSceneCheck } from "./dev/MainSceneCheck";
import { OUTRO_PREVIEW_HEIGHT, OutroPreview } from "./dev/OutroPreview";
import { SVG_INVENTORY_CHECK_HEIGHT, SvgInventoryCheck } from "./dev/SvgInventoryCheck";
import { SVG_PICKER_CHECK_HEIGHT, SvgPickerCheck } from "./dev/SvgPickerCheck";
import { SVG_SANITIZE_CHECK_HEIGHT, SvgSanitizeCheck } from "./dev/SvgSanitizeCheck";
import { ensureStagePreviewData, SVG_STAGE_PREVIEW_HEIGHT, SvgStagePreview } from "./dev/SvgStagePreview";
import { SVG_SYNC_PREVIEW_HEIGHT, SvgSyncPreview } from "./dev/SvgSyncPreview";
import { ThemePreview } from "./dev/ThemePreview";
import { HadisVideo } from "./HadisVideo";
import { calculateHadisMetadata } from "./lib/loadHadis";
import { THUMBNAIL_DURATION_FRAMES, ThumbnailScene } from "./scenes/ThumbnailScene";
import {
  defaultHadisProps,
  hadisVideoSchema,
  type HadisVideoProps,
  type Orientation,
} from "./types";

/**
 * Part 13B: আসল দুই কম্পোজিশন — `HadisPortrait` (9:16) ও `HadisLandscape` (16:9)।
 *  - দুটোই একই `HadisVideo` আঁকে; পার্থক্য শুধু সাইজ। 4K = রেন্ডারে `--scale 2` (কম্পোজিশন সবসময় বেস HD সাইজে)।
 *  - মোট ফ্রেম ও `width/height` আসে `calculateHadisMetadata` (Part 5) থেকে, কিন্তু orientation **কম্পোজিশনের ID থেকে বাঁধা**:
 *    Studio-র props প্যানেলে `orientation` বদলালেও `HadisPortrait` কখনো ১৯২০×১০৮০ হয় না (ভুল সাইজ-মিলহীনতা বন্ধ)।
 *  - ডিফল্ট প্রপসে নমুনা `hadisId: "0000"` (zip-এর `hadis0000.wav` + JSON) — `action = check` ও Studio-তে সরাসরি আঁকা যায়।
 *    আসল রেন্ডারে (Part 14 `render.mjs`) `--props`-এ নিজের hadisId/কিতাব/নম্বর/থিম যায়।
 *    নমুনা ফাইল মুছে ফেললে `calculateMetadata` `[HADIS_DATA]` এরর দেয় → `check.mjs` ⚠️ দিয়ে বাদ দেয়, রান সবুজ থাকে।
 */
export const forceOrientation =
  (orientation: Orientation): CalculateMetadataFunction<HadisVideoProps> =>
  (options) =>
    calculateHadisMetadata({ ...options, props: { ...options.props, orientation } });

/**
 * থাম্বনেইল (Hook + Teaser + Intro এক ছবিতে): `forceOrientation`-এর মতোই orientation কম্পোজিশনের ID-তে বাঁধা।
 * `calculateHadisMetadata` চলে (teaser-এর সেকেন্ড props-এ বসাতে), কিন্তু ফ্রেম-সংখ্যা স্থির `THUMBNAIL_DURATION_FRAMES`
 * (ভিডিওর দৈর্ঘ্য নয়) — আসল ছবি `render.mjs`-এ `renderStill` দিয়ে `THUMBNAIL_FRAME`-এ, `--scale 2` (4K)।
 */
export const forceThumbnail =
  (orientation: Orientation): CalculateMetadataFunction<HadisVideoProps> =>
  async (options) => {
    const meta = await calculateHadisMetadata({ ...options, props: { ...options.props, orientation } });
    return { ...meta, durationInFrames: THUMBNAIL_DURATION_FRAMES };
  };

export const HadisThumbnail: React.FC<HadisVideoProps> = (props) => (
  <ThumbnailScene
    theme={props.theme}
    hadisId={props.hadisId}
    bookname={props.hadisBookname}
    number={props.hadisNumber}
    hookText={props.hookText}
    teaserStartSeconds={props.teaserStartSeconds}
    teaserEndSeconds={props.teaserEndSeconds}
    teaserEnabled={props.teaserEnabled}
    seriesNumber={props.seriesNumber}
    thumbnailNight={props.thumbnailNight}
  />
);

export const hadisPortraitDefaults: HadisVideoProps = {
  ...defaultHadisProps,
  hadisId: "0000",
  orientation: "portrait",
};

export const hadisLandscapeDefaults: HadisVideoProps = {
  ...hadisPortraitDefaults,
  orientation: "landscape",
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
    {/* Part 13B: আসল ভিডিও — 9:16 (১০৮০×১৯২০) ও 16:9 (১৯২০×১০৮০); Intro + Main + Outro + অডিও।
        CLI-তে: `remotion render HadisPortrait` / `HadisLandscape` (Part 14-এর render.mjs এভাবেই ডাকে)। */}
    <Composition
      id="HadisPortrait"
      component={HadisVideo}
      schema={hadisVideoSchema}
      defaultProps={hadisPortraitDefaults}
      calculateMetadata={forceOrientation("portrait")}
      durationInFrames={FPS * 13}
      fps={FPS}
      width={BASE_SIZES.portrait.width}
      height={BASE_SIZES.portrait.height}
    />
    <Composition
      id="HadisLandscape"
      component={HadisVideo}
      schema={hadisVideoSchema}
      defaultProps={hadisLandscapeDefaults}
      calculateMetadata={forceOrientation("landscape")}
      durationInFrames={FPS * 13}
      fps={FPS}
      width={BASE_SIZES.landscape.width}
      height={BASE_SIZES.landscape.height}
    />
    {/* থাম্বনেইল: Hook + Teaser + Intro এক ছবিতে — 9:16 (১০৮০×১৯২০) ও 16:9 (১৯২০×১০৮০)।
        CLI-তে: `remotion still ThumbnailPortrait --frame 45 --scale 2` (render.mjs এভাবেই আঁকে → ২১৬০×৩৮৪০ / ৩৮৪০×২১৬০)। */}
    <Composition
      id="ThumbnailPortrait"
      component={HadisThumbnail}
      schema={hadisVideoSchema}
      defaultProps={hadisPortraitDefaults}
      calculateMetadata={forceThumbnail("portrait")}
      durationInFrames={THUMBNAIL_DURATION_FRAMES}
      fps={FPS}
      width={BASE_SIZES.portrait.width}
      height={BASE_SIZES.portrait.height}
    />
    <Composition
      id="ThumbnailLandscape"
      component={HadisThumbnail}
      schema={hadisVideoSchema}
      defaultProps={hadisLandscapeDefaults}
      calculateMetadata={forceThumbnail("landscape")}
      durationInFrames={THUMBNAIL_DURATION_FRAMES}
      fps={FPS}
      width={BASE_SIZES.landscape.width}
      height={BASE_SIZES.landscape.height}
    />
    {/* Part 3: থিম যাচাইয়ের ছবি (dev টুল) */}
    <Composition
      id="ThemePreview"
      component={ThemePreview}
      durationInFrames={60}
      fps={FPS}
      width={BASE_SIZES.portrait.width}
      height={BASE_SIZES.portrait.height}
    />
    {/* Part 6: ব্যাকগ্রাউন্ড ও লেআউট যাচাইয়ের ছবি (dev টুল) */}
    <Composition
      id="BackgroundPreview"
      component={BackgroundPreview}
      durationInFrames={120}
      fps={FPS}
      width={BASE_SIZES.portrait.width}
      height={BASE_SIZES.portrait.height}
    />
    {/* Part 7: লোগো ও হেডার যাচাইয়ের ছবি (dev টুল) */}
    <Composition
      id="HeaderPreview"
      component={HeaderPreview}
      durationInFrames={120}
      fps={FPS}
      width={BASE_SIZES.portrait.width}
      height={HEADER_PREVIEW_HEIGHT}
    />
    {/* Part 8: Intro সিনের যাচাইয়ের ছবি (dev টুল) */}
    <Composition
      id="IntroPreview"
      component={IntroPreview}
      durationInFrames={90}
      fps={FPS}
      width={BASE_SIZES.portrait.width}
      height={INTRO_PREVIEW_HEIGHT}
    />
    {/* Part 9A: SVG sanitize যাচাইয়ের ছবি (dev টুল) */}
    <Composition
      id="SvgSanitizeCheck"
      component={SvgSanitizeCheck}
      durationInFrames={60}
      fps={FPS}
      width={BASE_SIZES.portrait.width}
      height={SVG_SANITIZE_CHECK_HEIGHT}
    />
    {/* Part 9G: SVG picker যাচাইয়ের ছবি (dev টুল) */}
    <Composition
      id="SvgPickerCheck"
      component={SvgPickerCheck}
      durationInFrames={60}
      fps={FPS}
      width={BASE_SIZES.portrait.width}
      height={SVG_PICKER_CHECK_HEIGHT}
    />
    {/* Part 9I-5: SVG inventory (ফোল্ডার-স্ক্যান) যাচাইয়ের ছবি (dev টুল; 9J-তে FallbackSvg অংশ যোগ হবে) */}
    <Composition
      id="SvgInventoryCheck"
      component={SvgInventoryCheck}
      durationInFrames={60}
      fps={FPS}
      width={BASE_SIZES.portrait.width}
      height={SVG_INVENTORY_CHECK_HEIGHT}
    />
    {/* Part 9K-4: SVG স্টেজ (SvgStage) যাচাইয়ের ছবি (dev টুল; 9K-5-এ খালি ফোল্ডার + ৪ সাইজ, 9L-এ cross-fade ঘর যোগ হয়েছে — উচ্চতা ধ্রুবক থেকেই আসে)।
        নমুনা-JSON (hadis0000, hadis0000gap, hadis0000same) না থাকলে calculateMetadata `[HADIS_DATA]` এরর দেয় → check.mjs কম্পোজিশনটা ⚠️ বাদ দেয়, রান সবুজ থাকে। */}
    <Composition
      id="SvgStagePreview"
      component={SvgStagePreview}
      calculateMetadata={async () => {
        await ensureStagePreviewData();
        return { durationInFrames: 60 };
      }}
      durationInFrames={60}
      fps={FPS}
      width={BASE_SIZES.portrait.width}
      height={SVG_STAGE_PREVIEW_HEIGHT}
    />
    {/* Part 10: রঙিন ক্যাপশন (Caption) যাচাইয়ের ছবি (dev টুল) — নমুনা-ফাইল লাগে না (সেগমেন্ট কোডের ভেতরেই লেখা) */}
    <Composition
      id="CaptionPreview"
      component={CaptionPreview}
      durationInFrames={60}
      fps={FPS}
      width={BASE_SIZES.portrait.width}
      height={CAPTION_PREVIEW_HEIGHT}
    />
    {/* Part 11: অডিও-পরিকল্পনার (ভয়েস-ফেড + SFX-কিউ) যাচাইয়ের ছবি (dev টুল) — নমুনা-ফাইল লাগে না (৩ দৃশ্য কোডের ভেতরেই লেখা) */}
    <Composition
      id="AudioPreview"
      component={AudioPreview}
      durationInFrames={60}
      fps={FPS}
      width={BASE_SIZES.portrait.width}
      height={AUDIO_PREVIEW_HEIGHT}
    />
    {/* Part 11: আসল HadisAudio + SfxPlayer মাউন্ট-যাচাই (dev টুল) — নমুনা hadis0000 দিয়ে; ফাইল না থাকলে ⚠️ বাদ, রান সবুজ */}
    <Composition
      id="AudioSmoke"
      component={AudioSmoke}
      schema={hadisVideoSchema}
      defaultProps={{ ...defaultHadisProps, hadisId: "0000" }}
      calculateMetadata={calculateHadisMetadata}
      durationInFrames={90}
      fps={FPS}
      width={BASE_SIZES.portrait.width}
      height={BASE_SIZES.portrait.height}
    />
    {/* Part 12E: Outro সিন (লোগো + নাম + টাইপরাইটার + Play ব্যাজ) যাচাইয়ের ছবি (dev টুল) — নমুনা-ফাইল লাগে না; ঘর ও উচ্চতা কোডের ভেতরেই */}
    <Composition
      id="OutroPreview"
      component={OutroPreview}
      durationInFrames={60}
      fps={FPS}
      width={BASE_SIZES.portrait.width}
      height={OUTRO_PREVIEW_HEIGHT}
    />
    {/* Part 13A: Main সিন (Header + SvgStage + Caption) যাচাইয়ের ছবি (dev টুল) — নমুনা hadis0000 দিয়ে; JSON না থাকলে calculateMetadata `[HADIS_DATA]` এরর দেয় → check.mjs ⚠️ বাদ দেয়, রান সবুজ থাকে */}
    <Composition
      id="MainSceneCheck"
      component={MainSceneCheck}
      calculateMetadata={async () => {
        await ensureMainSceneCheckData();
        return { durationInFrames: 60 };
      }}
      durationInFrames={60}
      fps={FPS}
      width={BASE_SIZES.portrait.width}
      height={MAIN_SCENE_CHECK_HEIGHT}
    />
    {/* Part 13C: পুরো ভিডিও (HadisVideoView = HadisVideo-র আঁকা) যাচাইয়ের ছবি (dev টুল) — নমুনা hadis0000 + hadis0000gap দিয়ে; JSON না থাকলে calculateMetadata `[HADIS_DATA]` এরর দেয় → check.mjs ⚠️ বাদ দেয়, রান সবুজ থাকে */}
    <Composition
      id="HadisVideoPreview"
      component={HadisVideoPreview}
      calculateMetadata={async () => {
        await ensureVideoPreviewData();
        return { durationInFrames: 60 };
      }}
      durationInFrames={60}
      fps={FPS}
      width={BASE_SIZES.portrait.width}
      height={HADIS_VIDEO_PREVIEW_HEIGHT}
    />
    {/* Part 9C: SVG frame-sync যাচাইয়ের ছবি (dev টুল) */}
    <Composition
      id="SvgSyncPreview"
      component={SvgSyncPreview}
      durationInFrames={90}
      fps={FPS}
      width={BASE_SIZES.portrait.width}
      height={SVG_SYNC_PREVIEW_HEIGHT}
    />
    {/* Part 9E: SVG লোড যাচাইয়ের ছবি (dev টুল; 9F-এ আসল আঁকা যোগ হবে) */}
    <Composition
      id="AnimatedSvgPreview"
      component={AnimatedSvgPreview}
      durationInFrames={60}
      fps={FPS}
      width={BASE_SIZES.portrait.width}
      height={ANIMATED_SVG_PREVIEW_HEIGHT}
    />
    {/* Part 5: ডেটা লোডার যাচাই (dev টুল) — নমুনা hadis0000 দিয়ে */}
    <Composition
      id="DataCheck"
      component={DataCheck}
      schema={hadisVideoSchema}
      defaultProps={{ ...defaultHadisProps, hadisId: "0000" }}
      calculateMetadata={calculateHadisMetadata}
      durationInFrames={90}
      fps={FPS}
      width={BASE_SIZES.portrait.width}
      height={BASE_SIZES.portrait.height}
    />
    </>
  );
};
