import type { ThemeId } from "./types";

/**
 * Part 3: ৩টা মূল থিম (emerald, navy, greenDayNight) + ৪টা ঋতু-থিম (monsoon = বর্ষা, winter = শীত, spring = বসন্ত, autumn = শরৎ)।
 * সাতটা থিমই দিন-রাতের থিম (greenDayNight-এর মতো) — সময়ের মোড (day / night / dayToNight / nightToDay) চারটাতেই কাজ করে।
 *
 * নকশার সিদ্ধান্ত: সব লেখা সবসময় আধা-স্বচ্ছ গাঢ় প্যানেলের (`panelBg`) উপরে বসবে।
 * ফলে দিনের উজ্জ্বল আকাশেও লেখা পড়া যায়, আর লেখার রঙ দিন-রাতে বদলাতে হয় না।
 */

export type Palette = {
  /** আকাশ/ব্যাকগ্রাউন্ড গ্রেডিয়েন্ট (উপর → মাঝ → নিচ) */
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  /** মূল লেখা (panelBg-এর উপরে) */
  text: string;
  /** গৌণ লেখা */
  textMuted: string;
  accent: string;
  accent2: string;
  /** লেখার পেছনের আধা-স্বচ্ছ প্যানেল */
  panelBg: string;
  panelBorder: string;
  /** গ্লো-এর রঙ (লোগো রিং, SVG-এর পেছনের বৃত্ত ইত্যাদি) */
  glow: string;
  /** ক্যাপশনের সক্রিয় শব্দের ৬টা উজ্জ্বল রঙ */
  captionColors: string[];
};

export type Decor = {
  /** ব্যাকগ্রাউন্ডের হালকা প্যাটার্ন */
  pattern: "geometric" | "none";
  /** ভাসমান কণার ধরন */
  particles: "gold" | "stars" | "none";
  particleCount: number;
};

/** ঋতুর বিশেষ এফেক্ট: বর্ষার বৃষ্টি, শীতের কুয়াশা, বসন্তের ঝরা পাপড়ি */
export type SeasonEffect = {
  kind: "rain" | "mist" | "petals" | "leaves";
  /** rain/mist-এ প্রথম রঙটাই; petals/leaves-এ পাপড়িগুলো পালা করে এই রঙ নেয় */
  colors: string[];
  /** rain = ফোঁটার সংখ্যা, mist = কুয়াশার স্তর (হিমকণা = ×৫), petals/leaves = পাপড়ি/পাতার সংখ্যা */
  count: number;
  /** দিনে (nightFactor ০) ও রাতে (১) এফেক্টের স্বচ্ছতা — মাঝে মসৃণ মিশ্রণ */
  dayOpacity: number;
  nightOpacity: number;
  /** শুধু rain: বিদ্যুৎ-ঝলক (রাতের দিকে জোরালো; ~৩.৭ সেকেন্ডে সর্বোচ্চ একবার, আস্তে ঝলকানো) */
  lightning?: boolean;
};

export type Scenery = {
  sun: { color: string; glow: string };
  moon: { color: string; glow: string };
  star: string;
  cloud: string;
  fireflyColor: string;
  fireflyGlow: string;
  fireflyCount: number;
  /** টিলার রঙ [দিন, গোধূলি, রাত]; না দিলে greenDayNight-এর সবুজ টিলা */
  hills?: { back: [string, string, string]; front: [string, string, string] };
  /** তারার সংখ্যা (ডিফল্ট ৭০) ও মেঘের সংখ্যা (ডিফল্ট ৫) */
  starCount?: number;
  cloudCount?: number;
  /** মেঘের স্বচ্ছতা দিনে/রাতে (ডিফল্ট ০.৬ / ০.০৫) */
  cloudDayOpacity?: number;
  cloudNightOpacity?: number;
  /** সূর্য/চাঁদের জোর (০–১, ডিফল্ট ১) — বর্ষায় মেঘে ঢাকা তাই কম */
  sunStrength?: number;
  moonStrength?: number;
  /** ঋতুর এফেক্ট; না থাকলে নেই (greenDayNight) */
  effect?: SeasonEffect;
};

