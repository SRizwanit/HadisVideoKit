/**
 * Part 4: বাংলা সংখ্যা ও টেক্সট পরিষ্কার করার হেল্পার।
 */

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** ইংরেজি (0-9), আরবি-ইন্ডিক (٠-٩), ফার্সি/উর্দু (۰-۹) সংখ্যা → বাংলা সংখ্যা। বাংলা আগে থেকে থাকলে অপরিবর্তিত। */
export function toBnDigits(input: string | number): string {
  return String(input).replace(/[0-9٠-٩۰-۹]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code >= 0x30 && code <= 0x39) return BN_DIGITS[code - 0x30];
    if (code >= 0x660 && code <= 0x669) return BN_DIGITS[code - 0x660];
    return BN_DIGITS[code - 0x6f0];
  });
}

/**
 * অদৃশ্য/বিভ্রান্তিকর অক্ষর: ZWSP, word joiner, BOM, LRM/RLM, bidi নিয়ন্ত্রণ, soft hyphen।
 * ⚠️ ZWJ (U+200D) ও ZWNJ (U+200C) এখানে নেই — বাংলা যুক্তাক্ষরের (র‍্যা, ক্ষ ইত্যাদি) জন্য এগুলো রাখতে হয়।
 */
const INVISIBLE = /[​⁠﻿‎‏‪-‮⁦-⁩­]/g;

/** স্পেসের মতো আচরণ করা অক্ষর (NBSP, ট্যাব, নতুন লাইন ইত্যাদি) */
const SPACES = /[\s  -   　]+/g;

/** অদৃশ্য অক্ষর মুছে, বাড়তি স্পেস এক স্পেসে এনে, দুই পাশ ট্রিম করে। ZWJ/ZWNJ অক্ষত। */
export function cleanText(input: string | null | undefined): string {
  return (input ?? "").replace(INVISIBLE, "").replace(SPACES, " ").trim();
}
