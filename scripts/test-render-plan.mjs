// Part 14A: renderPlan.mjs-এর pure কেস। সাধারণ Node-এ চলে (ব্রাউজার/npm install ছাড়া):
//   node scripts/test-render-plan.mjs
// প্রতি কেসে ✅/❌ ছাপে; কোনো কেস ফেল করলে exit code 1।
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as RP from "./lib/renderPlan.mjs";

const {
  buildPlan,
  parseArgs,
  parseSeconds,
  checkInputs,
  formatDryRun,
  formatReport,
  cleanText,
  toBnDigits,
} = RP;

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    const result = fn();
    if (result !== true) throw new Error(`ফলাফল true নয়: ${JSON.stringify(result)}`);
    passed++;
    console.log(`✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`❌ ${name}\n   ${e instanceof Error ? e.message : String(e)}`);
  }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const base = (...extra) => ["--id", "0101", ...extra];
const errsOf = (argv) => buildPlan(argv).errors.join(" | ");

// ---------- ১. আর্গুমেন্টের সব রূপ ----------
check("`--key value` আকার", () => {
  const r = buildPlan(["--id", "0101", "--theme", "navy", "--quality", "4k"]);
  return r.ok && r.plan.jobs[0].inputProps.theme === "navy" && r.plan.jobs[0].scale === 2;
});

check("`--key=value` আকার", () => {
  const r = buildPlan(["--id=0101", "--theme=navy", "--quality=4k", "--orientation=landscape"]);
  return r.ok && r.plan.jobs.length === 1 && r.plan.jobs[0].compositionId === "HadisLandscape";
});

check("`=` এর পরের মানে `=` থাকলেও কাটে না (book=\"ক=খ\")", () => {
  const r = parseArgs(["--book=ক=খ"]);
  return r.raw.book === "ক=খ" && r.errors.length === 0;
});

check("workflow-এর ৮টা আর্গুমেন্ট, খালি intro/outro সহ, ঠিকঠাক চলে", () => {
  const r = buildPlan([
    "--id", "0101", "--book", "সহীহ বুখারী", "--number", "১২৩", "--theme", "emerald",
    "--orientation", "both", "--quality", "both", "--intro", "", "--outro", "",
  ]);
  const p = r.plan.jobs[0].inputProps;
  return r.ok && r.plan.jobs.length === 4 && p.introSeconds === 3 && p.outroSeconds === 4;
});

check("`--intro` খালি আর পরেই আরেকটা `--outro` — খালি মান ধরে", () => {
  const r = buildPlan(["--id", "0101", "--intro", "--outro", "6"]);
  const p = r.plan.jobs[0].inputProps;
  return r.ok && p.introSeconds === 3 && p.outroSeconds === 6;
});

check("`--dry-run` ফ্ল্যাগ (মান ছাড়া ও `=false`)", () => {
  return (
    buildPlan(base("--dry-run")).plan.dryRun === true &&
    buildPlan(base("--dry-run=false")).plan.dryRun === false &&
    buildPlan(base()).plan.dryRun === false
  );
});

check("অজানা আর্গুমেন্ট → বাংলা ভুল, নামসহ", () => {
  const r = buildPlan(base("--foo", "1"));
  return !r.ok && r.errors.some((e) => e.includes("--foo") && e.includes("অজানা"));
});

check("`--` ছাড়া এলোমেলো মান → ভুল", () => {
  const r = buildPlan(["0101", "--id", "0101"]);
  return !r.ok && r.errors.some((e) => e.includes("0101") && e.includes("--নাম মান"));
});

check("একই আর্গুমেন্ট দুবার → সতর্কতা, শেষেরটা জেতে", () => {
  const r = buildPlan(["--id", "1", "--id", "2"]);
  return r.ok && r.plan.id === "2" && r.warnings.some((w) => w.includes("--id"));
});

// ---------- ২. intro / outro ----------
const secs = (v) => parseSeconds(v, "intro", 3);

check("intro/outro: খালি → ডিফল্ট (3 / 4)", () => {
  const r = buildPlan(base("--intro", "", "--outro", ""));
  const p = r.plan.jobs[0].inputProps;
  return p.introSeconds === 3 && p.outroSeconds === 4 && secs("").value === 3;
});

check("intro/outro: বাংলা অঙ্ক ও আরবি-ইন্ডিক অঙ্ক", () => {
  return secs("৫").value === 5 && secs("١٢").value === 12 && secs("۷").value === 7;
});

check("intro/outro: দশমিক 2.5 / ২.৫ / 2,5", () => {
  return secs("2.5").value === 2.5 && secs("২.৫").value === 2.5 && secs("2,5").value === 2.5;
});

check("intro/outro: সীমা 0 ও 15 চলে", () => secs("0").value === 0 && secs("15").value === 15);

check("intro/outro: 16 → ভুল (০–১৫ বলে)", () => {
  const e = secs("16").error ?? "";
  return e.includes("--intro") && e.includes("15");
});

check("intro/outro: -1 → ভুল", () => typeof secs("-1").error === "string");

check("intro/outro: abc → ভুল, নাম ও ডিফল্ট বলে", () => {
  const e = secs("abc").error ?? "";
  return e.includes("--intro") && e.includes("abc") && e.includes("ডিফল্ট");
});

check("intro/outro: 1.2.3, '.5', '5.' → ভুল", () => {
  return ["1.2.3", ".5", "5."].every((v) => typeof secs(v).error === "string");
});

check("outro-র ভুলে আর্গুমেন্টের নাম `--outro` আসে", () => {
  return errsOf(base("--outro", "abc")).includes("--outro");
});

// ---------- ৩. id / theme / orientation / quality ----------
check("id: `../x` ও স্পেস ও `/` ও `.` আটকায়", () => {
  return ["../x", "a b", "a/b", "a.b", "ক"].every((id) => {
    const r = buildPlan(["--id", id]);
    return !r.ok && r.errors.some((e) => e.includes("--id"));
  });
});

check("id: খালি বা না-দেওয়া → ভুল", () => {
  return !buildPlan(["--id", ""]).ok && !buildPlan([]).ok;
});

check("id: `0101`, `a_b-C9` চলে", () => buildPlan(["--id", "a_b-C9"]).ok && buildPlan(["--id", "0101"]).ok);

check("খারাপ theme/orientation/quality → ভুল, চলার তালিকা সহ", () => {
  const e = errsOf(base("--theme", "zz", "--orientation", "wide", "--quality", "8k"));
  return (
    e.includes("emerald, navy, greenDayNight") &&
    e.includes("portrait, landscape, both") &&
    e.includes("hd, 4k, both")
  );
});

check("একসাথে কয়েকটা ভুল থাকলে সবকটা একবারে আসে", () => {
  const r = buildPlan(["--id", "../x", "--theme", "zz", "--intro", "abc"]);
  return r.errors.length === 3;
});

check("theme/orientation/quality খালি → ডিফল্ট emerald/portrait/hd", () => {
  const r = buildPlan(base("--theme", "", "--orientation", "", "--quality", ""));
  const j = r.plan.jobs;
  return r.ok && j.length === 1 && j[0].inputProps.theme === "emerald" && j[0].label === "9x16 HD";
});

check("theme বড়-ছোট হাতের অক্ষর আলাদা ধরে (Navy ≠ navy)", () => !buildPlan(base("--theme", "Navy")).ok);

// ---------- ৪. book / number ----------
check("number: ইংরেজি অঙ্ক → বাংলা; মিশ্র \"১২3/ক\" ঠিক থাকে", () => {
  const p = buildPlan(base("--number", " 45 ", "--book", "x")).plan.jobs[0].inputProps;
  const m = buildPlan(base("--number", "১২3/ক", "--book", "x")).plan.jobs[0].inputProps;
  return p.hadisNumber === "৪৫" && m.hadisNumber === "১২৩/ক";
});

check("book: অদৃশ্য অক্ষর মোছে, স্পেস এক করে; ZWJ রাখে", () => {
  const p = buildPlan(base("--book", "  সহীহ\u200B   বুখারী\u200E ")).plan.jobs[0].inputProps;
  const z = cleanText("র\u200Dযা");
  return p.hadisBookname === "সহীহ বুখারী" && z === "র\u200Dযা";
});

check("book ও number দুটোই খালি → শুধু সতর্কতা (ভুল নয়)", () => {
  const r = buildPlan(base());
  return r.ok && r.warnings.some((w) => w.includes("--book") && w.includes("--number"));
});

check("শুধু একটা খালি হলে সতর্কতা নেই", () => {
  return buildPlan(base("--book", "বুখারী")).warnings.length === 0;
});

check("toBnDigits: ইংরেজি/আরবি-ইন্ডিক/ফার্সি → বাংলা", () => toBnDigits("0a9٣۴") === "০a৯৩৪");

// ---------- ৫. জব তালিকা ----------
const names = (argv) => buildPlan(argv).plan.jobs.map((j) => j.outputFile);

check("জব সংখ্যা: 1 / 2 / 4", () => {
  const n = (...a) => buildPlan(base(...a)).plan.jobs.length;
  return (
    n("--orientation", "portrait", "--quality", "hd") === 1 &&
    n("--orientation", "both", "--quality", "hd") === 2 &&
    n("--orientation", "portrait", "--quality", "both") === 2 &&
    n("--orientation", "both", "--quality", "both") === 4
  );
});

check("জবের ক্রম: portrait আগে, HD আগে", () => {
  const j = buildPlan(base("--orientation", "both", "--quality", "both")).plan.jobs;
  return same(
    j.map((x) => x.label),
    ["9x16 HD", "9x16 4K", "16x9 HD", "16x9 4K"],
  ) && same(j.map((x) => x.index), [1, 2, 3, 4]);
});

check("চার সাইজের আউটপুট নাম ঠিক (out/hadis<id>_…mp4)", () => {
  return same(names(base("--orientation", "both", "--quality", "both")), [
    join("out", "hadis0101_9x16_HD.mp4"),
    join("out", "hadis0101_9x16_4K.mp4"),
    join("out", "hadis0101_16x9_HD.mp4"),
    join("out", "hadis0101_16x9_4K.mp4"),
  ]);
});

check("--out-dir বদলালে নামের ফোল্ডার বদলায়, নাম একই থাকে", () => {
  return names(base("--out-dir", "tmp/videos"))[0] === join("tmp/videos", "hadis0101_9x16_HD.mp4");
});

check("props-এর orientation জবের কম্পোজিশন আইডির সাথে মেলে", () => {
  const j = buildPlan(base("--orientation", "both", "--quality", "both")).plan.jobs;
  return j.every(
    (x) =>
      x.inputProps.orientation === x.orientation &&
      x.compositionId === (x.orientation === "portrait" ? "HadisPortrait" : "HadisLandscape"),
  );
});

check("inputProps-এ ঠিক ৭টা কী", () => {
  const keys = Object.keys(buildPlan(base()).plan.jobs[0].inputProps).sort();
  return same(keys, [
    "hadisBookname", "hadisId", "hadisNumber", "introSeconds", "orientation", "outroSeconds", "theme",
  ]);
});

check("scale: HD = 1, 4K = 2; সাইজ বেস × scale", () => {
  const j = buildPlan(base("--orientation", "both", "--quality", "both")).plan.jobs;
  const by = Object.fromEntries(j.map((x) => [x.label, x]));
  return (
    by["9x16 HD"].scale === 1 && by["9x16 HD"].width === 1080 && by["9x16 HD"].height === 1920 &&
    by["9x16 4K"].scale === 2 && by["9x16 4K"].width === 2160 && by["9x16 4K"].height === 3840 &&
    by["16x9 HD"].width === 1920 && by["16x9 HD"].height === 1080 &&
    by["16x9 4K"].width === 3840 && by["16x9 4K"].height === 2160
  );
});

check("concurrency: 4K কম, HD বেশি", () => {
  const j = buildPlan(base("--quality", "both")).plan.jobs;
  return j[0].concurrency === 4 && j[1].concurrency === 2 && j[1].concurrency < j[0].concurrency;
});

check("--concurrency / --crf সব জবে বসে", () => {
  const j = buildPlan(base("--quality", "both", "--concurrency", "3", "--crf", "23")).plan.jobs;
  return j.every((x) => x.concurrency === 3 && x.crf === 23);
});

check("ডিফল্ট crf 18", () => buildPlan(base()).plan.jobs[0].crf === 18);

check("clamp: concurrency 0→1, 99→8; crf 0→1, 99→51 (সতর্কতাসহ)", () => {
  const lo = buildPlan(base("--book", "x", "--concurrency", "0", "--crf", "0"));
  const hi = buildPlan(base("--book", "x", "--concurrency", "99", "--crf", "99"));
  return (
    lo.plan.jobs[0].concurrency === 1 && lo.plan.jobs[0].crf === 1 &&
    hi.plan.jobs[0].concurrency === 8 && hi.plan.jobs[0].crf === 51 &&
    hi.warnings.length === 2
  );
});

check("concurrency/crf: অসংখ্যা → ভুল (নাম সহ)", () => {
  const e = errsOf(base("--concurrency", "abc", "--crf", "1.5"));
  return e.includes("--concurrency") && e.includes("--crf");
});

check("--frames: 0-59 / ৫-১০ / একক 30; উল্টো ও অসংখ্যা → ভুল", () => {
  const f = (v) => buildPlan(base("--frames", v));
  return (
    same(f("0-59").plan.jobs[0].frameRange, [0, 59]) &&
    same(f("৫-১০").plan.jobs[0].frameRange, [5, 10]) &&
    same(f("30").plan.jobs[0].frameRange, [30, 30]) &&
    buildPlan(base()).plan.jobs[0].frameRange === null &&
    !f("59-0").ok && !f("abc").ok && !f("-5").ok
  );
});

// ---------- ৬. ইনপুট ফাইল (অস্থায়ী ফোল্ডারে) ----------
function makeRoot(spec) {
  const root = mkdtempSync(join(tmpdir(), "renderplan-"));
  for (const [rel, content] of Object.entries(spec)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}
const goodJson = JSON.stringify({ ok: true });
const fullSpec = (id) => ({
  [`public/hadis/hadis${id}.wav`]: "RIFF-data",
  [`public/hadis/hadis${id}_timestamp.json`]: goodJson,
  "src/logo.jpg": "jpg",
  "src/google-play-badge.png": "png",
  "public/svg/svg1.svg": "<svg/>",
  "public/svg/svg2.svg": "<svg/>",
  "public/sfx/whoosh.mp3": "mp3",
});

check("সব ফাইল আছে → ok, নোটে SVG/SFX সংখ্যা, কোনো সতর্কতা নেই", () => {
  const root = makeRoot(fullSpec("0101"));
  try {
    const r = checkInputs({ id: "0101" }, root);
    return (
      r.ok && r.errors.length === 0 && r.warnings.length === 0 &&
      r.notes.some((n) => n.includes("2টি svg")) && r.notes.some((n) => n.includes("1টি SFX"))
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

check("কিছুই নেই → চারটা ভুল (wav, json, logo, badge), প্রতিটায় ফাইলের পাথ", () => {
  const root = makeRoot({});
  try {
    const r = checkInputs({ id: "0101" }, root);
    const e = r.errors.join("\n");
    return (
      !r.ok && r.errors.length === 4 &&
      e.includes("public/hadis/hadis0101.wav") &&
      e.includes("public/hadis/hadis0101_timestamp.json") &&
      e.includes("src/logo.jpg") && e.includes("src/google-play-badge.png")
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

check("শূন্য বাইটের wav/json/ছবি → ভুল", () => {
  const spec = fullSpec("0101");
  spec["public/hadis/hadis0101.wav"] = "";
  spec["public/hadis/hadis0101_timestamp.json"] = "";
  spec["src/logo.jpg"] = "";
  const root = makeRoot(spec);
  try {
    const r = checkInputs({ id: "0101" }, root);
    return !r.ok && r.errors.length === 3 && r.errors.every((e) => e.includes("খালি"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

check("ভাঙা JSON → ভুলে ফাইলের নাম ও কারণ থাকে", () => {
  const spec = fullSpec("0101");
  spec["public/hadis/hadis0101_timestamp.json"] = "{ not json";
  const root = makeRoot(spec);
  try {
    const r = checkInputs({ id: "0101" }, root);
    return (
      !r.ok && r.errors.length === 1 &&
      r.errors[0].includes("hadis0101_timestamp.json") && r.errors[0].includes("বৈধ JSON নয়") &&
      r.errors[0].length > 80
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

check("অন্য id-র ফাইল থাকলে এই id-র জন্য ভুল (hadis0102 ≠ hadis0101)", () => {
  const root = makeRoot(fullSpec("0102"));
  try {
    return !checkInputs({ id: "0101" }, root).ok && checkInputs({ id: "0102" }, root).ok;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

check("SVG না থাকলে ও SFX খালি হলে শুধু সতর্কতা (থামায় না)", () => {
  const spec = fullSpec("0101");
  delete spec["public/svg/svg1.svg"];
  delete spec["public/svg/svg2.svg"];
  delete spec["public/sfx/whoosh.mp3"];
  spec["public/sfx/.gitkeep"] = "";
  const root = makeRoot(spec);
  try {
    const r = checkInputs({ id: "0101" }, root);
    return (
      r.ok && r.errors.length === 0 && r.warnings.length === 2 &&
      r.warnings.some((w) => w.includes("fallback")) && r.warnings.some((w) => w.includes("নীরব"))
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

check("svg ছাড়া অন্য ফাইল (readme.txt) SVG গোনায় ধরে না", () => {
  const spec = fullSpec("0101");
  spec["public/svg/readme.txt"] = "x";
  const root = makeRoot(spec);
  try {
    return checkInputs({ id: "0101" }, root).notes.some((n) => n.includes("2টি svg"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

check("রুট ফোল্ডার নিজেই নেই — throw না করে ভুল দেয়", () => {
  const r = checkInputs({ id: "0101" }, join(tmpdir(), "renderplan-does-not-exist-xyz"));
  return !r.ok && r.errors.length === 4;
});

// ---------- ৭. --dry-run ও রিপোর্ট ----------
check("`--dry-run`: buildPlan/formatDryRun কিছু লেখে না (ফোল্ডার তৈরি হয় না)", () => {
  const root = makeRoot({});
  const before = process.cwd();
  try {
    process.chdir(root);
    const r = buildPlan(["--id", "0101", "--dry-run", "--out-dir", "should-not-exist"]);
    formatDryRun(r.plan);
    checkInputs(r.plan, root);
    return r.plan.dryRun === true && !existsSync(join(root, "should-not-exist")) && !existsSync(join(root, "out"));
  } finally {
    process.chdir(before);
    rmSync(root, { recursive: true, force: true });
  }
});

check("dry-run টেবিলে সব জবের কম্পোজিশন, সাইজ, আউটপুট, concurrency, crf থাকে", () => {
  const plan = buildPlan(base("--orientation", "both", "--quality", "both", "--frames", "0-59")).plan;
  const t = formatDryRun(plan);
  return (
    t.includes("HadisPortrait") && t.includes("HadisLandscape") &&
    t.includes("3840x2160") && t.includes("hadis0101_16x9_4K.mp4") &&
    t.includes("concurrency: 2") && t.includes("crf: 18") && t.includes("0-59") &&
    t.includes("1. 9x16 HD") && t.includes("4. 16x9 4K")
  );
});

check("formatReport: ❌/⚠️/ℹ️ উপসর্গ ঠিক", () => {
  const t = formatReport({ errors: ["e"], warnings: ["w"], notes: ["n"] });
  return t === "❌ e\n⚠️ w\nℹ️ n" && formatReport({}) === "";
});

// ---------- ৮. constants.ts-এর সাথে মিল (টেক্সট হিসেবে পড়া) ----------
const constantsText = readFileSync(join(projectRoot, "src", "constants.ts"), "utf8");
const strList = (name) => {
  const m = new RegExp(`export const ${name} = \\[([^\\]]*)\\]`).exec(constantsText);
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null;
};
const num = (name) => {
  const m = new RegExp(`export const ${name} = (\\d+)`).exec(constantsText);
  return m ? Number(m[1]) : null;
};
const objText = (name) => {
  const m = new RegExp(`export const ${name} = \\{([^}]*)\\}`).exec(constantsText);
  return m ? m[1] : null;
};
const pairs = (name) => {
  const t = objText(name);
  return t ? Object.fromEntries([...t.matchAll(/"?([A-Za-z0-9]+)"?\s*:\s*("[^"]*"|\d+)/g)].map((x) => [x[1], x[2].replace(/"/g, "")])) : null;
};

check("কপি করা তালিকা constants.ts-এর সাথে এক: THEME_IDS / ORIENTATIONS / QUALITIES", () => {
  return (
    same(strList("THEME_IDS"), RP.THEME_IDS) &&
    same(strList("ORIENTATIONS"), RP.ORIENTATIONS) &&
    same(strList("QUALITIES"), RP.QUALITIES)
  );
});

check("কপি করা লেবেল ও scale constants.ts-এর সাথে এক", () => {
  const ol = pairs("ORIENTATION_LABEL");
  const ql = pairs("QUALITY_LABEL");
  const qs = pairs("QUALITY_SCALE");
  return (
    ol.portrait === RP.ORIENTATION_LABEL.portrait && ol.landscape === RP.ORIENTATION_LABEL.landscape &&
    ql.hd === RP.QUALITY_LABEL.hd && ql["4k"] === RP.QUALITY_LABEL["4k"] &&
    Number(qs.hd) === RP.QUALITY_SCALE.hd && Number(qs["4k"]) === RP.QUALITY_SCALE["4k"]
  );
});

check("কপি করা সেকেন্ড/সীমা constants.ts-এর সাথে এক", () => {
  return (
    num("DEFAULT_INTRO_SECONDS") === RP.DEFAULT_INTRO_SECONDS &&
    num("DEFAULT_OUTRO_SECONDS") === RP.DEFAULT_OUTRO_SECONDS &&
    num("MAX_INTRO_OUTRO_SECONDS") === RP.MAX_INTRO_OUTRO_SECONDS
  );
});

check("কপি করা BASE_SIZES ও ফোল্ডারের নাম constants.ts-এর সাথে এক", () => {
  const t = objText("BASE_SIZES") ?? "";
  const portrait = /portrait:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)/.exec(t);
  const landscape = /landscape:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)/.exec(constantsText);
  const dir = (n) => new RegExp(`export const ${n} = "([^"]+)"`).exec(constantsText)?.[1];
  return (
    portrait && landscape &&
    Number(portrait[1]) === RP.BASE_SIZES.portrait.width && Number(portrait[2]) === RP.BASE_SIZES.portrait.height &&
    Number(landscape[1]) === RP.BASE_SIZES.landscape.width && Number(landscape[2]) === RP.BASE_SIZES.landscape.height &&
    dir("HADIS_DIR") === RP.HADIS_DIR && dir("SVG_DIR") === RP.SVG_DIR && dir("SFX_DIR") === RP.SFX_DIR
  );
});

