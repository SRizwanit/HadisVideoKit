import React, { useCallback, useEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import { AnimatedSvg, type AnimatedSvgStatus } from "../components/AnimatedSvg";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { createSvgLoader, useSvgSource, type SvgLoader, type SvgSource } from "../lib/svgLoad";
import { getThemeColors, skyGradient } from "../themes";
import { LOAD_CASE_COUNT, runLoadCases, type LoadCaseOutcome } from "./svgLoadCases";

/**
 * Part 9E + 9F (dev টুল): SVG লোড ও `AnimatedSvg` যাচাইয়ের ছবি।
 * 9F: নিচে `AnimatedSvg` কম্পোনেন্টের ১৬টা ঘর + ৯টা স্বয়ংক্রিয় ✅/❌ সারি (৩ ফ্রেমে আলাদা ছবি, একই SVG দু'বার = id আলাদা,
 * `frame` prop বনাম `useCurrentFrame()`, ফাইল নেই / HTML / ভাঙা SVG → কিছু আঁকা হয় না, বিপজ্জনক SVG সাফ হয়)।
 * 9E অংশ (এই ধাপে লোডের ফলাফল):
 *  - চারটা ঘর আসল `useSvgSource` হুক দিয়ে: `svg1`, `svg2` → ready (দৈর্ঘ্য n); `svg999` (নেই) → missing;
 *    নকল সার্ভার HTML ফেরত দিলে → missing। প্রতিটায় ✅/❌।
 *  - নিচে `svgLoadCases.ts`-এর সব কেস (ক্যাশ, ব্যর্থতা ক্যাশ হয় না, সময় শেষ, বেআইনি নাম...) একটা করে সারি।
 *  - ছবিটা আদৌ রেন্ডার হওয়াই প্রমাণ যে missing/HTML অবস্থায় `delayRender` আটকে যায়নি।
 * `npm run check` এটাকে নিজে ধরে `out/check-AnimatedSvgPreview.png` বানায়।
 */

export const ANIMATED_SVG_PREVIEW_HEIGHT = 3600;

/** "HTML ফেরত" দেখানোর নকল সার্ভার: যে নামই চাও, HTML পাতা ফেরত দেয় (dev সার্ভারের ভুল উত্তরের মতো) */
const htmlLoader: SvgLoader = createSvgLoader({
  fetcher: async () =>
    new Response("<!DOCTYPE html><html><body>index</body></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  urlFor: (name) => `https://example.invalid/${name}.svg`,
  warn: () => undefined, // প্রিভিউয়ের জন্য ইচ্ছে করে ভুল — লগে ওয়ার্নিং না ছড়ানো
});

const svgLoaderOf = (body: string): SvgLoader =>
  createSvgLoader({
    fetcher: async () => new Response(body, { status: 200, headers: { "content-type": "image/svg+xml" } }),
    urlFor: (name) => `https://example.invalid/${name}.svg`,
    warn: () => undefined,
  });

/** <script>, onload=, javascript: সহ — কিন্তু SMIL-এ ঘোরে; সাফ হয়ে ঘুরতে থাকা চাই */
const unsafeLoader = svgLoaderOf(
  `<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect x="300" y="300" width="400" height="400" fill="#f5d77a" onclick="alert(2)"><animateTransform attributeName="transform" type="rotate" from="0 500 500" to="360 500 500" dur="6s" repeatCount="indefinite"/></rect></svg>`,
);
/** `<svg` আছে কিন্তু `</svg>` নেই → sanitize অবৈধ বলবে, কিছু আঁকা হবে না */
const brokenLoader = svgLoaderOf(`<svg viewBox="0 0 1000 1000"><rect x="10" y="10" width="500" height="500"`);

type CellSpec = {
  key: string;
  label: string;
  name: string;
  loader?: SvgLoader;
  expect: "ready" | "missing";
  note: string;
};

const CELLS: CellSpec[] = [
  { key: "svg1", label: "svg1", name: "svg1", expect: "ready", note: "নমুনা (CSS) — ready হওয়া চাই" },
  { key: "svg2", label: "svg2", name: "svg2", expect: "ready", note: "নমুনা (SMIL) — ready হওয়া চাই" },
  { key: "svg999", label: "svg999 (ফাইল নেই)", name: "svg999", expect: "missing", note: "missing → পরে fallback আসবে" },
  { key: "html", label: "HTML ফেরত (নকল সার্ভার)", name: "svg1", loader: htmlLoader, expect: "missing", note: "missing → পরে fallback আসবে" },
];

const describe = (src: SvgSource): string => {
  if (src.state === "ready") return `ready, দৈর্ঘ্য ${src.text.length}`;
  if (src.state === "missing") return `missing, fallback আসবে (${src.reason})`;
  return "লোড হচ্ছে…";
};

const SourceCell: React.FC<{ spec: CellSpec; onResult: (key: string, ok: boolean) => void }> = ({ spec, onResult }) => {
  const p = getThemeColors("emerald", 0);
  const src = useSvgSource(spec.name, spec.loader);
  const finished = src.state !== "loading";
  const ok = finished && src.state === spec.expect && (src.state !== "ready" || src.text.includes("<svg"));

  useEffect(() => {
    if (finished) onResult(spec.key, ok);
  }, [finished, ok, spec.key, onResult]);

  return (
    <div
      style={{
        background: p.panelBg,
        border: `2px solid ${p.panelBorder}`,
        borderRadius: 20,
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        gap: 22,
      }}
    >
      <div style={{ fontSize: 56, width: 70, textAlign: "center" }}>{finished ? (ok ? "✅" : "❌") : "⏳"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 34, color: p.accent }}>{spec.label}</div>
        <div style={{ fontSize: 28, fontWeight: 600, color: p.text }}>{describe(src)}</div>
        <div style={{ fontSize: 22, color: p.textMuted }}>
          প্রত্যাশা: {spec.expect} · {spec.note}
        </div>
      </div>
    </div>
  );
};

// ---------- 9F: AnimatedSvg-এর ঘর ----------
const DRAW_CELL = 240;
const DRAW_FRAMES = [0, 30, 60];

/** ঘরের ভেতরের দৃশ্যমান উপাদানের "ছাপ" (SvgSyncPreview-র মতো: পর্দার-বাক্স + opacity + fill + stroke-opacity) */
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

type DrawReport = { status: AnimatedSvgStatus; sig: string; safe: boolean };

type DrawSpec = {
  key: string;
  label: string;
  name: string;
  frame?: number | "current";
  prefix?: string;
  loader?: SvgLoader;
};

const DRAW_CELLS: DrawSpec[] = [
  ...DRAW_FRAMES.map((f, i) => ({ key: `s1f${i}`, label: "svg1", name: "svg1", frame: f, prefix: `a${i}-` })),
  ...DRAW_FRAMES.map((f, i) => ({ key: `s2f${i}`, label: "svg2", name: "svg2", frame: f, prefix: `b${i}-` })),
  { key: "tw2a", label: "svg2 · যমজ A (prefix tw1-)", name: "svg2", frame: 30, prefix: "tw1-" },
  { key: "tw2b", label: "svg2 · যমজ B (prefix tw2-)", name: "svg2", frame: 30, prefix: "tw2-" },
  { key: "tw1a", label: "svg1 · যমজ A (prefix ua-)", name: "svg1", frame: 30, prefix: "ua-" },
  { key: "tw1b", label: "svg1 · যমজ B (prefix ub-)", name: "svg1", frame: 30, prefix: "ub-" },
  { key: "noframe", label: "svg1 · frame prop ছাড়া", name: "svg1", prefix: "nf-" },
  { key: "withframe", label: "svg1 · frame = বর্তমান ফ্রেম", name: "svg1", frame: "current", prefix: "wf-" },
  { key: "missing", label: "svg999 (ফাইল নেই)", name: "svg999" },
  { key: "html", label: "HTML ফেরত (নকল সার্ভার)", name: "svg1", loader: htmlLoader },
  { key: "unsafe", label: "<script>/onload সহ SVG", name: "svg1", loader: unsafeLoader, prefix: "un-" },
  { key: "broken", label: "ভাঙা SVG (</svg> নেই)", name: "svg1", loader: brokenLoader },
];

const DrawCell: React.FC<{ spec: DrawSpec; current: number; onReport: (key: string, r: DrawReport) => void }> = ({
  spec,
  current,
  onReport,
}) => {
  const p = getThemeColors("emerald", 0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<AnimatedSvgStatus | null>(null);
  const frame = spec.frame === "current" ? current : spec.frame;

  const handle = useCallback(
    (st: AnimatedSvgStatus) => {
      const el = wrapRef.current;
      setStatus(st);
      if (!el) return;
      onReport(spec.key, {
        status: st,
        sig: signatureOf(el),
        safe: !el.querySelector("script") && !el.querySelector("[onload],[onclick]"),
      });
    },
    [onReport, spec.key],
  );

  const line = status
    ? status.state === "ready"
      ? `CSS: ${status.counts?.css ?? "?"}, SMIL: ${status.counts?.smil ?? "?"} ✅`
      : `কিছু আঁকা হয়নি — fallback আসবে`
    : "…";
  return (
    <div style={{ width: DRAW_CELL, display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        ref={wrapRef}
        style={{
          width: DRAW_CELL,
          height: DRAW_CELL,
          background: p.panelBg,
          border: `2px solid ${p.panelBorder}`,
          borderRadius: 18,
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        <AnimatedSvg
          name={spec.name}
          size={DRAW_CELL - 4}
          frame={frame}
          prefix={spec.prefix}
          loader={spec.loader}
          onReport={handle}
        />
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: p.accent, lineHeight: 1.2 }}>
        {spec.label}
        {frame !== undefined ? ` · ফ্রেম ${frame}` : " · ফ্রেম = Composition-এর"}
      </div>
      <div style={{ fontSize: 19, color: p.textMuted, lineHeight: 1.2 }}>{line}</div>
    </div>
  );
};

export const AnimatedSvgPreview: React.FC = () => {
  const p = getThemeColors("emerald", 0);
  const current = useCurrentFrame();
  const [draw, setDraw] = useState<Record<string, DrawReport>>({});
  const onDraw = useCallback((key: string, r: DrawReport) => {
    setDraw((prev) => {
      const o = prev[key];
      const same =
        !!o &&
        o.sig === r.sig &&
        o.safe === r.safe &&
        o.status.state === r.status.state &&
        o.status.counts?.css === r.status.counts?.css &&
        o.status.counts?.smil === r.status.counts?.smil;
      return same ? prev : { ...prev, [key]: r };
    });
  }, []);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [cases, setCases] = useState<LoadCaseOutcome[] | null>(null);
  const handleRef = useRef<number | null>(null);
  if (cases === null && handleRef.current === null) {
    handleRef.current = delayRender("svgLoad কেস চলছে");
  }

  useEffect(() => {
    let alive = true;
    const release = () => {
      if (handleRef.current !== null) {
        continueRender(handleRef.current);
        handleRef.current = null;
      }
    };
    runLoadCases()
      .then((out) => {
        if (alive) setCases(out);
      })
      .catch((err) => {
        if (alive) {
          setCases([{ id: "runner", title: "কেস-চালক", ok: false, detail: String(err) }]);
        }
      })
      .finally(release);
    return () => {
      alive = false;
      release();
    };
  }, []);

  const onResult = React.useCallback((key: string, ok: boolean) => {
    setResults((prev) => (prev[key] === ok ? prev : { ...prev, [key]: ok }));
  }, []);

  const cellsDone = CELLS.filter((c) => c.key in results).length;
  const cellsOk = CELLS.filter((c) => results[c.key] === true).length;
  const casesOk = cases ? cases.filter((c) => c.ok).length : 0;
  const distinct = (keys: string[]): number => new Set(keys.map((k) => draw[k]?.sig ?? `?${k}`)).size;
  const have = (...keys: string[]): boolean => keys.every((k) => k in draw);
  const same = (a: string, b: string): boolean => have(a, b) && draw[a].sig === draw[b].sig && draw[a].sig !== "";
  const ready = (k: string): boolean => draw[k]?.status.state === "ready";
  const nothing = (k: string): boolean => draw[k]?.status.state === "missing" && draw[k].sig === "";
  const d1 = distinct(["s1f0", "s1f1", "s1f2"]);
  const d2 = distinct(["s2f0", "s2f1", "s2f2"]);
  const drawChecks: { ok: boolean; text: string }[] = [
    { ok: have("s1f0", "s1f1", "s1f2") && d1 === 3 && ["s1f0", "s1f1", "s1f2"].every(ready), text: `svg1 (CSS): ৩ ফ্রেমে ছবি আলাদা: ${d1}/3` },
    { ok: have("s2f0", "s2f1", "s2f2") && d2 === 3 && ["s2f0", "s2f1", "s2f2"].every(ready), text: `svg2 (SMIL): ৩ ফ্রেমে ছবি আলাদা: ${d2}/3` },
    { ok: same("tw2a", "tw2b") && (draw.tw2a?.status.counts?.smil ?? 0) >= 1 && (draw.tw2b?.status.counts?.smil ?? 0) >= 1, text: "svg2 দু'বার (prefix আলাদা, একই ফ্রেম) → দুটোই একই ও সচল (id আলাদা)" },
    { ok: same("tw1a", "tw1b") && (draw.tw1a?.status.counts?.css ?? 0) >= 1 && (draw.tw1b?.status.counts?.css ?? 0) >= 1, text: "svg1 দু'বার (prefix আলাদা) → দুটোই একই ও সচল" },
    { ok: same("noframe", "withframe") && (current === 0 || (have("s1f0") && draw.noframe.sig !== draw.s1f0.sig)), text: `frame prop ছাড়া = useCurrentFrame() (${current}); prop দিলে prop-ই চলে` },
    { ok: nothing("missing"), text: "svg999 (ফাইল নেই) → কিছু আঁকা হয় না, ক্র্যাশ নয়" },
    { ok: nothing("html"), text: "HTML ফেরত → কিছু আঁকা হয় না" },
    { ok: nothing("broken"), text: "ভাঙা SVG (</svg> নেই) → কিছু আঁকা হয় না (+ একটা ওয়ার্নিং)" },
    { ok: ready("unsafe") && draw.unsafe.safe && (draw.unsafe.status.counts?.smil ?? 0) >= 1, text: "<script>/onload/onclick সাফ হয়েছে, তবু সচল (SMIL ≥ 1)" },
  ];
  const drawOk = drawChecks.filter((c) => c.ok).length;
  const total = CELLS.length + LOAD_CASE_COUNT + drawChecks.length;
  const allDone = cellsDone === CELLS.length && cases !== null && DRAW_CELLS.every((c) => c.key in draw);
  const allOk = allDone && cellsOk === CELLS.length && casesOk === (cases?.length ?? -1) && drawOk === drawChecks.length;

  return (
    <AbsoluteFill
      style={{
        background: skyGradient(p),
        padding: 36,
        flexDirection: "column",
        gap: 16,
        fontFamily: FONT_BODY,
        color: p.text,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 20, flexWrap: "wrap" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 46, color: p.accent }}>SVG লোড ও AnimatedSvg যাচাই (9E + 9F)</div>
        <div style={{ fontWeight: 700, fontSize: 34, color: allOk ? "#7CFFB2" : "#FF8A8A" }}>
          {allOk ? "সব ✅" : allDone ? "❌ আছে" : "…"} · {cellsOk + casesOk + drawOk}/{total}
        </div>
      </div>

      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, color: p.accent }}>
        9F · `AnimatedSvg` — স্বয়ংক্রিয় যাচাই ({drawOk}/{drawChecks.length})
      </div>
      <div style={{ background: p.panelBg, border: `2px solid ${p.panelBorder}`, borderRadius: 18, padding: "12px 22px" }}>
        {drawChecks.map((c) => (
          <div key={c.text} style={{ fontSize: 25, fontWeight: 600, color: c.ok ? "#7CFFB2" : "#FF8A8A", lineHeight: 1.45 }}>
            {c.ok ? "✅" : "❌"} {c.text}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {DRAW_CELLS.map((c) => (
          <DrawCell key={c.key} spec={c} current={current} onReport={onDraw} />
        ))}
      </div>

      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, color: p.accent, marginTop: 8 }}>
        9E · আসল হুক `useSvgSource` — চার অবস্থা
      </div>
      {CELLS.map((c) => (
        <SourceCell key={c.key} spec={c} onResult={onResult} />
      ))}

      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, color: p.accent, marginTop: 8 }}>
        লোডারের কেস ({cases ? `${casesOk}/${cases.length}` : "…"})
      </div>
      <div
        style={{
          background: p.panelBg,
          border: `2px solid ${p.panelBorder}`,
          borderRadius: 20,
          padding: "10px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {(cases ?? []).map((c) => (
          <div key={c.id} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "6px 0" }}>
            <div style={{ fontSize: 34, width: 48 }}>{c.ok ? "✅" : "❌"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: p.text }}>{c.title}</div>
              <div style={{ fontSize: 22, color: c.ok ? p.textMuted : "#FF8A8A" }}>{c.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
