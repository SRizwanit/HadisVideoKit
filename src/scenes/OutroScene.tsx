import React from "react";
import { Audio, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { FitText } from "../components/FitText";
import { Logo } from "../components/Logo";
import { PlayBadge } from "../components/PlayBadge";
import { APP_NAME, DEFAULT_SFX_VOLUME, OUTRO_TEXT } from "../constants";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { OUTRO_STEPS, outroLayout, planOutro, typewriterText } from "../lib/outroPlan";
import type { Timing } from "../lib/timing";
import { computeLayout } from "../lib/useLayout";
import { useNightFactor } from "../lib/useNightFactor";
import { useSfxSrc } from "../lib/useSfxSrc";
import { getThemeColors, parseColor } from "../themes";
import type { ThemeId } from "../types";
import { splitAppName } from "./IntroScene";

/**
 * Part 12D: Outro সিন (ডিফল্ট ৪ সেকেন্ড = ১২০ ফ্রেম)।
 *
 * ক্রম (১২০ ফ্রেমের হিসাবে; সব সময়/মাপ `outroPlan.ts` থেকে — এখানে কোনো হিসাব নেই):
 *   ০     লোগো স্কেল-ইন + glow · ৮/১৪ অ্যাপের নাম দুই লাইনে (উঠে আসে)
 *   ২০–৪৮ "আজই প্লে স্টোর থেকে ইনস্টল করুন:" টাইপ হয় (যুক্তাক্ষর কখনো ভাঙে না)
 *   ৫০    Play ব্যাজ bounce-in (+ ঐচ্ছিক `chime`) · ৬৬ shine · ৮০ pulse · ৮৬ ট্যাপ-ইঙ্গিত
 *   শেষ ১২ ফ্রেম ফেড-আউট (সামান্য বড় হতে হতে)
 * Outro ১২০-র কম হলে ক্রম চেপে আসে, বেশি হলে স্বাভাবিক গতিতে হয়ে স্থির থাকে (pulse/ট্যাপ চলতে থাকে);
 * ৬ ফ্রেমের কম হলে অ্যানিমেশন ছাড়া শেষ অবস্থার স্থির দৃশ্য; ০ হলে কিছুই আঁকে না। (`IntroScene`-এর মতোই নিয়ম।)
 *
 * - ব্যাকগ্রাউন্ড এখানে আঁকা হয় না; Part 13-এ `<Background>` পেছনে থাকবে।
 * - সব লেখা থিমের আধা-স্বচ্ছ গাঢ় প্যানেলে (`panelBg`) → greenDayNight-এর রাতে ফায়ারফ্লাই/তারার মাঝেও পড়া যায়।
 * - SFX: Part 11-এর `SfxPlayer` Outro-র প্রথম ফ্রেমে `whoosh` বাজায় (এখানে ছোঁয়া হয়নি); এখানে ব্যাজ আসার সময় ঐচ্ছিক `chime`।
 */

type Props = {
  theme: ThemeId;
  timing: Timing;
  /** dev প্রিভিউয়ের জন্য সরাসরি nightFactor (timing-কে ছাপিয়ে যায়) */
  nightFactor?: number;
  /**
   * Outro `<Sequence from>`-এর অফসেট (ফ্রেম), দিন/রাতের রঙের জন্য (Part 7-এর নিয়ম)।
   * ডিফল্ট = `timing.introFrames + timing.mainFrames` (Part 13-এ Outro Sequence ঠিক সেখানেই শুরু), তাই Part 13-এ আলাদা করে দিতে হয় না।
   */
  frameOffset?: number;
  /** dev প্রিভিউয়ের জন্য: Outro সিনের নিজের (০-ভিত্তিক) ফ্রেম সরাসরি — না দিলে `useCurrentFrame()` */
  frame?: number;
  /** dev প্রিভিউয়ের জন্য: ভিডিওর সাইজ ছাড়া অন্য সাইজে লেআউট */
  size?: { width: number; height: number };
  /** false হলে chime খোঁজাও হয় না (dev প্রিভিউ) */
  sfx?: boolean;
};

/** ব্যাজ আসার সময়ের ঐচ্ছিক chime (ফাইল না থাকলে চুপচাপ বাদ); বন্ধ করতে `OUTRO_CHIME_ENABLED = false` */
export const OUTRO_CHIME_NAME = "chime";
export const OUTRO_CHIME_ENABLED = true;

function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color);
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${alpha})`;
}

export const OutroScene: React.FC<Props> = ({
  theme,
  timing,
  nightFactor,
  frameOffset,
  frame,
  size,
  sfx = true,
}) => {
  const currentFrame = useCurrentFrame();
  const video = useVideoConfig();
  const width = size?.width ?? video.width;
  const height = size?.height ?? video.height;
  const outroFrames = timing.outroFrames;
  const localFrame = frame ?? currentFrame;

  const computedNight = useNightFactor(timing, frameOffset ?? timing.introFrames + timing.mainFrames);
  const night = nightFactor ?? computedNight;
  const p = getThemeColors(theme, night);

  const chimeSrc = useSfxSrc(sfx && OUTRO_CHIME_ENABLED ? OUTRO_CHIME_NAME : null);

  const plan = planOutro(localFrame, outroFrames);
  if (!plan) return null; // Outro ০ ফ্রেম/অবৈধ → কিছুই আঁকা হয় না

  const L = outroLayout(computeLayout(width, height));
  const u = L.unit;
  const [line1, line2] = splitAppName(APP_NAME);
  const lines = [line1, line2].filter((l) => l.length > 0);
  const lineH = L.fonts.name * 1.25;
  const typed = typewriterText(OUTRO_TEXT, plan.text.typed);
  const logoGlow = L.logo.size * 1.9;

  const chimeFrom = Math.round(OUTRO_STEPS.badge * plan.speed);

  return (
    <div
      data-outro-scene={plan.isStatic ? "static" : "anim"}
      data-outro-typed={typed.length}
      style={{
        position: "absolute",
        inset: 0,
        width,
        height,
        opacity: plan.scene.opacity,
        transform: `scale(${plan.scene.scale})`,
        transformOrigin: "50% 50%",
        overflow: "hidden",
      }}
    >
      {/* প্যানেল: সব লেখা/ব্যাজ এর উপরে — রাতের আকাশেও পড়া যায় */}
      <div
        data-outro-panel="1"
        style={{
          position: "absolute",
          left: L.panel.x,
          top: L.panel.y,
          width: L.panel.width,
          height: L.panel.height,
          boxSizing: "border-box",
          borderRadius: L.panelRadius,
          background: p.panelBg,
          border: `${3 * u}px solid ${p.panelBorder}`,
          boxShadow: `0 ${16 * u}px ${56 * u}px rgba(0,0,0,0.4), 0 0 ${48 * u}px ${withAlpha(p.glow, 0.25)}`,
        }}
      />

      {/* লোগো (স্কেল-ইন) + পেছনের নরম আলোর বৃত্ত */}
      <div
        data-outro-logo="1"
        style={{
          position: "absolute",
          left: L.logo.x,
          top: L.logo.y,
          width: L.logo.size,
          height: L.logo.size,
          opacity: plan.logo.opacity,
          transform: `scale(${plan.logo.scale})`,
          transformOrigin: "50% 50%",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: logoGlow,
            height: logoGlow,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${withAlpha(p.glow, 0.38 * plan.glow)} 0%, ${withAlpha(p.glow, 0)} 65%)`,
          }}
        />
        <Logo
          size={L.logo.size}
          ringColor={p.accent}
          ringColor2={p.accent2}
          glowColor={p.glow}
          glowStrength={1.25}
          style={{ position: "relative" }}
        />
      </div>

      {/* অ্যাপের নাম — দুই লাইন, একটার পর একটা উঠে আসে */}
      <div
        data-outro-name="1"
        style={{
          position: "absolute",
          left: L.name.x,
          top: L.name.y,
          width: L.name.width,
          height: L.name.height,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {lines.map((text, i) => {
          const look = plan.name[Math.min(i, 1)];
          return (
            <div
              key={i}
              style={{
                width: "100%",
                height: lineH,
                display: "flex",
                alignItems: "center",
                // Part 14C-fix: বাংলা মাথার অংশ কাটা বন্ধ — FitText নিজে উপরে বাড়তি জায়গা রাখে, এখানে কিছু কাটা হয় না
                overflow: "visible",
                opacity: look.opacity,
                transform: `translateY(${look.offsetUnits * u}px)`,
              }}
            >
              <FitText
                text={text}
                baseSize={L.fonts.name}
                minSize={L.fonts.name * 0.55}
                maxWidth={L.name.width}
                color={p.text}
                fontFamily={FONT_DISPLAY}
                fontWeight={700}
                lineHeight={1.25}
                textAlign="center"
                maxLines={1}
              />
            </div>
          );
        })}
      </div>

      {/* CTA লেখা — টাইপ হয় (ইউনিট ধরে), সাইজ/লাইন-ভাঙা পুরো লেখা ধরে ঠিক */}
      <div
        data-outro-text="1"
        style={{
          position: "absolute",
          left: L.text.x,
          top: L.text.y,
          width: L.text.width,
          height: L.text.height,
          display: "flex",
          alignItems: "center",
          opacity: plan.text.opacity,
          transform: `translateY(${plan.text.offsetUnits * u}px)`,
        }}
      >
        <FitText
          text={OUTRO_TEXT}
          visibleText={typed}
          baseSize={L.fonts.text}
          minSize={L.fonts.text * 0.6}
          maxWidth={L.text.width}
          color={p.accent2}
          fontFamily={FONT_BODY}
          fontWeight={700}
          lineHeight={1.3}
          textAlign="center"
          maxLines={2}
        />
      </div>

      {/* Play ব্যাজ (bounce · pulse · shine) + ট্যাপ-ইঙ্গিত — দুটোই PlayBadge আঁকে */}
      <PlayBadge
        box={L.badge}
        tapBox={L.tap}
        unit={u}
        outroFrames={outroFrames}
        frame={localFrame}
        nightFactor={night}
        tapColor={p.accent2}
      />

      {/* ঐচ্ছিক chime: ব্যাজ আসার মুহূর্তে; ফাইল না থাকলে src null → কিছুই বাজে না */}
      {chimeSrc && !plan.isStatic && chimeFrom < outroFrames ? (
        <Sequence from={chimeFrom} durationInFrames={Math.max(1, outroFrames - chimeFrom)} layout="none">
          <Audio src={chimeSrc} volume={DEFAULT_SFX_VOLUME} />
        </Sequence>
      ) : null}
    </div>
  );
};
