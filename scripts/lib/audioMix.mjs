// Audio post-processing for the rendered Hadis videos (FFmpeg).
//
// Remotion renders the video with the narration, SFX and Intro/Outro/Hook voices already mixed into one AAC track.
// This module takes that finished MP4 and:
//   1. normalizes the narration track to ~ -14 LUFS (FFmpeg `loudnorm`, two-pass, TP -1.5, LRA 11),
//   2. (optional) mixes in a VERY quiet background music track that is
//        - looped when it is shorter than the video, trimmed (+ fade-out) when it is longer,
//        - ducked (`sidechaincompress`) whenever the voice is speaking,
//   3. writes the result with the video stream copied untouched (`-c:v copy`) and the audio encoded as AAC.
//
// Design rules:
//   - NEVER breaks the render: every failure is logged as a warning and the original (Remotion) MP4 is kept.
//   - No background music given  → voice normalization only ("No background music provided, skipping").
//   - All ffmpeg/ffprobe calls use argument arrays (no shell), so spaces/special characters in file names are safe.
//   - Pure helpers (`buildFilterGraph`, `parseLoudnormJson`, ...) are exported and covered by scripts/test-audio-mix.mjs.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, renameSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Settings — edit the numbers here (or override with the env vars named in the comments).
// ---------------------------------------------------------------------------
export const AUDIO_SETTINGS = {
  /** Voice loudness target in LUFS (YouTube/Shorts-friendly) */
  targetLufs: -14,
  /** Voice true-peak ceiling in dBTP */
  truePeak: -1.5,
  /** Voice loudness range */
  lra: 11,

  /**
   * ⭐ BACKGROUND MUSIC VOLUME — the single easy-to-edit variable (env override: BG_MUSIC_VOLUME).
   * The music is first levelled to `bgReferenceLufs` (same as the voice), then multiplied by this factor:
   *   0.06 ≈ -24 dB · 0.08 ≈ -22 dB (default) · 0.10 ≈ -20 dB below the voice.   0 = no music.
   */
  bgVolume: 0.08,
  /** Music is levelled to this LUFS before `bgVolume` is applied, so the factor means the same for every track */
  bgReferenceLufs: -14,

  /** Ducking (sidechaincompress; voice = sidechain). threshold is LINEAR (0.02 ≈ -34 dB); times in ms. */
  duck: { threshold: 0.02, ratio: 8, attack: 20, release: 600, makeup: 1 },

  /** Music fade-in at the start / fade-out at the end of the video (seconds) */
  bgFadeInSeconds: 1,
  bgFadeOutSeconds: 2,

  sampleRate: 48000,
  aacBitrate: "192k",
  /** Only the first N seconds of the music are decoded (keeps the temp WAV small for very long tracks) */
  maxBgSeconds: 3600,
  /** Music shorter than this is rejected (a loop of a blip is not music) */
  minBgSeconds: 1,
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, fallback = NaN) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
};

/** Merge env overrides into the defaults. Returns { settings, warnings }. Never throws. */
export function resolveSettings(env = process.env, base = AUDIO_SETTINGS) {
  const settings = { ...base, duck: { ...base.duck } };
  const warnings = [];
  const raw = env.BG_MUSIC_VOLUME;
  if (raw !== undefined && String(raw).trim() !== "") {
    const v = num(raw);
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      warnings.push(`BG_MUSIC_VOLUME="${raw}" is not a number between 0 and 1 — using ${base.bgVolume}.`);
    } else {
      settings.bgVolume = v;
    }
  }
  return { settings, warnings };
}

// ---------------------------------------------------------------------------
// Process helpers
// ---------------------------------------------------------------------------
/** Run a program (no shell). Resolves { code, stdout, stderr }; never rejects. */
export function run(cmd, args, { cwd } = {}) {
  return new Promise((resolvePromise) => {
    let stdout = "";
    let stderr = "";
    let child;
    try {
      child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      resolvePromise({ code: -1, stdout, stderr: String(err?.message ?? err) });
      return;
    }
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => resolvePromise({ code: -1, stdout, stderr: stderr + String(err?.message ?? err) }));
    child.on("close", (code) => resolvePromise({ code: code ?? -1, stdout, stderr }));
  });
}

