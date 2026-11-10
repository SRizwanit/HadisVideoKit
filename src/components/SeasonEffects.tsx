import React from "react";
import { random, useCurrentFrame } from "remotion";
import { lerp, smoothstep } from "../lib/sky";
import type { SeasonEffect } from "../themes";

/**
 * ঋতুর এফেক্ট (বর্ষা / শীত / বসন্ত) — আকাশের উপরে, জোনাকির নিচে।
 *   rain   (বর্ষা) : তির্যক বৃষ্টির রেখা + (থাকলে) বিদ্যুৎ-ঝলক — রাতের দিকে জোরালো
 *   mist   (শীত)   : ভেসে চলা কুয়াশার স্তর + নিচে ঘন কুয়াশা + ঝিলমিল হিমকণা
 *   petals (বসন্ত) : দুলতে দুলতে ঝরা পাপড়ি (ঘুরে, ফ্লিপ করে)
 * নিয়ম (বাকি কিটের মতোই): রেন্ডার-সেফ — Math.random() নয়, random(seed) + useCurrentFrame(); CSS animation নয়।
 * স্বচ্ছতা: `dayOpacity` (nightFactor ০) → `nightOpacity` (১), মাঝে মসৃণ মিশ্রণ।
 */

type Props = {
  width: number;
  height: number;
  nightFactor: number;
  effect: SeasonEffect;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const Rain: React.FC<{ width: number; height: number; nf: number; effect: SeasonEffect; alpha: number }> = ({
  width,
  height,
  nf,
  effect,
  alpha,
}) => {
  const frame = useCurrentFrame();
  const unit = Math.min(width, height) / 1080;
  const color = effect.colors[0] ?? "#d6eef5";
  const slope = 0.2; // প্রতি ১ px নামায় ০.২ px ডানে
  const deg = (Math.atan(slope) * 180) / Math.PI;

  // বিদ্যুৎ: প্রতি ১১০ ফ্রেমের চক্রে (~৩.৭s) সর্বোচ্চ একবার, দুবার আস্তে ঝলকে মিলিয়ে যায়
  let flash = 0;
  if (effect.lightning) {
    const cycle = 110;
    const k = Math.floor(frame / cycle);
    const fire = random(`ltn-fire-${k}`) > 0.35;
    const offset = Math.floor(random(`ltn-off-${k}`) * (cycle - 24));
    const t = frame - k * cycle - offset;
    if (fire && t >= 0 && t < 18) {
      flash = t < 2 ? 1 : t < 4 ? 0.25 : t < 6 ? 0.8 : Math.exp(-(t - 6) / 3) * 0.5;
    }
  }
  // দিনে ক্ষীণ, রাতে পূর্ণ
  const flashStrength = 0.15 + 0.85 * smoothstep((nf - 0.15) / 0.6);

  return (
    <>
      {Array.from({ length: effect.count }, (_, i) => {
        const depth = random(`rn-d-${i}`); // ০ = দূরে, ১ = কাছে
        const len = (36 + 70 * depth) * unit;
        const speed = (24 + 22 * depth) * unit; // px/ফ্রেম
        const wrapH = height + len * 2;
        const y = ((random(`rn-y-${i}`) * wrapH + frame * speed) % wrapH) - len;
        const x = random(`rn-x-${i}`) * width * 1.25 - width * 0.1 + y * slope;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: (1.4 + 1.6 * depth) * unit,
              height: len,
              background: `linear-gradient(to bottom, transparent 0%, ${color} 100%)`,
              opacity: alpha * (0.25 + 0.55 * depth),
              transform: `rotate(-${deg}deg)`,
              transformOrigin: "50% 0%",
              borderRadius: 2 * unit,
            }}
          />
        );
      })}
      {flash > 0.001 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `rgba(215, 230, 255, ${Math.round(flash * 0.3 * flashStrength * 1000) / 1000})`,
          }}
        />
      )}
    </>
  );
};

