import { z } from "zod";
import {
  DEFAULT_INTRO_SECONDS,
  DEFAULT_OUTRO_SECONDS,
  MAX_INTRO_OUTRO_SECONDS,
  ORIENTATIONS,
  THEME_IDS,
} from "./constants";

/**
 * Part 2: কিটের "চুক্তি"।
 * - HadisVideoProps  → GitHub Actions / render স্ক্রিপ্ট থেকে আসা ইনপুট
 * - TimestampFile    → AI-এর বানানো hadisXXXX_timestamp.json
 */

// ---------- ইনপুট প্রপস ----------

export const themeIdSchema = z.enum(THEME_IDS);
export type ThemeId = z.infer<typeof themeIdSchema>;

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
  orientation: orientationSchema,
  introSeconds: z.number().min(0).max(MAX_INTRO_OUTRO_SECONDS),
  outroSeconds: z.number().min(0).max(MAX_INTRO_OUTRO_SECONDS),
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

export const timestampFileSchema = z
  .object({
    language: z.string().optional(),
    segments: z.array(segmentSchema).min(1, "কমপক্ষে একটা segment দরকার"),
  })
  .superRefine((file, ctx) => {
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