const FFMPEG_BASE = ["-hide_banner", "-nostats", "-nostdin"];

/** Check that ffmpeg + ffprobe exist and have the filters we need. */
export async function checkFfmpeg() {
  const v = await run("ffmpeg", ["-version"]);
  if (v.code !== 0) return { ok: false, reason: "ffmpeg is not installed (apt-get install ffmpeg)" };
  const p = await run("ffprobe", ["-version"]);
  if (p.code !== 0) return { ok: false, reason: "ffprobe is not installed (apt-get install ffmpeg)" };
  const f = await run("ffmpeg", [...FFMPEG_BASE, "-filters"]);
  const missing = ["loudnorm", "sidechaincompress", "amix", "alimiter", "afade"].filter(
    (name) => !new RegExp(`\\s${name}\\s`).test(f.stdout),
  );
  if (missing.length > 0) return { ok: false, reason: `this ffmpeg build lacks filters: ${missing.join(", ")}` };
  return { ok: true };
}

/**
 * ffprobe a media file.
 * @returns {Promise<{ok:boolean, error?:string, hasAudio:boolean, hasVideo:boolean, duration:number,
 *   videoDuration:number, audioDuration:number, formatName:string, audioCodec:string, videoCodec:string}>}
 */
export async function probeMedia(file) {
  const empty = { ok: false, hasAudio: false, hasVideo: false, duration: 0, videoDuration: 0, audioDuration: 0, formatName: "", audioCodec: "", videoCodec: "" };
  if (!file || !existsSync(file)) return { ...empty, error: `file not found: ${file}` };
  const r = await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]);
  if (r.code !== 0) return { ...empty, error: (r.stderr.trim().split("\n").pop() || "ffprobe failed").slice(0, 200) };
  let json;
  try {
    json = JSON.parse(r.stdout);
  } catch {
    return { ...empty, error: "ffprobe returned unreadable output" };
  }
  const streams = Array.isArray(json.streams) ? json.streams : [];
  const audio = streams.find((s) => s.codec_type === "audio");
  // cover-art "video" streams in mp3/m4a files are attached pictures, not real video
  const video = streams.find((s) => s.codec_type === "video" && !(s.disposition && s.disposition.attached_pic === 1));
  const formatDuration = num(json.format?.duration, 0);
  return {
    ok: true,
    hasAudio: Boolean(audio),
    hasVideo: Boolean(video),
    duration: formatDuration,
    videoDuration: num(video?.duration, formatDuration),
    audioDuration: num(audio?.duration, formatDuration),
    formatName: String(json.format?.format_name ?? ""),
    audioCodec: String(audio?.codec_name ?? ""),
    videoCodec: String(video?.codec_name ?? ""),
  };
}

// ---------------------------------------------------------------------------
// Loudness measurement (loudnorm pass 1)
// ---------------------------------------------------------------------------
/** Pull the JSON block that loudnorm prints at the end of stderr. Returns null if missing/unusable. */
export function parseLoudnormJson(stderr) {
  const text = String(stderr ?? "");
  const end = text.lastIndexOf("}");
  const start = end === -1 ? -1 : text.lastIndexOf("{", end);
  if (start === -1) return null;
  let raw;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const m = {
    input_i: num(raw.input_i),
    input_tp: num(raw.input_tp),
    input_lra: num(raw.input_lra),
    input_thresh: num(raw.input_thresh),
    target_offset: num(raw.target_offset),
  };
  // "-inf" (silence) or missing values parse to NaN → unusable
  if (!Object.values(m).every(Number.isFinite)) return null;
  return m;
}

/** Measure integrated loudness etc. of the first audio stream. Returns the parsed block or null. */
export async function measureLoudness(file, settings = AUDIO_SETTINGS) {
  const { targetLufs, truePeak, lra } = settings;
  const r = await run("ffmpeg", [
    ...FFMPEG_BASE,
    "-i", file,
    "-map", "0:a:0",
    "-vn",
    "-af", `loudnorm=I=${targetLufs}:TP=${truePeak}:LRA=${lra}:print_format=json`,
    "-f", "null", "-",
  ]);
  if (r.code !== 0) return null;
  return parseLoudnormJson(r.stderr);
}

