import { loadFont as loadBaloo } from "@remotion/google-fonts/BalooDa2";
import { loadFont as loadHind } from "@remotion/google-fonts/HindSiliguri";

/**
 * Part 3: বাংলা ফন্ট।
 *  - শিরোনাম/ব্যাজ → Baloo Da 2 (৬০০–৮০০)
 *  - ক্যাপশন/ছোট লেখা → Hind Siliguri (৪০০–৭০০)
 * শুধু bengali ও latin অংশ নামে (দ্রুত রেন্ডার)।
 * Remotion-এর loadFont() নিজেই delayRender করে, তাই ফন্ট লোড শেষ না হওয়া পর্যন্ত ফ্রেম রেন্ডার হয় না।
 */
const baloo = loadBaloo("normal", {
  weights: ["600", "700", "800"],
  subsets: ["bengali", "latin"],
});

const hind = loadHind("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["bengali", "latin"],
});

export const FONT_DISPLAY = `${baloo.fontFamily}, sans-serif`;
export const FONT_BODY = `${hind.fontFamily}, sans-serif`;