export type Theme = {
  id: ThemeId;
  /** বাংলা নাম */
  name: string;
  /** true হলে দিন-রাত বদলায় না (nightFactor-এর কোনো প্রভাব নেই) */
  isStatic: boolean;
  day: Palette;
  /** দিন → রাতের মাঝের গোধূলি (শুধু greenDayNight-এ) */
  dusk?: Palette;
  night: Palette;
  decor: Decor;
  scenery?: Scenery;
};

// ---------- থিমের সংজ্ঞা ----------

// emerald (এমারেল্ড): আগের গাঢ় প্যালেট এখন "রাত"; সাথে নতুন "দিন" ও "গোধূলি" — সময়ের মোড এখন emerald-এও কাজ করে
const emeraldDay: Palette = {
  skyTop: "#8fdcb4",
  skyMid: "#c8f2d8",
  skyBottom: "#58b98a",
  text: "#fff8e1",
  textMuted: "#d9f0e0",
  accent: "#f5c542",
  accent2: "#ffe08a",
  panelBg: "#032010d1",
  panelBorder: "#f5c542cc",
  glow: "#ffe08a",
  captionColors: ["#ffd166", "#7ef0b0", "#8ee3ff", "#ffb3c7", "#c9b6ff", "#ffa86b"],
};

const emeraldDusk: Palette = {
  skyTop: "#2c4a52",
  skyMid: "#c98a58",
  skyBottom: "#e6b566",
  text: "#fff8e1",
  textMuted: "#e6efd8",
  accent: "#f5c542",
  accent2: "#ffe08a",
  panelBg: "#032010cc",
  panelBorder: "#f5c542cc",
  glow: "#f5c542",
  captionColors: ["#ffd166", "#7ef0b0", "#8ee3ff", "#ffb3c7", "#c9b6ff", "#ffa86b"],
};

const emeraldPalette: Palette = {
  skyTop: "#021f12",
  skyMid: "#064e2f",
  skyBottom: "#0b6b3e",
  text: "#fff8e1",
  textMuted: "#cfe9d8",
  accent: "#f5c542",
  accent2: "#ffe08a",
  panelBg: "#03201080",
  panelBorder: "#f5c54299",
  glow: "#f5c542",
  captionColors: ["#ffd166", "#7ef0b0", "#8ee3ff", "#ffb3c7", "#c9b6ff", "#ffa86b"],
};

// navy (রয়্যাল নেভি): আগের গাঢ় প্যালেট এখন "রাত"; সাথে নতুন "দিন" ও "গোধূলি"
const navyDay: Palette = {
  skyTop: "#6fb9f5",
  skyMid: "#b9deff",
  skyBottom: "#e6f3ff",
  text: "#ffffff",
  textMuted: "#cfe3ff",
  accent: "#8fd3ff",
  accent2: "#ffffff",
  panelBg: "#050a2ad1",
  panelBorder: "#8fd3ffcc",
  glow: "#cfeaff",
  captionColors: ["#8fd3ff", "#ffe08a", "#9bf0c6", "#ffb3c7", "#d2b8ff", "#ffb88a"],
};

const navyDusk: Palette = {
  skyTop: "#33387f",
  skyMid: "#c4688a",
  skyBottom: "#f0a868",
  text: "#ffffff",
  textMuted: "#e3e8ff",
  accent: "#9fdcff",
  accent2: "#ffe3c0",
  panelBg: "#070a2acc",
  panelBorder: "#9fdcffcc",
  glow: "#ffc08a",
  captionColors: ["#9fdcff", "#ffe08a", "#9bf0c6", "#ffb3c7", "#d2b8ff", "#ffb88a"],
};

