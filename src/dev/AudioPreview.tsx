import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { planSfx, voiceFadeFrames, voiceGain, type AudioPlan, type SfxPlan } from "../lib/audioPlan";
import { buildFrameSegments, computeTiming, type FrameSegment, type Timing } from "../lib/timing";
import { getThemeColors, skyGradient, type Palette } from "../themes";
import { AUDIO_CASE_COUNT, runAudioCases } from "./audioCases";

/**
 * Part 11 (dev টুল): অডিও-পরিকল্পনার যাচাইয়ের ছবি — `npm run check` এটাকে নিজে ধরে `out/check-AudioPreview.png` বানায়।
 *
 * অডিও চোখে দেখা যায় না, তাই এখানে **সময়রেখা** আঁকা হয়: Intro | Main | Outro, ভয়েসের ভলিউম-রেখা (ফেডসহ),
 * প্রতিটা SFX কিউ (কোন ফ্রেমে, কতক্ষণ, কত ভলিউমে), আর বাদ পড়া কিউয়ের কারণ।
 * - ৩টা দৃশ্য হাতে লেখা (নমুনা-ফাইল লাগে না): সাধারণ · খুব ছোট Main · Outro নেই।
 * - উপরে স্বয়ংক্রিয় সারি (বিশুদ্ধ হিসাব মিলিয়ে ✅/❌), নিচে `audioPlan.ts`-এর বিশুদ্ধ কেস।
 * - আসল বাজানো (`HadisAudio`/`SfxPlayer`) এখানে নেই — সেটা `AudioSmoke` কম্পোজিশন (বান্ডল-যাচাই) ও Part 13-র Studio/রেন্ডারে।
 */

// ---------- দৃশ্য (হাতে লেখা) ----------
type Scene = {
  key: string;
  title: string;
  timing: Timing;
  segments: FrameSegment[];
  outroSfx: boolean;
};

const T1 = computeTiming({ introSeconds: 3, outroSeconds: 4, audioSeconds: 14 }); // Intro 90 · Main 420 · Outro 120 = 630
const S1 = buildFrameSegments(
  {
    segments: [
      { id: 1, start: 0, end: 3, text: "ক খ", sfx: { name: "whoosh", volume: 0.6 } },
      { id: 2, start: 3, end: 7, text: "গ ঘ" },
      { id: 3, start: 7, end: 10, text: "ঙ চ", sfx: { name: "pop" } },
      { id: 4, start: 10, end: 12, text: "ছ জ", sfx: { name: "ding", volume: 0 } },
      { id: 5, start: 12, end: 13.5, text: "ঝ ঞ", sfx: { name: "../x", volume: 0.5 } },
      { id: 6, start: 13.5, end: 14, text: "ট ঠ", sfx: { name: "chime", volume: 1 } },
    ],
  },
  T1,
);

const T2 = computeTiming({ introSeconds: 3, outroSeconds: 4, audioSeconds: 0.7 }); // Main 21 ফ্রেম
const S2 = buildFrameSegments({ segments: [{ id: 1, start: 0, end: 0.7, text: "ক খ", sfx: { name: "pop" } }] }, T2);

const T3 = computeTiming({ introSeconds: 3, outroSeconds: 0, audioSeconds: 6 }); // Outro নেই
const S3 = buildFrameSegments(
  {
    segments: [
      { id: 1, start: 0, end: 3, text: "ক খ", sfx: { name: "whoosh" } },
      { id: 2, start: 3, end: 6, text: "গ ঘ", sfx: { name: "pop", volume: 0.8 } },
    ],
  },
  T3,
);

const SCENES: Scene[] = [
  { key: "s1", title: "দৃশ্য ১ · সাধারণ (Intro 90 · Main 420 · Outro 120)", timing: T1, segments: S1, outroSfx: true },
  { key: "s2", title: "দৃশ্য ২ · খুব ছোট Main (21 ফ্রেম) — ফেড ও কিউ ছোট", timing: T2, segments: S2, outroSfx: true },
  { key: "s3", title: "দৃশ্য ৩ · Outro নেই (০ s) — Outro-SFX নেই", timing: T3, segments: S3, outroSfx: true },
];

const PLANS: AudioPlan[] = SCENES.map((s) => planSfx(s.segments, s.timing, { outroSfx: s.outroSfx }));

