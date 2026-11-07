/**
 * Part 7: টেক্সট বক্সে আঁটানোর হিসাব (খাঁটি ফাংশন — আলাদাভাবে টেস্টযোগ্য)।
 *
 * ব্রাউজারে বেস সাইজে লেখাটা এক লাইনে কত চওড়া হয় (`naturalWidth`) সেটা মেপে এখানে দেওয়া হয়।
 * নিয়ম:
 *  ১. এক লাইনে আঁটলে বেস সাইজই থাকে।
 *  ২. না আঁটলে ফন্ট ছোট করা হয়, তবে `minSize`-এর নিচে নয়।
 *  ৩. `minSize`-এও এক লাইনে না আঁটলে দুই লাইনে ভাঙা হয় (ফন্ট আবার একটু বড় করা যায়)।
 *  ৪. দুই লাইনেও না আঁটলে `minSize` রেখে দুই লাইনের বেশি অংশ কেটে "…" দেখানো হয়
 *     (ক্র্যাশ বা ওভারফ্লো নয়)।
 */

export type FitInput = {
  /** বেস সাইজে এক লাইনে লেখাটার প্রস্থ (px) */
  naturalWidth: number;
  baseSize: number;
  minSize: number;
  /** বক্সের ভেতরের ব্যবহারযোগ্য প্রস্থ (px) */
  maxWidth: number;
  /** সর্বোচ্চ কত লাইন (ডিফল্ট ২) */
  maxLines?: number;
};

export type FitResult = {
  fontSize: number;
  /** true হলে একাধিক লাইনে ভাঙা হবে */
  wrap: boolean;
  /** সর্বোচ্চ কত লাইন দেখানো হবে (বেশি হলে ছাঁটা) */
  lines: number;
};

/** দুই লাইনে ভাঙলে শব্দের অসমান ভাগের জন্য একটু বাড়তি জায়গা ধরা হয় */
const WRAP_SLACK = 1.12;

export function fitFontSize({
  naturalWidth,
  baseSize,
  minSize,
  maxWidth,
  maxLines = 2,
}: FitInput): FitResult {
  const base = Math.max(1, baseSize);
  const min = Math.min(base, Math.max(1, minSize));

  // মাপ অসম্ভব হলে (০ বা NaN) বেস সাইজেই রাখি
  if (!(naturalWidth > 0) || !(maxWidth > 0)) {
    return { fontSize: base, wrap: false, lines: 1 };
  }

  // ১. বেস সাইজে এক লাইনে আঁটে
  if (naturalWidth <= maxWidth) return { fontSize: base, wrap: false, lines: 1 };

  // ২. ছোট করে এক লাইনে আঁটে
  const oneLine = (base * maxWidth) / naturalWidth;
  if (oneLine >= min) return { fontSize: oneLine, wrap: false, lines: 1 };

  // ৩. একাধিক লাইনে ভাঙা (বেস সাইজ থেকে নেমে, minSize-এর নিচে নয়)
  const lines = Math.max(2, Math.floor(maxLines));
  const multi = (base * maxWidth * lines) / (naturalWidth * WRAP_SLACK);
  const size = Math.min(base, Math.max(min, multi));
  return { fontSize: size, wrap: true, lines };
}
