/**
 * Part 2: কিটের সব স্থির মান (constants) এক জায়গায়।
 * কোনো কম্পোনেন্টে সরাসরি "magic number" বা হার্ডকোড টেক্সট না লিখে এখান থেকে নেবে।
 */

// ---------- ভিডিও ----------
export const FPS = 30;

export const THEME_IDS = ["emerald", "navy", "greenDayNight"] as const;
export const ORIENTATIONS = ["portrait", "landscape"] as const;
export const QUALITIES = ["hd", "4k"] as const;

/** বেস (HD) সাইজ। 4K-তে Remotion-এর scale=2 ব্যবহার হবে। */
export const BASE_SIZES = {
  portrait: { width: 1080, height: 1920 }, // 9:16
  landscape: { width: 1920, height: 1080 }, // 16:9
} as const;

export const QUALITY_SCALE = { hd: 1, "4k": 2 } as const;

/** ফাইল নামে ব্যবহারের লেবেল: hadis0101_9x16_HD.mp4 */
export const ORIENTATION_LABEL = { portrait: "9x16", landscape: "16x9" } as const;
export const QUALITY_LABEL = { hd: "HD", "4k": "4K" } as const;

// ---------- সময় (সেকেন্ড) ----------
export const DEFAULT_INTRO_SECONDS = 3;
export const DEFAULT_OUTRO_SECONDS = 4;
export const MAX_INTRO_OUTRO_SECONDS = 15;
/** সিনগুলোর মাঝের ক্রস-ফেড (ফ্রেম) */
export const TRANSITION_FRAMES = 12;

// ---------- টেক্সট ----------
export const APP_NAME = "ইসলামী বিশ্বকোষ ও আল হাদিস S2";
export const TAGLINE = "আজকের হাদিস";
export const OUTRO_TEXT = "আজই প্লে স্টোর থেকে ইনস্টল করুন:";
/** "সহীহ বুখারী নং : ১২৩" এর "নং :" অংশ */
export const NUMBER_LABEL = "নং :";

// ---------- public/ ফোল্ডারের পাথ (staticFile() এর সাথে ব্যবহার) ----------
export const HADIS_DIR = "hadis";
export const SVG_DIR = "svg";
export const SFX_DIR = "sfx";

export const hadisAudioPath = (hadisId: string) =>
  `${HADIS_DIR}/hadis${hadisId}.wav`;

export const hadisTimestampPath = (hadisId: string) =>
  `${HADIS_DIR}/hadis${hadisId}_timestamp.json`;

export const svgPath = (svgName: string) => `${SVG_DIR}/${svgName}.svg`;

export const sfxPath = (name: string, ext: "mp3" | "wav" = "mp3") =>
  `${SFX_DIR}/${name}.${ext}`;

// ---------- SFX ডিফল্ট ----------
export const VOICE_VOLUME = 1;
export const DEFAULT_SFX_VOLUME = 0.4;

// ---------- অডিও (Part 11) ----------
/** Main-এর শেষে ভয়েসের ফেড-আউট (ফ্রেম; ০ = ফেড বন্ধ)। Main খুব ছোট হলে `audioPlan.ts` নিজে ছোট করে। */
export const VOICE_FADE_OUT_FRAMES = 10;
/** প্রতিটা SFX-এর শেষে ছোট ফেড (ফ্রেম) — লম্বা ফাইল ছাঁটলে "ক্লিক" শোনা যায় না */
export const SFX_FADE_OUT_FRAMES = 6;
/** এক SFX সর্বোচ্চ কতক্ষণ বাজবে (সেকেন্ড) — এর বেশি লম্বা ফাইল ছাঁটা হয় */
export const SFX_MAX_SECONDS = 4;
/** Main → Outro বদলের SFX (ফাইল না থাকলে চুপচাপ বাদ); বন্ধ করতে `OUTRO_SFX_ENABLED = false` */
export const OUTRO_SFX_NAME = "whoosh";
export const OUTRO_SFX_ENABLED = true;