const navyPalette: Palette = {
  skyTop: "#070b2b",
  skyMid: "#0f1c5c",
  skyBottom: "#1b2f86",
  text: "#ffffff",
  textMuted: "#cfe3ff",
  accent: "#8fd3ff",
  accent2: "#ffffff",
  panelBg: "#050a2ac4",
  panelBorder: "#8fd3ff99",
  glow: "#8fd3ff",
  captionColors: ["#8fd3ff", "#ffe08a", "#9bf0c6", "#ffb3c7", "#d2b8ff", "#ffb88a"],
};

const gdnDay: Palette = {
  skyTop: "#cdeaa0",
  skyMid: "#e3f4b0",
  skyBottom: "#9bd88f",
  text: "#fffbe6",
  textMuted: "#e2f5d0",
  accent: "#ffd84d",
  accent2: "#fff1a8",
  panelBg: "#06280ed1",
  panelBorder: "#ffd84dcc",
  glow: "#fff1a8",
  captionColors: ["#ffe27a", "#9bf5b5", "#8fe6ff", "#ffbdd0", "#d4c2ff", "#ffb98a"],
};

const gdnDusk: Palette = {
  skyTop: "#5d4f7a",
  skyMid: "#c9785a",
  skyBottom: "#e2a45c",
  text: "#fffbe6",
  textMuted: "#e8f2d6",
  accent: "#ffc65a",
  accent2: "#ffe3a0",
  panelBg: "#052412cc",
  panelBorder: "#ffc65acc",
  glow: "#ffc65a",
  captionColors: ["#ffd66e", "#8ff0ad", "#8fdcff", "#ffb3c7", "#cdb8ff", "#ffae80"],
};

const gdnNight: Palette = {
  skyTop: "#031a12",
  skyMid: "#052e1f",
  skyBottom: "#0a4a32",
  text: "#fffbe6",
  textMuted: "#cfe9d8",
  accent: "#d8ff6a",
  accent2: "#f7ffb0",
  panelBg: "#03160ec2",
  panelBorder: "#d8ff6acc",
  glow: "#d8ff6a",
  captionColors: ["#e6ff7a", "#7ef0b0", "#8ee3ff", "#ffb3c7", "#c9b6ff", "#ffa86b"],
};

// ---- বর্ষা (monsoon): ধূসর-সবুজ ভারী মেঘ, ভেজা সবুজ, বৃষ্টি + রাতে বিদ্যুৎ ----
const monsoonDay: Palette = {
  skyTop: "#6b8791",
  skyMid: "#93aeb4",
  skyBottom: "#5d8a7a",
  text: "#f2fbff",
  textMuted: "#d3e6ea",
  accent: "#7fe0d0",
  accent2: "#d4fff6",
  panelBg: "#08212bd1",
  panelBorder: "#7fe0d0cc",
  glow: "#a8f0e4",
  captionColors: ["#9ff0e0", "#ffe08a", "#9fd8ff", "#ffbdd0", "#d4c2ff", "#ffb98a"],
};

const monsoonDusk: Palette = {
  skyTop: "#3f4a63",
  skyMid: "#5e6784",
  skyBottom: "#87798a",
  text: "#f2fbff",
  textMuted: "#dbe6ee",
  accent: "#9ad6ff",
  accent2: "#dff2ff",
  panelBg: "#0a1a2ccc",
  panelBorder: "#9ad6ffcc",
  glow: "#9ad6ff",
  captionColors: ["#a8e6ff", "#ffd98a", "#9bf0c6", "#ffb3c7", "#cdb8ff", "#ffae80"],
};

const monsoonNight: Palette = {
  skyTop: "#050b17",
  skyMid: "#0a1a2b",
  skyBottom: "#10303a",
  text: "#f2fbff",
  textMuted: "#cfe3ea",
  accent: "#6fe3ff",
  accent2: "#c8f6ff",
  panelBg: "#040e18c4",
  panelBorder: "#6fe3ffcc",
  glow: "#6fe3ff",
  captionColors: ["#8aeaff", "#ffe08a", "#9bf0c6", "#ffb3c7", "#d2b8ff", "#ffb88a"],
};