const Mist: React.FC<{ width: number; height: number; effect: SeasonEffect; alpha: number }> = ({
  width,
  height,
  effect,
  alpha,
}) => {
  const frame = useCurrentFrame();
  const unit = Math.min(width, height) / 1080;
  const color = effect.colors[0] ?? "#ffffff";
  const sparkles = effect.count * 5;

  return (
    <>
      {/* নিচের ঘন কুয়াশা */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: height * 0.4,
          opacity: alpha * 0.55,
          background: `linear-gradient(to top, ${color} 0%, ${color}66 45%, transparent 100%)`,
        }}
      />
      {/* ভেসে চলা কুয়াশার স্তর */}
      {Array.from({ length: effect.count }, (_, i) => {
        const w = width * (0.9 + 0.7 * random(`ms-w-${i}`));
        const h = height * (0.1 + 0.09 * random(`ms-h-${i}`));
        const span = width + w * 2;
        const speed = (0.35 + 0.55 * random(`ms-sp-${i}`)) * unit;
        const x = ((((random(`ms-x-${i}`) * span + frame * speed) % span) + span) % span) - w;
        const y = height * (0.42 + 0.5 * random(`ms-y-${i}`));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: w,
              height: h,
              borderRadius: "50%",
              opacity: alpha * (0.35 + 0.35 * random(`ms-o-${i}`)),
              background: `radial-gradient(ellipse at center, ${color} 0%, ${color}00 70%)`,
              filter: `blur(${16 * unit}px)`,
            }}
          />
        );
      })}
      {/* ঝিলমিল হিমকণা: ধীরে নামে ও দুলে */}
      {Array.from({ length: sparkles }, (_, i) => {
        const size = (2 + 3.2 * random(`fr-s-${i}`)) * unit;
        const wrapH = height + 40 * unit;
        const fall = (0.25 + 0.5 * random(`fr-v-${i}`)) * unit;
        const y = ((random(`fr-y-${i}`) * wrapH + frame * fall) % wrapH) - 20 * unit;
        const sway = Math.sin(frame * (0.012 + 0.02 * random(`fr-w-${i}`)) + random(`fr-p-${i}`) * 6.28) * 26 * unit;
        const tw = 0.5 + 0.5 * Math.sin(frame * (0.03 + 0.05 * random(`fr-t-${i}`)) + random(`fr-q-${i}`) * 6.28);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: random(`fr-x-${i}`) * width + sway,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: color,
              opacity: alpha * (0.2 + 0.6 * tw),
              boxShadow: `0 0 ${size * 3}px ${color}`,
            }}
          />
        );
      })}
    </>
  );
};

const Petals: React.FC<{ width: number; height: number; effect: SeasonEffect; alpha: number; leaf?: boolean }> = ({
  width,
  height,
  effect,
  alpha,
  leaf = false,
}) => {
  const frame = useCurrentFrame();
  const unit = Math.min(width, height) / 1080;
  const colors = effect.colors.length > 0 ? effect.colors : ["#ff5a36"];

  return (
    <>
      {Array.from({ length: effect.count }, (_, i) => {
        const depth = random(`pt2-d-${i}`); // ০ = দূরে, ১ = কাছে
        const size = (leaf ? 22 + 26 * depth : 14 + 20 * depth) * unit;
        const wrapH = height + size * 4;
        const fall = (leaf ? 0.8 + 1.3 * depth : 1.1 + 1.7 * depth) * unit; // px/ফ্রেম
        const y = ((random(`pt2-y-${i}`) * wrapH + frame * fall) % wrapH) - size * 2;
        const phase = random(`pt2-p-${i}`) * Math.PI * 2;
        const sway = Math.sin(frame * (0.018 + 0.026 * random(`pt2-w-${i}`)) + phase) * 70 * unit;
        const spin = frame * (0.8 + 1.4 * random(`pt2-r-${i}`)) * (random(`pt2-dir-${i}`) > 0.5 ? 1 : -1) + phase * 57.3;
        const flip = 0.35 + 0.65 * Math.abs(Math.cos(frame * 0.045 + phase));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: random(`pt2-x-${i}`) * width + sway,
              top: y,
              width: size,
              height: size * 0.72,
              background: colors[i % colors.length],
              borderRadius: leaf ? "0 100% 0 100%" : "100% 0 100% 0",
              opacity: alpha * (0.55 + 0.45 * depth),
              transform: `rotate(${spin}deg) scaleX(${flip})`,
              boxShadow: `0 0 ${size * 0.4}px ${colors[i % colors.length]}55`,
            }}
          />
        );
      })}
    </>
  );
};

export const SeasonEffects: React.FC<Props> = ({ width, height, nightFactor, effect }) => {
  const nf = clamp01(nightFactor);
  const alpha = lerp(effect.dayOpacity, effect.nightOpacity, smoothstep(nf));

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {effect.kind === "rain" && <Rain width={width} height={height} nf={nf} effect={effect} alpha={alpha} />}
      {effect.kind === "mist" && <Mist width={width} height={height} effect={effect} alpha={alpha} />}
      {effect.kind === "petals" && <Petals width={width} height={height} effect={effect} alpha={alpha} />}
      {effect.kind === "leaves" && <Petals width={width} height={height} effect={effect} alpha={alpha} leaf />}
    </div>
  );
};
