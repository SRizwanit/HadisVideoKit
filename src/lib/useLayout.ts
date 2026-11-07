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

export function computeLayout(width: number, height: number): Layout {
  const isPortrait = height >= width;
  const unit = Math.min(width, height) / BASE;

  if (isPortrait) {
    // উপর ৩.৫% | হেডার ১৮% | ফাঁক | SVG ৪৩% | ফাঁক | ক্যাপশন ২৪% | নিচে ৮.৫% (শর্টসের UI)
    const padding = width * 0.055;
    const top = height * 0.035;
    const gap = height * 0.015;
    const headerHeight = height * 0.18;
    const svgSize = Math.min(height * 0.43, width - padding * 2);
    const captionHeight = height * 0.24;

    const headerBox: Box = { x: padding, y: top, width: width - padding * 2, height: headerHeight };
    const svgBox: SquareBox = {
      x: (width - svgSize) / 2,
      y: headerBox.y + headerBox.height + gap,
      size: svgSize,
    };
    const captionBox: Box = {
      x: padding,
      y: svgBox.y + svgBox.size + gap,
      width: width - padding * 2,
      height: captionHeight,
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
  const captionBox: Box = {
    x: captionX,
    y: bodyY,
    width: width - padding - captionX,
    height: bodyHeight,
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
