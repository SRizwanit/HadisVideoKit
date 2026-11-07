import { mixColors } from "../themes";

/**
 * Part 6: greenDayNight আকাশের হিসাব (শুধু গণিত, রেন্ডার নয় — তাই আলাদা টেস্ট করা যায়)।
 * nightFactor (nf): ০ = সকাল, ~০.৫ = গোধূলি, ১ = গভীর রাত।
 */

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smoothstep = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// সূর্য-চাঁদ একই উপবৃত্তাকার চাপ বরাবর চলে (বাঁ থেকে ডানে)
const ARC = { cx: 0.5, cy: 0.7, rx: 0.42, ry: 0.5 };
const toRad = (deg: number) => (deg * Math.PI) / 180;

function arcPoint(angleDeg: number, w: number, h: number) {
  const a = toRad(angleDeg);
  return {
    x: (ARC.cx + ARC.rx * Math.cos(a)) * w,
    y: (ARC.cy - ARC.ry * Math.sin(a)) * h,
  };
}

/** সূর্য: ওপরে-বাঁয়ে (সকাল) থেকে নামতে নামতে ডানের দিগন্তে */
export function sunPosition(nf: number, w: number, h: number) {
  const t = clamp01(nf / 0.6);
  return arcPoint(lerp(140, 8, t), w, h);
}
/** সূর্যের দৃশ্যমানতা: ০.৪৫ থেকে ফিকে হয়ে ০.৭ এ অদৃশ্য */
export const sunOpacity = (nf: number) => 1 - smoothstep((nf - 0.45) / 0.25);

/** চাঁদ: বাঁ দিগন্ত থেকে উঠে ডানে-ওপরে */
export function moonPosition(nf: number, w: number, h: number) {
  const t = clamp01((nf - 0.35) / 0.65);
  return arcPoint(lerp(170, 60, smoothstep(t)), w, h);
}
export const moonOpacity = (nf: number) => smoothstep((nf - 0.4) / 0.3);

/** তারা ফোটা: ০.৪৫ থেকে শুরু, ০.৮৫ এ পূর্ণ */
export const starFactor = (nf: number) => smoothstep((nf - 0.45) / 0.4);

/** মেঘ: দিনে স্পষ্ট, রাতে প্রায় অদৃশ্য */
export const cloudOpacity = (nf: number) => 0.6 * (1 - smoothstep((nf - 0.1) / 0.5)) + 0.05 * nf;

/** জোনাকির সামগ্রিক উজ্জ্বলতা: Intro ≈ ০.০৬ (ক্ষীণ) → Main-এ ক্রমে → Outro ১ */
export const fireflyVisibility = (nf: number) => 0.06 + 0.94 * smoothstep((nf - 0.25) / 0.7);

/**
 * i-তম জোনাকি কতটা ফুটেছে (০–১)। threshold (০–১, প্রতিটার নিজস্ব) যত ছোট, তত আগে জ্বলে।
 * তাই দিনের বেলা মাত্র কয়েকটা, রাতে সবগুলো।
 */
export const fireflyAppear = (visibility: number, threshold: number) =>
  smoothstep((visibility - threshold * 0.7) / 0.3);

/** দিন → গোধূলি → রাত: তিন রঙের মিশ্রণ */
export function mix3(day: string, dusk: string, night: string, nf: number): string {
  return nf < 0.5 ? mixColors(day, dusk, nf * 2) : mixColors(dusk, night, (nf - 0.5) * 2);
}

/** টিলা (hills) এর রঙ: [পেছনের, সামনের] */
export function hillColors(nf: number): [string, string] {
  return [
    mix3("#7cc47a", "#6f7f45", "#0a3a28", nf),
    mix3("#5fae62", "#4c6a3a", "#062a1c", nf),
  ];
}