// ---- শীত (winter): কুয়াশামাখা ফ্যাকাশে ভোর, ঠান্ডা নীল, হিমকণা ----
const winterDay: Palette = {
  skyTop: "#cfe3ee",
  skyMid: "#e4eff5",
  skyBottom: "#b9d0de",
  text: "#f4fbff",
  textMuted: "#d9e9f5",
  accent: "#9fd8ff",
  accent2: "#ffffff",
  panelBg: "#0c1d2fd1",
  panelBorder: "#9fd8ffcc",
  glow: "#e8f6ff",
  captionColors: ["#a8dcff", "#ffe08a", "#9bf0c6", "#ffb3c7", "#d2b8ff", "#ffb88a"],
};

const winterDusk: Palette = {
  skyTop: "#5f6f99",
  skyMid: "#b58fa0",
  skyBottom: "#e8bfa0",
  text: "#f4fbff",
  textMuted: "#e4ebf5",
  accent: "#ffd0a8",
  accent2: "#fff0e0",
  panelBg: "#101a2eca",
  panelBorder: "#ffd0a8cc",
  glow: "#ffd9b8",
  captionColors: ["#ffd9b0", "#a8dcff", "#9bf0c6", "#ffb3c7", "#d2b8ff", "#ffc08a"],
};

const winterNight: Palette = {
  skyTop: "#050a1c",
  skyMid: "#0c1a3a",
  skyBottom: "#1a3358",
  text: "#f4fbff",
  textMuted: "#cfe0f2",
  accent: "#bfe6ff",
  accent2: "#ffffff",
  panelBg: "#050a22c4",
  panelBorder: "#bfe6ffcc",
  glow: "#bfe6ff",
  captionColors: ["#bfe6ff", "#ffe08a", "#9bf0c6", "#ffb3c7", "#d2b8ff", "#ffb88a"],
};

// ---- বসন্ত (spring): পলাশ-কৃষ্ণচূড়ার আগুন-রঙা গোধূলি, গোলাপি দিন, ঝরা পাপড়ি ----
const springDay: Palette = {
  skyTop: "#ffd6df",
  skyMid: "#ffe7d0",
  skyBottom: "#ffc2a0",
  text: "#fff7f0",
  textMuted: "#f6dfe6",
  accent: "#ffb347",
  accent2: "#ffd9a8",
  panelBg: "#2a0f24d1",
  panelBorder: "#ffb347cc",
  glow: "#ffd0a0",
  captionColors: ["#ffc46e", "#a8f0b0", "#9fe0ff", "#ffb3d0", "#d8c2ff", "#ff9f7a"],
};

const springDusk: Palette = {
  skyTop: "#7b3f7a",
  skyMid: "#e0606e",
  skyBottom: "#ffa05a",
  text: "#fff7f0",
  textMuted: "#f8e2dc",
  accent: "#ffc65a",
  accent2: "#ffe3a0",
  panelBg: "#2a0d22cc",
  panelBorder: "#ffc65acc",
  glow: "#ffb070",
  captionColors: ["#ffd070", "#a8f0b0", "#9fe0ff", "#ffb3d0", "#d8c2ff", "#ffa07a"],
};

const springNight: Palette = {
  skyTop: "#150820",
  skyMid: "#2b1038",
  skyBottom: "#4a1a4a",
  text: "#fff7f0",
  textMuted: "#ecd6e6",
  accent: "#ff8fb8",
  accent2: "#ffd0e0",
  panelBg: "#16071fc4",
  panelBorder: "#ff8fb8cc",
  glow: "#ff9ac1",
  captionColors: ["#ff9fc4", "#ffd98a", "#9bf0c6", "#9fe0ff", "#d8c2ff", "#ffb08a"],
};

