import { z } from "zod";
import {
  DEFAULT_INTRO_SECONDS,
  DEFAULT_OUTRO_SECONDS,
  MAX_INTRO_OUTRO_SECONDS,
  ORIENTATIONS,
  THEME_IDS,
  TIME_MODES,
} from "./constants";

/**
 * Part 2: কিটের "চুক্তি"।
 * - HadisVideoProps  → GitHub Actions / render স্ক্রিপ্ট থেকে আসা ইনপুট
 * - TimestampFile    → AI-এর বানানো hadisXXXX_timestamp.json
 */

// ---------- ইনপুট প্রপস ----------

export const themeIdSchema = z.enum(THEME_IDS);
export type ThemeId = z.infer<typeof themeIdSchema>;

/** সময়ের মোড: day / night / dayToNight / nightToDay (`constants.ts`-এর `TIME_MODES`) */
export const timeModeSchema = z.enum(TIME_MODES);

export const orientationSchema = z.enum(ORIENTATIONS);
export type Orientation = z.infer<typeof orientationSchema>;

/** ফাইলের কী: শুধু ইংরেজি অক্ষর, সংখ্যা, - ও _ (পাথ-ইনজেকশন থেকে নিরাপদ) */
const fileKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/, "শুধু ইংরেজি অক্ষর, সংখ্যা, - ও _ ব্যবহার করা যাবে");

export const hadisVideoSchema = z.object({
  /** ফাইল খোঁজার কী। "0101" → hadis0101.wav */
  hadisId: fileKeySchema,
  /** ভিডিওতে দেখানো কিতাবের নাম */
  hadisBookname: z.string(),
  /** ভিডিওতে দেখানো হাদিস নম্বর (বাংলা বা ইংরেজি সংখ্যা; Part 4 বাংলায় রূপান্তর করবে) */
  hadisNumber: z.string(),
  theme: themeIdSchema,
  /**
   * দিন-রাতের মোড (workflow-এর `time_mode`)। না দিলে = `dayToNight` (আগের আচরণ)। শুধু দিন-রাতের থিমে
   * (greenDayNight, monsoon, winter, spring) প্রভাব ফেলে; emerald/navy স্থির।
   */
  timeMode: timeModeSchema.optional(),
  orientation: orientationSchema,
  introSeconds: z.number().min(0).max(MAX_INTRO_OUTRO_SECONDS),
  outroSeconds: z.number().min(0).max(MAX_INTRO_OUTRO_SECONDS),
  /**
   * Hook দৃশ্যের সেকেন্ড। workflow-এর `hook_seconds` ফাঁকা (বা Studio-তে না দিলে) = অটো: `calculateMetadata`
   * hook.wav-এর দৈর্ঘ্য থেকে বসায় (wav না থাকলে Hook নেই)। সংখ্যা দিলে = অন্তত ততটা সেকেন্ড (hook.wav লম্বা হলে wav-ই জেতে —
   * অডিও কাটে না; wav না থাকলে শব্দহীন Hook ততটা সেকেন্ড)। ০ = Hook বন্ধ। ফল `props`-এ ফেরত যায়, যাতে কম্পোনেন্টের
   * `timingFromConfig` ঠিক একই সংখ্যা পায়।
   */
  hookSeconds: z.number().min(0).max(MAX_INTRO_OUTRO_SECONDS).optional(),
  /** Hook-এর বড় লেখা। workflow-এর `hook_text` ফাঁকা (বা না দিলে) = `constants.ts`-এর `HOOK_TEXT` */
  hookText: z.string().optional(),
  /** false = অডিও টিজার (cold open) বন্ধ। না দিলে/true = JSON-এ `teaser` থাকলে চলবে (workflow-এর `teaser` টিক) */
  teaserEnabled: z.boolean().optional(),
  /**
   * অডিও টিজার (cold open): দৃশ্যের সেকেন্ড + হাদিস-.wav-এর কোন অংশ বাজবে (সেকেন্ড) — ব্যবহারকারী দেয় না;
   * `calculateMetadata` timestamp JSON-এর `teaser` থেকে বসায় (না থাকলে/০ = টিজার নেই)।
   */
  teaserSeconds: z.number().min(0).max(MAX_INTRO_OUTRO_SECONDS).optional(),
  teaserStartSeconds: z.number().min(0).optional(),
  teaserEndSeconds: z.number().min(0).optional(),
  /** থাম্বনেইলের সিরিজ ব্যাজ: "১২" → "পর্ব ১২" (ফাঁকা/না দিলে ব্যাজ নেই)। ভিডিওতে কিছু বদলায় না — শুধু থাম্বনেইল (`ThumbnailScene`) */
  seriesNumber: z.string().optional(),
  /** থাম্বনেইলের ব্যাকগ্রাউন্ডের দিন-রাত (০ = দিন, ১ = রাত)। ফাঁকা/না দিলে `timeMode` বা থিমের ডিফল্ট (`THUMBNAIL_NIGHT_BY_THEME`)। শুধু দিন-রাতের থিমে (greenDayNight, monsoon, winter, spring) প্রভাব ফেলে */
  thumbnailNight: z.number().min(0).max(1).optional(),
});

