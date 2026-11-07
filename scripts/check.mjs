// Part 2/5: অটো-যাচাই স্ক্রিপ্ট (মোবাইল ওয়ার্কফ্লোর জন্য, GitHub Actions থেকে চলে)।
// কাজ: বান্ডল → সব কম্পোজিশনের তালিকা → প্রতিটার একটা করে ছবি (PNG) → out/ ফোল্ডারে।
// কোনো কম্পোজিশন ভাঙা থাকলে এখানেই ধরা পড়বে। পরের Part-এ এটা নিজে নিজে নতুন কম্পোজিশনও ধরবে।
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  getCompositions,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const outDir = path.resolve("out");
mkdirSync(outDir, { recursive: true });

const summary = [];
const log = (line) => {
  console.log(line);
  summary.push(line);
};

try {
  console.log("▶ ব্রাউজার যাচাই...");
  await ensureBrowser();

  console.log("▶ বান্ডল তৈরি হচ্ছে...");
  const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });

  const comps = await getCompositions(serveUrl);
  log(`## ✅ বান্ডল সফল — ${comps.length}টা কম্পোজিশন পাওয়া গেছে\n`);
  log("| ID | সাইজ | FPS | ফ্রেম | সময় |");
  log("|---|---|---|---|---|");

  const skipped = [];
  for (const c of comps) {
    let composition;
    try {
      composition = await selectComposition({ serveUrl, id: c.id });
    } catch (err) {
      // Part 5: ডেটা-ফাইল (wav/json) না থাকলে ব্যর্থ নয়, ⚠️ হিসেবে দেখানো হয়।
      // অন্য যেকোনো এরর (কোডের ভুল) আগের মতোই ব্যর্থ করে।
      const msg = String(err?.message ?? err);
      if (msg.includes("[HADIS_DATA]")) {
        skipped.push(`- ⚠️ \`${c.id}\` বাদ: ${msg.split("[HADIS_DATA]").pop().trim()}`);
        continue;
      }
      throw err;
    }
    const frame = Math.min(45, Math.max(0, composition.durationInFrames - 1));
    const output = path.join(outDir, `check-${c.id}.png`);
    await renderStill({ composition, serveUrl, output, frame });
    const secs = (composition.durationInFrames / composition.fps).toFixed(1);
    log(
      `| ${c.id} | ${composition.width}×${composition.height} | ${composition.fps} | ${composition.durationInFrames} | ${secs}s |`,
    );
  }
  if (skipped.length) log("\n### ⚠️ ডেটা-ফাইলের অভাবে বাদ পড়া কম্পোজিশন\n\n" + skipped.join("\n"));
  log("\nছবিগুলো Artifacts-এ `check-images` নামে আছে।");
} catch (err) {
  log(`## ❌ যাচাই ব্যর্থ\n\n\`\`\`\n${err?.stack ?? err}\n\`\`\``);
  process.exitCode = 1;
} finally {
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join("\n") + "\n");
  }
}