// ---------------------------------------------------------------------------
// Filter graph (pure → unit-tested)
// ---------------------------------------------------------------------------
const f3 = (n) => (Math.round(n * 1000) / 1000).toString();

/** loudnorm filter text: two-pass (linear) when we have measurements, otherwise single-pass dynamic. */
export function loudnormFilter(measured, settings = AUDIO_SETTINGS) {
  const { targetLufs: I, truePeak: TP, lra: LRA } = settings;
  const head = `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}`;
  if (!measured) return head;
  return (
    `${head}:measured_I=${f3(measured.input_i)}:measured_TP=${f3(measured.input_tp)}` +
    `:measured_LRA=${f3(measured.input_lra)}:measured_thresh=${f3(measured.input_thresh)}` +
    `:offset=${f3(measured.target_offset)}:linear=true`
  );
}

/** Common tail: loudnorm internally upsamples to 192 kHz, so bring everything back to 48 kHz stereo float. */
const normalizeFormat = (sr) => `aresample=${sr},aformat=sample_fmts=fltp:sample_rates=${sr}:channel_layouts=stereo`;

/** Linear peak ceiling equal to the true-peak target (-1.5 dBTP ≈ 0.841) — final safety limiter after mixing */
export const peakLimit = (settings = AUDIO_SETTINGS) => clamp(Math.pow(10, settings.truePeak / 20), 0.0625, 1);

/**
 * Build the -filter_complex string.
 * Inputs: [0] = rendered video (voice track), [1] = prepared background WAV (only when `hasBg`).
 * @param {{hasVoice:boolean, hasBg:boolean, measured:object|null, durationSeconds:number, settings?:object}} o
 * @returns {{filter:string, outLabel:string}}
 */
export function buildFilterGraph({ hasVoice, hasBg, measured, durationSeconds, settings = AUDIO_SETTINGS }) {
  const sr = settings.sampleRate;
  const dur = Math.max(0.1, durationSeconds);
  const fadeIn = clamp(settings.bgFadeInSeconds, 0, dur / 2);
  const fadeOut = clamp(settings.bgFadeOutSeconds, 0, dur / 2);
  const limiter = `alimiter=limit=${f3(peakLimit(settings))}:attack=5:release=50:level=disabled`;

  const bgChain =
    `[1:a:0]${normalizeFormat(sr)},volume=${f3(settings.bgVolume)},atrim=duration=${f3(dur)},asetpts=N/SR/TB` +
    (fadeIn > 0 ? `,afade=t=in:st=0:d=${f3(fadeIn)}` : "") +
    (fadeOut > 0 ? `,afade=t=out:st=${f3(dur - fadeOut)}:d=${f3(fadeOut)}` : "");

  if (hasVoice && hasBg) {
    const d = settings.duck;
    return {
      outLabel: "[aout]",
      filter: [
        `[0:a:0]${loudnormFilter(measured, settings)},${normalizeFormat(sr)},asplit=2[vmix][vsc]`,
        `${bgChain}[bg]`,
        `[bg][vsc]sidechaincompress=threshold=${d.threshold}:ratio=${d.ratio}:attack=${d.attack}:release=${d.release}:makeup=${d.makeup}[ducked]`,
        `[vmix][ducked]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,${limiter},${normalizeFormat(sr)}[aout]`,
      ].join(";"),
    };
  }
  if (hasVoice) {
    return {
      outLabel: "[aout]",
      filter: `[0:a:0]${loudnormFilter(measured, settings)},${normalizeFormat(sr)},${limiter}[aout]`,
    };
  }
  // video without any audio stream + background music → music alone (nothing to duck)
  return { outLabel: "[aout]", filter: `${bgChain},${limiter}[aout]` };
}

// ---------------------------------------------------------------------------
// Background track preparation (decode → level to reference LUFS → 48 kHz stereo WAV)
// ---------------------------------------------------------------------------
/**
 * Decode any audio file (mp3, wav, m4a, ogg, aac, flac …) to a clean 48 kHz stereo PCM WAV, levelled to
 * `bgReferenceLufs` with a plain gain (no dynamics processing). PCM makes `-stream_loop` sample-accurate (no encoder-gap clicks).
 * @returns {Promise<{ok:boolean, wavPath?:string, duration?:number, gainDb?:number, error?:string}>}
 */
