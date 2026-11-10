import type { ThemeId } from "../types";

/**
 * থিম-ভিত্তিক ক্যাপশন স্টাইল: প্রতিটা থিমের ক্যাপশন আলাদা রকম অ্যানিমেটেড ও রঙিন।
 *
 *  - wordFx      : সক্রিয় শব্দের অ্যানিমেশন (gold / neon / pill / drip / frost / bloom)
 *  - particle    : ক্যাপশন-বাক্সের ভেতরে ভাসা কণা (sparkle / star / firefly / rain / snow / petal)
 *  - ringSpeed   : বাক্সের ঘুরন্ত রঙিন বর্ডারের গতি (ডিগ্রি/ফ্রেম)
 *  - shimmer     : বাক্সের উপর দিয়ে আলোর ঝলক (প্রতি `shimmerPeriod` ফ্রেমে একবার)
 *  - entryScale  : বাক্স ওঠার সময় শুরুর স্কেল (১ = স্কেল নেই)
 *  - glowPulse   : বাক্সের বাইরের আভার স্পন্দন (unit-এ)
 *
 * সবকিছু ফ্রেম থেকে হিসাব — CSS animation / Math.random() নেই, তাই render-safe।
 */

export type WordFx = "gold" | "neon" | "pill" | "drip" | "frost" | "bloom";
export type ParticleKind = "sparkle" | "star" | "firefly" | "rain" | "snow" | "petal";

export type CaptionStyle = {
  wordFx: WordFx;
  particle: ParticleKind;
  particleCount: number;
  ringSpeed: number;
  shimmer: boolean;
  shimmerPeriod: number;
  entryScale: number;
  glowPulse: number;
};

export const CAPTION_STYLES: Record<ThemeId, CaptionStyle> = {
  // সোনালি ঝিকিমিকি: সোনার আন্ডারলাইনে আলো ছোটে, শব্দের উপর তারা ঝলমল করে
  emerald: { wordFx: "gold", particle: "sparkle", particleCount: 14, ringSpeed: 1.2, shimmer: true, shimmerPeriod: 96, entryScale: 0.96, glowPulse: 10 },
  // নিয়ন: জ্বলজ্বলে নিয়ন-গ্লো, টুইংকলিং তারা
  navy: { wordFx: "neon", particle: "star", particleCount: 24, ringSpeed: 2.2, shimmer: true, shimmerPeriod: 120, entryScale: 0.9, glowPulse: 14 },
  // সবুজ দিন-রাত: শব্দের পেছনে রঙিন পিল, জোনাকি
  greenDayNight: { wordFx: "pill", particle: "firefly", particleCount: 14, ringSpeed: 1.6, shimmer: false, shimmerPeriod: 90, entryScale: 0.94, glowPulse: 12 },
  // বর্ষা: শব্দ টুপ করে পড়ে, ঢেউ-আন্ডারলাইন, বৃষ্টির রেখা
  monsoon: { wordFx: "drip", particle: "rain", particleCount: 26, ringSpeed: 1.0, shimmer: false, shimmerPeriod: 90, entryScale: 0.98, glowPulse: 8 },
  // শীত: বরফ-ঝলক, হিমকণা, তুষারকণা ঝরে
  winter: { wordFx: "frost", particle: "snow", particleCount: 24, ringSpeed: 0.8, shimmer: true, shimmerPeriod: 110, entryScale: 0.95, glowPulse: 10 },
  // বসন্ত: মার্কার-হাইলাইট, দুলুনি, ফুল ও ঝরা পাপড়ি
  spring: { wordFx: "bloom", particle: "petal", particleCount: 12, ringSpeed: 1.4, shimmer: true, shimmerPeriod: 100, entryScale: 0.94, glowPulse: 12 },
};

export const getCaptionStyle = (theme: ThemeId): CaptionStyle => CAPTION_STYLES[theme] ?? CAPTION_STYLES.emerald;

/** নির্ধারিত (deterministic) ছদ্ম-র‍্যান্ডম: n → [0, 1) */
export const hash01 = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
