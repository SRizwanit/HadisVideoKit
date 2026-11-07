import React, { useLayoutEffect, useRef, useState } from "react";
import { fitFontSize, type FitResult } from "../lib/fitText";

/**
 * Part 7: বক্সে আঁটা টেক্সট।
 * লুকানো একটা `span`-এ বেস সাইজে লেখাটা মেপে (এক লাইনে) `fitFontSize` দিয়ে ফন্ট ঠিক করে।
 * মাপ হয় ব্রাউজারের লেআউটে (`offsetWidth` — transform/scale-এর প্রভাব নেই), তাই
 * অ্যানিমেশন বা 4K scale-এ ফল বদলায় না। ফন্ট লোড শেষ হলে আবার মাপে।
 */

type Props = {
  text: string;
  baseSize: number;
  minSize: number;
  maxWidth: number;
  color: string;
  fontFamily: string;
  fontWeight?: number;
  lineHeight?: number;
  textAlign?: React.CSSProperties["textAlign"];
  maxLines?: number;
  /**
   * Part 12D (ছোট যোগ, ঐচ্ছিক): `text`-এর শুরুর অংশ (prefix) — শুধু এটুকু দেখা যায়, বাকিটা স্বচ্ছ থেকে জায়গা ধরে রাখে।
   * টাইপরাইটারে (Outro-র CTA) ফন্ট-সাইজ ও লাইন-ভাঙা সবসময় পুরো `text` ধরে ঠিক হয়, তাই টাইপ হতে হতে লেখা নড়ে না।
   * `visibleText` না দিলে (বা `text`-এর prefix না হলে) আগের মতোই পুরো লেখা দেখায়।
   */
  visibleText?: string;
  style?: React.CSSProperties;
};

export const FitText: React.FC<Props> = ({
  text,
  baseSize,
  minSize,
  maxWidth,
  color,
  fontFamily,
  fontWeight = 700,
  lineHeight = 1.25,
  textAlign = "center",
  maxLines = 2,
  visibleText,
  style,
}) => {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState<FitResult>({ fontSize: baseSize, wrap: false, lines: 1 });

  useLayoutEffect(() => {
    let alive = true;
    const measure = () => {
      const el = measureRef.current;
      if (!el || !alive) return;
      const next = fitFontSize({
        naturalWidth: el.offsetWidth,
        baseSize,
        minSize,
        maxWidth,
        maxLines,
      });
      setFit((prev) =>
        Math.abs(prev.fontSize - next.fontSize) < 0.01 &&
        prev.wrap === next.wrap &&
        prev.lines === next.lines
          ? prev
          : next,
      );
    };
    measure();
    // ফন্ট পরে লোড হলে (Studio-তে) আবার মাপা
    const fonts = (typeof document !== "undefined" ? document.fonts : undefined) as
      | { ready?: Promise<unknown> }
      | undefined;
    fonts?.ready?.then(measure).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [text, baseSize, minSize, maxWidth, maxLines, fontFamily, fontWeight]);

  const common: React.CSSProperties = { fontFamily, fontWeight, lineHeight };

  return (
    <>
      {/* মাপার জন্য লুকানো কপি (বেস সাইজ, এক লাইন) */}
      <span
        ref={measureRef}
        aria-hidden
        style={{
          ...common,
          position: "absolute",
          visibility: "hidden",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          fontSize: baseSize,
          left: 0,
          top: 0,
        }}
      >
        {text}
      </span>
      <div
        style={{
          ...common,
          color,
          textAlign,
          fontSize: fit.fontSize,
          width: "100%",
          overflow: "hidden",
          whiteSpace: fit.wrap ? "normal" : "nowrap",
          textWrap: fit.wrap ? "balance" : undefined,
          overflowWrap: "break-word",
          // দুই লাইনের বেশি হলে "…" দিয়ে ছাঁটা
          display: fit.wrap ? "-webkit-box" : "block",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: fit.wrap ? fit.lines : undefined,
          ...style,
        }}
      >
        {visibleText !== undefined && text.startsWith(visibleText) && visibleText.length < text.length ? (
          <>
            {visibleText}
            <span style={{ color: "transparent" }}>{text.slice(visibleText.length)}</span>
          </>
        ) : (
          text
        )}
      </div>
    </>
  );
};