// ---------- মাপ (সব স্থির সংখ্যা; উচ্চতা এখান থেকেই) ----------
const PAD = 36;
const HEAD_H = 84;
const SEC_H = 56;
const ROW_H = 54;
const ROW_PITCH = 62;
const N_AUTO = 7;
const CONTENT_W = 1080 - PAD * 2; // 1008
const SC_TITLE_H = 34;
const SC_STRIP_H = 30;
const SC_VOICE_H = 46;
const LANE_H = 28;
const SC_MAX_LANES = 3;
const SC_NOTE_H = 56;
const SC_H = SC_TITLE_H + SC_STRIP_H + 8 + SC_VOICE_H + 8 + SC_MAX_LANES * LANE_H + 6 + SC_NOTE_H + 18;

export const AUDIO_PREVIEW_HEIGHT =
  PAD * 2 + HEAD_H + (SEC_H + N_AUTO * ROW_PITCH) + (SEC_H + SCENES.length * SC_H) + (SEC_H + AUDIO_CASE_COUNT * ROW_PITCH) + 30;

// ---------- স্বয়ংক্রিয় সারি ----------
type Row = { title: string; ok: boolean; note: string };
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const brief = (c: SfxPlan) => `${c.name}@${c.from}+${c.durationFrames} (${c.volume.toFixed(2)})`;

function buildRows(): Row[] {
  const rows: Row[] = [];
  const [p1, p2, p3] = PLANS;
  const mainEnd = (t: Timing) => t.introFrames + t.mainFrames;

  // 1. দৃশ্য ১: ঠিক কিউ, ঠিক ফ্রেমে
  {
    const want = ["whoosh@90+120", "pop@300+120", "chime@495+15", "whoosh@510+120"];
    const got = p1.cues.map((c) => `${c.name}@${c.from}+${c.durationFrames}`);
    const ok = got.length === want.length && want.every((w, i) => w === got[i]);
    rows.push({ title: "দৃশ্য ১: ঠিক ৪টা কিউ, ঠিক ফ্রেমে (segment-শুরু + Outro-শুরু)", ok, note: ok ? got.join(" · ") : `চাই ${want.join(" ")} · পেয়েছে ${got.join(" ") || "—"}` });
  }

  // 2. volume ০ নীরবে বাদ; অবৈধ নাম বাদ + ঠিক একটা সতর্কতা; কম-ভলিউম ডিফল্ট
  {
    const names = p1.cues.map((c) => c.name);
    const ok = !names.includes("ding") && !names.includes("../x") && p1.warnings.length === 1 && /\.\.\/x/.test(p1.warnings[0] ?? "") && near(p1.cues[1]?.volume ?? -1, 0.4, 1e-9) && near(p1.cues[0]?.volume ?? -1, 0.6, 1e-9);
    rows.push({ title: "volume ০ (ding) নীরবে বাদ · অবৈধ নাম (../x) বাদ + ১টা সতর্কতা · ডিফল্ট ০.৪", ok, note: `সতর্কতা ${p1.warnings.length}টা · whoosh ${(p1.cues[0]?.volume ?? 0).toFixed(2)} · pop ${(p1.cues[1]?.volume ?? 0).toFixed(2)}` });
  }

  // 3. Main-এর শেষে শুরু হওয়া SFX ছাঁটা; কোনো segment-কিউ Outro-তে ঢোকে না
  {
    const seg: [AudioPlan, Timing][] = [[p1, T1], [p2, T2], [p3, T3]];
    const over = seg.flatMap(([pl, t]) => pl.cues.filter((c) => c.kind === "segment" && c.from + c.durationFrames > mainEnd(t)));
    const chime = p1.cues.find((c) => c.name === "chime");
    const ok = over.length === 0 && chime?.durationFrames === 15 && chime.from + chime.durationFrames === mainEnd(T1);
    rows.push({ title: "Main-এর শেষের SFX ছাঁটা — Main-এর শেষেই থামে, Outro-তে ঢোকে না (৩ দৃশ্যেই)", ok, note: `chime ${chime ? brief(chime) : "—"} → শেষ ফ্রেম ${chime ? chime.from + chime.durationFrames : "—"} = Main-শেষ ${mainEnd(T1)} · সীমা ছাড়ানো কিউ ${over.length}টা` });
  }

  // 4. ভয়েসের ভলিউম-রেখা (দৃশ্য ১)
  {
    const fade = voiceFadeFrames(T1.mainFrames);
    const g = (f: number) => voiceGain(f, T1.mainFrames, fade);
    const ok = fade === 10 && near(g(0), 1, 1e-9) && near(g(409), 1, 1e-9) && near(g(415), 0.5, 1e-9) && near(g(420), 0, 1e-9);
    rows.push({ title: "ভয়েস-ভলিউম (দৃশ্য ১): পুরো → শেষ ১০ ফ্রেমে ১ → ০", ok, note: `ফেড ${fade} ফ্রেম · f0 ${g(0).toFixed(2)} · f409 ${g(409).toFixed(2)} · f415 ${g(415).toFixed(2)} · f420 ${g(420).toFixed(2)}` });
  }

  // 5. ছোট Main
  {
    const fade = voiceFadeFrames(T2.mainFrames);
    const pop = p2.cues.find((c) => c.name === "pop");
    const ok = T2.mainFrames === 21 && fade === 5 && pop?.from === 90 && pop.durationFrames === 21;
    rows.push({ title: "খুব ছোট Main (21 ফ্রেম): ফেড ⌊21÷4⌋ = ৫ → ¼-সীমা; SFX Main-এর দৈর্ঘ্যে ছাঁটা", ok, note: `Main ${T2.mainFrames} · ফেড ${fade} · pop ${pop ? brief(pop) : "—"} · Outro-কিউ ${p2.cues.filter((c) => c.kind === "outro").length}টা` });
  }

  // 6. Outro নেই
  {
    const outro = p3.cues.filter((c) => c.kind === "outro");
    const ok = outro.length === 0 && p3.cues.length === 2 && T3.outroFrames === 0;
    rows.push({ title: "Outro ০ s: Outro-SFX নেই; segment-কিউ ঠিকই আছে", ok, note: `Outro ${T3.outroFrames} ফ্রেম · কিউ ${p3.cues.map(brief).join(" · ")}` });
  }

  // 7. ভয়েসের জায়গা সব দৃশ্যে: Intro-র পরে শুরু, Main-এ শেষ
  {
    const ok = SCENES.every((s) => s.timing.introFrames + s.timing.mainFrames + s.timing.outroFrames === s.timing.totalFrames && s.timing.introFrames === 90);
    rows.push({ title: "ভয়েসের জায়গা: শুরু = Intro-শেষ (90) · শেষ = Main-শেষ · Outro-তে ভয়েস নেই (৩ দৃশ্যে)", ok, note: SCENES.map((s) => `${s.key}: ${s.timing.introFrames}→${mainEnd(s.timing)} / মোট ${s.timing.totalFrames}`).join(" · ") });
  }

  return rows;
}

