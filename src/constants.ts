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

// ---------- রেন্ডার মান (YouTube/Shorts-এ কম কম্প্রেশন-ক্ষতি) ----------
/** H.264 + CRF ~18 + AAC 192k + 30 fps (`scripts/render.mjs` ও `scripts/lib/renderPlan.mjs`-এর `DEFAULT_CRF = 18` এই মানই ধরে; fps = `FPS`) */
export const VIDEO_CODEC = "h264";
export const VIDEO_CRF = 18;
export const AUDIO_CODEC = "aac";
export const AUDIO_BITRATE = "192k";

// ---------- নিচের প্রোগ্রেস বার ----------
/** পুরো ভিডিও জুড়ে নিচে প্রোগ্রেস বার (দর্শককে শেষ পর্যন্ত দেখতে উৎসাহ দেয়)। বন্ধ করতে `false` */
export const PROGRESS_BAR_ENABLED = true;
/** বারের উচ্চতা ও পাশের মার্জিন (১০৮০-বেস unit; 4K-তে আপনা-আপনি ×২) */
export const PROGRESS_BAR_HEIGHT = 12;
export const PROGRESS_BAR_SIDE_MARGIN = 60;
/** নিচের কিনারা থেকে দূরত্ব (unit): Portrait-এ শর্টসের নিরাপদ এলাকায়, Landscape-এ নিচের মার্জিনে */
export const PROGRESS_BAR_BOTTOM = { portrait: 64, landscape: 22 } as const;

// ---------- টেক্সট ----------
export const APP_NAME = "ইসলামী বিশ্বকোষ ও আল হাদিস S2";
export const TAGLINE = "আজকের হাদিস";
export const OUTRO_TEXT = "আজই প্লে স্টোর থেকে ইনস্টল করুন:";
/** "সহীহ বুখারী হাদিস নং : ১২৩" এর "হাদিস নং :" অংশ ("নং" = নম্বর-এর সংক্ষেপ; হাদিসের ক্রম বোঝাতে এটাই মানানসই) */
export const NUMBER_LABEL = "হাদিস নং :";
/** সিরিজ ব্যাজ: "পর্ব ১২" (থাম্বনেইলে; workflow-এর `series` ইনপুট) */
export const SERIES_LABEL = "পর্ব";

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

// ---------- Intro / Outro ভয়েস (Part 14C-audio) ----------
/**
 * Intro ও Outro-তে শুধু এই দুটো অডিও বাজে (ক্যাপশন নেই — ক্যাপশন শুধু Main-এ)।
 * ফাইল: `public/audio/intro.wav`, `public/audio/outro.wav` — না থাকলে ক্র্যাশ নয়, আগের মতো (SFX সহ) চলে।
 * ফাইল থাকলে Intro/Outro-র নিজস্ব SFX (whoosh/chime) বন্ধ থাকে, যেন ভয়েসের উপর না চাপে।
 */
export const AUDIO_DIR = "audio";
export const INTRO_AUDIO_PATH = `${AUDIO_DIR}/intro.wav`;
export const OUTRO_AUDIO_PATH = `${AUDIO_DIR}/outro.wav`;
/** বন্ধ করতে `false` — তখন আগের আচরণ (সেকেন্ড/SFX অপরিবর্তিত) */
export const INTRO_OUTRO_AUDIO_ENABLED = true;
export const INTRO_OUTRO_AUDIO_VOLUME = 1;
/** অডিওর শেষে ছোট ফেড-আউট (ফ্রেম) — দৃশ্য অডিওর চেয়ে ছোট হলে "ক্লিক" শোনা যায় না */
export const INTRO_OUTRO_AUDIO_FADE_OUT_FRAMES = 6;
/** দৃশ্যের দৈর্ঘ্য কমপক্ষে (অডিও + এই বাড়তি সেকেন্ড) — অডিও কেটে যায় না */
export const INTRO_OUTRO_AUDIO_TAIL_SECONDS = 0.1;

// ---------- Hook (Intro-র আগের প্রশ্ন-দৃশ্য) ----------
/**
 * ভিডিওর একদম শুরুতে Hook: বড় লেখা (`HOOK_TEXT`) + `public/audio/hook.wav`-এর ভয়েস।
 * ক্রম: [ Hook ][ Intro ][ Main ][ Outro ]
 * Hook-এর দৈর্ঘ্য = hook.wav-এর দৈর্ঘ্য (+ `HOOK_AUDIO_TAIL_SECONDS`) — আলাদা সেকেন্ড দিতে হয় না, workflow বদলাতে হয় না।
 * `public/audio/hook.wav` না থাকলে Hook দৃশ্যই বসে না (ভিডিও আগের মতো Intro দিয়ে শুরু)। বন্ধ করতে `HOOK_ENABLED = false`।
 */
export const HOOK_TEXT = "এই হাদিসের ব্যাপারে কি আপনার জানা আছে?";
export const HOOK_AUDIO_PATH = `${AUDIO_DIR}/hook.wav`;
export const HOOK_ENABLED = true;
export const HOOK_AUDIO_VOLUME = 1;
/** অডিওর শেষে ছোট ফেড-আউট (ফ্রেম) */
export const HOOK_AUDIO_FADE_OUT_FRAMES = 6;
/** Hook দৃশ্য = অডিও + এই বাড়তি সেকেন্ড (শেষ শব্দ কেটে যায় না; ফেড-আউটের জায়গা) */
export const HOOK_AUDIO_TAIL_SECONDS = 0.12;
/**
 * ভিজ্যুয়াল হুক: Hook দৃশ্যের প্রথম ফ্রেম থেকেই বিষয়ের সাথে মেলে এমন SVG এনিমেশন (লেখার সাথে)।
 * SVG বাছাই: JSON-এর `"hookSvg"` → টিজারের সেগমেন্টের SVG → প্রথম সেগমেন্টের SVG → (কিছু না থাকলে) fallback আইকন। বন্ধ করতে `false`
 */
export const HOOK_VISUAL_ENABLED = true;

// ---------- অডিও টিজার / cold open (Hook-এর পরে) ----------
/**
 * হাদিসের সবচেয়ে শক্তিশালী বাক্যাংশ আগে একবার বাজে (বড় লেখায় শব্দ-ধরে হাইলাইট), তারপর Intro → হাদিস শুরু থেকে।
 * ক্রম: [ Hook ][ Teaser ][ Intro ][ Main ][ Outro ]
 * "সিলেক্ট" = হাদিসের timestamp JSON-এ `"teaser": { "start": 12.4, "end": 17.9 }` থাকা (সেকেন্ড, .wav-এর শুরু থেকে)।
 * `teaser` না থাকলে টিজার নেই (আগের মতো)। বন্ধ করতে `TEASER_ENABLED = false`। workflow বদলাতে হয় না।
 */
export const TEASER_ENABLED = true;
/** এর চেয়ে ছোট অংশ বাদ (null) */
export const TEASER_MIN_SECONDS = 0.5;
/** এর চেয়ে লম্বা অংশ `start + এই সেকেন্ডে` ছাঁটা */
export const TEASER_MAX_SECONDS = 12;
/** দৃশ্য = অংশ + এই বাড়তি সেকেন্ড (শেষ শব্দ কেটে যায় না) */
export const TEASER_TAIL_SECONDS = 0.15;
/** অংশের শুরু ও শেষে ফেড (ফ্রেম) — বাক্যের মাঝখান কাটলে "ক্লিক" শোনা যায় না */
export const TEASER_AUDIO_FADE_FRAMES = 4;
export const TEASER_AUDIO_VOLUME = 1;