check("কম্পোজিশন আইডি Root.tsx-এ আছে (HadisPortrait / HadisLandscape)", () => {
  const root = readFileSync(join(projectRoot, "src", "Root.tsx"), "utf8");
  return root.includes(`"${RP.COMPOSITION_IDS.portrait}"`) && root.includes(`"${RP.COMPOSITION_IDS.landscape}"`);
});

check("ফাইল নামের প্যাটার্ন: out/*.mp4 (workflow-এর শর্ত) — সব নাম মেলে", () => {
  const all = names(base("--orientation", "both", "--quality", "both"));
  return all.every((n) => /^out[\\/]hadis0101_(9x16|16x9)_(HD|4K)\.mp4$/.test(n));
});

// ---------- ৯. নির্ভরযোগ্যতা ----------
check("একই ইনপুটে বারবার একই ফল (deterministic)", () => {
  const argv = base("--book", "বুখারী", "--number", "7", "--orientation", "both", "--quality", "both");
  return same(buildPlan(argv), buildPlan(argv)) && same(parseArgs(argv), parseArgs(argv));
});

check("buildPlan ইনপুট argv বদলায় না", () => {
  const argv = base("--theme", "navy");
  const copy = [...argv];
  buildPlan(argv);
  return same(argv, copy);
});

