import { createSvgLoader } from "../lib/svgLoad";
import {
  createSvgInventoryLoader,
  inventoryFromFileList,
  namesFromFileList,
  probeSvgFilesDetailed,
  scanStaticFiles,
  type StaticScan,
} from "../lib/svgInventory";

/**
 * Part 9I-5 (dev টুল): svgInventory-র পরীক্ষার কেস — শুদ্ধ তালিকা (React নেই; তবে `svgInventory.ts` নিজে react/remotion import করে,
 * তাই প্লেইন Node-এ চালাতে `remotion` ও `react` নকল/alias করে বান্ডল করতে হয়)।
 * কেসগুলো নকল `scan`/`probe`/নকল `fetch`-সার্ভার দিয়ে চলে — আসল `public/svg/` ফোল্ডার ছোঁয় না — তাই খালি ফোল্ডার, গ্যাপ,
 * HTML-ফেরত, ৬০-সীমা ইত্যাদি এমন অবস্থাও যাচাই হয় যা আসল ফোল্ডারে বানানো যায় না।
 * `runInventoryCases()` কখনো reject করে না; কোনো কেস ভাঙলে সেটা ❌ (কারণসহ) হয়ে যায়।
 */

export type InventoryCaseOutcome = {
  id: string;
  /** "৯I-১" … "৯I-৪" — কোন ধাপের নিয়ম */
  step: string;
  title: string;
  input: string;
  expected: string;
  actual: string;
  ok: boolean;
};

type CaseResult = { expected: string; actual: string; ok: boolean };
type CaseDef = { id: string; step: string; title: string; input: string; run: () => CaseResult | Promise<CaseResult> };

const fmt = (names: readonly string[], count: number, source?: string | null): string =>
  `[${names.join(", ")}] · count ${count}${source ? ` · ${source}` : ""}`;

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

const unusable = (): StaticScan => ({ state: "unusable", reason: "Studio নয়" });

/** নকল সার্ভার-লোডার: `files`-এ থাকলে SVG, `htmlFor`-এ থাকলে 200 + HTML, নইলে 404 */
function serverLoader(files: Iterable<string>, htmlFor: Iterable<string> = []) {
  const have = new Set(files);
  const html = new Set(htmlFor);
  return createSvgLoader({
    warn: () => undefined,
    urlFor: (name) => `/svg/${name}.svg`,
    fetcher: async (url) => {
      const name = url.slice("/svg/".length, -".svg".length);
      if (html.has(name)) return new Response("<!doctype html><html></html>", { status: 200, headers: { "content-type": "text/html" } });
      if (have.has(name)) return new Response("<svg viewBox='0 0 10 10'></svg>", { status: 200, headers: { "content-type": "image/svg+xml" } });
      return new Response("not found", { status: 404, headers: { "content-type": "text/plain" } });
    },
  });
}

const range = (n: number) => Array.from({ length: n }, (_, i) => `svg${i + 1}`);

