import { NUMBER_LABEL } from "../constants";
import { cleanText, toBnDigits } from "./bnDigits";

/**
 * Part 4: workflow ইনপুট → ভিডিওতে দেখানোর টেক্সট।
 * Intro ও Header দুই জায়গাতেই একই ফরম্যাট (buildHadisLabel) ব্যবহার হবে।
 */

/** কিতাবের নাম: শুধু পরিষ্কার করা (যেকোনো বাংলা টেক্সট চলবে) */
export const normalizeBookname = (bookname: string | null | undefined): string =>
  cleanText(bookname);

/** হাদিস নম্বর: পরিষ্কার + সব সংখ্যা বাংলায়। "  45 " → "৪৫", "12-13" → "১২-১৩" */
export const normalizeHadisNumber = (number: string | number | null | undefined): string =>
  toBnDigits(cleanText(number === null || number === undefined ? "" : String(number)));

/**
 * "সহীহ বুখারী হাদিস নং : ১২৩"
 * - দুটোই থাকলে পুরো লেবেল
 * - শুধু নম্বর থাকলে "হাদিস নং : ১২৩"
 * - শুধু কিতাব থাকলে "সহীহ বুখারী"
 * - দুটোই ফাঁকা হলে ""
 */
export function buildHadisLabel(
  bookname: string | null | undefined,
  number: string | number | null | undefined,
): string {
  const book = normalizeBookname(bookname);
  const num = normalizeHadisNumber(number);
  if (book && num) return `${book} ${NUMBER_LABEL} ${num}`;
  if (num) return `${NUMBER_LABEL} ${num}`;
  return book;
}
