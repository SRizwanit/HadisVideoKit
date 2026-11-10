// Resolves the optional `background_music` workflow input.
//
//   BACKGROUND_MUSIC = ""                     → nothing to do (video renders with no music, voice is still normalized)
//   BACKGROUND_MUSIC = "https://.../song.mp3" → download, validate (ffprobe), save as public/background/background1.<ext>
//   BACKGROUND_MUSIC = "mysong.mp3"           → use public/background/mysong.mp3 (falls back to the old location public/mysong.mp3;
//                                                error if it exists in neither)
//
// On success it writes   BG_MUSIC_FILE=public/background/background1.mp3   (relative to the repo root)
//                        BG_MUSIC_DOWNLOADED=true|false
// to $GITHUB_ENV, so the render steps pick it up. Run locally too:
//   BACKGROUND_MUSIC="https://example.com/a.mp3" node scripts/prepare-bgmusic.mjs
//
// Failure policy:
//   - download / validation problems  → ::warning:: and continue WITHOUT music (exit 0, never breaks the workflow)
//   - a file NAME that is in neither public/background/ nor public/ → clear ::error:: (+ list of the audio files that do exist) and BG_MUSIC_ERROR is set.
//     The workflow's own steps use `!cancelled()`, so this step cannot stop the render anyway: the videos are rendered
//     without music, and the "Fail if background music file was not found" step turns the run ❌ at the end (and skips the
//     Release). Run locally (no GITHUB_ENV) the script exits 1 instead. Set FAIL_ON_MISSING_FILENAME = false to only warn.
import { createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, appendFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { probeMedia } from "./lib/audioMix.mjs";

const FAIL_ON_MISSING_FILENAME = true;
const MAX_BYTES = 150 * 1024 * 1024; // 150 MB
const TIMEOUT_MS = 180_000;
const ATTEMPTS = 3;
const FIXED_NAME = "background1";
/** Background music lives (and is committed) in public/<MUSIC_SUBDIR>/ */
export const MUSIC_SUBDIR = "background";
const AUDIO_EXTS = ["mp3", "wav", "m4a", "ogg", "aac", "flac", "opus"];

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// PUBLIC_DIR is only for tests/local experiments; in the workflow it is unset → <repo>/public
const publicDir = process.env.PUBLIC_DIR ? resolve(process.env.PUBLIC_DIR) : join(projectRoot, "public");
const musicDir = join(publicDir, MUSIC_SUBDIR);

/** Path to hand to the render step: relative to the repo root (e.g. public/background/background1.mp3), absolute if outside it */
function pathForRender(absFile) {
  const rel = relative(projectRoot, absFile);
  return rel.startsWith("..") ? absFile : rel.split("\\").join("/");
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in scripts/test-audio-mix.mjs)
// ---------------------------------------------------------------------------
export const isUrl = (s) => /^[a-z][a-z0-9+.-]*:\/\//i.test(String(s ?? "").trim());

/** Turn common "share" links into direct-download links. Anything else is returned unchanged. */
export function normalizeDirectLink(input) {
  let u;
  try {
    u = new URL(String(input).trim());
  } catch {
    return String(input).trim();
  }
  const host = u.hostname.toLowerCase();
  // Dropbox: ?dl=0 shows a web page → dl=1 downloads the file
  if (host === "www.dropbox.com" || host === "dropbox.com") {
    u.searchParams.set("dl", "1");
    return u.toString();
  }
  // Google Drive: /file/d/<id>/view → uc?export=download&id=<id>
  if (host === "drive.google.com") {
    const m = u.pathname.match(/\/file\/d\/([^/]+)/);
    const id = m?.[1] ?? u.searchParams.get("id");
    if (id) return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
  }
  // GitHub: /owner/repo/blob/branch/path → ?raw=true
  if (host === "github.com" && /^\/[^/]+\/[^/]+\/blob\//.test(u.pathname)) {
    u.searchParams.set("raw", "true");
    return u.toString();
  }
  return u.toString();
}

const CONTENT_TYPE_EXT = {
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mpeg3": "mp3",
  "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav", "audio/vnd.wave": "wav",
  "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a",
  "audio/ogg": "ogg", "application/ogg": "ogg", "audio/opus": "opus",
  "audio/aac": "aac", "audio/aacp": "aac", "audio/x-aac": "aac",
  "audio/flac": "flac", "audio/x-flac": "flac",
};

/** ffprobe `format_name` → extension (only when unambiguous) */
function extFromFormatName(formatName) {
  const f = String(formatName ?? "").toLowerCase();
  if (!f) return "";
  const parts = f.split(",");
  if (parts.includes("mp3")) return "mp3";
  if (parts.includes("wav")) return "wav";
  if (parts.includes("flac")) return "flac";
  if (parts.includes("ogg")) return "ogg";
  if (parts.includes("aac")) return "aac";
  if (parts.includes("m4a") || parts.includes("mp4")) return "m4a";
  return "";
}

/** Decide the extension from (1) what the file really is, (2) the URL, (3) Content-Type, (4) fallback mp3. */
export function pickExtension({ url = "", contentType = "", formatName = "" } = {}) {
  const real = extFromFormatName(formatName);
  if (real) return real;
  try {
    const e = extname(new URL(url).pathname).slice(1).toLowerCase();
    if (AUDIO_EXTS.includes(e)) return e;
  } catch {
    /* not a URL */
  }
  const ct = String(contentType).split(";")[0].trim().toLowerCase();
  if (CONTENT_TYPE_EXT[ct]) return CONTENT_TYPE_EXT[ct];
  return "mp3";
}

/**
 * Find a file the user named, inside public/background/ first, then (old location) public/ itself.
 * @returns {{ok:true, file:string, dir:string}|{ok:false, error:string, available:string[]}}
 */
export function resolveMusicFile(rawName, musicFolder, publicFolder) {
  const a = resolvePublicFile(rawName, musicFolder);
  if (a.ok) return { ok: true, file: a.file, dir: musicFolder };
  const b = resolvePublicFile(rawName, publicFolder);
  if (b.ok) return { ok: true, file: b.file, dir: publicFolder };
  const available = [...a.available, ...b.available.filter((f) => !a.available.includes(f))];
  return { ok: false, error: a.error.replace("public/", `public/${MUSIC_SUBDIR}/`), available };
}

/**
 * Find a file the user named, inside one folder (top level only — no paths, no "..").
 * Accepts "song.mp3", "public/song.mp3", "SONG.MP3" (case-insensitive) and "song" (extension omitted).
 * @returns {{ok:true, file:string}|{ok:false, error:string, available:string[]}}
 */
export function resolvePublicFile(rawName, dir) {
  let name = String(rawName ?? "").trim().replace(/^["']|["']$/g, "").trim();
  name = name.replace(/^\.?\/?public\//i, "").replace(/^background\//i, "");
  const list = (() => {
    try {
      return readdirSync(dir).filter((f) => AUDIO_EXTS.includes(extname(f).slice(1).toLowerCase()));
    } catch {
      return [];
    }
  })();
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..") || /[\0\r\n]/.test(name)) {
    return { ok: false, error: `"${rawName}" is not a plain file name from the public/ folder (no sub-folders or "..").`, available: list };
  }
  if (existsSync(join(dir, name)) && statSync(join(dir, name)).isFile()) return { ok: true, file: name };
  const lower = name.toLowerCase();
  const ci = list.find((f) => f.toLowerCase() === lower);
  if (ci) return { ok: true, file: ci };
  if (!extname(name)) {
    const stem = list.find((f) => f.slice(0, f.lastIndexOf(".")).toLowerCase() === lower);
    if (stem) return { ok: true, file: stem };
  }
  return { ok: false, error: `public/${name} does not exist.`, available: list };
}

// ---------------------------------------------------------------------------
// Logging helpers
// ---------------------------------------------------------------------------
const summary = [];
const warn = (msg) => {
  console.log(`::warning::${msg}`);
  summary.push(`- ⚠️ ${msg}`);
};
const info = (msg) => {
  console.log(msg);
};

function setEnv(key, value) {
  const v = String(value).replace(/[\r\n]/g, " ");
  if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `${key}=${v}\n`);
  else console.log(`(local run) ${key}=${v}`);
}

function flushSummary() {
  if (process.env.GITHUB_STEP_SUMMARY && summary.length > 0) {
    try {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, ["### 🎵 Background music", ...summary, ""].join("\n"));
    } catch {
      /* summary is optional */
    }
  }
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------
async function downloadOnce(url, dest) {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": "Mozilla/5.0 (HadisVideoKit bgmusic downloader)", Accept: "audio/*,*/*;q=0.8" },
  });
  if (!res.ok) {
    const e = new Error(`server answered HTTP ${res.status}`);
    e.retry = res.status >= 500 || res.status === 429;
    throw e;
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (/text\/html/i.test(contentType)) {
    throw Object.assign(new Error("the link returned a web page, not an audio file (use a DIRECT download link)"), { retry: false });
  }
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) {
    throw Object.assign(new Error(`file is too large (${(declared / 1048576).toFixed(0)} MB, limit ${MAX_BYTES / 1048576} MB)`), { retry: false });
  }
  let received = 0;
  const body = Readable.fromWeb(res.body);
  body.on("data", (chunk) => {
    received += chunk.length;
    if (received > MAX_BYTES) body.destroy(Object.assign(new Error(`file is larger than ${MAX_BYTES / 1048576} MB`), { retry: false }));
  });
  await pipeline(body, createWriteStream(dest));
  if (received === 0) throw Object.assign(new Error("downloaded file is empty"), { retry: true });
  return { contentType, bytes: received };
}

