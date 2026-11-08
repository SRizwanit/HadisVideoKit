import { useVideoConfig } from "remotion";

/**
 * Part 6: রেসপনসিভ লেআউট।
 * সব মাপ ভিডিওর width/height-এর অনুপাতে হিসাব হয়, তাই 4K (render scale=2)-তেও ডিজাইন একই থাকে।
 * Part 7 (Header), 9 (SVG), 10 (Caption) এই বক্সগুলোই ব্যবহার করবে।
 */

export type Box = { x: number; y: number; width: number; height: number };
export type SquareBox = { x: number; y: number; size: number };

export type Layout = {
  isPortrait: boolean;
  width: number;
  height: number;
  /** ১০৮০ পিক্সেল (ছোট দিক) ধরে স্কেল-ফ্যাক্টর। বেস HD-তে সবসময় ১ */
  unit: number;
  /** শর্টস/রিলসে UI ঢাকা না পড়ার নিরাপদ মার্জিন */
  safe: { top: number; bottom: number; left: number; right: number };
  padding: number;
  headerBox: Box;
  headerHeight: number;
  svgBox: SquareBox;
  captionBox: Box;
  /**
   * ইনফোগ্রাফিক-কার্ডের বক্স (সবসময় চূড়ান্ত জায়গায়; কার্ড না থাকলে আঁকাই হয় না)।
   * Portrait: ছোট হওয়া SVG-র ঠিক নিচে (পুরনো SVG-বক্সের নিচ পর্যন্ত); Landscape: ডান কলামের উপরের অংশ।
   */
  infoBox: Box;
  fontSizes: {
    appName: number;
    tagline: number;
    hadisLabel: number;
    /** ক্যাপশনের সর্বোচ্চ ও সর্বনিম্ন ফন্ট (লাইন বেশি হলে অটো-ফিটে এর মাঝে নামবে) */
    captionMax: number;
    captionMin: number;
    outroText: number;
  };
};

const BASE = 1080;

/** ইনফোগ্রাফিক চলার সময় Portrait-এ SVG-র আকার (স্বাভাবিক আকারের ভগ্নাংশ) */
export const INFOGRAPHIC_SVG_SHRINK = 0.34;
/** Landscape-এ ইনফোগ্রাফিক-কার্ড ডান কলামের উচ্চতার কত অংশ নেয় (বাকিটা ক্যাপশন) */
export const INFOGRAPHIC_LANDSCAPE_SHARE = 0.56;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * @param infoMix ইনফোগ্রাফিক-লেআউটের অগ্রগতি ০–১ (`infographicLayoutMix`; ডিফল্ট ০ = আগের লেআউট হুবহু)।
 *   Portrait: SVG ছোট হয়ে উপরে থাকে (বর্গ, মাঝখানে), ক্যাপশন একই। Landscape: SVG একই, ক্যাপশন-বক্স ছোট হয়ে নিচে নামে।
 */
export function computeLayout(width: number, height: number, infoMix = 0): Layout {
  const mix = Math.min(1, Math.max(0, Number.isFinite(infoMix) ? infoMix : 0));
  const isPortrait = height >= width;
  const unit = Math.min(width, height) / BASE;

  if (isPortrait) {
    // উপর ৩.৫% | হেডার ১৮% | ফাঁক | SVG ৪৩% | ফাঁক | ক্যাপশন ২৪% | নিচে ৮.৫% (শর্টসের UI)
    const padding = width * 0.055;
    const top = height * 0.035;
    const gap = height * 0.015;
    const headerHeight = height * 0.18;
    const fullSvgSize = Math.min(height * 0.43, width - padding * 2);
    const captionHeight = height * 0.24;
    const svgSize = lerp(fullSvgSize, fullSvgSize * INFOGRAPHIC_SVG_SHRINK, mix);

    const headerBox: Box = { x: padding, y: top, width: width - padding * 2, height: headerHeight };
    const svgY = headerBox.y + headerBox.height + gap;
    const svgBox: SquareBox = {
      x: (width - svgSize) / 2,
      y: svgY,
      size: svgSize,
    };
    // ক্যাপশন সবসময় স্বাভাবিক জায়গায় (SVG ছোট হলেও নড়ে না)
    const captionBox: Box = {
      x: padding,
      y: svgY + fullSvgSize + gap,
      width: width - padding * 2,
      height: captionHeight,
    };
    // ইনফোগ্রাফিক-কার্ড: ছোট SVG-র নিচে, পুরনো SVG-বক্সের নিচ পর্যন্ত
    const infoGap = height * 0.012;
    const infoY = svgY + fullSvgSize * INFOGRAPHIC_SVG_SHRINK + infoGap;
    const infoBox: Box = {
      x: padding,
      y: infoY,
      width: width - padding * 2,
      height: Math.max(1, svgY + fullSvgSize - infoY),
    };
    return {
      isPortrait,
      width,
      height,
      unit,
      safe: { top, bottom: height * 0.085, left: padding, right: padding },
      padding,
      headerBox,
      headerHeight,
      svgBox,
      captionBox,
      infoBox,
      fontSizes: {
        appName: 46 * unit,
        tagline: 40 * unit,
        hadisLabel: 42 * unit,
        captionMax: 66 * unit,
        captionMin: 40 * unit,
        outroText: 56 * unit,
      },
    };
  }

  // Landscape: উপরে পাতলা হেডার; নিচে বাঁয়ে SVG, ডানে ক্যাপশন
  const padding = width * 0.045;
  const top = height * 0.04;
  const bottom = height * 0.05;
  const gap = height * 0.04;
  const headerHeight = height * 0.15;
  const headerBox: Box = { x: padding, y: top, width: width - padding * 2, height: headerHeight };

  const bodyY = headerBox.y + headerBox.height + gap;
  const bodyHeight = height - bottom - bodyY;
  const svgSize = Math.min(bodyHeight, width * 0.4);
  const svgBox: SquareBox = { x: padding, y: bodyY + (bodyHeight - svgSize) / 2, size: svgSize };
  const captionX = svgBox.x + svgSize + width * 0.03;
  const captionW = width - padding - captionX;
  // ইনফোগ্রাফিক: ডান কলামের উপরে কার্ড, ক্যাপশন-বক্স ছোট হয়ে নিচে নামে (SVG বাঁয়ে একই)
  const infoH = bodyHeight * INFOGRAPHIC_LANDSCAPE_SHARE;
  const infoGap = height * 0.025;
  const infoBox: Box = { x: captionX, y: bodyY, width: captionW, height: infoH };
  const captionBox: Box = {
    x: captionX,
    y: lerp(bodyY, bodyY + infoH + infoGap, mix),
    width: captionW,
    height: lerp(bodyHeight, bodyHeight - infoH - infoGap, mix),
  };
  return {
    isPortrait,
    width,
    height,
    unit,
    safe: { top, bottom, left: padding, right: padding },
    padding,
    headerBox,
    headerHeight,
    svgBox,
    captionBox,
    infoBox,
    fontSizes: {
      appName: 40 * unit,
      tagline: 34 * unit,
      hadisLabel: 38 * unit,
      captionMax: 60 * unit,
      captionMin: 34 * unit,
      outroText: 52 * unit,
    },
  };
}

/** কম্পোনেন্টের ভেতরে: বর্তমান ভিডিও সাইজ অনুযায়ী লেআউট */
export function useLayout(): Layout {
  const { width, height } = useVideoConfig();
  return computeLayout(width, height);
}
