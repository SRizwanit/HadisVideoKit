import React from "react";
import { Img, useCurrentFrame } from "remotion";
import badge from "../google-play-badge.png";
import handCursor from "../hand-cursor.png";
import {
  BADGE_ASPECT,
  BADGE_MAX_SCALE,
  OUTRO_BASE_FRAMES,
  OUTRO_TAP_ENABLED,
  SHINE_ANGLE_DEG,
  SHINE_BAND,
  CLICK_PRESS_SCALE,
  badgeIsSharp,
  badgeSize,
  planOutro,
  scaledBox,
  shineCenter,
  tapLook,
  type ClickLook,
  type OutroPlan,
} from "../lib/outroPlan";
import type { Box } from "../lib/useLayout";

/**
 * Part 12B: Google Play ব্যাজ — ছবি + আস্পেক্ট রেশিও + clear space + spring bounce-in।
 * Part 12C (এই ফাইলেই যোগ): ধীর pulse, একবারের shine sweep (ব্যাজের আকারে মাস্ক করা), ঐচ্ছিক "ট্যাপ" ইঙ্গিত, রাতের জন্য হালকা গাঢ় halo।
 * 12B-র আঁকা ও জায়গা (rest box) বদলায়নি।
 * Cursor-আপডেট: পুরনো তীর-ইঙ্গিত সরিয়ে `src/hand-cursor.png` (হাত + ক্লিক-রেখা) বসানো — নিচ থেকে উঠে এসে ব্যাজে ক্লিক করে (চাপ + রিং-ঢেউ + ব্যাজে হালকা হাইলাইট), তারপর নেমে যায়; Outro লম্বা হলে চক্র চলতে থাকে।
 *   সময়/ধাপ সব `outroPlan.ts`-এর `clickLook` থেকে; এখানে শুধু আঁকা। `tapBox` এখন শুধু "কার্সর চালু কি না"-র সংকেত (জায়গা ব্যাজের ওপরেই)।
 *
 * - সব সংখ্যা `outroPlan.ts` থেকে আসে (`planOutro().badge`, `badgeSize`, `badgeIsSharp`); এখানে কোনো সময়/মাপের হিসাব নেই।
 * - সবকিছু ফ্রেম থেকে হিসাব (CSS animation / Math.random() / remotion `spring()` নেই) → রেন্ডারে নিরাপদ।
 * - ছবি Remotion `Img` দিয়ে (লোড হওয়া পর্যন্ত রেন্ডার অপেক্ষা করে)।
 * - আস্পেক্ট রেশিও কখনো বিকৃত হয় না: বাক্সের উচ্চতা = প্রস্থ ÷ `BADGE_ASPECT` (`badgeSize`), ছবি `object-fit: contain`।
 * - Clear space (ব্যাজের উচ্চতার ¼, Google-এর নিয়ম) বসানো হয় লেআউটে (`outroLayout().badge.outer`); এই কম্পোনেন্ট শুধু নিজের বাক্সটুকু আঁকে,
 *   তাই bounce-এর ভেতরেও clear space-এ ঢোকে না (`BADGE_MAX_SCALE`-এর জায়গা `outer`-এ রাখা আছে)।
 */

