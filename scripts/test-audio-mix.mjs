// Tests for the audio features (scripts/lib/audioMix.mjs + scripts/prepare-bgmusic.mjs).
//   node scripts/test-audio-mix.mjs
// Pure cases always run; the ffmpeg cases run only when ffmpeg/ffprobe are installed (otherwise they are skipped).
// Prints ✅/❌ per case; exit code 1 on any failure.
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUDIO_SETTINGS,
  buildFilterGraph,
  checkFfmpeg,
  createAudioMixer,
  loudnormFilter,
  measureLoudness,
  parseLoudnormJson,
  prepareBackgroundWav,
  probeMedia,
  resolveSettings,
} from "./lib/audioMix.mjs";
import { isUrl, normalizeDirectLink, pickExtension, resolvePublicFile } from "./prepare-bgmusic.mjs";

const here = dirname(fileURLToPath(import.meta.url));
let passed = 0;
let failed = 0;
let skipped = 0;
function ok(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`✅ ${name}`);
  } else {
    failed++;
    console.log(`❌ ${name}${extra ? ` — ${extra}` : ""}`);
  }
}
function skip(name, why) {
  skipped++;
  console.log(`⏭️  ${name} (${why})`);
}

// ---------------------------------------------------------------------------
// Pure cases
// ---------------------------------------------------------------------------
console.log("\n— pure helpers —");

ok("isUrl: https link", isUrl("https://example.com/a.mp3"));
ok("isUrl: file name is not a URL", !isUrl("my song.mp3"));

ok("dropbox ?dl=0 → dl=1", normalizeDirectLink("https://www.dropbox.com/s/abc/song.mp3?dl=0") === "https://www.dropbox.com/s/abc/song.mp3?dl=1");
ok("google drive view link → uc?export=download", normalizeDirectLink("https://drive.google.com/file/d/ID123/view?usp=sharing") === "https://drive.google.com/uc?export=download&id=ID123");
ok("github blob → ?raw=true", normalizeDirectLink("https://github.com/o/r/blob/main/a.mp3") === "https://github.com/o/r/blob/main/a.mp3?raw=true");
ok("plain direct link unchanged", normalizeDirectLink("https://cdn.example.com/x/y.mp3") === "https://cdn.example.com/x/y.mp3");

ok("ext: real format wins over URL", pickExtension({ url: "https://x/a.mp3", formatName: "mov,mp4,m4a,3gp,3g2,mj2" }) === "m4a");
ok("ext: URL extension", pickExtension({ url: "https://x/a.OGG?token=1", formatName: "" }) === "ogg");
ok("ext: content-type", pickExtension({ url: "https://x/download?id=1", contentType: "audio/mpeg; charset=x" }) === "mp3");
ok("ext: wav content-type", pickExtension({ url: "https://x/d", contentType: "audio/x-wav" }) === "wav");
ok("ext: fallback mp3", pickExtension({ url: "https://x/d" }) === "mp3");

{
  const dir = mkdtempSync(join(tmpdir(), "pub-"));
  writeFileSync(join(dir, "Lo Fi (1).MP3"), "x");
  writeFileSync(join(dir, "background1.wav"), "x");
  writeFileSync(join(dir, "notes.txt"), "x");
  ok("resolvePublicFile: exact name with spaces/specials", resolvePublicFile("Lo Fi (1).MP3", dir).file === "Lo Fi (1).MP3");
  ok("resolvePublicFile: case-insensitive", resolvePublicFile("lo fi (1).mp3", dir).file === "Lo Fi (1).MP3");
  ok("resolvePublicFile: 'public/' prefix + quotes", resolvePublicFile('"public/background1.wav"', dir).file === "background1.wav");
  ok("resolvePublicFile: extension omitted", resolvePublicFile("background1", dir).file === "background1.wav");
  const miss = resolvePublicFile("nope.mp3", dir);
  ok("resolvePublicFile: missing → clear error + list of audio files", !miss.ok && miss.error.includes("does not exist") && miss.available.length === 2);
  ok("resolvePublicFile: rejects path traversal", !resolvePublicFile("../secret.mp3", dir).ok && !resolvePublicFile("a/b.mp3", dir).ok);
  rmSync(dir, { recursive: true, force: true });
}