export type HadisVideoProps = z.infer<typeof hadisVideoSchema>;

/** Studio-তে দেখা ও টেস্টের ডিফল্ট মান */
export const defaultHadisProps: HadisVideoProps = {
  hadisId: "0101",
  hadisBookname: "সহীহ বুখারী",
  hadisNumber: "১",
  theme: "emerald",
  orientation: "portrait",
  introSeconds: DEFAULT_INTRO_SECONDS,
  outroSeconds: DEFAULT_OUTRO_SECONDS,
};

// ---------- Timestamp JSON ----------

const sfxNameSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/, "SFX নাম: শুধু ইংরেজি অক্ষর, সংখ্যা, - ও _");

export const sfxCueSchema = z.object({
  /** public/sfx/<name>.mp3 (না থাকলে .wav) */
  name: sfxNameSchema,
  /** ০ থেকে ১ */
  volume: z.number().min(0).max(1).optional(),
});
export type SfxCue = z.infer<typeof sfxCueSchema>;

export const wordTimingSchema = z
  .object({
    word: z.string().min(1),
    start: z.number().min(0),
    end: z.number().min(0),
  })
  .refine((w) => w.end >= w.start, {
    message: "শব্দের end অবশ্যই start-এর সমান বা বড় হতে হবে",
  });
export type WordTiming = z.infer<typeof wordTimingSchema>;

export const segmentSchema = z
  .object({
    id: z.number().int().optional(),
    /** সেকেন্ড, .wav-এর শুরু থেকে মাপা */
    start: z.number().min(0),
    end: z.number().min(0),
    text: z.string().min(1),
    words: z.array(wordTimingSchema).optional(),
    /** "svg1", "svg2" ... (public/svg/svg1.svg) */
    svg: z
      .string()
      .regex(/^svg\d+$/, 'svg নাম হতে হবে "svg1", "svg2" ... এই ধাঁচের')
      .optional(),
    sfx: sfxCueSchema.optional(),
  })
  .refine((s) => s.end > s.start, {
    message: "segment-এর end অবশ্যই start-এর চেয়ে বড় হতে হবে",
  });
export type Segment = z.infer<typeof segmentSchema>;

/** অডিও টিজার (ঐচ্ছিক): হাদিসের সবচেয়ে শক্তিশালী বাক্যাংশ — সেকেন্ড, .wav-এর শুরু থেকে (segment-এর সময়ের মতোই) */
export const teaserSchema = z
  .object({
    start: z.number().min(0),
    end: z.number().min(0),
    /** ঐচ্ছিক: শুধু fallback — কোনো `words`/segment-এর সাথে না মিললে এই লেখা সমান ভাগে দেখানো হয় */
    text: z.string().min(1).optional(),
  })
  .refine((t) => t.end > t.start, { message: "teaser-এর end অবশ্যই start-এর চেয়ে বড় হতে হবে" });
export type Teaser = z.infer<typeof teaserSchema>;

/**
 * ইনফোগ্রাফিক (ঐচ্ছিক): হাদিসের মূল পাঠ থেকে নেওয়া **ছোট ছোট পয়েন্ট** (পিল/চিপ), SVG-র ঠিক নিচের স্ট্রিপে (`infoBox`) নির্দিষ্ট সময়ে ফোটে।
 *  - steps   → পিল → পিল (মাঝে তীর), যেমন "নিয়ত → ফল"
 *  - list    → পাশাপাশি পিল (মাঝে ছোট ফোঁটা), যেমন "দুনিয়া · নারী"
 *  - compare → দুই পাশ: বাঁ-পিল | ডান-পিল (মাঝে ছোট বিভাজক); `side` না দিলে একটা বাঁয়ে একটা ডানে
 * প্রতিটা পয়েন্ট ১–৩ শব্দের ছোট লেখা; ২–৩টা পয়েন্ট (এক সারিতে বসে, তাই বড় বাক্য নয়)।
 * `start`/`end` সেকেন্ড, .wav-এর শুরু থেকে (segment-এর সময়ের মতোই)।
 */
export const INFOGRAPHIC_TYPES = ["steps", "list", "compare"] as const;
export const infographicTypeSchema = z.enum(INFOGRAPHIC_TYPES);
export type InfographicType = z.infer<typeof infographicTypeSchema>;

