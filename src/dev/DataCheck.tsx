import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { useHadisTimestamp } from "../lib/loadHadis";
import { buildHadisLabel } from "../lib/displayText";
import { buildFrameSegments, timingFromConfig } from "../lib/timing";
import { getThemeColors, skyGradient } from "../themes";
import type { HadisVideoProps } from "../types";

/**
 * Part 5 (dev টুল): ডেটা লোডার ঠিক চলছে কিনা দেখার ছবি।
 * WAV দৈর্ঘ্য → মোট ফ্রেম, JSON → segment-এর ফ্রেম, কিতাব/নম্বর লেবেল — সব এক ছবিতে।
 * Studio-তে hadisId বদলালে durationInFrames বদলায়।
 */
export const DataCheck: React.FC<HadisVideoProps> = (props) => {
  const { durationInFrames, fps, width, height } = useVideoConfig();
  const timestamp = useHadisTimestamp(props.hadisId);
  const p = getThemeColors(props.theme, 0);

  const timing = timingFromConfig(durationInFrames, props, fps);
  const segments = timestamp ? buildFrameSegments(timestamp, timing) : [];
  const sec = (f: number) => (f / fps).toFixed(2);

  const rows: [string, string][] = [
    ["hadisId", props.hadisId],
    ["লেবেল", buildHadisLabel(props.hadisBookname, props.hadisNumber)],
    ["সাইজ", `${width}×${height} (${props.orientation})`],
    ["মোট", `${durationInFrames} ফ্রেম = ${sec(durationInFrames)}s`],
    ["Intro", `${timing.introFrames} ফ্রেম (${sec(timing.introFrames)}s)`],
    ["Main (.wav)", `${timing.mainFrames} ফ্রেম (${sec(timing.mainFrames)}s)`],
    ["Outro", `${timing.outroFrames} ফ্রেম (${sec(timing.outroFrames)}s)`],
    ["segment", `${segments.length}টা`],
  ];

  return (
    <AbsoluteFill
      style={{
        background: skyGradient(p),
        padding: 48,
        gap: 20,
        flexDirection: "column",
        fontFamily: FONT_BODY,
        color: p.text,
      }}
    >
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 52, color: p.accent }}>
        ডেটা লোডার যাচাই ✅
      </div>
      <div style={{ background: p.panelBg, border: `2px solid ${p.panelBorder}`, borderRadius: 24, padding: 28 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "flex", gap: 20, fontSize: 36, lineHeight: 1.5 }}>
            <span style={{ color: p.textMuted, minWidth: 220 }}>{k}</span>
            <span style={{ fontWeight: 700 }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ background: p.panelBg, border: `2px solid ${p.panelBorder}`, borderRadius: 24, padding: 28, fontSize: 30, lineHeight: 1.45 }}>
        {segments.slice(0, 8).map((s) => (
          <div key={s.index}>
            <span style={{ color: p.accent }}>
              #{s.id} [{s.startFrame}→{s.endFrame}]
            </span>{" "}
            {s.text}
            <span style={{ color: p.textMuted }}> · {s.words.length} শব্দ</span>
            {s.svg ? <span style={{ color: p.textMuted }}> · {s.svg}</span> : null}
            {s.sfx ? <span style={{ color: p.textMuted }}> · sfx:{s.sfx.name}</span> : null}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