{
  const sample = `[Parsed_loudnorm_0 @ 0x1]\n{\n\t"input_i" : "-27.61",\n\t"input_tp" : "-4.47",\n\t"input_lra" : "18.06",\n\t"input_thresh" : "-39.20",\n\t"output_i" : "-16.58",\n\t"target_offset" : "0.58"\n}\n`;
  const m = parseLoudnormJson(sample);
  ok("parseLoudnormJson: reads the block", m && m.input_i === -27.61 && m.target_offset === 0.58);
  ok("parseLoudnormJson: silence (-inf) → null", parseLoudnormJson('{"input_i":"-inf","input_tp":"-inf","input_lra":"0.00","input_thresh":"-70.00","target_offset":"inf"}') === null);
  ok("parseLoudnormJson: garbage → null", parseLoudnormJson("nothing here") === null);
}

{
  const s = AUDIO_SETTINGS;
  ok("default settings: -14 LUFS, TP -1.5, LRA 11", s.targetLufs === -14 && s.truePeak === -1.5 && s.lra === 11);
  ok("default music volume inside 0.06–0.10", s.bgVolume >= 0.06 && s.bgVolume <= 0.1);
  ok("resolveSettings: env override", resolveSettings({ BG_MUSIC_VOLUME: "0.06" }).settings.bgVolume === 0.06);
  const bad = resolveSettings({ BG_MUSIC_VOLUME: "loud" });
  ok("resolveSettings: bad value → default + warning", bad.settings.bgVolume === s.bgVolume && bad.warnings.length === 1);
  ok("resolveSettings: out of range rejected", resolveSettings({ BG_MUSIC_VOLUME: "3" }).warnings.length === 1);

  const lf = loudnormFilter({ input_i: -20, input_tp: -3, input_lra: 5, input_thresh: -30, target_offset: 0.4 });
  ok("loudnorm two-pass uses measured values + linear", lf.includes("I=-14") && lf.includes("TP=-1.5") && lf.includes("LRA=11") && lf.includes("measured_I=-20") && lf.includes("linear=true"));
  ok("loudnorm single-pass fallback", loudnormFilter(null) === "loudnorm=I=-14:TP=-1.5:LRA=11");

  const g = buildFilterGraph({ hasVoice: true, hasBg: true, measured: null, durationSeconds: 20 });
  ok("graph: voice is the sidechain of the music", g.filter.includes("asplit=2[vmix][vsc]") && g.filter.includes("[bg][vsc]sidechaincompress="));
  ok("graph: amix normalize=0", g.filter.includes("amix=inputs=2:duration=first:dropout_transition=0:normalize=0"));
  ok("graph: music trimmed to exact length + fade-out", g.filter.includes("atrim=duration=20") && g.filter.includes("afade=t=out:st=18:d=2"));
  const nb = buildFilterGraph({ hasVoice: true, hasBg: false, measured: null, durationSeconds: 20 });
  ok("graph (no music): normalization only", nb.filter.includes("loudnorm") && !nb.filter.includes("amix") && !nb.filter.includes("sidechain"));
  const nv = buildFilterGraph({ hasVoice: false, hasBg: true, measured: null, durationSeconds: 20 });
  ok("graph (no voice): music only, no ducking", !nv.filter.includes("sidechain") && !nv.filter.includes("loudnorm") && nv.filter.includes("[1:a:0]"));
  const short = buildFilterGraph({ hasVoice: true, hasBg: true, measured: null, durationSeconds: 1.5 });
  ok("graph: very short video keeps fades inside the clip", short.filter.includes("afade=t=out:st=0.75:d=0.75"));
}