async function download(url, dest) {
  let lastErr;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      return await downloadOnce(url, dest);
    } catch (err) {
      lastErr = err;
      rmSync(dest, { force: true });
      const retry = err?.retry !== false; // network errors (no flag) are retried too
      if (!retry || attempt === ATTEMPTS) break;
      info(`   attempt ${attempt} failed (${err.message}) — retrying...`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function fmtDur(s) {
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

async function validateAudio(file) {
  const p = await probeMedia(file);
  if (!p.ok) return { ok: false, error: `ffprobe could not read the file (${p.error})` };
  if (!p.hasAudio) return { ok: false, error: "the file has no audio stream" };
  if (!(p.duration >= 1)) return { ok: false, error: `the audio is too short (${p.duration.toFixed(2)} s)` };
  return { ok: true, probe: p };
}

async function main() {
  const input = String(process.env.BACKGROUND_MUSIC ?? "").trim();

  if (input === "") {
    info("No background music provided, skipping. (Video will have the narration only, normalized to -14 LUFS.)");
    summary.push("- No background music provided — narration only (still normalized to -14 LUFS).");
    return 0;
  }

  // ---- A) direct link ----
  if (isUrl(input)) {
    if (!/^https?:\/\//i.test(input)) {
      warn(`Only http(s) links are supported: "${input}". Continuing without background music.`);
      return 0;
    }
    const url = normalizeDirectLink(input);
    if (url !== input) info(`Share link converted to a direct link: ${url}`);
    info("Downloading background music...");
    mkdirSync(musicDir, { recursive: true });
    const tmp = join(musicDir, `.${FIXED_NAME}.download`);
    try {
      const { contentType, bytes } = await download(url, tmp);
      info(`   downloaded ${(bytes / 1048576).toFixed(2)} MB`);
      const v = await validateAudio(tmp);
      if (!v.ok) throw new Error(v.error);

      const ext = pickExtension({ url, contentType, formatName: v.probe.formatName });
      // overwrite any previous background1.* (also removes an old file with a different extension)
      // (also cleans the old location public/background1.* — the file now lives in public/background/)
      for (const dir of [musicDir, publicDir]) {
        for (const f of readdirSync(dir)) {
          if (f.toLowerCase().startsWith(`${FIXED_NAME}.`) && f !== basename(tmp)) rmSync(join(dir, f), { force: true });
        }
      }
      const finalName = `${FIXED_NAME}.${ext}`;
      renameSync(tmp, join(musicDir, finalName));
      info(`✅ Saved as public/${MUSIC_SUBDIR}/${finalName} (${fmtDur(v.probe.duration)}, ${v.probe.audioCodec || "audio"})`);
      summary.push(`- Downloaded from link → \`public/${MUSIC_SUBDIR}/${finalName}\` (${fmtDur(v.probe.duration)}).`);
      setEnv("BG_MUSIC_FILE", pathForRender(join(musicDir, finalName)));
      setEnv("BG_MUSIC_DOWNLOADED", "true");
      return 0;
    } catch (err) {
      rmSync(tmp, { force: true });
      warn(`Background music download/validation failed: ${String(err?.message ?? err).split("\n")[0]}. Continuing WITHOUT background music.`);
      return 0;
    }
  }

  // ---- B) file name in public/background/ (or the old location public/) ----
  const found = resolveMusicFile(input, musicDir, publicDir);
  if (!found.ok) {
    const hint = found.available.length > 0 ? ` Audio files in public/background/: ${found.available.join(", ")}.` : " There are no audio files in public/background/ yet.";
    const msg = `Background music: ${found.error}${hint} Give a direct download link, or upload the file to public/background/ first.`;
    if (FAIL_ON_MISSING_FILENAME) {
      console.log(`::error::${msg}`);
      summary.push(`- ❌ ${msg}`);
      setEnv("BG_MUSIC_ERROR", msg);
      return process.env.GITHUB_ENV ? 0 : 1;
    }
    warn(`${msg} Continuing without background music.`);
    return 0;
  }
  const rel = found.dir === musicDir ? `public/${MUSIC_SUBDIR}/${found.file}` : `public/${found.file}`;
  const v = await validateAudio(join(found.dir, found.file));
  if (!v.ok) {
    warn(`${rel} is not usable as background music: ${v.error}. Continuing WITHOUT background music.`);
    return 0;
  }
  info(`✅ Using ${rel} (${fmtDur(v.probe.duration)}, ${v.probe.audioCodec || "audio"})`);
  summary.push(`- Using existing file \`${rel}\` (${fmtDur(v.probe.duration)}).`);
  setEnv("BG_MUSIC_FILE", pathForRender(join(found.dir, found.file)));
  setEnv("BG_MUSIC_DOWNLOADED", "false");
  return 0;
}

// run only when executed directly (the test file imports the helpers above)
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let code = 0;
  try {
    code = await main();
  } catch (err) {
    // anything unexpected must not break the workflow
    warn(`Unexpected problem while preparing background music: ${String(err?.message ?? err).split("\n")[0]}. Continuing WITHOUT background music.`);
    code = 0;
  }
  flushSummary();
  process.exit(code);
}
