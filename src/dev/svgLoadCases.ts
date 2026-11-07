import {
  classifySvgResponse,
  createSvgLoader,
  isValidSvgName,
  type SvgFetcher,
} from "../lib/svgLoad";

/**
 * Part 9E (dev): svgLoad-এর পরীক্ষার কেস — React ছাড়া, তাই সাধারণ Node-এও চালানো যায়;
 * `AnimatedSvgPreview` শুধু ফলাফল আঁকে। প্রতিটা কেস নিজের আলাদা লোডার/নকল সার্ভার ব্যবহার করে
 * (শুধু `cache` কেসটা আসল `fetch` দিয়ে আসল `public/svg/svg1.svg` আনে)।
 */

export type LoadCaseOutcome = { id: string; title: string; ok: boolean; detail: string };

const svgOk = (extra = "") =>
  `<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">${extra}<circle cx="500" cy="500" r="200" fill="#f5d77a"/></svg>`;

const htmlPage = "<!DOCTYPE html><html><head><title>Not found</title></head><body>index</body></html>";

/** নকল সার্ভার: প্রতিবার `make(callNumber)` যা বানায় তাই ফেরত দেয় (callNumber ১ থেকে) */
function stubFetcher(make: (n: number, signal?: AbortSignal) => Promise<Response> | Response): {
  fetcher: SvgFetcher;
  calls: () => number;
} {
  let n = 0;
  return {
    fetcher: async (_url, init) => make(++n, init?.signal),
    calls: () => n,
  };
}

const respond = (body: string, type: string | null, status = 200) =>
  new Response(body, { status, headers: type === null ? {} : { "content-type": type } });

const fakeUrl = (name: string) => `https://example.invalid/${name}.svg`;

type CaseFn = () => Promise<{ ok: boolean; detail: string }>;