// ---------------------------------------------------------------------------
// ffmpeg cases
// ---------------------------------------------------------------------------
console.log("\n— ffmpeg integration —");
const tools = await checkFfmpeg();
if (!tools.ok) {
  skip("all ffmpeg cases", tools.reason);
} else {
  const work = mkdtempSync(join(tmpdir(), "audiomix-test-"));
  const ff = (...args) => spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" });
  const quiet = () => {};

  // 20 s test video; "voice" = 220 Hz tone, 2 s on / 2 s off, deliberately quiet (needs a big boost to reach -14 LUFS)
  const voiceSrc = "sine=f=220:duration=20,volume='if(lt(mod(t,4),2),0.12,0)':eval=frame";
  const videoName = "hadis 0101 (test) [9x16].mp4";
  const video = join(work, videoName);
  ff("-f", "lavfi", "-i", "testsrc=size=320x240:rate=30:duration=20", "-f", "lavfi", "-i", voiceSrc, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-shortest", video);
  ok("fixture: test video created (name has spaces/brackets)", existsSync(video));

  const silentVideo = join(work, "no audio.mp4");
  ff("-f", "lavfi", "-i", "testsrc=size=320x240:rate=30:duration=10", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", silentVideo);

  // music fixtures: short (8 s) and long (40 s), various formats, awkward names
  const music = (name, secs, codecArgs) => {
    const f = join(work, name);
    ff("-f", "lavfi", "-i", `sine=f=440:duration=${secs}`, "-f", "lavfi", "-i", `sine=f=660:duration=${secs}`, "-filter_complex", "amix=inputs=2:normalize=0,volume=0.5", ...codecArgs, f);
    return f;
  };
  const shortMp3 = music("lo fi (short) & calm.mp3", 8, ["-c:a", "libmp3lame", "-b:a", "128k"]);
  const longWav = music("long track.wav", 40, ["-c:a", "pcm_s16le"]);

  // helper: mean volume (dB) of a window of the final file's audio
  // `bandHz` isolates one frequency (the test "voice" is 220 Hz, the test music is 440 + 660 Hz) to look at the music alone
  const meanDb = (file, start, dur, bandHz = 0) => {
    const af = (bandHz ? `bandpass=f=${bandHz}:width_type=h:w=60,` : "") + "volumedetect";
    const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-ss", String(start), "-t", String(dur), "-i", file, "-vn", "-af", af, "-f", "null", "-"], { encoding: "utf8" });
    const m = r.stderr.match(/mean_volume:\s*(-?[\d.]+|-inf) dB/);
    return m ? (m[1] === "-inf" ? -120 : parseFloat(m[1])) : NaN;
  };
  const copyVideo = (name) => {
    const f = join(work, name);
    copyFileSync(video, f);
    return f;
  };

  // --- 1. no background music: normalization only ---
  {
    const f = copyVideo("case1 no music.mp4");
    const mixer = await createAudioMixer({ bgMusicFile: "", env: {}, log: quiet });
    const r = await mixer.process(f);
    mixer.cleanup();
    const before = await probeMedia(video);
    const after = await probeMedia(f);
    const lufs = (await measureLoudness(f))?.input_i;
    ok("no music: status normalized", r.status === "normalized", r.detail);
    ok("no music: voice ≈ -14 LUFS", Number.isFinite(lufs) && Math.abs(lufs + 14) <= 1, `got ${lufs}`);
    ok("no music: video stream copied (h264), audio is AAC", after.videoCodec === "h264" && after.audioCodec === "aac");
    ok("no music: same length as the video", Math.abs(after.duration - before.duration) < 0.3, `${before.duration} vs ${after.duration}`);
    ok("no music: no leftover temp file", readdirSync(work).every((n) => !n.includes(".audiomix.tmp")));
  }

  // --- 2. SHORT music → looped; ducking; fade-out ---
  {
    const f = copyVideo("case2 loop.mp4");
    const logs = [];
    const mixer = await createAudioMixer({ bgMusicFile: shortMp3, env: {}, log: (l) => logs.push(l) });
    const r = await mixer.process(f);
    mixer.cleanup();
    const before = await probeMedia(video);
    const after = await probeMedia(f);
    ok("short music: status mixed", r.status === "mixed", r.detail);
    ok("short music: log says it loops", logs.some((l) => l.startsWith("Looping background music")));
    ok("short music: exact video length", Math.abs(after.duration - before.duration) < 0.3, `${before.duration} vs ${after.duration}`);
    ok("short music: video stream still h264 copy", after.videoCodec === "h264" && after.hasAudio);
    // t=10–12 is a voice gap AFTER the 8 s music ended → music is only there if looping works
    const gapLoop = meanDb(f, 10.2, 1.5);
    ok("short music: music audible after the first loop (gap at 10 s)", gapLoop > -70, `${gapLoop} dB`);
    // gap at 2–4 s: music alone → must be very quiet compared with the voice (-14 LUFS ≈ -14..-20 dB mean while speaking)
    const gapEarly = meanDb(f, 2.3, 1.4);
    const speech = meanDb(f, 0.2, 1.6);
    ok("short music: very soft under the voice (≥ 15 dB below speech)", speech - gapEarly >= 15, `speech ${speech} dB, music ${gapEarly} dB`);
    // fade-out: last gap is 18–20 s; the final 0.4 s must be clearly quieter than 18.0–18.4
    const fadeStart = meanDb(f, 18.0, 0.4);
    const fadeEnd = meanDb(f, 19.5, 0.4);
    ok("short music: fade-out at the end", fadeStart - fadeEnd >= 6, `${fadeStart} → ${fadeEnd} dB`);
    ok("short music: voice stays near -14 LUFS (music is negligible)", Math.abs((await measureLoudness(f)).input_i + 14) <= 1.5);
  }

  // --- 3. LONG music → trimmed ---
  {
    const f = copyVideo("case3 trim.mp4");
    const logs = [];
    const mixer = await createAudioMixer({ bgMusicFile: longWav, env: {}, log: (l) => logs.push(l) });
    const r = await mixer.process(f);
    mixer.cleanup();
    const before = await probeMedia(video);
    const after = await probeMedia(f);
    ok("long music: status mixed + log says trimming", r.status === "mixed" && logs.some((l) => l.startsWith("Trimming background music")));
    ok("long music: cut to the exact video length (not 40 s)", Math.abs(after.duration - before.duration) < 0.3, `${before.duration} vs ${after.duration}`);
  }

  // --- 4. ducking: the music (440 Hz band) is lower while the voice speaks than it would be without ducking ---
  {
    const ducked = copyVideo("case4 ducked.mp4");
    const flat = copyVideo("case4 flat.mp4");
    const m1 = await createAudioMixer({ bgMusicFile: longWav, env: { BG_MUSIC_VOLUME: "0.3" }, log: quiet });
    await m1.process(ducked);
    m1.cleanup();
    const m2 = await createAudioMixer({ bgMusicFile: longWav, env: { BG_MUSIC_VOLUME: "0.3" }, log: quiet });
    m2.settings.duck.ratio = 1; // ratio 1 = no compression = ducking off
    await m2.process(flat);
    m2.cleanup();
    const speakDuck = meanDb(ducked, 0.3, 1.5, 440); // voice speaking (0–2 s)
    const speakFlat = meanDb(flat, 0.3, 1.5, 440);
    const gapDuck = meanDb(ducked, 2.5, 1.2, 440); // voice silent (2–4 s)
    const gapFlat = meanDb(flat, 2.5, 1.2, 440);
    ok("ducking: music drops ≥ 6 dB while the voice speaks", speakFlat - speakDuck >= 6, `ducked ${speakDuck} dB vs flat ${speakFlat} dB`);
    ok("ducking: music comes back to full level when the voice stops", Math.abs(gapDuck - gapFlat) <= 1.5, `ducked ${gapDuck} dB vs flat ${gapFlat} dB`);
  }

  // --- 5. video without audio stream ---
  {
    const f = join(work, "case5 silent.mp4");
    copyFileSync(silentVideo, f);
    const sizeBefore = statSync(f).size;
    const m1 = await createAudioMixer({ bgMusicFile: "", env: {}, log: quiet });
    const r1 = await m1.process(f);
    m1.cleanup();
    ok("no audio stream + no music: skipped, file untouched", r1.status === "skipped" && statSync(f).size === sizeBefore);
    const m2 = await createAudioMixer({ bgMusicFile: shortMp3, env: {}, log: quiet });
    const r2 = await m2.process(f);
    m2.cleanup();
    const after = await probeMedia(f);
    ok("no audio stream + music: music-only audio track added", r2.status === "mixed" && after.hasAudio && Math.abs(after.duration - 10) < 0.3, `${r2.status} ${r2.detail}`);
  }

  // --- 6. broken background music never breaks the render ---
  {
    const bad = join(work, "fake song.mp3");
    writeFileSync(bad, "this is not audio at all");
    const f = copyVideo("case6 broken music.mp4");
    const logs = [];
    const mixer = await createAudioMixer({ bgMusicFile: bad, env: {}, log: (l) => logs.push(l) });
    const r = await mixer.process(f);
    mixer.cleanup();
    ok("broken music: warning + continues without music", logs.some((l) => l.includes("Continuing without background music")) && r.status === "normalized", `${r.status}`);
    const missing = await createAudioMixer({ bgMusicFile: join(work, "does not exist.mp3"), env: {}, log: quiet });
    const f2 = copyVideo("case6b missing music.mp4");
    const r2 = await missing.process(f2);
    missing.cleanup();
    ok("missing music file: continues, voice still normalized", r2.status === "normalized");
  }

  // --- 7. different music formats are all accepted ---
  {
    const formats = [
      ["mp3", ["-c:a", "libmp3lame"]],
      ["wav", ["-c:a", "pcm_s16le"]],
      ["m4a", ["-c:a", "aac"]],
      ["ogg", ["-c:a", "libvorbis"]],
      ["aac", ["-c:a", "aac", "-f", "adts"]],
      ["flac", ["-c:a", "flac"]],
    ];
    for (const [ext, codec] of formats) {
      const f = join(work, `fmt test.${ext}`);
      const r = ff("-f", "lavfi", "-i", "sine=f=330:duration=3", ...codec, f);
      if (r.status !== 0 || !existsSync(f)) {
        skip(`format ${ext}`, "this ffmpeg cannot encode it");
        continue;
      }
      const d = mkdtempSync(join(work, "w-"));
      const p = await prepareBackgroundWav(f, d, AUDIO_SETTINGS, quiet);
      ok(`format ${ext}: decoded to WAV`, p.ok && Math.abs(p.duration - 3) < 0.2, p.error);
    }
  }

  // --- 8. prepare-bgmusic.mjs against a local HTTP server ---
  {
    const server = createServer((req, res) => {
      if (req.url === "/track.mp3") {
        res.writeHead(200, { "Content-Type": "audio/mpeg" });
        res.end(readFileSync(shortMp3));
      } else if (req.url === "/redirect") {
        res.writeHead(302, { Location: "/track.mp3" });
        res.end();
      } else if (req.url === "/mislabeled.mp3") {
        res.writeHead(200, { "Content-Type": "application/octet-stream" });
        res.end(readFileSync(join(work, "fmt test.m4a")));
      } else if (req.url === "/page") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html>share page</html>");
      } else {
        res.writeHead(404);
        res.end("nope");
      }
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;

    const newPub = () => mkdtempSync(join(work, "public-"));

    // async spawn (the HTTP server lives in this process, so a blocking spawnSync would deadlock)
    const runPrepareAsync = (input, pub) =>
      new Promise((resolvePromise) => {
        const envFile = join(work, `github_env_${Math.random().toString(36).slice(2)}`);
        writeFileSync(envFile, "");
        const c = spawn("node", [join(here, "prepare-bgmusic.mjs")], {
          env: { ...process.env, BACKGROUND_MUSIC: input, PUBLIC_DIR: pub, GITHUB_ENV: envFile },
        });
        let o = "";
        c.stdout.on("data", (d) => (o += d));
        c.stderr.on("data", (d) => (o += d));
        c.on("close", (code) => resolvePromise({ code, out: o, env: readFileSync(envFile, "utf8") }));
      });

    {
      const pub = newPub();
      const r = await runPrepareAsync("", pub);
      ok("prepare: empty input → no music, exit 0, nothing written", r.code === 0 && r.env === "" && r.out.includes("No background music provided"));
    }
    {
      const pub = newPub();
      writeFileSync(join(pub, "background1.wav"), "old");
      const r = await runPrepareAsync(`${base}/track.mp3`, pub);
      ok("prepare: link → saved as background1.mp3, old background1.* removed", r.code === 0 && existsSync(join(pub, "background1.mp3")) && !existsSync(join(pub, "background1.wav")), r.out);
      ok("prepare: BG_MUSIC_FILE + BG_MUSIC_DOWNLOADED exported", r.env.includes("BG_MUSIC_FILE=") && r.env.includes("background1.mp3") && r.env.includes("BG_MUSIC_DOWNLOADED=true"), r.env);
    }
    {
      const pub = newPub();
      const r = await runPrepareAsync(`${base}/redirect`, pub);
      ok("prepare: follows redirects", r.code === 0 && existsSync(join(pub, "background1.mp3")), r.out);
    }
    {
      const pub = newPub();
      const r = await runPrepareAsync(`${base}/mislabeled.mp3`, pub);
      ok("prepare: real format decides extension (.mp3 link that is m4a → .m4a)", r.code === 0 && existsSync(join(pub, "background1.m4a")), r.out);
    }
    {
      const pub = newPub();
      const r = await runPrepareAsync(`${base}/page`, pub);
      ok("prepare: HTML page → warning, continue without music (exit 0)", r.code === 0 && r.out.includes("::warning::") && r.env === "" && readdirSync(pub).length === 0, r.out);
    }
    {
      const pub = newPub();
      const r = await runPrepareAsync(`${base}/missing.mp3`, pub);
      ok("prepare: 404 → warning, continue without music (exit 0)", r.code === 0 && r.out.includes("::warning::") && r.env === "", r.out);
    }
    {
      const pub = newPub();
      copyFileSync(shortMp3, join(pub, "my theme (v2).mp3"));
      const r = await runPrepareAsync("my theme (v2).mp3", pub);
      ok("prepare: file name with spaces/specials from public/", r.code === 0 && r.env.includes("my theme (v2).mp3") && r.env.includes("BG_MUSIC_DOWNLOADED=false"), r.out + r.env);
    }
    {
      const pub = newPub();
      copyFileSync(shortMp3, join(pub, "exists.mp3"));
      const r = await runPrepareAsync("typo.mp3", pub);
      ok(
        "prepare: missing file name → clear ::error:: listing available files + BG_MUSIC_ERROR (workflow gate fails the run later)",
        r.code === 0 && r.out.includes("::error::") && r.out.includes("does not exist") && r.out.includes("exists.mp3") && r.env.includes("BG_MUSIC_ERROR=") && !r.env.includes("BG_MUSIC_FILE="),
        r.out + r.env,
      );
    }
    {
      const pub = newPub();
      writeFileSync(join(pub, "bad.mp3"), "not audio");
      const r = await runPrepareAsync("bad.mp3", pub);
      ok("prepare: invalid existing file → warning, continue without music", r.code === 0 && r.out.includes("::warning::") && r.env === "", r.out);
    }
    {
      const pub = newPub();
      const r = await runPrepareAsync("ftp://example.com/a.mp3", pub);
      ok("prepare: non-http link → warning, continue", r.code === 0 && r.out.includes("::warning::") && r.env === "", r.out);
    }
    server.close();
  }

  rmSync(work, { recursive: true, force: true });
}

console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed === 0 ? 0 : 1);