export type PlayBadgeProps = {
  /** ব্যাজের স্থির (scale = ১) বাক্স — সাধারণত `outroLayout(layout).badge` (x, y, width, height)। height দিলেও আস্পেক্ট থেকে নতুন করে হিসাব হয় */
  box: Box;
  /** Outro সিনের মোট ফ্রেম (ডিফল্ট ১২০ = ৪ সেকেন্ড) */
  outroFrames?: number;
  /** dev প্রিভিউয়ের জন্য: Outro সিনের নিজের (০-ভিত্তিক) ফ্রেম সরাসরি — না দিলে `useCurrentFrame()` */
  frame?: number;
  /** আস্পেক্ট রেশিও (ডিফল্ট ফাইলের রেশিও `BADGE_ASPECT`) */
  aspect?: number;
  /** একই পাতায় একাধিক ব্যাজ থাকলে আলাদা চেনার নাম (শুধু `data-` অ্যাট্রিবিউটে) */
  label?: string;
  /** "ট্যাপ" ইঙ্গিতের বাক্স — সাধারণত `outroLayout().tap` (ব্যাজের `outer`-এর নিচে, clear space-এর বাইরে)। না দিলে ইঙ্গিত আঁকা হয় না */
  tapBox?: Box;
  /** layout `unit` (ট্যাপ-ইঙ্গিতের ওঠানামা unit→px; 4K = ২×)। ডিফল্ট ১ */
  unit?: number;
  /** ট্যাপ-ইঙ্গিত চালু/বন্ধ (ডিফল্ট `OUTRO_TAP_ENABLED`; এক জায়গায় বদলালেই বন্ধ) */
  showTap?: boolean;
  /** ট্যাপ-ইঙ্গিতের রঙ (ডিফল্ট সাদা) */
  tapColor?: string;
  /** রাত-ফ্যাক্টর ০…১ — ব্যাজের পেছনের গাঢ় halo কতটা জোরালো (ডিফল্ট ০ = দিন) */
  nightFactor?: number;
  /** প্রিভিউ-ডিবাগ: আসল বাক্স ও clear space-এর রেখা আঁকে (ডিফল্ট false; আসল ভিডিওতে কখনো নয়) */
  debugOutline?: boolean;
  style?: React.CSSProperties;
};

/** এই ফ্রেমে ব্যাজ আসলে কোথায়/কত বড়/কতটা স্বচ্ছ — বিশুদ্ধ হিসাব (কম্পোনেন্ট ও যাচাই দুটোই ব্যবহার করে) */
export type PlayBadgeLook = {
  /** আঁকা হচ্ছে কি (bounce-in শুরু হয়নি বা Outro ০ ফ্রেম → false) */
  visible: boolean;
  opacity: number;
  /** আঁকা স্কেল = `plan.badge.scale × plan.pulse` (≤ `BADGE_MAX_SCALE`) */
  scale: number;
  /** শুধু pulse গুণক (১…১.০৬) */
  pulse: number;
  /** স্থির অবস্থার ব্যাজ-বাক্স (scale = ১; আস্পেক্ট ঠিক) */
  rest: Box;
  /** এখন আঁকা বাক্স (কেন্দ্র ধরে স্কেল করা) */
  drawn: Box;
  /** ব্যাজের উচ্চতার ¼ */
  clear: number;
  /** PNG-র আসল পিক্সেলের মধ্যে আঁকা হচ্ছে কি (বড় করা হচ্ছে না → ঝাপসা নয়) */
  sharp: boolean;
  /** shine (rest বাক্সের স্থানাঙ্কে; ব্যাজের সঙ্গে একসাথে স্কেল হয়) */
  shine: {
    active: boolean;
    opacity: number;
    /** আলো-ফালির কেন্দ্রের x (px, ব্যাজের বাঁ কিনারা থেকে): −`bandWidth/2`-এর ওপাশ … প্রস্থ + … ; ব্যাজের বাইরে শুরু ও শেষ */
    centerX: number;
    /** ফালির প্রস্থ (px) */
    bandWidth: number;
    angleDeg: number;
  };
  /** ট্যাপ-ইঙ্গিতের পুরনো বাক্স/ওঠানামা (সিনের স্থানাঙ্কে) — আঁকা হয় না, শুধু আগের হিসাবের সাথে সামঞ্জস্যের জন্য রাখা */
  tap: { visible: boolean; opacity: number; box: Box; offsetY: number };
  /** হাতের ক্লিক-কার্সর (Play ব্যাজে ক্লিক) — `plan.click`; কার্সর বন্ধ/স্থির দৃশ্য/`tapBox` নেই হলে অদৃশ্য */
  click: ClickLook;
  /** halo-র শক্তি (০…) */
  haloAlpha: number;
};

/** ব্যাজের কোণের ব্যাসার্ধ ÷ উচ্চতা (PNG থেকে মাপা ≈ ০.১২) — halo ও shine-মাস্কের আকারের জন্য */
export const BADGE_CORNER_RATIO = 0.12;
/** halo: দিনে ও রাতে গাঢ় ছায়ার alpha (ব্যাজ ফায়ারফ্লাই/তারার মাঝে পরিষ্কার থাকে) */
export const BADGE_HALO_DAY = 0.25;
export const BADGE_HALO_NIGHT = 0.5;

