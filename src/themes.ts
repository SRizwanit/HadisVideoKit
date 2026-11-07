import type { ThemeId } from "./types";

/**
 * Part 3: ৩টা থিম।
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

export type Scenery = {
  sun: { color: string; glow: string };
  moon: { color: string; glow: string };
  star: string;
  cloud: string;
  fireflyColor: string;
  fireflyGlow: string;
  fireflyCount: number;
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

export const THEMES: Record<ThemeId, Theme> = {
  emerald: {
    id: "emerald",
    name: "এমারেল্ড নাইট",
    isStatic: true,
    day: emeraldPalette,
    night: emeraldPalette,
    decor: { pattern: "geometric", particles: "gold", particleCount: 28 },
  },
  navy: {
    id: "navy",
    name: "রয়্যাল নেভি",
    isStatic: true,
    day: navyPalette,
    night: navyPalette,
    decor: { pattern: "none", particles: "stars", particleCount: 40 },
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
