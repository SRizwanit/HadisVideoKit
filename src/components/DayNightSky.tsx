import React from "react";
import { random, useCurrentFrame } from "remotion";
import {
  cloudOpacity,
  hillColors,
  moonOpacity,
  moonPosition,
  starFactor,
  sunOpacity,
  sunPosition,
} from "../lib/sky";
import { getThemeColors, skyGradient, THEMES } from "../themes";

/**
 * Part 6: দিন-রাতের আকাশ (greenDayNight)
 * আকাশের রঙ মিশ্রণ (দিন → গোধূলি → রাত), সূর্য-চাঁদ চাপ বরাবর গতি, মেঘ, মিটমিট তারা, দূরের টিলা।
 * সব অ্যানিমেশন useCurrentFrame() ভিত্তিক — CSS animation নয়।
 */

type Props = { width: number; height: number; nightFactor: number };

const STAR_COUNT = 70;
const CLOUDS = 5;

export const DayNightSky: React.FC<Props> = ({ width, height, nightFactor: nf }) => {
  const frame = useCurrentFrame();
  const unit = Math.min(width, height) / 1080;
  const scenery = THEMES.greenDayNight.scenery!;
  const palette = getThemeColors("greenDayNight", nf);

  const sun = sunPosition(nf, width, height);
  const sunOp = sunOpacity(nf);
  const moon = moonPosition(nf, width, height);
  const moonOp = moonOpacity(nf);
  const stars = starFactor(nf);
  const cloudOp = cloudOpacity(nf);

  const sunR = 110 * unit;
  const moonR = 90 * unit;
  const [hillBack, hillFront] = hillColors(nf);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: skyGradient(palette) }}>
      {/* তারা */}
      {stars > 0.001 &&
        Array.from({ length: STAR_COUNT }, (_, i) => {
          const x = random(`st-x-${i}`) * width;
          const y = random(`st-y-${i}`) * height * 0.68;
          const size = (2 + 3.5 * random(`st-s-${i}`)) * unit;
          const tw = 0.5 + 0.5 * Math.sin(frame * (0.04 + 0.06 * random(`st-t-${i}`)) + random(`st-p-${i}`) * 6.28);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: size,
                height: size,
                borderRadius: "50%",
                background: scenery.star,
                opacity: stars * (0.25 + 0.75 * tw),
                boxShadow: `0 0 ${size * 2.5}px ${scenery.star}`,
              }}
            />
          );
        })}

      {/* সূর্য: গ্লো + ঘূর্ণায়মান আলোকরশ্মি + গোলক */}
      {sunOp > 0.001 && (
        <div style={{ position: "absolute", left: sun.x, top: sun.y, opacity: sunOp }}>
          <div
            style={{
              position: "absolute",
              left: -sunR * 4,
              top: -sunR * 4,
              width: sunR * 8,
              height: sunR * 8,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${scenery.sun.glow}aa 0%, ${scenery.sun.glow}33 35%, transparent 68%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: -sunR * 3,
              top: -sunR * 3,
              width: sunR * 6,
              height: sunR * 6,
              borderRadius: "50%",
              background: `repeating-conic-gradient(from ${frame * 0.15}deg, ${scenery.sun.glow}40 0deg 7deg, transparent 7deg 30deg)`,
              WebkitMaskImage: "radial-gradient(circle, #000 15%, transparent 70%)",
              maskImage: "radial-gradient(circle, #000 15%, transparent 70%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: -sunR,
              top: -sunR,
              width: sunR * 2,
              height: sunR * 2,
              borderRadius: "50%",
              background: scenery.sun.color,
              boxShadow: `0 0 ${sunR * 0.8}px ${sunR * 0.3}px ${scenery.sun.glow}`,
            }}
          />
        </div>
      )}

      {/* চাঁদ: পূর্ণ চাঁদ + হালকা গর্ত + গ্লো */}
      {moonOp > 0.001 && (
        <div style={{ position: "absolute", left: moon.x, top: moon.y, opacity: moonOp }}>
          <div
            style={{
              position: "absolute",
              left: -moonR * 3,
              top: -moonR * 3,
              width: moonR * 6,
              height: moonR * 6,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${scenery.moon.glow}55 0%, ${scenery.moon.glow}1f 40%, transparent 70%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: -moonR,
              top: -moonR,
              width: moonR * 2,
              height: moonR * 2,
              borderRadius: "50%",
              background: scenery.moon.color,
              boxShadow: `0 0 ${moonR * 0.6}px ${moonR * 0.15}px ${scenery.moon.glow}88`,
              overflow: "hidden",
            }}
          >
            {[
              { x: 0.28, y: 0.3, s: 0.28 },
              { x: 0.62, y: 0.55, s: 0.34 },
              { x: 0.4, y: 0.72, s: 0.18 },
            ].map((c, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${c.x * 100}%`,
                  top: `${c.y * 100}%`,
                  width: `${c.s * 100}%`,
                  height: `${c.s * 100}%`,
                  borderRadius: "50%",
                  background: "rgba(150,170,120,0.22)",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ধীর মেঘ */}
      {cloudOp > 0.01 &&
        Array.from({ length: CLOUDS }, (_, i) => {
          const cw = (260 + 160 * random(`cl-w-${i}`)) * unit;
          const speed = (0.25 + 0.35 * random(`cl-sp-${i}`)) * unit;
          const span = width + cw * 2;
          const x = ((((random(`cl-x-${i}`) * span + frame * speed) % span) + span) % span) - cw;
          const y = height * (0.08 + 0.42 * random(`cl-y-${i}`));
          const ch = cw * 0.38;
          return (
            <div key={i} style={{ position: "absolute", left: x, top: y, width: cw, height: ch, opacity: cloudOp }}>
              {[
                { l: 0, t: 0.35, w: 0.5, h: 0.65 },
                { l: 0.22, t: 0, w: 0.46, h: 0.8 },
                { l: 0.5, t: 0.25, w: 0.5, h: 0.75 },
              ].map((b, k) => (
                <div
                  key={k}
                  style={{
                    position: "absolute",
                    left: `${b.l * 100}%`,
                    top: `${b.t * 100}%`,
                    width: `${b.w * 100}%`,
                    height: `${b.h * 100}%`,
                    borderRadius: "50%",
                    background: scenery.cloud,
                    filter: `blur(${4 * unit}px)`,
                  }}
                />
              ))}
            </div>
          );
        })}

      {/* দূরের সবুজ টিলা */}
      <svg
        width={width}
        height={height * 0.2}
        viewBox="0 0 1000 200"
        preserveAspectRatio="none"
        style={{ position: "absolute", left: 0, bottom: 0 }}
      >
        <path d="M0 120 Q 120 40 260 100 T 520 90 T 780 70 T 1000 110 V200 H0 Z" fill={hillBack} />
        <path d="M0 160 Q 160 100 330 150 T 640 140 T 1000 150 V200 H0 Z" fill={hillFront} />
      </svg>
    </div>
  );
};
