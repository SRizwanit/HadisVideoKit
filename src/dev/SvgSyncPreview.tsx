import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile } from "remotion";
import { FPS, svgPath } from "../constants";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { sanitizeSvg } from "../lib/svgSanitize";
import { runSync, useSvgSync, type SyncCache } from "../lib/svgSync";
import { getThemeColors, skyGradient } from "../themes";

/**
 * Part 9C + 9D (dev টুল): SVG frame-sync যাচাইয়ের ছবি (CSS ও SMIL দুটোই)।
 * `public/svg/svg1.svg` (CSS) এবং `public/svg/svg2.svg` (SMIL) ফ্রেম 0 / 15 / 30 / 45 / 60 / 75-এ পাশাপাশি
 * (প্রতিটা ঘরে আলাদা prefix — Part 9B)। প্রতি ঘরের নিচে "CSS: n, SMIL: m animations found"।
 * সঙ্গে একটা স্থির (অ্যানিমেশনহীন) SVG — সেটায় 0 + সতর্কতা আসাই ঠিক।
 * উপরে সারাংশ (✅/❌): ছয় ফ্রেমের ছবি সত্যিই আলাদা কিনা (উপাদানের পর্দার-বাক্স, opacity, fill-এর ছাপ মিলিয়ে),
 * আর stateless-এর প্রমাণ: একই ফ্রেম দুই আলাদা instance-এ একই ছবি + স্ক্রাব (৩০ → ৭৫ → ০ → ৩০) করে ফিরলে
 * শুরুর ছবিই ফেরে।
 * `npm run check` এটাকে নিজে ধরে `out/check-SvgSyncPreview.png` বানায়।
 */

export const SVG_SYNC_PREVIEW_HEIGHT = 2800;
const PREVIEW_FRAMES = [0, 15, 30, 45, 60, 75];
const N = PREVIEW_FRAMES.length;
const CELL = 316;

// ঘরের ক্রমিক নম্বর (reports-এর চাবি)
const SVG1_BASE = 0; // 0..5  → svg1 (CSS)
const SVG2_BASE = N; // 6..11 → svg2 (SMIL)
const STATIC_INDEX = 2 * N; // 12 → স্থির SVG
const TWIN_INDEX = 2 * N + 1; // 13 → svg2, ফ্রেম 30, আলাদা instance (stateless প্রমাণ)
const SCRUB_INDEX = 2 * N + 2; // 14 → svg2, স্ক্রাব-পরীক্ষা
const TWIN_FRAME_SLOT = 2; // PREVIEW_FRAMES[2] = 30 → twin এই ঘরের সঙ্গে মেলানো হয়
const SCRUB_FRAMES = { base: 30, far: 75, zero: 0 };

const STATIC_SVG = `<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg"><circle cx="500" cy="500" r="300" fill="#f5d77a"/><rect x="380" y="380" width="240" height="240" fill="#2ecc71"/></svg>`;

type Loaded = { text: string | null } | null;

/** public/svg/<name>.svg-র টেক্সট (dev টুলের নিজস্ব সহজ লোডার; ঠিকঠাক লোডার Part 9E-তে) */
function useRawSvg(name: string): string | null {
  const [loaded, setLoaded] = useState<Loaded>(null);
  const handleRef = useRef<number | null>(null);
  if (loaded === null && handleRef.current === null) {
    handleRef.current = delayRender(`SVG লোড হচ্ছে (${name})`);
  }
  React.useEffect(() => {
    let alive = true;
    const release = () => {
      if (handleRef.current !== null) {
        continueRender(handleRef.current);
        handleRef.current = null;
      }
    };
    fetch(staticFile(svgPath(name)))
      .then(async (res) => {
        const type = res.headers.get("content-type") ?? "";
        const text = await res.text();
        const ok = res.ok && !type.includes("text/html") && text.includes("<svg");
        if (alive) setLoaded({ text: ok ? text : null });
      })
      .catch(() => {
        if (alive) setLoaded({ text: null });
      })
      .finally(release);
    return () => {
      alive = false;
      release();
    };
  }, [name]);
  return loaded?.text ?? null;
}

/**
 * ঘরের ভেতরের প্রতিটা দৃশ্যমান উপাদানের "ছাপ": ঘরের সাপেক্ষে পর্দার-বাক্স (x, y, চওড়া, উঁচু) + opacity + fill + stroke-opacity।
 * CSS-এর transform আর SMIL-এর animateTransform/animateMotion/animate দুটোই এই বাক্সে ধরা পড়ে
 * (SMIL computed `transform`-এ আসে না, তাই শুধু transform দেখলে চলত না)। ফ্রেম আলাদা হলে ছাপও আলাদা।
 * শূন্য-মাপের উপাদান (defs, animate, ...) বাদ; `url(#prefix-id)` থেকে prefix সরানো, যাতে আলাদা prefix-এর দুই instance তুলনা করা যায়।
 */
