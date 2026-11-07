import { useEffect, useRef, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { sfxPath } from "../constants";

/**
 * Part 8: SFX ফাইল আছে কিনা দেখা (না থাকলে ক্র্যাশ নয়, চুপচাপ বাদ)।
 * `public/sfx/<name>.mp3` আগে, না থাকলে `.wav`। দুটোই না থাকলে `null` + একবার ওয়ার্নিং।
 * Part 11 (SfxPlayer) একই হুক ব্যবহার করবে।
 *
 * মনে রাখো: Remotion-এর <Audio> ফাইল না পেলে রেন্ডার থামিয়ে দেয়, তাই আগে এখানে যাচাই।
 * Studio-র ডেভ সার্ভার ফাইল না পেলে HTML ফেরত দিতে পারে — তাই content-type "text/html" হলে "নেই" ধরা হয়।
 */

const cache = new Map<string, Promise<string | null>>();

async function exists(path: string): Promise<boolean> {
  const url = staticFile(path);
  const ctrl = new AbortController();
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const type = res.headers.get("content-type") ?? "";
    return res.ok && !type.includes("text/html");
  } catch {
    return false;
  } finally {
    ctrl.abort(); // শুধু হেডার দরকার, বডি নামানো বন্ধ
  }
}

/** নাম → ব্যবহারযোগ্য src (".mp3" বা ".wav") অথবা null। ফলাফল ক্যাশ হয়। */
export function resolveSfx(name: string): Promise<string | null> {
  let p = cache.get(name);
  if (!p) {
    p = (async () => {
      for (const ext of ["mp3", "wav"] as const) {
        const path = sfxPath(name, ext);
        if (await exists(path)) return staticFile(path);
      }
      console.warn(`⚠️ SFX "${name}" পাওয়া যায়নি (public/sfx/${name}.mp3 বা .wav) — চুপচাপ বাদ দেওয়া হলো।`);
      return null;
    })();
    cache.set(name, p);
  }
  return p;
}

/**
 * `name` দিলে SFX-এর src (বা null) ফেরত দেয়; খোঁজা শেষ না হওয়া পর্যন্ত রেন্ডার আটকে রাখে (delayRender)।
 * `name = null` হলে কিছুই করে না (প্রিভিউ/বন্ধ করার জন্য)।
 */
export function useSfxSrc(name: string | null): string | null {
  const [state, setState] = useState<{ name: string; src: string | null } | null>(null);
  const handleRef = useRef<number | null>(null);
  if (name !== null && handleRef.current === null && state?.name !== name) {
    handleRef.current = delayRender(`SFX খোঁজা হচ্ছে (${name})`);
  }

  useEffect(() => {
    if (name === null) return;
    let alive = true;
    const release = () => {
      if (handleRef.current !== null) {
        continueRender(handleRef.current);
        handleRef.current = null;
      }
    };
    resolveSfx(name)
      .then((src) => {
        if (alive) setState({ name, src });
      })
      .catch(() => {
        if (alive) setState({ name, src: null });
      })
      .finally(release);
    return () => {
      alive = false;
      release();
    };
  }, [name]);

  return name !== null && state?.name === name ? state.src : null;
}