export async function prepareBackgroundWav(srcFile, workDir, settings = AUDIO_SETTINGS, log = () => {}) {
  const info = await probeMedia(srcFile);
  if (!info.ok) return { ok: false, error: `cannot read background music: ${info.error}` };
  if (!info.hasAudio) return { ok: false, error: "background music file has no audio stream" };
  if (!(info.duration >= settings.minBgSeconds)) {
    return { ok: false, error: `background music is too short (${f3(info.duration)} s)` };
  }

  // measure → pure gain to the reference level
  let gainDb = 0;
  const m = await measureLoudness(srcFile, { ...settings, targetLufs: settings.bgReferenceLufs });
  if (m) {
    gainDb = clamp(settings.bgReferenceLufs - m.input_i, -40, 40);
    log(`   Background music loudness ${f3(m.input_i)} LUFS → levelling by ${f3(gainDb)} dB (reference ${settings.bgReferenceLufs} LUFS)`);
  } else {
    log("   ⚠️ Could not measure background music loudness — using it as is.");
  }

  const wavPath = join(workDir, "background.wav");
  const r = await run("ffmpeg", [
    ...FFMPEG_BASE, "-y",
    "-i", srcFile,
    "-map", "0:a:0", "-vn",
    "-t", String(settings.maxBgSeconds),
    "-af", `volume=${f3(gainDb)}dB,${normalizeFormat(settings.sampleRate)},alimiter=limit=0.95:level=disabled`,
    "-c:a", "pcm_s16le",
    wavPath,
  ]);
  if (r.code !== 0 || !existsSync(wavPath)) {
    return { ok: false, error: `background music could not be decoded: ${r.stderr.trim().split("\n").pop() || "ffmpeg failed"}` };
  }
  const wavInfo = await probeMedia(wavPath);
  return { ok: true, wavPath, duration: wavInfo.ok && wavInfo.duration > 0 ? wavInfo.duration : Math.min(info.duration, settings.maxBgSeconds), gainDb };
}

// ---------------------------------------------------------------------------
// The mixer
// ---------------------------------------------------------------------------
/**
 * Create a mixer that post-processes finished MP4s in place.
 * @param {{ bgMusicFile?: string, env?: object, log?: (line:string)=>void }} opts
 *   bgMusicFile: absolute path of the background music ('' / undefined = none)
 * @returns {Promise<{ process:(videoFile:string)=>Promise<{status:string, detail:string}>, cleanup:()=>void, settings:object }>}
 */