function signatureOf(el: Element): string {
  const origin = el.getBoundingClientRect();
  let out = "";
  el.querySelectorAll("*").forEach((n) => {
    const r = n.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    const cs = getComputedStyle(n);
    out +=
      [
        (r.x - origin.x).toFixed(1),
        (r.y - origin.y).toFixed(1),
        r.width.toFixed(1),
        r.height.toFixed(1),
        cs.opacity,
        cs.fill.replace(/url\([^)]*\)/, "url"),
        cs.strokeOpacity,
      ].join(",") + ";";
  });
  return out;
}

type Report = { sig: string; css: number; smil: number; scrubOk?: boolean };

const SvgCell: React.FC<{
  index: number;
  label: string;
  text: string | null;
  frame: number;
  prefix: string;
  scrub?: boolean;
  onReport: (index: number, r: Report) => void;
}> = ({ index, label, text, frame, prefix, scrub = false, onReport }) => {
  const p = getThemeColors("emerald", 0);
  const html = useMemo(() => sanitizeSvg(text, { prefix }).svg ?? "", [text, prefix]);
  // ⚠️ `{ __html }` object-ও memo করা চাই: প্রতি রেন্ডারে নতুন object দিলে React ভেতরের <svg> নতুন করে বসিয়ে দেয়
  // (অ্যানিমেশন আবার বুনো ঘড়িতে চলে)। Part 9F `AnimatedSvg`-এও একই নিয়ম।
  const innerHtml = useMemo(() => ({ __html: html }), [html]);
  const ref = useRef<HTMLDivElement>(null);
  const counts = useSvgSync(ref, frame, html, label);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !counts) return;
    let scrubOk: boolean | undefined;
    if (scrub) {
      // স্ক্রাব-পরীক্ষা: নিজস্ব cache-সহ ৩০ → ৭৫ → ০ → ৩০; শুরুর ছাপ ফিরে আসা চাই, ৭৫-এর ছাপ আলাদা চাই।
      const cache: { current: SyncCache | null } = { current: null };
      const at = (f: number): string => {
        runSync(el, f, cache, html);
        return signatureOf(el);
      };
      const first = at(SCRUB_FRAMES.base);
      const far = at(SCRUB_FRAMES.far);
      const zero = at(SCRUB_FRAMES.zero);
      const back = at(SCRUB_FRAMES.base);
      scrubOk = first === back && first !== far && far !== zero && first !== zero;
      runSync(el, frame, cache, html); // ঘর আবার নিজের ফ্রেমে ফিরে যায়
    }
    onReport(index, { sig: signatureOf(el), css: counts.css, smil: counts.smil, scrubOk });
  }, [counts, html, frame, index, scrub, onReport]);

  const animated = counts ? counts.css + counts.smil > 0 : false;
  return (
    <div style={{ width: CELL, display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        ref={ref}
        style={{
          width: CELL,
          height: CELL,
          background: p.panelBg,
          border: `2px solid ${p.panelBorder}`,
          borderRadius: 20,
          overflow: "hidden",
        }}
        dangerouslySetInnerHTML={innerHtml}
      />
      <div style={{ fontSize: 24, fontWeight: 700, color: p.accent }}>
        {label} · ফ্রেম {frame} ({(frame / FPS).toFixed(2)}s)
      </div>
      <div style={{ fontSize: 22, color: p.textMuted }}>
        {counts
          ? `CSS: ${counts.css}, SMIL: ${counts.smil} animations found ${animated ? "✅" : "⚠️ স্থির"}`
          : "…"}
      </div>
    </div>
  );
};

export const SvgSyncPreview: React.FC = () => {
  const p = getThemeColors("emerald", 0);
  const svg1 = useRawSvg("svg1");
  const svg2 = useRawSvg("svg2");
  const [reports, setReports] = useState<Record<number, Report>>({});

  const onReport = React.useCallback((index: number, r: Report) => {
    setReports((prev) => {
      const old = prev[index];
      return old && old.sig === r.sig && old.css === r.css && old.smil === r.smil && old.scrubOk === r.scrubOk
        ? prev
        : { ...prev, [index]: r };
    });
  }, []);

  const group = (base: number): Report[] =>
    PREVIEW_FRAMES.map((_, i) => reports[base + i]).filter((r): r is Report => !!r);
  const distinctOf = (list: Report[]): number => new Set(list.map((r) => r.sig)).size;

  const r1 = group(SVG1_BASE);
  const r2 = group(SVG2_BASE);
  const distinct1 = distinctOf(r1);
  const distinct2 = distinctOf(r2);
  const found1 = r1.length === N && r1.every((r) => r.css >= 1);
  const found2 = r2.length === N && r2.every((r) => r.smil >= 1);

  const base2 = reports[SVG2_BASE + TWIN_FRAME_SLOT];
  const twin = reports[TWIN_INDEX];
  const twinOk = !!base2 && !!twin && base2.sig === twin.sig && twin.smil >= 1;
  const scrubOk = reports[SCRUB_INDEX]?.scrubOk === true;

  const staticRep = reports[STATIC_INDEX];
  const staticOk = !!staticRep && staticRep.css === 0 && staticRep.smil === 0;

  const row = (ok: boolean, text: string) => (
    <div style={{ fontSize: 28, fontWeight: 600, color: ok ? "#7CFFB2" : "#FF8A8A" }}>
      {ok ? "✅" : "❌"} {text}
    </div>
  );

  const heading = (text: string) => (
    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, color: p.accent }}>{text}</div>
  );

  return (
    <AbsoluteFill
      style={{
        background: skyGradient(p),
        padding: 36,
        flexDirection: "column",
        gap: 18,
        fontFamily: FONT_BODY,
        color: p.text,
      }}
    >
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 46, color: p.accent }}>
        SVG frame-sync যাচাই (CSS + SMIL)
      </div>
      <div style={{ background: p.panelBg, border: `2px solid ${p.panelBorder}`, borderRadius: 18, padding: "14px 22px" }}>
        {svg1 === null
          ? row(false, "public/svg/svg1.svg লোড হয়নি")
          : row(distinct1 === N, `svg1 (CSS): ছয় ফ্রেমের ছবি আলাদা: ${distinct1}/${N}`)}
        {row(found1, "svg1: প্রতি ঘরে CSS ≥ 1 অ্যানিমেশন পাওয়া গেছে")}
        {svg2 === null
          ? row(false, "public/svg/svg2.svg লোড হয়নি")
          : row(distinct2 === N, `svg2 (SMIL): ছয় ফ্রেমের ছবি আলাদা: ${distinct2}/${N}`)}
        {row(found2, "svg2: প্রতি ঘরে SMIL ≥ 1 অ্যানিমেশন পাওয়া গেছে")}
        {row(twinOk, "একই ফ্রেম (30) দুই আলাদা instance-এ → একই ছবি")}
        {row(scrubOk, "স্ক্রাব 30 → 75 → 0 → 30: শুরুর ছবিই ফিরে আসে (stateless)")}
        {row(staticOk, "স্থির SVG → CSS: 0, SMIL: 0 (সতর্কতা, ক্র্যাশ নয়)")}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {heading("svg1 — CSS @keyframes")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
          {svg1 !== null &&
            PREVIEW_FRAMES.map((f, i) => (
              <SvgCell
                key={f}
                index={SVG1_BASE + i}
                label="svg1"
                text={svg1}
                frame={f}
                prefix={`a${i}-`}
                onReport={onReport}
              />
            ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {heading("svg2 — SMIL (animate, animateTransform, animateMotion)")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
          {svg2 !== null &&
            PREVIEW_FRAMES.map((f, i) => (
              <SvgCell
                key={f}
                index={SVG2_BASE + i}
                label="svg2"
                text={svg2}
                frame={f}
                prefix={`b${i}-`}
                onReport={onReport}
              />
            ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {heading("অতিরিক্ত যাচাই")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
          <SvgCell index={STATIC_INDEX} label="স্থির SVG" text={STATIC_SVG} frame={30} prefix="st-" onReport={onReport} />
          {svg2 !== null && (
            <SvgCell
              index={TWIN_INDEX}
              label="svg2 (আলাদা instance)"
              text={svg2}
              frame={PREVIEW_FRAMES[TWIN_FRAME_SLOT]}
              prefix="tw-"
              onReport={onReport}
            />
          )}
          {svg2 !== null && (
            <SvgCell
              index={SCRUB_INDEX}
              label="svg2 (স্ক্রাব-পরীক্ষা)"
              text={svg2}
              frame={SCRUB_FRAMES.base}
              prefix="sc-"
              scrub
              onReport={onReport}
            />
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