// ---- শরৎ (autumn): সোনালি-কমলা আলো, ঝরা পাতা ----
const autumnDay: Palette = {
  skyTop: "#f5c07a",
  skyMid: "#ffe2b4",
  skyBottom: "#e9a05e",
  text: "#fff4e2",
  textMuted: "#f6e2c6",
  accent: "#ff9a3c",
  accent2: "#ffd08a",
  panelBg: "#2a1208d1",
  panelBorder: "#ff9a3ccc",
  glow: "#ffcf8a",
  captionColors: ["#ffb347", "#ffd98a", "#ff8a6b", "#a8f0b0", "#9fe0ff", "#ffc4d0"],
};

const autumnDusk: Palette = {
  skyTop: "#6b3a4a",
  skyMid: "#d9663a",
  skyBottom: "#f0a050",
  text: "#fff4e2",
  textMuted: "#f2d8c0",
  accent: "#ffb15a",
  accent2: "#ffe0a8",
  panelBg: "#2a0f08cc",
  panelBorder: "#ffb15acc",
  glow: "#ff9a50",
  captionColors: ["#ffb347", "#ffd98a", "#ff8a6b", "#a8f0b0", "#9fe0ff", "#ffc4d0"],
};

const autumnNight: Palette = {
  skyTop: "#150b10",
  skyMid: "#2e1a1a",
  skyBottom: "#4a2a1c",
  text: "#fff4e2",
  textMuted: "#e8cfb8",
  accent: "#ffb15a",
  accent2: "#ffd8a0",
  panelBg: "#1a0b07c4",
  panelBorder: "#ffb15acc",
  glow: "#ff9a50",
  captionColors: ["#ffb347", "#ffd98a", "#ff8a6b", "#a8f0b0", "#9fe0ff", "#ffc4d0"],
};