export const infographicItemSchema = z.object({
  /** ছোট পয়েন্ট (হাদিসের মূল পাঠ থেকে; ১–৩ শব্দ, ১২ অক্ষরের মধ্যে রাখা ভালো; সর্বোচ্চ ২৪) */
  text: z.string().min(1).max(24),
  /** শুধু `compare`-এর জন্য: "left" বা "right" */
  side: z.enum(["left", "right"]).optional(),
  /** ঐচ্ছিক: এই item ঠিক কোন সেকেন্ডে ফুটবে (.wav-এর শুরু থেকে)। না দিলে সময় সমান ভাগে */
  at: z.number().min(0).optional(),
});
export type InfographicItem = z.infer<typeof infographicItemSchema>;

export const infographicSchema = z
  .object({
    start: z.number().min(0),
    end: z.number().min(0),
    type: infographicTypeSchema,
    /** ঐচ্ছিক, এখন ভিডিওতে আঁকা হয় না (পুরনো JSON চলার জন্য রাখা; পিল-স্ট্রিপে শিরোনামের জায়গা নেই) */
    title: z.string().min(1).max(80).optional(),
    /** ঐচ্ছিক, আঁকা হয় না (`compare`-এর পুরনো ক্ষেত্র) */
    leftTitle: z.string().min(1).max(40).optional(),
    rightTitle: z.string().min(1).max(40).optional(),
    items: z.array(infographicItemSchema).min(2, "ইনফোগ্রাফিকে কমপক্ষে ২টা পয়েন্ট দরকার").max(3, "ইনফোগ্রাফিকে সর্বোচ্চ ৩টা ছোট পয়েন্ট (এক সারিতে বসে)"),
  })
  .refine((g) => g.end > g.start, { message: "infographic-এর end অবশ্যই start-এর চেয়ে বড় হতে হবে" });
export type Infographic = z.infer<typeof infographicSchema>;

export const timestampFileSchema = z
  .object({
    language: z.string().optional(),
    /** ঐচ্ছিক: থাকলে Hook-এর পরে এই অংশ আগে বাজে (cold open) */
    teaser: teaserSchema.optional(),
    /** ঐচ্ছিক (ভিজ্যুয়াল হুক): ভিডিওর প্রথম মুহূর্তে (Hook দৃশ্যে) দেখানোর SVG — বিষয়ের সাথে মেলে এমনটা, যেমন "svg3"। না দিলে টিজারের সেগমেন্টের SVG */
    hookSvg: z
      .string()
      .regex(/^svg\d+$/, 'hookSvg নাম হতে হবে "svg1", "svg2" ... এই ধাঁচের')
      .optional(),
    /** ঐচ্ছিক: ইনফোগ্রাফিক-কার্ড (SVG-র জায়গায় নির্দিষ্ট সময়ে)। না দিলে ভিডিও আগের মতোই; সময়ের ক্রমে, একটার উপর আরেকটা নয় */
    infographics: z.array(infographicSchema).max(8, "সর্বোচ্চ ৮টা infographic").optional(),
    segments: z.array(segmentSchema).min(1, "কমপক্ষে একটা segment দরকার"),
  })
  .superRefine((file, ctx) => {
    const gs = file.infographics ?? [];
    for (let i = 1; i < gs.length; i++) {
      if (gs[i].start < gs[i - 1].end) {
        ctx.addIssue({
          code: "custom",
          path: ["infographics", i, "start"],
          message: "infographic গুলো সময়ের ক্রমে থাকতে হবে এবং একটার উপর আরেকটা চাপবে না",
        });
      }
    }
    for (let i = 1; i < file.segments.length; i++) {
      if (file.segments[i].start < file.segments[i - 1].start) {
        ctx.addIssue({
          code: "custom",
          path: ["segments", i, "start"],
          message: "segment গুলো সময়ের ক্রমে (start বাড়ার ক্রমে) সাজানো থাকতে হবে",
        });
      }
    }
  });
export type TimestampFile = z.infer<typeof timestampFileSchema>;

/**
 * JSON যাচাই করে পরিষ্কার বাংলা/ইংরেজি এরর মেসেজসহ ফেরত দেয়।
 * @param source এররে দেখানোর জন্য ফাইলের নাম/পাথ
 */
export function parseTimestampFile(data: unknown, source = "timestamp json"): TimestampFile {
  const result = timestampFileSchema.safeParse(data);
  if (result.success) return result.data;

  const lines = result.error.issues.map((issue) => {
    const where = issue.path.length ? issue.path.join(".") : "(root)";
    return `  • ${where}: ${issue.message}`;
  });
  throw new Error(`${source} সঠিক ফরম্যাটে নেই:\n${lines.join("\n")}`);
}
