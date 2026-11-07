import React from "react";
import { random, useCurrentFrame } from "remotion";
import { fireflyAppear, fireflyVisibility } from "../lib/sky";

/**
 * Part 6: জোনাকি 🌿✨ (greenDayNight)
 * - রেন্ডার-সেফ: Math.random() নয়, random(seed) + useCurrentFrame() — প্রতি রেন্ডারে একই ফল
 * - sin/cos মিশ্রণে আঁকাবাঁকা ভাসা; হলদে-সবুজ গ্লো; নরম পালস (জ্বলা-নেভা)
 * - দূরের জোনাকি ছোট ও ক্ষীণ, কাছেরগুলো বড় ও উজ্জ্বল
 * - দিনে প্রায় অদৃশ্য, রাতে পূর্ণ (nightFactor)
 */

type Props = {
  width: number;
  height: number;
  nightFactor: number;
  count: number;
  color: string;
  glow: string;
};

export const Fireflies: React.FC<Props> = ({ width, height, nightFactor, count, color, glow }) => {
  const frame = useCurrentFrame();
  const unit = Math.min(width, height) / 1080;
  const visibility = fireflyVisibility(nightFactor);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {Array.from({ length: count }, (_, i) => {
        const appear = fireflyAppear(visibility, random(`ff-thr-${i}`));
        if (appear <= 0.001) return null;

        const depth = random(`ff-depth-${i}`); // ০ = দূরে, ১ = কাছে
        const baseX = random(`ff-x-${i}`) * width;
        const baseY = height * (0.3 + 0.65 * random(`ff-y-${i}`));
        const ampX = (50 + 110 * random(`ff-ax-${i}`)) * unit;
        const ampY = (30 + 80 * random(`ff-ay-${i}`)) * unit;
        const speed = 0.006 + 0.012 * random(`ff-sp-${i}`);
        const phase = random(`ff-ph-${i}`) * Math.PI * 2;
        const t = frame * speed;

        const x =
          baseX + Math.sin(t * 1.3 + phase) * ampX + Math.sin(t * 3.1 + phase * 2) * ampX * 0.25;
        const y =
          baseY + Math.cos(t * 0.9 + phase) * ampY + Math.sin(t * 2.3 + phase) * ampY * 0.3 - frame * 0.05 * unit * (0.3 + depth);

        // জ্বলা-নেভা: ০.৩ থেকে ১ এর মধ্যে নরম পালস
        const pulseSpeed = 0.05 + 0.06 * random(`ff-pl-${i}`);
        const pulse = 0.5 + 0.5 * Math.sin(frame * pulseSpeed + phase * 3);
        const blink = 0.3 + 0.7 * pulse * pulse;

        const r = (3 + 6 * depth) * unit; // কেন্দ্রের আকার
        const halo = r * (5 + 3 * (1 - depth)); // দূরেরটা বেশি ঝাপসা
        const alpha = appear * blink * (0.45 + 0.55 * depth);

        // উপরে উঠে গেলে ঘুরে নিচে ফেরা (স্ক্রিনের বাইরে হারিয়ে না যায়)
        const wrapH = height * 1.1;
        const yy = ((((y - height * 0.2) % wrapH) + wrapH) % wrapH) + height * 0.2 - height * 0.05;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - halo / 2,
              top: yy - halo / 2,
              width: halo,
              height: halo,
              borderRadius: "50%",
              opacity: alpha,
              background: `radial-gradient(circle, ${color} 0%, ${color} ${Math.round((r / halo) * 100)}%, ${glow} ${Math.round((r / halo) * 100) + 12}%, transparent 70%)`,
            }}
          />
        );
      })}
    </div>
  );
};