/** হাতের কার্সরের আইকনে আঙুলের ডগা (ছবির ভগ্নাংশে) — এই বিন্দুটাই ব্যাজের লক্ষ্যে বসে ও চাপের সময় এখান ধরে ছোট হয় */
export const HAND_TIP = { x: 0.4, y: 0.14 } as const;
/** হাতের আইকনের মাপ = ব্যাজের উচ্চতা × এই */
export const HAND_SIZE_RATIO = 0.95;
/** ব্যাজের কোথায় ক্লিক পড়ে (ব্যাজের প্রস্থ/উচ্চতার ভগ্নাংশ) */
export const CLICK_TARGET = { x: 0.74, y: 0.52 } as const;
/** বিশ্রামের জায়গা: লক্ষ্য থেকে ডান-নিচে (হাতের মাপের ভগ্নাংশ) */
export const HAND_REST_OFFSET = { x: 0.18, y: 0.62 } as const;

const NO_CLICK_LOOK: ClickLook = { active: false, opacity: 0, approach: 0, press: 0, ripple: 0, rippleOpacity: 0 };

const NO_TAP = { visible: false, opacity: 0, box: { x: 0, y: 0, width: 0, height: 0 }, offsetY: 0 };

const finiteNum = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/**
 * বাক্স + প্ল্যান থেকে ব্যাজের চেহারা। `plan = null` (Outro ০ ফ্রেম/অবৈধ) বা প্রস্থ ≤ ০ → `visible: false`, কখনো throw করে না।
 * প্রস্থ (`box.width`) ধরা হয়; উচ্চতা সবসময় প্রস্থ ÷ আস্পেক্ট — পাঠানো `box.height` ভুল হলেও ব্যাজ বিকৃত হয় না।
 */
export function playBadgeLook(
  box: Box,
  plan: OutroPlan | null,
  aspect: number = BADGE_ASPECT,
  opts: { tapBox?: Box; unit?: number; showTap?: boolean; nightFactor?: number } = {},
): PlayBadgeLook {
  const size = badgeSize(finiteNum(box?.width, 0), aspect);
  const x = finiteNum(box?.x, 0);
  const y = finiteNum(box?.y, 0);
  // বাক্সের উচ্চতা ভুল দিলেও কেন্দ্র-ঠিক রাখতে: প্রস্থ ধরে উচ্চতা বদলে y-কে কেন্দ্র থেকে সরানো হয় না — ওপরের-বাঁ কোণ (x, y) স্থির
  const rest: Box = { x, y, width: size.width, height: size.height };
  const pulse = plan ? Math.max(1, finiteNum(plan.pulse, 1)) : 1;
  // pulse শুরুর আগেই bounce থিতিয়ে যায়; তবু কখনো `BADGE_MAX_SCALE`-এর বেশি নয় (outer-এ জায়গা সেটুকুই)
  const scale = plan ? Math.min(BADGE_MAX_SCALE, finiteNum(plan.badge.scale, 1) * pulse) : 1;
  const opacity = plan ? Math.min(1, Math.max(0, finiteNum(plan.badge.opacity, 0))) : 0;
  const visible = !!plan && plan.badge.visible && size.width > 0 && opacity > 0;
  // shine: একবার; ফালির কেন্দ্র ব্যাজের বাইরে থেকে ঢোকে ও বাইরে চলে যায় (`shineCenter`)
  const sh = plan ? plan.shine : { active: false, position: 0, opacity: 0 };
  const bandWidth = size.width * SHINE_BAND;
  const shine = {
    active: visible && sh.active && sh.opacity > 0,
    opacity: Math.min(1, Math.max(0, finiteNum(sh.opacity, 0))),
    centerX: shineCenter(finiteNum(sh.position, 0)) * size.width,
    bandWidth,
    angleDeg: SHINE_ANGLE_DEG,
  };

  // ট্যাপ-ইঙ্গিত: ব্যাজ দেখা দেওয়ার পরে; `tapBox` না দিলে বা `showTap = false` হলে অদৃশ্য
  const tb = opts.tapBox;
  const unit = finiteNum(opts.unit, 1) > 0 ? finiteNum(opts.unit, 1) : 1;
  let tap = NO_TAP;
  if (plan && !plan.isStatic && tb && finiteNum(tb.width, 0) > 0 && finiteNum(tb.height, 0) > 0) {
    const tl = tapLook(plan.t, opts.showTap ?? OUTRO_TAP_ENABLED);
    // নিচের দিকে ওঠানামা (ব্যাজের `outer`-এ কখনো ঢোকে না; প্যানেলের নিচের প্যাডিংয়ে থাকে)
    tap = {
      visible: tl.opacity > 0,
      opacity: tl.opacity,
      box: { x: finiteNum(tb.x, 0), y: finiteNum(tb.y, 0), width: tb.width, height: tb.height },
      offsetY: tl.offsetUnits * unit,
    };
  }

  const tapValid = !!tb && finiteNum(tb.width, 0) > 0 && finiteNum(tb.height, 0) > 0;
  const click: ClickLook =
    plan && !plan.isStatic && tapValid && (opts.showTap ?? OUTRO_TAP_ENABLED) && plan.click ? plan.click : NO_CLICK_LOOK;

  const night = Math.min(1, Math.max(0, finiteNum(opts.nightFactor, 0)));
  return {
    visible,
    opacity,
    scale,
    pulse,
    rest,
    drawn: scaledBox(rest, scale),
    clear: size.clear,
    sharp: badgeIsSharp(size.width),
    shine,
    tap,
    click,
    haloAlpha: BADGE_HALO_DAY + (BADGE_HALO_NIGHT - BADGE_HALO_DAY) * night,
  };
}

