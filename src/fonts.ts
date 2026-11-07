import { loadFont as loadAnek } from "@remotion/google-fonts/AnekBangla";
import { loadFont as loadNoto } from "@remotion/google-fonts/NotoSansBengali";

/**
 * Part 3 (ফন্ট বদল — v2.52): বাংলা ফন্ট।
 *  - শিরোনাম/ব্যাজ/অ্যাপের নাম/রিবন/Outro CTA → Anek Bangla (৬০০–৮০০)  = FONT_DISPLAY
 *  - ক্যাপশন/কিতাবের নাম ও নম্বর/ছোট লেখা   → Noto Sans Bengali (৪০০–৭০০) = FONT_BODY
 * কেন বদল: আগের Baloo Da 2-তে ভিডিওর রেন্ডারে "ইসলামী"-র "মী" অংশে ঈ-কার (ী) ম-এর উপর চেপে ভেঙে দেখাচ্ছিল।
 * শুধু bengali ও latin অংশ নামে (দ্রুত রেন্ডার) — latin লাগে "S2"-এর জন্য।
 * Remotion-এর loadFont() নিজেই delayRender করে, তাই ফন্ট লোড শেষ না হওয়া পর্যন্ত ফ্রেম রেন্ডার হয় না।
 * ⚠️ এক্সপোর্ট নাম (FONT_DISPLAY / FONT_BODY) আগের মতোই — তাই অন্য কোনো ফাইল বদলাতে হয়নি।
 */
const anek = loadAnek("normal", {
  weights: ["600", "700", "800"],
  subsets: ["bengali", "latin"],
});

const noto = loadNoto("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["bengali", "latin"],
});

export const FONT_DISPLAY = `${anek.fontFamily}, "Noto Sans Bengali", sans-serif`;
export const FONT_BODY = `${noto.fontFamily}, "Anek Bangla", sans-serif`;