export async function createAudioMixer({ bgMusicFile = "", env = process.env, log = console.log } = {}) {
  const { settings, warnings } = resolveSettings(env);
  for (const w of warnings) log(`⚠️ ${w}`);

  const tools = await checkFfmpeg();
  if (!tools.ok) log(`⚠️ Audio mixing disabled: ${tools.reason}. Videos keep the original Remotion audio.`);

  let workDir = null;
  const ensureWorkDir = () => (workDir ??= mkdtempSync(join(tmpdir(), "hadis-audio-")));

  // background track is prepared once and reused by every video job
  let bg; // undefined = not prepared yet, null = none/failed, object = ready
  async function getBackground() {
    if (bg !== undefined) return bg;
    bg = null;
    const wanted = String(bgMusicFile ?? "").trim();
    if (!wanted) {
      log("No background music provided, skipping (voice normalization only).");
      return bg;
    }
    if (settings.bgVolume <= 0) {
      log("Background music volume is 0, skipping.");
      return bg;
    }
    log(`Preparing background music: ${wanted}`);
    const prepared = await prepareBackgroundWav(wanted, ensureWorkDir(), settings, log);
    if (!prepared.ok) {
      log(`⚠️ Background music skipped: ${prepared.error}. Continuing without background music.`);
      return bg;
    }
    bg = prepared;
    return bg;
  }

  async function processVideo(videoFile) {
    if (!tools.ok) return { status: "skipped", detail: tools.reason };
    try {
      const v = await probeMedia(videoFile);
      if (!v.ok || !v.hasVideo) return skip(`cannot read rendered video (${v.error ?? "no video stream"})`);

      const hasVoice = v.hasAudio;
      const background = await getBackground();
      const hasBg = Boolean(background);
      const durationSeconds = v.videoDuration > 0 ? v.videoDuration : v.duration;

      if (!hasVoice && !hasBg) {
        log("⚠️ Video has no audio stream and there is no background music — nothing to mix, skipping.");
        return { status: "skipped", detail: "no audio stream" };
      }
      if (!hasVoice) log("⚠️ Video has no audio stream — adding background music only (no ducking).");

      // 1) loudnorm pass 1
      let measured = null;
      if (hasVoice) {
        log(`Normalizing voice to ${settings.targetLufs} LUFS (two-pass loudnorm)...`);
        measured = await measureLoudness(videoFile, settings);
        if (measured) {
          log(`   measured ${f3(measured.input_i)} LUFS, true peak ${f3(measured.input_tp)} dBTP, LRA ${f3(measured.input_lra)}`);
        } else {
          log("   ⚠️ Could not measure the voice (silent or unreadable) — using single-pass loudnorm.");
        }
      }

      // 2) loop / trim
      const inputArgs = ["-i", videoFile];
      if (hasBg) {
        if (background.duration + 0.05 < durationSeconds) {
          log(`Looping background music (${f3(background.duration)} s → ${f3(durationSeconds)} s video)`);
          inputArgs.push("-stream_loop", "-1", "-i", background.wavPath);
        } else {
          log(`Trimming background music (${f3(background.duration)} s → ${f3(durationSeconds)} s video, fade-out ${settings.bgFadeOutSeconds} s)`);
          inputArgs.push("-i", background.wavPath);
        }
        log(`Mixing background music at volume ${settings.bgVolume} with ducking (sidechaincompress)`);
      }

      const { filter, outLabel } = buildFilterGraph({ hasVoice, hasBg, measured, durationSeconds, settings });

      // 3) encode: video copied, audio AAC
      const tmpOut = videoFile.replace(/\.mp4$/i, "") + ".audiomix.tmp.mp4";
      rmSync(tmpOut, { force: true });
      const args = [
        ...FFMPEG_BASE, "-y",
        ...inputArgs,
        "-filter_complex", filter,
        "-map", "0:v:0", "-map", outLabel,
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", settings.aacBitrate, "-ar", String(settings.sampleRate), "-ac", "2",
        "-t", f3(durationSeconds),
        "-movflags", "+faststart",
        tmpOut,
      ];
      const r = await run("ffmpeg", args);
      if (r.code !== 0) {
        rmSync(tmpOut, { force: true });
        return skip(`ffmpeg failed: ${r.stderr.trim().split("\n").slice(-3).join(" | ").slice(0, 400)}`);
      }

      // 4) verify before replacing the original
      const out = await probeMedia(tmpOut);
      const okOut = out.ok && out.hasVideo && out.hasAudio && Math.abs(out.duration - v.duration) <= 1 && statSync(tmpOut).size > 0;
      if (!okOut) {
        rmSync(tmpOut, { force: true });
        return skip("mixed file failed verification (missing stream or wrong length)");
      }
      renameSync(tmpOut, videoFile);

      const after = await measureLoudness(videoFile, settings);
      const detail =
        `${hasBg ? "voice normalized + background music (ducked)" : hasVoice ? "voice normalized" : "background music only"}` +
        (after ? ` | final ${f3(after.input_i)} LUFS, peak ${f3(after.input_tp)} dBTP` : "");
      log(`✅ Audio done: ${detail}`);
      return { status: hasBg ? "mixed" : "normalized", detail };
    } catch (err) {
      return skip(`unexpected error: ${String(err?.message ?? err).split("\n")[0]}`);
    }

    function skip(reason) {
      log(`⚠️ Audio post-processing skipped: ${reason}. Keeping the original Remotion audio.`);
      return { status: "failed", detail: reason };
    }
  }

  return {
    settings,
    process: processVideo,
    cleanup() {
      if (workDir) {
        try {
          rmSync(workDir, { recursive: true, force: true });
        } catch {
          /* temp dir cleanup is best effort */
        }
        workDir = null;
      }
    },
  };
}
