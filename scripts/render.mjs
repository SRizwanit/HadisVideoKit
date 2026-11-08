// Part 14B: আসল রেন্ডার স্ক্রিপ্ট (Part 3-এর স্টাব এটাই বদলে দিল)। render.yml আগের মতোই এটাকে ডাকে — বদলাতে হয় না।
//
//   node scripts/render.mjs --id 0101 --book "সহীহ বুখারী" --number ১ \
//     --theme greenDayNight --orientation both --quality hd
//   থিম: emerald | navy | greenDayNight | monsoon (বর্ষা) | winter (শীত) | spring (বসন্ত)
//   --time-mode day | night | dayToNight (ডিফল্ট) | nightToDay   (দিন-রাতের থিমে; emerald/navy-তে প্রভাব নেই)
//
// ধাপ: আর্গুমেন্ট যাচাই + ইনপুট ফাইল পরীক্ষা (14A, কয়েক সেকেন্ডে) → (--dry-run হলে টেবিল ছেপে শেষ)
//      → বান্ডল একবার → প্রতিটা জব একটার পর একটা: selectComposition → renderMedia → ফাইল যাচাই।
// কোনো জব ব্যর্থ হলে exit code 1 (আগে শেষ হওয়া mp4 out/ এ থেকে যায়)।
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  THUMBNAIL_JPEG_QUALITY,
  buildPlan,
  checkInputs,
  formatDryRun,
  formatReport,
} from "./lib/renderPlan.mjs";
import { buildPublishText } from "./lib/publishText.mjs";
import { buildSrtCues, formatSrt } from "./lib/srt.mjs";
import { createAudioMixer } from "./lib/audioMix.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** রেন্ডার ফেল করলে "মেমরি কম" মনে হয় এমন বার্তার চিহ্ন */
const OOM_PATTERN =
  /out of memory|ENOMEM|heap|Target closed|Page crashed|SIGKILL|SIGABRT|killed|std::bad_alloc|Protocol error/i;

// ---------- ছোট হেল্পার ----------
const summaryLines = [];
function say(line = "") {
  console.log(line);
}
/** টার্মিনালে ও (থাকলে) GitHub Step Summary-তে — Markdown */
function sayMd(line = "") {
  console.log(line);
  summaryLines.push(line);
}
function flushSummary() {
  if (process.env.GITHUB_STEP_SUMMARY && summaryLines.length > 0) {
    try {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryLines.join("\n") + "\n");
    } catch {
      /* summary না লেখা গেলে রেন্ডার থামাই না */
    }
  }
}

function fmtDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}ঘ ${m}মি ${s}সে`;
  if (m > 0) return `${m}মি ${s}সে`;
  return `${s}সে`;
}

function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** --frames দিয়ে টেস্ট রেন্ডার হলে নামের শেষে _test (আসল ফাইলের সাথে মিশবে না) */
function outputPathFor(job) {
  const file = job.frameRange ? job.outputFile.replace(/\.mp4$/i, "_test.mp4") : job.outputFile;
  return resolve(file);
}

/** [HADIS_DATA] এরর → বাংলা ব্যাখ্যা */
function explainHadisData(message) {
  const detail = message.split("[HADIS_DATA]").pop().trim();
  return [
    "হাদিসের ডেটা ফাইল পাওয়া যায়নি বা ঠিক নেই।",
    `কারণ: ${detail}`,
    "করণীয়: public/hadis/ ফোল্ডারে hadis<id>.wav ও hadis<id>_timestamp.json ঠিক নামে আছে কিনা এবং JSON-এর গঠন ঠিক কিনা দেখো (AI-কে আবার JSON বানাতে বলা যায়)।",
  ].join("\n   ");
}

function explainFailure(err) {
  const message = String(err?.message ?? err);
  if (message.includes("[HADIS_DATA]")) return { text: explainHadisData(message), hadisData: true };
  if (OOM_PATTERN.test(message)) {
    return {
      text: [
        `রেন্ডার মাঝপথে থেমে গেছে (সম্ভবত মেমরি কম): ${message.split("\n")[0]}`,
        "করণীয়: quality = hd দিয়ে চালাও, অথবা `--concurrency` কমাও (যেমন 2 বা 1)। 4K ও greenDayNight থিম বেশি মেমরি নেয়।",
      ].join("\n   "),
      hadisData: false,
    };
  }
  return {
    text: `রেন্ডার ব্যর্থ: ${message.split("\n")[0]}`,
    hadisData: false,
    stack: err?.known ? undefined : err?.stack,
  };
}

/** আমাদের নিজের জানা ভুল (stack দেখানোর দরকার নেই) */
function knownError(message) {
  const e = new Error(message);
  e.known = true;
  return e;
}

// ---------- একটা জব ----------
async function runJob({ job, total, serveUrl, mixer }) {
  const startedAt = Date.now();
  const outputLocation = outputPathFor(job);
  mkdirSync(dirname(outputLocation), { recursive: true });

  say(`\n▶ জব ${job.index}/${total}: ${job.label} → ${job.outputFile}`);

  // ১. কম্পোজিশন বেছে নেওয়া — মোট ফ্রেম ও সাইজ এখান থেকেই আসে (calculateMetadata)
  const composition = await selectComposition({
    serveUrl,
    id: job.compositionId,
    inputProps: job.inputProps,
  });

  const lastFrame = composition.durationInFrames - 1;
  let frameRange = null;
  if (job.frameRange) {
    const [start, end] = job.frameRange;
    if (start > lastFrame) {
      throw knownError(
        `--frames ${start}-${end} ঠিক নয়: ভিডিওতে মোট ${composition.durationInFrames}টা ফ্রেম (0 থেকে ${lastFrame})।`,
      );
    }
    const clampedEnd = Math.min(end, lastFrame);
    if (clampedEnd !== end) {
      say(`⚠️ শেষ ফ্রেম ${end} ভিডিওর বাইরে — ${clampedEnd} ধরা হলো।`);
    }
    frameRange = [start, clampedEnd];
  }
  const framesToRender = frameRange
    ? frameRange[1] - frameRange[0] + 1
    : composition.durationInFrames;
  const videoSeconds = framesToRender / composition.fps;

  // ফ্রেমের চেয়ে বেশি concurrency দিলে Remotion আপত্তি করে — তাই ছোট করে নিই
  const concurrency = Math.max(1, Math.min(job.concurrency, framesToRender));

  say(
    `   ${composition.width * job.scale}x${composition.height * job.scale} | ${framesToRender} ফ্রেম (${videoSeconds.toFixed(1)}সে) | ${composition.fps}fps | concurrency ${concurrency} | crf ${job.crf} | aac 192k`,
  );

  // ২. রেন্ডার — প্রতি ~১০% এ এক লাইন
  let lastDecile = -1;
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    // YouTube/Shorts-এ কম কম্প্রেশন-ক্ষতি: H.264 + CRF ~18 (job.crf) + AAC 192k + yuv420p (সব প্লেয়ারে চলে); fps = ৩০ (কম্পোজিশন)
    audioCodec: "aac",
    audioBitrate: "192k",
    pixelFormat: "yuv420p",
    outputLocation,
    inputProps: job.inputProps,
    scale: job.scale,
    crf: job.crf,
    concurrency,
    frameRange,
    overwrite: true,
    imageFormat: "jpeg",
    jpegQuality: 90,
    // ভারী SVG/ফন্ট লোডের জন্য বাড়তি সময় (ডিফল্ট ৩০ সেকেন্ড)
    timeoutInMilliseconds: 120000,
    chromiumOptions: { enableMultiProcessOnLinux: true },
    onProgress: ({ progress }) => {
      const decile = Math.min(10, Math.floor(progress * 10));
      if (decile > lastDecile) {
        lastDecile = decile;
        const elapsed = Date.now() - startedAt;
        const eta = progress > 0.02 ? (elapsed / progress) * (1 - progress) : NaN;
        say(
          `   [${job.index}/${total}] ${Math.round(progress * 100)}% | গত ${fmtDuration(elapsed)}${
            Number.isFinite(eta) ? ` | বাকি ~${fmtDuration(eta)}` : ""
          }`,
        );
      }
    },
  });

  // ৩. ফাইল যাচাই
  if (!existsSync(outputLocation)) {
    throw knownError(`রেন্ডার শেষ হলেও আউটপুট ফাইল তৈরি হয়নি: ${outputLocation}`);
  }
  if (statSync(outputLocation).size === 0) {
    throw knownError(`আউটপুট ফাইল খালি (০ বাইট): ${outputLocation}`);
  }

  // ৩খ. অডিও পোস্ট-প্রসেস (FFmpeg): ভয়েস ≈ -14 LUFS + (ঐচ্ছিক) নরম ব্যাকগ্রাউন্ড মিউজিক + ducking।
  // কখনো throw করে না — ব্যর্থ হলে Remotion-এর আসল অডিওসহ ভিডিও যেমন আছে তেমনই থাকে।
  const audio = await mixer.process(outputLocation);

  const size = statSync(outputLocation).size;
  const renderMs = Date.now() - startedAt;
  say(`✅ জব ${job.index}/${total} শেষ: ${fmtSize(size)} | ${fmtDuration(renderMs)}`);
  return {
    file: job.frameRange ? job.outputFile.replace(/\.mp4$/i, "_test.mp4") : job.outputFile,
    label: job.label,
    size,
    videoSeconds,
    renderMs,
    audio,
  };
}

// ---------- থাম্বনেইল (Hook + Teaser + Intro এক ছবিতে, 4K) ----------
/**
 * একটা ওরিয়েন্টেশনের থাম্বনেইল: PNG (লসলেস) + JPG (ছোট ফাইল) — দুটোই `--scale 2` (4K)।
 * ভিডিও জবের মতোই `selectComposition` (teaser-এর সেকেন্ড `calculateMetadata` থেকে আসে)।
 * ব্যর্থ হলে throw করে; কল-কারী ধরে ⚠️ দেখায় (ভিডিও আগেই তৈরি, তাই রান ব্যর্থ হয় না)।
 */
async function runThumbnail({ thumb, total, serveUrl }) {
  const startedAt = Date.now();
  mkdirSync(dirname(resolve(thumb.pngFile)), { recursive: true });
  say(`\n▶ থাম্বনেইল ${thumb.index}/${total}: ${thumb.label} → ${thumb.pngFile}`);

  const composition = await selectComposition({
    serveUrl,
    id: thumb.compositionId,
    inputProps: thumb.inputProps,
  });
  say(`   ${composition.width * thumb.scale}x${composition.height * thumb.scale} | ফ্রেম ${thumb.frame}`);

  const common = {
    serveUrl,
    composition,
    inputProps: thumb.inputProps,
    frame: Math.min(thumb.frame, composition.durationInFrames - 1),
    scale: thumb.scale,
    overwrite: true,
    timeoutInMilliseconds: 120000,
    chromiumOptions: { enableMultiProcessOnLinux: true },
  };

  const outputs = [];
  for (const [file, format] of [
    [thumb.pngFile, "png"],
    [thumb.jpgFile, "jpeg"],
  ]) {
    const output = resolve(file);
    await renderStill({
      ...common,
      output,
      imageFormat: format,
      ...(format === "jpeg" ? { jpegQuality: THUMBNAIL_JPEG_QUALITY } : {}),
    });
    if (!existsSync(output)) throw knownError(`থাম্বনেইল ফাইল তৈরি হয়নি: ${output}`);
    const size = statSync(output).size;
    if (size === 0) throw knownError(`থাম্বনেইল ফাইল খালি (০ বাইট): ${output}`);
    outputs.push({ file, size });
  }
  say(`✅ থাম্বনেইল ${thumb.index}/${total} শেষ | ${fmtDuration(Date.now() - startedAt)}`);
  return { label: thumb.label, width: composition.width * thumb.scale, height: composition.height * thumb.scale, outputs };
}

// ---------- প্রকাশের ফাইল: ক্যাপশন/ট্যাগ (.txt) + সাবটাইটেল (.srt) ----------
/** timestamp JSON পড়া (checkInputs আগেই দেখেছে যে ফাইল আছে ও JSON পার্স হয়) */
function readTimestampJson(plan) {
  return JSON.parse(readFileSync(join(projectRoot, "public", "hadis", `hadis${plan.id}_timestamp.json`), "utf8"));
}

/** শিরোনাম/বিবরণ/ট্যাগের .txt — ব্রাউজার লাগে না, তাই বান্ডলের আগেই (রেন্ডার ব্যর্থ হলেও ফাইলটা পাওয়া যায়) */
function writePublishText(plan) {
  const pub = plan.publish;
  const text = buildPublishText({
    file: readTimestampJson(plan),
    book: pub.book,
    number: pub.number,
    series: pub.series,
    hookText: pub.hookText,
    appLink: pub.appLink,
    orientations: pub.orientations,
  });
  const out = resolve(pub.textFile);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text, "utf8");
  return { file: pub.textFile, size: statSync(out).size };
}

/**
 * সাবটাইটেল .srt — সময় আসে `selectComposition`-এর ফল (calculateMetadata-র হিসাব: hook/teaser/intro/outro সেকেন্ড, মোট ফ্রেম),
 * তাই ভিডিওর সাথে ঠিক মেলে। সব ওরিয়েন্টেশন/কোয়ালিটিতে সময় এক, তাই প্রথম জবের কম্পোজিশনেই যথেষ্ট।
 */
async function writeSrtFile({ plan, serveUrl }) {
  const job = plan.jobs[0];
  const composition = await selectComposition({
    serveUrl,
    id: job.compositionId,
    inputProps: job.inputProps,
  });
  const p = composition.props ?? {};
  const cues = buildSrtCues({
    file: readTimestampJson(plan),
    totalFrames: composition.durationInFrames,
    fps: composition.fps,
    hookSeconds: p.hookSeconds,
    teaserSeconds: p.teaserSeconds,
    introSeconds: p.introSeconds,
    outroSeconds: p.outroSeconds,
    hookText: p.hookText,
    teaserStartSeconds: p.teaserStartSeconds,
    teaserEndSeconds: p.teaserEndSeconds,
  });
  if (cues.length === 0) throw knownError("সাবটাইটেলের কোনো লাইন তৈরি হয়নি (JSON-এ segment আছে তো?)");
  const out = resolve(plan.publish.srtFile);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, formatSrt(cues), "utf8");
  return { file: plan.publish.srtFile, size: statSync(out).size, cues: cues.length };
}

// ---------- মূল ফ্লো ----------
async function main() {
  // ১. আর্গুমেন্ট যাচাই (ব্রাউজার ছাড়া)
  const result = buildPlan(process.argv.slice(2));
  if (result.warnings.length > 0) say(formatReport({ warnings: result.warnings }));
  if (!result.ok) {
    sayMd("## ❌ আর্গুমেন্টে ভুল\n");
    sayMd(formatReport({ errors: result.errors }));
    return 1;
  }
  const plan = result.plan;

  // ২. ইনপুট ফাইল আগেভাগে (কয়েক সেকেন্ডে ভুল ধরা পড়ে)
  const inputs = checkInputs(plan, projectRoot);
  const inputInfo = formatReport({ warnings: inputs.warnings, notes: inputs.notes });
  if (inputInfo) say(inputInfo);
  if (!inputs.ok) {
    sayMd("## ❌ দরকারি ফাইল পাওয়া যায়নি\n");
    sayMd(formatReport({ errors: inputs.errors }));
    return 1;
  }

  // ৩. --dry-run: টেবিল ছেপে শেষ, ব্রাউজার ছাড়া
  if (plan.dryRun) {
    sayMd("## 📋 রেন্ডার পরিকল্পনা (--dry-run, কিছু রেন্ডার হয়নি)\n");
    sayMd("```\n" + formatDryRun(plan) + "\n```");
    return 0;
  }

  // থাম্বনেইল-only মোড: ভিডিওর জব চলে না
  const videoJobs = plan.thumbnailOnly ? [] : plan.jobs;
  const total = videoJobs.length;
  if (plan.thumbnailOnly) {
    say(`\nশুধু থাম্বনেইল মোড — ${plan.thumbnails.length}টা 4K থাম্বনেইল (PNG + JPG), ভিডিও রেন্ডার হবে না।`);
  } else {
    say(`\nমোট ${total}টা জব রেন্ডার হবে (একটার পর একটা)।`);
    if (plan.thumbnails.length > 0) say(`এরপর ${plan.thumbnails.length}টা 4K থাম্বনেইল (PNG + JPG)।`);
  }

  // ৩খ. প্রকাশের টেক্সট (.txt) — ব্রাউজার ছাড়াই, তাই আগেভাগে; ব্যর্থ হলে ⚠️, রান থামে না
  const publishInfo = { text: null, srt: null, failed: [] };
  if (plan.publish.enabled) {
    try {
      publishInfo.text = writePublishText(plan);
      say(`✅ প্রকাশের টেক্সট তৈরি: ${publishInfo.text.file}`);
    } catch (err) {
      say(`⚠️ প্রকাশের টেক্সট বানানো যায়নি: ${String(err?.message ?? err).split("\n")[0]}`);
      publishInfo.failed.push(`প্রকাশের টেক্সট: ${String(err?.message ?? err).split("\n")[0]}`);
    }
  }

  // ৪. ব্রাউজার + বান্ডল (একবারই)
  say("▶ ব্রাউজার যাচাই...");
  await ensureBrowser();

  say("▶ বান্ডল তৈরি হচ্ছে...");
  const serveUrl = await bundle({
    entryPoint: join(projectRoot, "src", "index.ts"),
    publicDir: join(projectRoot, "public"),
  });

  // ৪খ. অডিও মিক্সার (ffmpeg) — BG_MUSIC_FILE ফাঁকা = ব্যাকগ্রাউন্ড মিউজিক ছাড়া, শুধু ভয়েস -14 LUFS
  const bgEnv = String(process.env.BG_MUSIC_FILE ?? "").trim();
  const mixer = await createAudioMixer({
    bgMusicFile: bgEnv ? resolve(projectRoot, bgEnv) : "",
    env: process.env,
    log: say,
  });

  // ৫. জবগুলো একে একে
  const done = [];
  const failed = [];
  const thumbs = [];
  const thumbFailed = [];
  try {
    // সাবটাইটেল .srt (সময় composition থেকে) — ব্যর্থ হলে ⚠️, ভিডিও থামে না
    if (plan.publish.enabled) {
      try {
        publishInfo.srt = await writeSrtFile({ plan, serveUrl });
        say(`✅ সাবটাইটেল তৈরি: ${publishInfo.srt.file} (${publishInfo.srt.cues}টা লাইন)`);
      } catch (err) {
        const info = explainFailure(err);
        say(`⚠️ সাবটাইটেল বানানো যায়নি: ${info.text.split("\n")[0]}`);
        publishInfo.failed.push(`সাবটাইটেল: ${info.text.split("\n")[0]}`);
      }
    }
    for (const job of videoJobs) {
      try {
        done.push(await runJob({ job, total, serveUrl, mixer }));
      } catch (err) {
        const info = explainFailure(err);
        say(`\n❌ জব ${job.index}/${total} (${job.label}) ব্যর্থ:\n   ${info.text}`);
        if (info.stack && !info.hadisData) say(`\n${info.stack}`);
        failed.push({ label: job.label, reason: info.text.split("\n")[0] });
        // ডেটা ফাইলের সমস্যা সব জবেই একই — আর চেষ্টা করে লাভ নেই
        if (info.hadisData) break;
      }
    }
    // থাম্বনেইল: ভিডিওর পরে। এখানকার ব্যর্থতা ভিডিওর রান ব্যর্থ করে না (⚠️ দেখায়); ডেটা-ফাইল ভুল হলে ভিডিও জবই আগে থেমেছে
    if (failed.length === 0 || done.length > 0) {
      for (const thumb of plan.thumbnails) {
        try {
          thumbs.push(await runThumbnail({ thumb, total: plan.thumbnails.length, serveUrl }));
        } catch (err) {
          const info = explainFailure(err);
          say(`\n⚠️ থাম্বনেইল ${thumb.index}/${plan.thumbnails.length} (${thumb.label}) ব্যর্থ:\n   ${info.text}`);
          if (info.stack) say(`\n${info.stack}`);
          thumbFailed.push({ label: thumb.label, reason: info.text.split("\n")[0] });
        }
      }
    }
  } finally {
    mixer.cleanup();
    try {
      rmSync(serveUrl, { recursive: true, force: true });
    } catch {
      /* বান্ডলের অস্থায়ী ফোল্ডার মোছা না গেলে সমস্যা নেই */
    }
  }

  // ৬. শেষের টেবিল
  if (plan.thumbnailOnly) {
    sayMd(`\n## ${thumbFailed.length === 0 ? "✅" : "⚠️"} থাম্বনেইল শেষ — ${thumbs.length}/${plan.thumbnails.length}টি তৈরি\n`);
  } else {
    sayMd(`\n## ${failed.length === 0 ? "✅" : "⚠️"} রেন্ডার শেষ — ${done.length}/${total} ভিডিও তৈরি\n`);
  }
  if (done.length > 0) {
    sayMd("| ফাইল | সাইজ | ভিডিওর দৈর্ঘ্য | রেন্ডারে সময় |");
    sayMd("|---|---|---|---|");
    for (const d of done) {
      sayMd(
        `| \`${d.file}\` (${d.label}) | ${fmtSize(d.size)} | ${d.videoSeconds.toFixed(1)}সে | ${fmtDuration(d.renderMs)} |`,
      );
    }
  }
  if (done.length > 0) {
    sayMd("\n### 🔊 অডিও (ভয়েস -14 LUFS · ব্যাকগ্রাউন্ড মিউজিক · ducking)\n");
    for (const d of done) sayMd(`- \`${d.file}\`: ${d.audio?.status ?? "—"} — ${d.audio?.detail ?? ""}`);
  }
  if (thumbs.length > 0) {
    sayMd("\n### 🖼️ থাম্বনেইল (Hook + Teaser + Intro)\n");
    sayMd("| ফাইল | সাইজ | মাপ |");
    sayMd("|---|---|---|");
    for (const t of thumbs) {
      for (const o of t.outputs) {
        sayMd(`| \`${o.file}\` (${t.label}) | ${fmtSize(o.size)} | ${t.width}×${t.height} |`);
      }
    }
    sayMd("\n> ইউটিউবের থাম্বনেইল-সীমা ২ MB — PNG বড় হলে `.jpg` ফাইলটা দাও।");
  }
  if (publishInfo.text || publishInfo.srt) {
    sayMd("\n### 📝 প্রকাশের ফাইল\n");
    sayMd("| ফাইল | সাইজ | কী |");
    sayMd("|---|---|---|");
    if (publishInfo.text) {
      sayMd(`| \`${publishInfo.text.file}\` | ${fmtSize(publishInfo.text.size)} | ইউটিউব শিরোনাম (৩ বিকল্প) + বিবরণ + ট্যাগ + ফেসবুক ক্যাপশন + হ্যাশট্যাগ |`);
    }
    if (publishInfo.srt) {
      sayMd(`| \`${publishInfo.srt.file}\` | ${fmtSize(publishInfo.srt.size)} | সাবটাইটেল (${publishInfo.srt.cues}টা লাইন) — ইউটিউব স্টুডিওতে Subtitles → Upload file |`);
    }
    sayMd("\n> ⚠️ প্রকাশের আগে হাদিসের লেখা, সূত্র ও নম্বর নিজে যাচাই করে নিন।");
  }
  if (publishInfo.failed.length > 0) {
    sayMd("\n### ⚠️ প্রকাশের ফাইল ব্যর্থ (ভিডিও ঠিক আছে)\n");
    for (const f of publishInfo.failed) sayMd(`- ${f}`);
  }
  if (thumbFailed.length > 0) {
    sayMd("\n### ⚠️ থাম্বনেইল ব্যর্থ (ভিডিও ঠিক আছে)\n");
    for (const f of thumbFailed) sayMd(`- ${f.label}: ${f.reason}`);
  }
  if (failed.length > 0) {
    sayMd("\n### ❌ ব্যর্থ জব\n");
    for (const f of failed) sayMd(`- ${f.label}: ${f.reason}`);
    sayMd("\nআগে শেষ হওয়া ভিডিওগুলো `out/` এ আছে।");
    return 1;
  }
  return 0;
}

let exitCode = 1;
try {
  exitCode = await main();
} catch (err) {
  // অপ্রত্যাশিত ভুল (যেমন বান্ডল/ব্রাউজার চালু হয়নি): পুরো stack দেখাই, exit 1
  sayMd(`\n## ❌ রেন্ডার ব্যর্থ\n\n\`\`\`\n${err?.stack ?? err}\n\`\`\``);
  exitCode = 1;
} finally {
  flushSummary();
}
process.exit(exitCode);