// ---------- আঁকা ----------
const RowView: React.FC<{ p: Palette; ok: boolean; title: string; note: string }> = ({ p, ok, title, note }) => (
  <div style={{ height: ROW_PITCH, flexShrink: 0 }}>
    <div style={{ height: ROW_H, boxSizing: "border-box", background: p.panelBg, border: `2px solid ${ok ? p.panelBorder : "#FF6B6B"}`, borderRadius: 14, padding: "6px 16px", display: "flex", gap: 14, alignItems: "center" }}>
      <div style={{ fontSize: 28, lineHeight: 1 }}>{ok ? "✅" : "❌"}</div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        <div style={{ fontSize: 18, lineHeight: 1.2, color: ok ? p.textMuted : "#FF8A8A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{note}</div>
      </div>
    </div>
  </div>
);

const SectionTitle: React.FC<{ p: Palette; text: string }> = ({ p, text }) => (
  <div style={{ height: SEC_H, flexShrink: 0, display: "flex", alignItems: "center", fontSize: 27, fontWeight: 700, color: p.accent }}>{text}</div>
);

/** কিউগুলোকে লেনে সাজায় (একই লেনে ওভারল্যাপ নয়); ≤ SC_MAX_LANES লেন, বেশি হলে শেষ লেনেই */
function assignLanes(cues: SfxPlan[]): number[] {
  const laneEnd: number[] = [];
  return cues.map((c) => {
    let lane = laneEnd.findIndex((end) => end <= c.from);
    if (lane === -1) lane = laneEnd.length < SC_MAX_LANES ? laneEnd.length : SC_MAX_LANES - 1;
    laneEnd[lane] = Math.max(laneEnd[lane] ?? 0, c.from + c.durationFrames);
    return lane;
  });
}

const SceneView: React.FC<{ p: Palette; scene: Scene; plan: AudioPlan }> = ({ p, scene, plan }) => {
  const { timing: t } = scene;
  const W = CONTENT_W;
  const x = (f: number) => (f / t.totalFrames) * W;
  const mainStart = t.introFrames;
  const mainEnd = t.introFrames + t.mainFrames;
  const fade = voiceFadeFrames(t.mainFrames);
  const lanes = assignLanes(plan.cues);

  // ভয়েসের ভলিউম-রেখা: Main জুড়ে (ফেডের শেষ অংশটুকু বিশদ)
  const vy = (g: number) => SC_VOICE_H - 6 - g * (SC_VOICE_H - 12);
  const pts: string[] = [`${x(mainStart).toFixed(1)},${SC_VOICE_H - 6}`];
  const step = Math.max(1, Math.floor(t.mainFrames / 80));
  for (let f = 0; f < t.mainFrames; f += step) pts.push(`${x(mainStart + f).toFixed(1)},${vy(voiceGain(f, t.mainFrames, fade)).toFixed(1)}`);
  for (let f = Math.max(0, t.mainFrames - fade); f <= t.mainFrames; f += 1) pts.push(`${x(mainStart + f).toFixed(1)},${vy(voiceGain(f, t.mainFrames, fade)).toFixed(1)}`);
  pts.push(`${x(mainEnd).toFixed(1)},${SC_VOICE_H - 6}`);

  const dropped: string[] = [];
  for (const s of scene.segments) {
    if (s.sfx && !plan.cues.some((c) => c.segmentIndex === s.index)) {
      dropped.push(`segment ${s.index + 1} "${String(s.sfx.name)}" ${s.sfx.volume === 0 ? "(volume 0)" : "(অবৈধ নাম)"}`);
    }
  }

  const stripSegs: { label: string; from: number; to: number; color: string }[] = [
    { label: "Intro", from: 0, to: mainStart, color: "#5b8fd9" },
    { label: "Main (.wav)", from: mainStart, to: mainEnd, color: "#2fa874" },
    { label: "Outro", from: mainEnd, to: t.totalFrames, color: "#c9a13b" },
  ];

  return (
    <div style={{ height: SC_H, flexShrink: 0, position: "relative" }}>
      <div style={{ height: SC_TITLE_H, fontSize: 22, fontWeight: 700, lineHeight: "30px" }}>{scene.title}</div>
      <svg width={W} height={SC_H - SC_TITLE_H - 12} style={{ display: "block" }}>
        {/* Intro | Main | Outro */}
        {stripSegs.map((s) =>
          s.to > s.from ? (
            <g key={s.label}>
              <rect x={x(s.from)} y={0} width={Math.max(1, x(s.to) - x(s.from))} height={SC_STRIP_H} fill={s.color} opacity={0.85} rx={5} />
              {x(s.to) - x(s.from) > 70 ? (
                <text x={x(s.from) + 8} y={20} fontSize={16} fill="#fff" fontFamily={FONT_BODY} fontWeight={700}>
                  {s.label} · {s.to - s.from}
                </text>
              ) : null}
            </g>
          ) : null,
        )}
        {/* ভয়েস */}
        <g transform={`translate(0, ${SC_STRIP_H + 8})`}>
          <rect x={x(mainStart)} y={0} width={Math.max(1, x(mainEnd) - x(mainStart))} height={SC_VOICE_H} fill="#ffffff14" stroke="#ffffff44" />
          <polygon points={pts.join(" ")} fill="#7CFFB2" opacity={0.55} stroke="#7CFFB2" strokeWidth={1.5} />
          <text x={x(mainStart) + 8} y={16} fontSize={15} fill="#fff" fontFamily={FONT_BODY}>
            ভয়েস · ফেড {fade} ফ্রেম
          </text>
          {fade > 0 ? <line x1={x(mainEnd - fade)} x2={x(mainEnd - fade)} y1={0} y2={SC_VOICE_H} stroke="#ffd166" strokeDasharray="3 3" /> : null}
        </g>
        {/* SFX লেন */}
        <g transform={`translate(0, ${SC_STRIP_H + 8 + SC_VOICE_H + 8})`}>
          {plan.cues.map((c, i) => {
            const w = Math.max(3, x(c.from + c.durationFrames) - x(c.from));
            const y = lanes[i] * LANE_H;
            const col = c.kind === "outro" ? "#c9a13b" : "#ff9fb8";
            const labelRight = x(c.from) + 5 > W - 140; // ডান কিনারার কাছে হলে লেখা কিউয়ের ডান-প্রান্তে
            return (
              <g key={c.key}>
                <rect x={x(c.from)} y={y + 2} width={w} height={LANE_H - 6} rx={4} fill={col} opacity={0.4 + 0.6 * c.volume} stroke={col} />
                {w < 60 ? null : <text x={labelRight ? x(c.from) + w - 5 : x(c.from) + 5} y={y + 19} fontSize={14} fill="#fff" fontFamily={FONT_BODY} textAnchor={labelRight ? "end" : "start"}>
                  {c.name} {c.volume.toFixed(2)}
                </text>}
              </g>
            );
          })}
        </g>
        <text x={0} y={SC_STRIP_H + 8 + SC_VOICE_H + 8 + SC_MAX_LANES * LANE_H + 20} fontSize={17} fill={p.textMuted as string} fontFamily={FONT_BODY}>
          {`কিউ ${plan.cues.length}টা · ${plan.cues.map((c) => `${c.name}@${c.from}`).join("  ")}`}
        </text>
        <text x={0} y={SC_STRIP_H + 8 + SC_VOICE_H + 8 + SC_MAX_LANES * LANE_H + 44} fontSize={17} fill={dropped.length ? "#ffb86b" : (p.textMuted as string)} fontFamily={FONT_BODY}>
          {dropped.length ? `বাদ: ${dropped.join(" · ")}` : "বাদ পড়া কিউ নেই"}
        </text>
      </svg>
    </div>
  );
};

export const AudioPreview: React.FC = () => {
  const p = getThemeColors("emerald", 0);
  const cases = useMemo(() => runAudioCases(), []);
  const rows = useMemo(() => buildRows(), []);
  const rowsPassed = rows.filter((r) => r.ok).length;
  const casesPassed = cases.filter((c) => c.ok).length;
  const total = N_AUTO + AUDIO_CASE_COUNT;
  const passed = rowsPassed + casesPassed;
  const allOk = rows.length === N_AUTO && passed === total;

  return (
    <AbsoluteFill style={{ background: skyGradient(p), boxSizing: "border-box", padding: PAD, flexDirection: "column", fontFamily: FONT_BODY, color: p.text }}>
      <div style={{ height: HEAD_H, flexShrink: 0, display: "flex", alignItems: "baseline", gap: 20 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 46, color: p.accent }}>Audio যাচাই</div>
        <div style={{ fontWeight: 700, fontSize: 34, color: allOk ? "#7CFFB2" : "#FF8A8A" }}>
          {allOk ? "সব ✅" : "❌ আছে"} · {passed}/{total}
        </div>
      </div>

      <SectionTitle p={p} text={`Part 11 · স্বয়ংক্রিয় যাচাই (৩ দৃশ্যের পরিকল্পনা) · ${rowsPassed}/${N_AUTO}`} />
      {rows.map((r) => (
        <RowView key={r.title} p={p} ok={r.ok} title={r.title} note={r.note} />
      ))}

      <SectionTitle p={p} text="৩টা দৃশ্যের সময়রেখা — সবুজ = ভয়েস (ভলিউম-রেখা), গোলাপি = segment-SFX, সোনালি = Outro-SFX" />
      {SCENES.map((s, i) => (
        <SceneView key={s.key} p={p} scene={s} plan={PLANS[i]} />
      ))}

      <SectionTitle p={p} text={`audioPlan.ts-এর বিশুদ্ধ কেস · ${casesPassed}/${AUDIO_CASE_COUNT}`} />
      {cases.map((c) => (
        <RowView key={c.id} p={p} ok={c.ok} title={c.title} note={c.ok ? c.rule : c.detail} />
      ))}
    </AbsoluteFill>
  );
};