check("অদ্ভুত ইনপুটে কখনো throw করে না", () => {
  const weird = [undefined, null, 5, {}, [], "--id", "", "--", "---x", "--=", "--id=", "--book", "\u0000", "--frames", "9".repeat(400)];
  const inputs = [undefined, null, "str", 42, [], weird, [null], ["--"], ["--=x"], ["--id", undefined]];
  for (const input of inputs) {
    const r = buildPlan(input);
    if (typeof r.ok !== "boolean" || !Array.isArray(r.errors) || !Array.isArray(r.warnings)) return false;
  }
  for (const v of [undefined, null, 5, {}, "٣", "９", "\u200B"]) {
    const s = parseSeconds(v, "intro", 3);
    if (s.value === undefined && s.error === undefined) return false;
  }
  return true;
});

check("ভুল থাকলে plan = null, ঠিক থাকলে errors খালি", () => {
  const bad = buildPlan(["--id", "../x"]);
  const good = buildPlan(base());
  return bad.plan === null && !bad.ok && good.plan !== null && good.ok && good.errors.length === 0;
});

check("প্রতিটা ভুলের বার্তা খালি নয়, আর বাংলা অক্ষর আছে", () => {
  const e = buildPlan(["--id", "../x", "--theme", "zz", "--quality", "q", "--orientation", "o", "--intro", "a", "--outro", "-1", "--frames", "x", "--crf", "z", "--foo", "1"]).errors;
  return e.length >= 8 && e.every((m) => m.length > 10 && /[\u0980-\u09FF]/.test(m));
});

// ---------- ফলাফল ----------
console.log("");
console.log(`মোট ${passed + failed}টি কেস: ${passed}টি পাশ, ${failed}টি ফেল`);
if (failed > 0) {
  console.log("❌ কিছু কেস ফেল করেছে");
  process.exit(1);
}
console.log("✅ সব কেস পাশ");