export const PlayBadge: React.FC<PlayBadgeProps> = ({
  box,
  outroFrames = OUTRO_BASE_FRAMES,
  frame,
  aspect = BADGE_ASPECT,
  label,
  debugOutline = false,
  style,
  tapBox,
  unit = 1,
  showTap = OUTRO_TAP_ENABLED,
  tapColor = "#ffffff",
  nightFactor = 0,
}) => {
  const currentFrame = useCurrentFrame();
  const plan = planOutro(frame ?? currentFrame, outroFrames);
  const look = playBadgeLook(box, plan, aspect, { tapBox, unit, showTap, nightFactor });

  // প্রস্থ অবৈধ/০ বা Outro ০ ফ্রেম → কিছুই আঁকা হয় না (crash নেই)
  if (!plan || look.rest.width <= 0 || look.rest.height <= 0) return null;

  const { rest, shine, click } = look;
  const radius = rest.height * BADGE_CORNER_RATIO;

  // হাতের কার্সর: আঙুলের ডগা বিশ্রামের জায়গা (ব্যাজের ডান-নিচে) থেকে ব্যাজের লক্ষ্যে যায়; চাপের সময় ডগা ধরে ছোট হয়
  const handSize = rest.height * HAND_SIZE_RATIO;
  const targetX = rest.x + rest.width * CLICK_TARGET.x;
  const targetY = rest.y + rest.height * CLICK_TARGET.y;
  const away = 1 - click.approach;
  const tipX = targetX + away * handSize * HAND_REST_OFFSET.x;
  const tipY = targetY + away * handSize * HAND_REST_OFFSET.y;
  const handScale = 1 - (1 - CLICK_PRESS_SCALE) * click.press;
  const rippleD = rest.height * (0.3 + 1.0 * click.ripple);
  return (
    <>
      <div
        data-play-badge={label ?? "badge"}
        data-badge-visible={look.visible ? "1" : "0"}
        data-badge-scale={look.scale.toFixed(4)}
        data-badge-pulse={look.pulse.toFixed(4)}
        data-badge-sharp={look.sharp ? "1" : "0"}
        data-badge-shine={shine.active ? "1" : "0"}
        style={{
          position: "absolute",
          left: rest.x,
          top: rest.y,
          width: rest.width,
          height: rest.height,
          opacity: look.visible ? look.opacity : 0,
          // কেন্দ্র ধরে স্কেল (bounce × pulse) → ব্যাজ মাঝখান থেকে বাড়ে, clear space-এর ভেতরে ঢোকে না (`outer`-এ জায়গা রাখা আছে)
          transform: `scale(${look.scale})`,
          transformOrigin: "50% 50%",
          pointerEvents: "none",
          ...style,
        }}
      >
        {/* halo: ব্যাজের পেছনে হালকা গাঢ় ছায়া — রাতের আকাশ/ফায়ারফ্লাইয়ের মাঝে ব্যাজ পরিষ্কার থাকে (রাতে জোরালো) */}
        <div
          data-badge-halo={look.haloAlpha.toFixed(3)}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: radius,
            boxShadow: `0 0 ${rest.height * 0.2}px ${rest.height * 0.04}px rgba(0, 0, 0, ${look.haloAlpha})`,
          }}
        />
        <Img
          src={badge}
          style={{
            position: "relative",
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
        {/* shine: ব্যাজের নিজের আকারে (PNG-র alpha) মাস্ক করা + overflow hidden — আলো বাইরে বেরোয় না; ব্যাজের সঙ্গে একসাথে স্কেল হয় */}
        {shine.active ? (
          <div
            data-badge-shine-layer="1"
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              borderRadius: radius,
              WebkitMaskImage: `url(${badge})`,
              maskImage: `url(${badge})`,
              WebkitMaskSize: "100% 100%",
              maskSize: "100% 100%",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: shine.centerX - shine.bandWidth / 2,
                top: -rest.height,
                width: shine.bandWidth,
                height: rest.height * 3,
                transform: `rotate(${shine.angleDeg}deg)`,
                transformOrigin: "50% 50%",
                opacity: shine.opacity,
                background:
                  "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0) 100%)",
              }}
            />
          </div>
        ) : null}
        {/* ক্লিকের মুহূর্তে ব্যাজে হালকা সাদা হাইলাইট (shine-এর মতো ব্যাজের আকারে মাস্ক করা) */}
        {click.press > 0 ? (
          <div
            data-badge-press="1"
            style={{
              position: "absolute",
              inset: 0,
              background: `rgba(255, 255, 255, ${(0.18 * click.press).toFixed(3)})`,
              WebkitMaskImage: `url(${badge})`,
              maskImage: `url(${badge})`,
              WebkitMaskSize: "100% 100%",
              maskSize: "100% 100%",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              pointerEvents: "none",
            }}
          />
        ) : null}
        {debugOutline ? (
          <>
            {/* আসল ব্যাজ-বাক্স */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                outline: "2px dashed rgba(0, 200, 255, 0.9)",
                pointerEvents: "none",
              }}
            />
            {/* clear space (উচ্চতার ¼ চারপাশে) */}
            <div
              style={{
                position: "absolute",
                left: -look.clear,
                top: -look.clear,
                width: rest.width + 2 * look.clear,
                height: rest.height + 2 * look.clear,
                outline: "2px dotted rgba(255, 200, 0, 0.9)",
                pointerEvents: "none",
              }}
            />
          </>
        ) : null}
      </div>
      {/* ক্লিকের রিং-ঢেউ: আঙুলের ডগা যেখানে ব্যাজ ছোঁয় সেখান থেকে ছড়ায় */}
      {click.rippleOpacity > 0 ? (
        <div
          data-badge-ripple="1"
          style={{
            position: "absolute",
            left: targetX - rippleD / 2,
            top: targetY - rippleD / 2,
            width: rippleD,
            height: rippleD,
            boxSizing: "border-box",
            borderRadius: "50%",
            border: `${Math.max(2, rest.height * 0.03)}px solid ${tapColor}`,
            background: "rgba(255, 255, 255, 0.18)",
            opacity: click.rippleOpacity,
            pointerEvents: "none",
          }}
        />
      ) : null}
      {/* হাতের কার্সর (`src/hand-cursor.png`): নিচ থেকে উঠে ব্যাজে ক্লিক করে, তারপর নেমে যায় */}
      {click.active ? (
        <Img
          data-badge-cursor="1"
          data-cursor-approach={click.approach.toFixed(3)}
          data-cursor-press={click.press.toFixed(3)}
          src={handCursor}
          style={{
            position: "absolute",
            left: tipX - HAND_TIP.x * handSize,
            top: tipY - HAND_TIP.y * handSize,
            width: handSize,
            height: handSize,
            opacity: click.opacity,
            transform: `scale(${handScale})`,
            transformOrigin: `${HAND_TIP.x * 100}% ${HAND_TIP.y * 100}%`,
            pointerEvents: "none",
            filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.45))",
          }}
        />
      ) : null}
    </>
  );
};
