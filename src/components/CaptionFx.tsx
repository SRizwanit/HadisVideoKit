import React from "react";
import { clamp01, type WordLook } from "../lib/captionWords";
import { hash01, type CaptionStyle, type ParticleKind, type WordFx } from "../lib/captionStyles";
import { mixColors, parseColor } from "../themes";

/**
 * থিম-ভিত্তিক ক্যাপশন এফেক্ট (Caption.tsx ব্যবহার করে):
 *  - `PanelRing`      : বাক্সের ঘুরন্ত রঙিন বর্ডার
 *  - `PanelShimmer`   : বাক্সের উপর দিয়ে আলোর ঝলক
 *  - `PanelParticles` : ভেতরে ভাসা কণা (তারা/জোনাকি/বৃষ্টি/তুষার/পাপড়ি)
 *  - `wordFx`         : সক্রিয় শব্দের রঙিন অ্যানিমেশন (গ্লো, পিল, ফোঁটা, বরফ, ফুল …)
 * সব ফ্রেম থেকে হিসাব → render-safe।
 */

export const withAlpha = (color: string, alpha: number): string => {
  try {
    const c = parseColor(color);
    return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${Math.max(0, Math.min(1, alpha))})`;
  } catch {
    return color;
  }
};

// ---------- ছোট SVG আইকন ----------

const Star4: React.FC<{ color: string }> = ({ color }) => (
  <svg viewBox="-10 -10 20 20" width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
    <path d="M0 -10 C1 -3 3 -1 10 0 C3 1 1 3 0 10 C-1 3 -3 1 -10 0 C-3 -1 -1 -3 0 -10Z" fill={color} />
  </svg>
);

const Snowflake: React.FC<{ color: string }> = ({ color }) => (
  <svg viewBox="-11 -11 22 22" width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
    <g stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {[0, 60, 120].map((r) => (
        <g key={r} transform={`rotate(${r})`}>
          <line x1={0} y1={-10} x2={0} y2={10} />
          <path d="M-3 -7 L0 -4 L3 -7 M-3 7 L0 4 L3 7" />
        </g>
      ))}
    </g>
  </svg>
);

const Flower: React.FC<{ color: string; center: string }> = ({ color, center }) => (
  <svg viewBox="-11 -11 22 22" width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
    {[0, 72, 144, 216, 288].map((r) => (
      <ellipse key={r} cx={0} cy={-5.2} rx={3.6} ry={5.4} fill={color} transform={`rotate(${r})`} />
    ))}
    <circle cx={0} cy={0} r={3} fill={center} />
  </svg>
);

const Drop: React.FC<{ color: string }> = ({ color }) => (
  <svg viewBox="-8 -11 16 21" width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
    <path d="M0 -10 C4 -3 7 1 7 4.5 A7 7 0 0 1 -7 4.5 C-7 1 -4 -3 0 -10Z" fill={color} />
  </svg>
);

// ---------- বাক্সের বর্ডার / ঝলক ----------

/** ঘুরন্ত রঙিন বর্ডার (conic-gradient + মাস্ক) — বাক্সের ভেতরের কিনারায় বসে */
export const PanelRing: React.FC<{
  colors: string[];
  frame: number;
  speed: number;
  radius: number;
  width: number;
}> = ({ colors, frame, speed, radius, width }) => {
  const cs = colors.length >= 2 ? colors : [colors[0] ?? "#ffffff", "#ffffff"];
  const stops = [...cs, cs[0]].join(", ");
  return (
    <div
      aria-hidden
      data-caption-ring=""
      style={{
        position: "absolute",
        inset: 0,
        boxSizing: "border-box",
        borderRadius: radius,
        padding: width,
        background: `conic-gradient(from ${(frame * speed) % 360}deg, ${stops})`,
        WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor",
        mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        maskComposite: "exclude",
        pointerEvents: "none",
      }}
    />
  );
};

/** বাক্সের উপর দিয়ে তির্যক আলোর ঝলক; প্রতি `period` ফ্রেমের প্রথম ৪০%-এ ছোটে, বাকি সময় বিরতি */
export const PanelShimmer: React.FC<{ frame: number; period: number; width: number; u: number }> = ({ frame, period, width, u }) => {
  const t = (((frame % period) + period) % period) / period;
  const s = clamp01(t / 0.4);
  if (s <= 0 || s >= 1) return null;
  const bandW = 140 * u;
  const x = -bandW + s * (width + 2 * bandW);
  return (
    <div
      aria-hidden
      data-caption-shimmer=""
      style={{
        position: "absolute",
        top: "-20%",
        bottom: "-20%",
        left: 0,
        width: bandW,
        transform: `translateX(${x}px) skewX(-20deg)`,
        background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.2), rgba(255,255,255,0))",
        pointerEvents: "none",
      }}
    />
  );
};

// ---------- ভাসা কণা ----------

const TAU = Math.PI * 2;
const mod = (a: number, n: number): number => ((a % n) + n) % n;

const Particle: React.FC<{
  kind: ParticleKind;
  i: number;
  frame: number;
  w: number;
  h: number;
  u: number;
  colors: string[];
}> = ({ kind, i, frame, w, h, u, colors }) => {
  const r1 = hash01(i * 4 + 1);
  const r2 = hash01(i * 4 + 2);
  const r3 = hash01(i * 4 + 3);
  const r4 = hash01(i * 4 + 4);
  const c0 = colors[0] ?? "#ffffff";
  const pick = (k: number): string => colors[k % Math.max(1, colors.length)] ?? c0;

  if (kind === "sparkle") {
    const tw = 0.5 + 0.5 * Math.sin(frame * 0.13 * (0.6 + r3) + r4 * TAU);
    const size = (7 + r2 * 11) * u * (0.35 + 0.65 * tw);
    return (
      <div style={{ position: "absolute", left: r1 * w - size / 2, top: r2 * h - size / 2, width: size, height: size, opacity: 0.25 + 0.75 * tw, transform: `rotate(${frame * 0.9 + r4 * 90}deg)` }}>
        <Star4 color={r3 > 0.5 ? "#fff6cf" : c0} />
      </div>
    );
  }

  if (kind === "star") {
    const tw = 0.5 + 0.5 * Math.sin(frame * 0.16 * (0.5 + r3) + r4 * TAU);
    const size = (2.5 + r2 * 4) * u;
    const col = pick(Math.floor(r4 * 3) * 2);
    return (
      <div
        style={{
          position: "absolute",
          left: r1 * w,
          top: r2 * h,
          width: size,
          height: size,
          borderRadius: "50%",
          background: col,
          opacity: 0.2 + 0.8 * tw,
          boxShadow: `0 0 ${size * 2.5}px ${withAlpha(col, 0.9)}`,
        }}
      />
    );
  }

  if (kind === "firefly") {
    const x = r1 * w + Math.sin(frame * 0.02 * (0.5 + r3) + r4 * TAU) * 38 * u;
    const y = r2 * h + Math.cos(frame * 0.025 * (0.5 + r4) + r3 * TAU) * 22 * u;
    const pulse = 0.5 + 0.5 * Math.sin(frame * 0.09 * (0.6 + r3) + r1 * TAU);
    const size = (4 + r3 * 5) * u;
    return (
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: "50%",
          background: c0,
          opacity: 0.2 + 0.8 * pulse,
          boxShadow: `0 0 ${size * 3}px ${size * 0.8}px ${withAlpha(c0, 0.6)}`,
        }}
      />
    );
  }

  if (kind === "rain") {
    const len = (16 + r3 * 20) * u;
    const span = h + len * 2;
    const speed = (13 + r4 * 11) * u;
    const y = mod(frame * speed + r2 * span, span) - len;
    const x = mod(r1 * (w + 0.4 * h) - y * 0.2, w + 0.4 * h) - 0.2 * h;
    return (
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: Math.max(1.5, 2 * u),
          height: len,
          borderRadius: u * 2,
          background: `linear-gradient(180deg, ${withAlpha(c0, 0)}, ${withAlpha(c0, 0.7)})`,
          transform: "rotate(11deg)",
          opacity: 0.45 + 0.4 * r3,
        }}
      />
    );
  }

  if (kind === "snow") {
    const size = (3 + r3 * 6) * u;
    const span = h + size * 2;
    const speed = (0.9 + r4 * 1.3) * u;
    const y = mod(frame * speed + r2 * span, span) - size;
    const x = r1 * w + Math.sin(frame * 0.04 * (0.6 + r3) + r4 * TAU) * 16 * u;
    return (
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: "50%",
          background: "#ffffff",
          opacity: 0.4 + 0.5 * r3,
          boxShadow: `0 0 ${size * 1.5}px ${withAlpha("#dff4ff", 0.8)}`,
        }}
      />
    );
  }

  // petal
  const size = (9 + r3 * 9) * u;
  const span = h + size * 2;
  const speed = (1.1 + r4 * 1.4) * u;
  const y = mod(frame * speed + r2 * span, span) - size;
  const x = r1 * w + Math.sin(frame * 0.035 * (0.6 + r3) + r4 * TAU) * 30 * u;
  const col = pick(r4 > 0.5 ? 3 : 5);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size * 0.62,
        borderRadius: "70% 0 70% 0",
        background: col,
        opacity: 0.55 + 0.35 * r1,
        transform: `rotate(${frame * (1.5 + r3 * 2.5) + r4 * 180}deg)`,
      }}
    />
  );
};

export const PanelParticles: React.FC<{
  style: CaptionStyle;
  colors: string[];
  frame: number;
  w: number;
  h: number;
  u: number;
}> = ({ style, colors, frame, w, h, u }) => (
  <div aria-hidden data-caption-particles={style.particle} style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
    {Array.from({ length: style.particleCount }, (_, i) => (
      <Particle key={i} kind={style.particle} i={i} frame={frame} w={w} h={h} u={u} colors={colors} />
    ))}
  </div>
);

// ---------- সক্রিয় শব্দের এফেক্ট ----------

export type WordFxArgs = {
  fx: WordFx;
  look: WordLook;
  /** এখনকার মিশ্রিত রঙ (লেখার রঙ ↔ active রঙ) */
  color: string;
  activeColor: string;
  frame: number;
  fs: number;
  u: number;
  barH: number;
};

export type WordFxOut = {
  color: string;
  /** শেষের কালো ছায়ার আগে বসবে (কমা-সহ বা খালি) */
  glow: string;
  /** scale-এর পরে যোগ হবে */
  transform: string;
  /** লেখার পেছনে (z-index -1) */
  behind: React.ReactNode;
  /** লেখার উপরে ভাসা আইকন */
  above: React.ReactNode;
  /** আন্ডারলাইন */
  under: React.ReactNode;
};

const abs = (extra: React.CSSProperties): React.CSSProperties => ({ position: "absolute", pointerEvents: "none", ...extra });

/** চলমান-হাইলাইটওয়ালা আন্ডারলাইন গ্রেডিয়েন্ট */
const movingBar = (color: string, hl: string, frame: number, period: number): string => {
  const p = (mod(frame, period) / period) * 150 - 25;
  return `linear-gradient(90deg, ${color} 0%, ${color} ${p - 18}%, ${hl} ${p}%, ${color} ${p + 18}%, ${color} 100%)`;
};

export function wordFx(a: WordFxArgs): WordFxOut {
  const { fx, look, activeColor, frame, fs, u, barH } = a;
  const m = look.activeMix;
  const act = m > 0.01;
  const ul = clamp01(look.underline);
  const pop = Math.min(1.2, Math.max(0, look.pop));
  const out: WordFxOut = { color: a.color, glow: "", transform: "", behind: null, above: null, under: null };
  const bar = (style: React.CSSProperties): React.ReactNode =>
    look.underline > 0.01 ? (
      <span
        data-underline=""
        style={abs({ left: "6%", right: "6%", bottom: "0.04em", height: barH, borderRadius: barH, transformOrigin: "50% 50%", transform: `scaleX(${ul})`, opacity: m, ...style })}
      />
    ) : null;

  if (fx === "gold") {
    out.glow = act ? `0 0 ${fs * 0.35 * m}px ${withAlpha(activeColor, 0.9 * m)}, 0 0 ${fs * 0.75 * m}px ${withAlpha(activeColor, 0.4 * m)}, ` : "";
    out.under = bar({ background: movingBar(activeColor, "#fff8d6", frame, 22), boxShadow: `0 0 ${barH * 2}px ${withAlpha(activeColor, 0.8)}` });
    if (act) {
      const tw = 0.6 + 0.4 * Math.sin(frame * 0.4);
      out.above = (
        <span style={abs({ top: "-0.3em", right: "-0.08em", width: "0.36em", height: "0.36em", opacity: m * tw, transform: `rotate(${frame * 5}deg) scale(${0.6 + 0.5 * pop})` })}>
          <Star4 color={mixColors(activeColor, "#ffffff", 0.6)} />
        </span>
      );
    }
  } else if (fx === "neon") {
    const pulse = 0.85 + 0.15 * Math.sin(frame * 0.35);
    out.color = mixColors(a.color, "#ffffff", 0.4 * m);
    out.glow = act
      ? `0 0 ${fs * 0.1}px ${withAlpha("#ffffff", 0.9 * m)}, 0 0 ${fs * 0.3 * pulse}px ${withAlpha(activeColor, m)}, 0 0 ${fs * 0.65 * pulse}px ${withAlpha(activeColor, 0.7 * m)}, 0 0 ${fs * 1.1}px ${withAlpha(activeColor, 0.35 * m)}, `
      : "";
    out.under = bar({ background: mixColors(activeColor, "#ffffff", 0.5), boxShadow: `0 0 ${barH * 2}px ${withAlpha(activeColor, 1)}, 0 0 ${barH * 5}px ${withAlpha(activeColor, 0.7)}` });
  } else if (fx === "pill") {
    out.glow = act ? `0 0 ${fs * 0.2 * m}px ${withAlpha(activeColor, 0.6 * m)}, ` : "";
    out.transform = act ? `translateY(${-0.05 * pop}em)` : "";
    if (act) {
      const grow = 0.65 + 0.35 * ul;
      out.behind = (
        <span
          style={abs({
            left: "-0.06em",
            right: "-0.06em",
            top: "0.14em",
            bottom: "0.1em",
            borderRadius: "0.5em",
            background: withAlpha(activeColor, 0.26 * m),
            border: `${Math.max(1.5, 2 * u)}px solid ${withAlpha(activeColor, 0.9 * m)}`,
            boxShadow: `0 0 ${fs * 0.3}px ${withAlpha(activeColor, 0.45 * m)}`,
            transform: `scale(${grow})`,
            opacity: m,
            zIndex: -1,
          })}
        />
      );
    }
  } else if (fx === "drip") {
    const drop = look.state === "active" ? 1 - Math.min(1, pop) : 0;
    out.transform = `translateY(${-0.45 * drop}em)`;
    out.glow = act ? `0 0 ${fs * 0.3 * m}px ${withAlpha(activeColor, 0.7 * m)}, ` : "";
    if (look.underline > 0.01) {
      out.under = (
        <svg
          viewBox="0 0 100 10"
          preserveAspectRatio="none"
          style={abs({ left: "4%", right: "4%", bottom: "-0.02em", width: "92%", height: "0.2em", opacity: m, overflow: "visible" })}
        >
          <path d="M0 5 Q6.25 0 12.5 5 T25 5 T37.5 5 T50 5 T62.5 5 T75 5 T87.5 5 T100 5" pathLength={1} fill="none" stroke={activeColor} strokeWidth={Math.max(2, barH)} strokeLinecap="round" strokeDasharray={1} strokeDashoffset={1 - ul} vectorEffect="non-scaling-stroke" />
        </svg>
      );
    }
    if (act && ul < 0.999) {
      out.above = (
        <span style={abs({ left: "50%", top: `${-0.6 + 0.5 * ul}em`, width: "0.22em", height: "0.3em", marginLeft: "-0.11em", opacity: Math.sin(Math.PI * ul) * m })}>
          <Drop color={mixColors(activeColor, "#ffffff", 0.35)} />
        </span>
      );
    }
  } else if (fx === "frost") {
    out.color = mixColors(a.color, "#f2fbff", 0.45 * m);
    out.glow = act ? `0 0 ${fs * 0.22 * m}px ${withAlpha("#ffffff", 0.85 * m)}, 0 0 ${fs * 0.55 * m}px ${withAlpha(activeColor, 0.6 * m)}, ` : "";
    out.transform = act ? `rotate(${Math.sin(frame * 0.5) * 1.4 * m}deg)` : "";
    out.under = bar({ background: movingBar(activeColor, "#ffffff", frame, 28), boxShadow: `0 0 ${barH * 2}px ${withAlpha("#ffffff", 0.7)}` });
    if (act) {
      out.above = (
        <span style={abs({ top: "-0.34em", left: "50%", width: "0.34em", height: "0.34em", marginLeft: "-0.17em", opacity: m * 0.95, transform: `rotate(${frame * 2.2}deg) scale(${0.6 + 0.5 * pop})` })}>
          <Snowflake color="#ffffff" />
        </span>
      );
    }
  } else {
    // bloom
    out.glow = act ? `0 0 ${fs * 0.22 * m}px ${withAlpha(activeColor, 0.6 * m)}, ` : "";
    out.transform = act ? `rotate(${Math.sin(frame * 0.18) * 2.2 * m}deg)` : "";
    if (act) {
      out.behind = (
        <span
          style={abs({
            left: "-0.04em",
            width: "108%",
            top: "0.5em",
            height: "0.5em",
            borderRadius: "0.25em",
            background: withAlpha(activeColor, 0.5 * m),
            transformOrigin: "0% 50%",
            transform: `scaleX(${ul}) skewX(-8deg)`,
            zIndex: -1,
          })}
        />
      );
      out.above = (
        <span style={abs({ top: "-0.34em", right: "-0.1em", width: "0.38em", height: "0.38em", opacity: m, transform: `rotate(${frame * 3}deg) scale(${0.5 + 0.6 * pop})` })}>
          <Flower color={activeColor} center="#fff2b0" />
        </span>
      );
    }
  }
  return out;
}