export const THEMES: Record<ThemeId, Theme> = {
  emerald: {
    id: "emerald",
    name: "এমারেল্ড নাইট",
    isStatic: false,
    day: emeraldDay,
    dusk: emeraldDusk,
    night: emeraldPalette,
    decor: { pattern: "geometric", particles: "gold", particleCount: 28 },
    scenery: {
      sun: { color: "#fff3b0", glow: "#ffd966" },
      moon: { color: "#fff6d8", glow: "#f5c542" },
      star: "#fff3c4",
      cloud: "#ffffff",
      fireflyColor: "#ffe08a",
      fireflyGlow: "#f5c542",
      fireflyCount: 26,
      hills: {
        back: ["#4fb07a", "#5f7a4a", "#06402a"],
        front: ["#2f9a62", "#46633a", "#042f1e"],
      },
    },
  },
  navy: {
    id: "navy",
    name: "রয়্যাল নেভি",
    isStatic: false,
    day: navyDay,
    dusk: navyDusk,
    night: navyPalette,
    decor: { pattern: "none", particles: "stars", particleCount: 40 },
    scenery: {
      sun: { color: "#fffbe0", glow: "#ffe9a0" },
      moon: { color: "#eef4ff", glow: "#8fd3ff" },
      star: "#ffffff",
      cloud: "#ffffff",
      fireflyColor: "#bfe6ff",
      fireflyGlow: "#8fd3ff",
      fireflyCount: 24,
      hills: {
        back: ["#5f8fd0", "#4a5a8f", "#0b1a4a"],
        front: ["#4a78bd", "#3a4677", "#060f33"],
      },
      starCount: 110,
    },
  },
  greenDayNight: {
    id: "greenDayNight",
    name: "সবুজ Day & Night",
    isStatic: false,
    day: gdnDay,
    dusk: gdnDusk,
    night: gdnNight,
    decor: { pattern: "none", particles: "none", particleCount: 0 },
    scenery: {
      sun: { color: "#fff3b0", glow: "#ffe27a" },
      moon: { color: "#f4f8e8", glow: "#d8ff6a" },
      star: "#fffbe6",
      cloud: "#ffffff",
      fireflyColor: "#e6ff7a",
      fireflyGlow: "#b6ff3c",
      fireflyCount: 32,
      hills: {
        back: ["#7cc47a", "#6f7f45", "#0a3a28"],
        front: ["#5fae62", "#4c6a3a", "#062a1c"],
      },
    },
  },
  monsoon: {
    id: "monsoon",
    name: "বর্ষা — বৃষ্টির মেঘ",
    isStatic: false,
    day: monsoonDay,
    dusk: monsoonDusk,
    night: monsoonNight,
    decor: { pattern: "none", particles: "none", particleCount: 0 },
    scenery: {
      sun: { color: "#fff6d8", glow: "#d9efe8" },
      moon: { color: "#e8f1f4", glow: "#8fd8e8" },
      star: "#e8f6ff",
      cloud: "#aebdc4",
      fireflyColor: "#b9ffd9",
      fireflyGlow: "#4ff0b0",
      fireflyCount: 36,
      hills: {
        back: ["#5f9a86", "#4f6f6a", "#0b2f33"],
        front: ["#477f6d", "#3d5b59", "#062226"],
      },
      starCount: 36,
      cloudCount: 9,
      cloudDayOpacity: 0.85,
      cloudNightOpacity: 0.35,
      sunStrength: 0.3,
      moonStrength: 0.55,
      effect: {
        kind: "rain",
        colors: ["#d6eef5"],
        count: 90,
        dayOpacity: 0.55,
        nightOpacity: 0.42,
        lightning: true,
      },
    },
  },
  winter: {
    id: "winter",
    name: "শীত — কুয়াশার ভোর",
    isStatic: false,
    day: winterDay,
    dusk: winterDusk,
    night: winterNight,
    decor: { pattern: "none", particles: "none", particleCount: 0 },
    scenery: {
      sun: { color: "#fff6dc", glow: "#ffe9b0" },
      moon: { color: "#eef6ff", glow: "#bfe0ff" },
      star: "#f4fbff",
      cloud: "#ffffff",
      fireflyColor: "#e0f6ff",
      fireflyGlow: "#8ad4ff",
      fireflyCount: 26,
      hills: {
        back: ["#a9c6d6", "#7f7c93", "#0e2038"],
        front: ["#8fb0c4", "#625f78", "#08162a"],
      },
      starCount: 95,
      cloudCount: 4,
      cloudDayOpacity: 0.5,
      cloudNightOpacity: 0.06,
      sunStrength: 0.85,
      effect: {
        kind: "mist",
        colors: ["#ffffff"],
        count: 7,
        dayOpacity: 0.75,
        nightOpacity: 0.4,
      },
    },
  },
  spring: {
    id: "spring",
    name: "বসন্ত — ফুলের পাপড়ি",
    isStatic: false,
    day: springDay,
    dusk: springDusk,
    night: springNight,
    decor: { pattern: "none", particles: "none", particleCount: 0 },
    scenery: {
      sun: { color: "#fff1b8", glow: "#ffc27a" },
      moon: { color: "#fff3ea", glow: "#ffb3d0" },
      star: "#fff0f6",
      cloud: "#fff0f0",
      fireflyColor: "#ffd27a",
      fireflyGlow: "#ff8a3c",
      fireflyCount: 30,
      hills: {
        back: ["#8fcf8a", "#7a5a63", "#2a1535"],
        front: ["#6fbf6f", "#5a4152", "#1b0d26"],
      },
      starCount: 60,
      cloudCount: 5,
      cloudDayOpacity: 0.65,
      cloudNightOpacity: 0.05,
      effect: {
        kind: "petals",
        colors: ["#ff5a36", "#ff9ac1", "#ffd04a"],
        count: 34,
        dayOpacity: 1,
        nightOpacity: 0.65,
      },
    },
  },
  autumn: {
    id: "autumn",
    name: "শরৎ — ঝরা পাতা",
    isStatic: false,
    day: autumnDay,
    dusk: autumnDusk,
    night: autumnNight,
    decor: { pattern: "none", particles: "none", particleCount: 0 },
    scenery: {
      sun: { color: "#fff0c0", glow: "#ffb04a" },
      moon: { color: "#fff3e0", glow: "#ffc27a" },
      star: "#fff4e0",
      cloud: "#fff0dc",
      fireflyColor: "#ffd27a",
      fireflyGlow: "#ff9a3c",
      fireflyCount: 26,
      hills: {
        back: ["#d89a4a", "#9a5a3a", "#2a1410"],
        front: ["#c0742f", "#7a4430", "#1c0c0a"],
      },
      starCount: 70,
      cloudCount: 5,
      cloudDayOpacity: 0.6,
      cloudNightOpacity: 0.05,
      effect: {
        kind: "leaves",
        colors: ["#d9531e", "#f0a030", "#a83a1a", "#e8c040"],
        count: 30,
        dayOpacity: 1,
        nightOpacity: 0.6,
      },
    },
  },
};