const CASES: CaseDef[] = [
  // ---- 9I-1: নামের নিয়ম ----
  {
    id: "names-gaps",
    step: "9I-1",
    title: "গ্যাপ গোনা হয় (svg1, svg3)",
    input: '["svg1.svg", "svg3.svg"]',
    run: () => {
      const n = namesFromFileList(["svg1.svg", "svg3.svg"]);
      return { expected: fmt(["svg1", "svg3"], 2), actual: fmt(n, n.length), ok: same(n, ["svg1", "svg3"]) };
    },
  },
  {
    id: "names-paths",
    step: "9I-1",
    title: "পাথ-সহ নাম (svg/svg1.svg, svg/svg2.svg)",
    input: '["svg/svg1.svg", "svg/svg2.svg"] · source static',
    run: () => {
      const i = inventoryFromFileList(["svg/svg1.svg", "svg/svg2.svg"], "static");
      return { expected: fmt(["svg1", "svg2"], 2, "static"), actual: fmt(i.names, i.count, i.source), ok: same(i.names, ["svg1", "svg2"]) && i.count === 2 && i.source === "static" };
    },
  },
  {
    id: "names-empty",
    step: "9I-1",
    title: "খালি তালিকা → count 0, ক্র্যাশ নয়",
    input: "[] · null · undefined · \"x\"",
    run: () => {
      const i = inventoryFromFileList([], "probe");
      const bad = [namesFromFileList(null), namesFromFileList(undefined), namesFromFileList("x")];
      const ok = i.count === 0 && i.names.length === 0 && bad.every((b) => b.length === 0);
      return { expected: fmt([], 0, "probe"), actual: fmt(i.names, i.count, i.source), ok };
    },
  },
  {
    id: "names-junk",
    step: "9I-1",
    title: "SVG-নয় ও অবৈধ নাম বাদ",
    input: ".gitkeep, a.png, readme.md, svg1.svg.bak, a b.svg, SVG1.SVG, null, 5, svg2.svg",
    run: () => {
      const n = namesFromFileList([".gitkeep", "a.png", "readme.md", "svg1.svg.bak", "a b.svg", "SVG1.SVG", null, 5, "svg2.svg"]);
      return { expected: fmt(["svg2"], 1), actual: fmt(n, n.length), ok: same(n, ["svg2"]) };
    },
  },
  {
    id: "names-order",
    step: "9I-1",
    title: "সংখ্যা ধরে সাজানো (svg2 < svg10)",
    input: "svg10, svg2, svg1, svg9",
    run: () => {
      const n = namesFromFileList(["svg10.svg", "svg2.svg", "svg1.svg", "svg9.svg"]);
      const want = ["svg1", "svg2", "svg9", "svg10"];
      return { expected: fmt(want, 4), actual: fmt(n, n.length), ok: same(n, want) };
    },
  },
  {
    id: "names-dedupe",
    step: "9I-1",
    title: "ডুপ্লিকেট বাদ",
    input: "svg/svg1.svg, svg1.svg, other/svg1.svg",
    run: () => {
      const n = namesFromFileList(["svg/svg1.svg", "svg1.svg", "other/svg1.svg"]);
      return { expected: fmt(["svg1"], 1), actual: fmt(n, n.length), ok: same(n, ["svg1"]) };
    },
  },
  // ---- 9I-2: প্রথম উপায় ----
  {
    id: "static-folder",
    step: "9I-2",
    title: "শুধু svg/ ফোল্ডারের সরাসরি ফাইল",
    input: "svg/svg1.svg, svg/.gitkeep, hadis/h.wav, other/svg5.svg, svg/sub/svg9.svg, sfx/.gitkeep",
    run: () => {
      const s = scanStaticFiles(() => ["svg/svg1.svg", "svg/.gitkeep", "hadis/h.wav", "other/svg5.svg", "svg/sub/svg9.svg", "sfx/.gitkeep"].map((name) => ({ name })));
      const ok = s.state === "ok" && same(s.inventory.names, ["svg1"]) && s.inventory.source === "static";
      return { expected: "ok · [svg1] · static", actual: s.state === "ok" ? `ok · ${fmt(s.inventory.names, s.inventory.count, s.inventory.source)}` : `unusable (${s.reason})`, ok };
    },
  },
  {
    id: "static-unusable",
    step: "9I-2",
    title: "Studio-ছাড়া (undefined) বা throw → unusable, শান্ত",
    input: "getStaticFiles() → undefined · throw",
    run: () => {
      const a = scanStaticFiles(() => undefined);
      const b = scanStaticFiles(() => {
        throw new Error("boom");
      });
      return { expected: "unusable · unusable", actual: `${a.state} · ${b.state}`, ok: a.state === "unusable" && b.state === "unusable" };
    },
  },
  // ---- 9I-3 + 9I-4: প্রোব, জোড়া, ক্যাশ ----
  {
    id: "join-static",
    step: "9I-4",
    title: "প্রথম উপায় চললে সেটাই, প্রোব নেই (গ্যাপ-সহ)",
    input: "scan ok: svg/svg1.svg, svg/svg3.svg",
    run: async () => {
      const l = createSvgInventoryLoader({
        scan: () => scanStaticFiles(() => ["svg/svg1.svg", "svg/svg3.svg"]),
        probe: async () => {
          throw new Error("প্রোব ডাকা উচিত নয়");
        },
      });
      const r = await l.load();
      const ok = same(r.names, ["svg1", "svg3"]) && r.source === "static" && l.stats().probes === 0;
      return { expected: `${fmt(["svg1", "svg3"], 2, "static")} · probes 0`, actual: `${fmt(r.names, r.count, r.source)} · probes ${l.stats().probes}`, ok };
    },
  },
  {
    id: "join-static-empty",
    step: "9I-4",
    title: "প্রথম উপায় ok কিন্তু খালি → count 0, প্রোব নেই",
    input: "scan ok: (কোনো ফাইল নেই)",
    run: async () => {
      let probed = 0;
      const l = createSvgInventoryLoader({
        scan: () => scanStaticFiles(() => []),
        probe: async () => {
          probed += 1;
          return probeSvgFilesDetailed({ loader: serverLoader(["svg1"]) });
        },
      });
      const r = await l.load();
      return { expected: `${fmt([], 0, "static")} · probes 0`, actual: `${fmt(r.names, r.count, r.source)} · probes ${probed}`, ok: r.count === 0 && r.source === "static" && probed === 0 };
    },
  },
  {
    id: "probe-sample",
    step: "9I-3",
    title: "প্রোব: svg1, svg2 পায়, svg3-তে থামে",
    input: "scan unusable · সার্ভারে svg1, svg2",
    run: async () => {
      const l = createSvgInventoryLoader({ scan: unusable, probe: () => probeSvgFilesDetailed({ loader: serverLoader(["svg1", "svg2"]) }) });
      const r = await l.load();
      const d = l.details();
      const ok = same(r.names, ["svg1", "svg2"]) && r.source === "probe" && d.stoppedAt === "svg3" && d.probes === 3 && d.staticReason === "Studio নয়";
      return { expected: `${fmt(["svg1", "svg2"], 2, "probe")} · থামল svg3, 3 probe`, actual: `${fmt(r.names, r.count, r.source)} · থামল ${d.stoppedAt}, ${d.probes} probe`, ok };
    },
  },
  {
    id: "probe-empty",
    step: "9I-4",
    title: "খালি ফোল্ডার → count 0, ক্র্যাশ নয়",
    input: "scan unusable · সার্ভারে কোনো SVG নেই",
    run: async () => {
      const l = createSvgInventoryLoader({ scan: unusable, probe: () => probeSvgFilesDetailed({ loader: serverLoader([]) }) });
      const r = await l.load();
      const d = l.details();
      return { expected: `${fmt([], 0, "probe")} · থামল svg1`, actual: `${fmt(r.names, r.count, r.source)} · থামল ${d.stoppedAt}`, ok: r.count === 0 && d.stoppedAt === "svg1" };
    },
  },
  {
    id: "probe-html",
    step: "9I-3",
    title: "HTML-ফেরত (200) মিস গণ্য; আগের দুটো থাকে",
    input: "সার্ভারে svg1, svg2; svg3 → 200 + HTML",
    run: async () => {
      const l = createSvgInventoryLoader({ scan: unusable, probe: () => probeSvgFilesDetailed({ loader: serverLoader(["svg1", "svg2"], ["svg3"]) }) });
      const r = await l.load();
      return { expected: `${fmt(["svg1", "svg2"], 2, "probe")} · থামল svg3`, actual: `${fmt(r.names, r.count, r.source)} · থামল ${l.details().stoppedAt}`, ok: same(r.names, ["svg1", "svg2"]) && l.details().stoppedAt === "svg3" };
    },
  },
  {
    id: "probe-gap-limit",
    step: "9I-3",
    title: "প্রোবের জানা সীমা: গ্যাপে থামে (svg1, svg3 → শুধু svg1)",
    input: "scan unusable · সার্ভারে svg1, svg3",
    run: async () => {
      const l = createSvgInventoryLoader({ scan: unusable, probe: () => probeSvgFilesDetailed({ loader: serverLoader(["svg1", "svg3"]) }) });
      const r = await l.load();
      return { expected: `${fmt(["svg1"], 1, "probe")} · থামল svg2`, actual: `${fmt(r.names, r.count, r.source)} · থামল ${l.details().stoppedAt}`, ok: same(r.names, ["svg1"]) && l.details().stoppedAt === "svg2" };
    },
  },
  {
    id: "probe-cap-60",
    step: "9I-3",
    title: "সর্বোচ্চ ৬০ প্রোব (১০০ ফাইল থাকলেও)",
    input: "scan unusable · সার্ভারে svg1 … svg100",
    run: async () => {
      const l = createSvgInventoryLoader({ scan: unusable, probe: () => probeSvgFilesDetailed({ loader: serverLoader(range(100)) }) });
      const r = await l.load();
      const d = l.details();
      const ok = r.count === 60 && r.names[0] === "svg1" && r.names[59] === "svg60" && d.probes === 60 && d.stoppedAt === null;
      return { expected: "count 60 (svg1 … svg60) · 60 probe · থামেনি (সীমা)", actual: `count ${r.count} (${r.names[0]} … ${r.names[r.names.length - 1]}) · ${d.probes} probe · ${d.stoppedAt === null ? "থামেনি (সীমা)" : `থামল ${d.stoppedAt}`}`, ok };
    },
  },
  {
    id: "cache-once",
    step: "9I-4",
    title: "ক্যাশ: একসঙ্গে ৩ + পরে ১ ডাক → প্রোব ১ বার, একই ফল",
    input: "load() ×3 একসঙ্গে, তারপর ×1 · scan unusable",
    run: async () => {
      let probes = 0;
      const l = createSvgInventoryLoader({
        scan: unusable,
        probe: () => {
          probes += 1;
          return probeSvgFilesDetailed({ loader: serverLoader(["svg1", "svg2"]) });
        },
      });
      const [a, b, c] = await Promise.all([l.load(), l.load(), l.load()]);
      const d = await l.load();
      const ok = probes === 1 && a === b && b === c && c === d && l.peek() === a && l.stats().scans === 1;
      return { expected: "প্রোব 1 · একই অবজেক্ট · প্রথম-উপায় ডাক 1", actual: `প্রোব ${probes} · ${a === d ? "একই অবজেক্ট" : "আলাদা অবজেক্ট"} · প্রথম-উপায় ডাক ${l.stats().scans}`, ok };
    },
  },
  {
    id: "probe-throws",
    step: "9I-4",
    title: "প্রোব throw করলেও reject নয় → count 0",
    input: "scan unusable · probe() throw করে",
    run: async () => {
      const l = createSvgInventoryLoader({
        scan: unusable,
        probe: async () => {
          throw new Error("boom");
        },
      });
      const r = await l.load();
      const ok = r.count === 0 && (l.details().probeReason ?? "").includes("boom");
      return { expected: `${fmt([], 0, "probe")} · কারণে "boom"`, actual: `${fmt(r.names, r.count, r.source)} · কারণ: ${l.details().probeReason ?? "—"}`, ok };
    },
  },
  {
    id: "studio-fresh",
    step: "9I-4",
    title: "Studio-র তালিকা ক্যাশ হয় না: ফাইল যোগ/মোছা ধরা পড়ে",
    input: "scan: svg1 → svg1+svg2 → (খালি)",
    run: () => {
      let files = ["svg/svg1.svg"];
      const l = createSvgInventoryLoader({ scan: () => scanStaticFiles(() => files), probe: () => probeSvgFilesDetailed({ loader: serverLoader([]) }) });
      const a = l.peek();
      const a2 = l.peek();
      files = ["svg/svg1.svg", "svg/svg2.svg"];
      const b = l.peek();
      files = [];
      const c = l.peek();
      const ok = a !== null && a === a2 && b?.count === 2 && c?.count === 0 && l.stats().probes === 0;
      return { expected: "1 (একই অবজেক্ট) → 2 → 0 · প্রোব 0", actual: `${a?.count ?? "—"} (${a === a2 ? "একই অবজেক্ট" : "আলাদা"}) → ${b?.count ?? "—"} → ${c?.count ?? "—"} · প্রোব ${l.stats().probes}`, ok };
    },
  },
];

export const INVENTORY_CASE_COUNT = CASES.length;

/** সব কেস চালায় (কখনো reject করে না); ভাঙা কেস ❌ + কারণ */
export async function runInventoryCases(): Promise<InventoryCaseOutcome[]> {
  const out: InventoryCaseOutcome[] = [];
  for (const c of CASES) {
    try {
      const r = await c.run();
      out.push({ id: c.id, step: c.step, title: c.title, input: c.input, ...r });
    } catch (err) {
      out.push({ id: c.id, step: c.step, title: c.title, input: c.input, expected: "—", actual: `এরর: ${err instanceof Error ? err.message : String(err)}`, ok: false });
    }
  }
  return out;
}