const CASES: { id: string; title: string; run: CaseFn }[] = [
  {
    id: "classify",
    title: "উত্তর যাচাই (শুদ্ধ ফাংশন): ভালো SVG ready; ৪০৪, HTML, ফাঁকা, <svg>-হীন → missing",
    run: async () => {
      const t = (info: Parameters<typeof classifySvgResponse>[0]) => classifySvgResponse(info).state;
      const rows: [string, boolean][] = [
        ["ok svg", t({ ok: true, status: 200, contentType: "image/svg+xml", text: svgOk() }) === "ready"],
        ["ok, type নেই", t({ ok: true, status: 200, contentType: "", text: svgOk() }) === "ready"],
        ["BOM+svg", t({ ok: true, status: 200, contentType: "", text: "﻿" + svgOk() }) === "ready"],
        ["404", t({ ok: false, status: 404, contentType: "", text: "" }) === "missing"],
        ["text/html", t({ ok: true, status: 200, contentType: "text/html; charset=utf-8", text: svgOk() }) === "missing"],
        ["HTML বডি", t({ ok: true, status: 200, contentType: "image/svg+xml", text: htmlPage }) === "missing"],
        ["ফাঁকা", t({ ok: true, status: 200, contentType: "", text: "  \n" }) === "missing"],
        ["<svg>-হীন", t({ ok: true, status: 200, contentType: "", text: "hello world" }) === "missing"],
        ["<svgx> নয়", t({ ok: true, status: 200, contentType: "", text: "<svgx></svgx>" }) === "missing"],
      ];
      const bad = rows.filter(([, ok]) => !ok).map(([n]) => n);
      const bom = classifySvgResponse({ ok: true, status: 200, contentType: "", text: "﻿" + svgOk() });
      const bomOk = bom.state === "ready" && bom.text.startsWith("<svg");
      return {
        ok: bad.length === 0 && bomOk,
        detail: bad.length === 0 && bomOk ? `${rows.length}/${rows.length} ঠিক, BOM ছাঁটা` : `ভুল: ${bad.join(", ")}${bomOk ? "" : " (BOM থেকে গেছে)"}`,
      };
    },
  },
  {
    id: "html",
    title: "HTML ফেরত (Studio-র dev সার্ভার): missing + কারণে HTML, ক্র্যাশ নয়",
    run: async () => {
      const warnings: string[] = [];
      const s = stubFetcher(() => respond(htmlPage, "text/html; charset=utf-8"));
      const loader = createSvgLoader({ fetcher: s.fetcher, urlFor: fakeUrl, warn: (m) => warnings.push(m) });
      const r = await loader.load("svg77");
      const r2 = await loader.load("svg77");
      const ok =
        r.state === "missing" && r.reason.includes("HTML") && warnings.length === 1 && s.calls() === 2 && r2.state === "missing";
      return {
        ok,
        detail: `${r.state}${r.reason ? ` — ${r.reason}` : ""}; ওয়ার্নিং ${warnings.length}, ফেচ ${s.calls()} (ব্যর্থতা ক্যাশ হয়নি)`,
      };
    },
  },
  {
    id: "html-body",
    title: "type ঠিক (image/svg+xml) কিন্তু বডি HTML → missing",
    run: async () => {
      const s = stubFetcher(() => respond(htmlPage, "image/svg+xml"));
      const loader = createSvgLoader({ fetcher: s.fetcher, urlFor: fakeUrl, warn: () => undefined });
      const r = await loader.load("svg78");
      return { ok: r.state === "missing" && r.reason.includes("HTML"), detail: `${r.state}${r.reason ? ` — ${r.reason}` : ""}` };
    },
  },
  {
    id: "404",
    title: "ফাইল নেই (৪০৪) → missing, একবারই ওয়ার্নিং (তিনবার চাইলেও)",
    run: async () => {
      const warnings: string[] = [];
      const s = stubFetcher(() => respond("Not found", "text/plain", 404));
      const loader = createSvgLoader({ fetcher: s.fetcher, urlFor: fakeUrl, warn: (m) => warnings.push(m) });
      const a = await loader.load("svg999");
      await loader.load("svg999");
      await loader.load("svg999");
      return {
        ok: a.state === "missing" && a.reason.includes("404") && warnings.length === 1 && warnings[0].includes("svg999"),
        detail: `${a.state}${a.reason ? ` — ${a.reason}` : ""}; ওয়ার্নিং ${warnings.length}টি`,
      };
    },
  },
  {
    id: "name",
    title: "বেআইনি নাম (../x, a/b, svg1.svg, ফাঁকা, নম্বর) → missing, কোনো ফেচ নয়",
    run: async () => {
      const warnings: string[] = [];
      const s = stubFetcher(() => respond(svgOk(), "image/svg+xml"));
      const loader = createSvgLoader({ fetcher: s.fetcher, urlFor: fakeUrl, warn: (m) => warnings.push(m) });
      const bads = ["../secret", "a/b", "svg1.svg", "", "svg 1", "..\\x"];
      const results = await Promise.all(bads.map((n) => loader.load(n)));
      const allMissing = results.every((r) => r.state === "missing");
      const nonString = await loader.load(42 as unknown as string);
      const goodNames = isValidSvgName("svg1") && isValidSvgName("my_svg-2") && !isValidSvgName(null);
      return {
        ok: allMissing && nonString.state === "missing" && s.calls() === 0 && goodNames,
        detail: `${bads.length + 1}টা বেআইনি নাম সবই missing; ফেচ ${s.calls()}; ওয়ার্নিং ${warnings.length}`,
      };
    },
  },
  {
    id: "retry",
    title: "নেটওয়ার্ক-এরর → missing; আবার চাইলে সফল; এরপর ক্যাশ (ব্যর্থতা ক্যাশ হয় না)",
    run: async () => {
      const s = stubFetcher((n) => {
        if (n === 1) throw new Error("network down");
        return respond(svgOk(), "image/svg+xml");
      });
      const loader = createSvgLoader({ fetcher: s.fetcher, urlFor: fakeUrl, warn: () => undefined });
      const a = await loader.load("svg5");
      const peekBefore = loader.peek("svg5");
      const b = await loader.load("svg5");
      const c = await loader.load("svg5");
      const ok =
        a.state === "missing" &&
        peekBefore === null &&
        b.state === "ready" &&
        c === b &&
        loader.peek("svg5") === b &&
        s.calls() === 2;
      return { ok, detail: `১ম ${a.state}, ২য় ${b.state}, ৩য় ক্যাশ (একই বস্তু: ${c === b}); মোট ফেচ ${s.calls()}` };
    },
  },
  {
    id: "timeout",
    title: "সার্ভার সাড়া দেয় না → সময় শেষে missing (render আটকায় না), অনুরোধ বাতিল সংকেত",
    run: async () => {
      let aborted = false;
      const s = stubFetcher(
        (_n, signal) =>
          new Promise<Response>(() => {
            signal?.addEventListener("abort", () => {
              aborted = true;
            });
          }),
      );
      const loader = createSvgLoader({ fetcher: s.fetcher, urlFor: fakeUrl, timeoutMs: 150, warn: () => undefined });
      const t0 = Date.now();
      const r = await loader.load("svg6");
      const ms = Date.now() - t0;
      return {
        ok: r.state === "missing" && r.reason.includes("সময়") && ms < 2000 && aborted,
        detail: `${r.state}${r.reason ? ` — ${r.reason}` : ""}; ${ms}ms-এ ফিরেছে; abort সংকেত: ${aborted}`,
      };
    },
  },
  {
    id: "concurrent",
    title: "একসঙ্গে ৫ জন একই নাম চাইলে ফেচ ১টা, সবাই একই ফলাফল পায়",
    run: async () => {
      const s = stubFetcher(async () => {
        await new Promise((r) => setTimeout(r, 30));
        return respond(svgOk(), "image/svg+xml");
      });
      const loader = createSvgLoader({ fetcher: s.fetcher, urlFor: fakeUrl, warn: () => undefined });
      const rs = await Promise.all([1, 2, 3, 4, 5].map(() => loader.load("svg8")));
      const same = rs.every((r) => r === rs[0]) && rs[0].state === "ready";
      return { ok: same && s.calls() === 1, detail: `ফেচ ${s.calls()}, ফলাফল সব একই: ${same}` };
    },
  },
  {
    id: "cache",
    title: "আসল `public/svg/svg1.svg`: ৩ জন একসঙ্গে + পরে আবার → আসল ফেচ ১টা, ক্যাশ থেকে একই বস্তু",
    run: async () => {
      let real = 0;
      const counting: SvgFetcher = (url, init) => {
        real += 1;
        return fetch(url, init as RequestInit | undefined);
      };
      const loader = createSvgLoader({ fetcher: counting, warn: () => undefined });
      const first = await Promise.all([loader.load("svg1"), loader.load("svg1"), loader.load("svg1")]);
      const later = await loader.load("svg1");
      const peeked = loader.peek("svg1");
      const ok =
        first[0].state === "ready" &&
        first.every((r) => r === first[0]) &&
        later === first[0] &&
        peeked === first[0] &&
        real === 1 &&
        loader.fetchCount() === 1;
      const len = first[0].state === "ready" ? first[0].text.length : 0;
      return { ok, detail: `আসল ফেচ ${real}টি, দৈর্ঘ্য ${len}, ক্যাশ-বস্তু এক: ${later === first[0]}` };
    },
  },
];

export const LOAD_CASE_COUNT = CASES.length;
export const LOAD_CASE_TITLES = CASES.map((c) => ({ id: c.id, title: c.title }));

/** সব কেস চালায় (কখনো throw করে না: ভাঙলে ওই কেস ❌ + কারণ) */
export async function runLoadCases(): Promise<LoadCaseOutcome[]> {
  const out: LoadCaseOutcome[] = [];
  for (const c of CASES) {
    try {
      const r = await c.run();
      out.push({ id: c.id, title: c.title, ok: r.ok, detail: r.detail });
    } catch (err) {
      out.push({ id: c.id, title: c.title, ok: false, detail: `কেস নিজেই ভেঙেছে: ${err instanceof Error ? err.message : String(err)}` });
    }
  }
  return out;
}