export const getTheme = (id: ThemeId): Theme => THEMES[id];

// ---------- রঙ মিশ্রণ ----------

type Rgba = { r: number; g: number; b: number; a: number };

/** "#rgb", "#rrggbb", "#rrggbbaa" বা "rgba(r,g,b,a)" পার্স করে */
export function parseColor(input: string): Rgba {
  const s = input.trim();
  if (s.startsWith("#")) {
    let h = s.slice(1);
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length === 6) h += "ff";
    if (h.length !== 8 || /[^0-9a-fA-F]/.test(h)) {
      throw new Error(`রঙ বোঝা যায়নি: "${input}"`);
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: parseInt(h.slice(6, 8), 16) / 255,
    };
  }
  const m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (!m) throw new Error(`রঙ বোঝা যায়নি: "${input}"`);
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
}

const toCss = ({ r, g, b, a }: Rgba): string =>
  `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.round(a * 1000) / 1000})`;

/** দুই রঙের মিশ্রণ। t=0 → a, t=1 → b */
export function mixColors(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const ca = parseColor(a);
  const cb = parseColor(b);
  return toCss({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
    a: ca.a + (cb.a - ca.a) * t,
  });
}

function mixPalettes(a: Palette, b: Palette, t: number): Palette {
  const m = (x: string, y: string) => mixColors(x, y, t);
  return {
    skyTop: m(a.skyTop, b.skyTop),
    skyMid: m(a.skyMid, b.skyMid),
    skyBottom: m(a.skyBottom, b.skyBottom),
    text: m(a.text, b.text),
    textMuted: m(a.textMuted, b.textMuted),
    accent: m(a.accent, b.accent),
    accent2: m(a.accent2, b.accent2),
    panelBg: m(a.panelBg, b.panelBg),
    panelBorder: m(a.panelBorder, b.panelBorder),
    glow: m(a.glow, b.glow),
    captionColors: a.captionColors.map((c, i) => m(c, b.captionColors[i] ?? c)),
  };
}

/**
 * থিমের বর্তমান রঙসেট।
 * @param nightFactor ০ (দিন) → ০.৫ (গোধূলি) → ১ (রাত)। static থিমে এর কোনো প্রভাব নেই।
 */
export function getThemeColors(themeId: ThemeId, nightFactor = 0): Palette {
  const theme = THEMES[themeId];
  if (theme.isStatic) return theme.day;
  const nf = Math.min(1, Math.max(0, nightFactor));
  if (!theme.dusk) return mixPalettes(theme.day, theme.night, nf);
  return nf < 0.5
    ? mixPalettes(theme.day, theme.dusk, nf * 2)
    : mixPalettes(theme.dusk, theme.night, (nf - 0.5) * 2);
}

/** আকাশের CSS গ্রেডিয়েন্ট */
export const skyGradient = (p: Palette): string =>
  `linear-gradient(180deg, ${p.skyTop} 0%, ${p.skyMid} 55%, ${p.skyBottom} 100%)`;
