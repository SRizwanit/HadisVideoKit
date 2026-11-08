import { useEffect, useRef, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { HOOK_AUDIO_PATH, HOOK_ENABLED, INTRO_AUDIO_PATH, INTRO_OUTRO_AUDIO_ENABLED, OUTRO_AUDIO_PATH } from "../constants";

/**
 * Hook: `public/audio/hook.wav`-ও একই নিয়মে খোঁজা হয় (না থাকলে `hook: null` → Hook দৃশ্য বসে না)।
 * Part 14C-audio: `public/audio/intro.wav` ও `outro.wav` আছে কিনা দেখা (না থাকলে ক্র্যাশ নয়, `null`)।
 * Remotion-এর <Audio> ফাইল না পেলে রেন্ডার থামিয়ে দেয়, তাই আগে এখানে যাচাই (useSfxSrc-এর মতোই; Studio-র HTML-ফেরতও "নেই")।
 * `enabled = false` (dev প্রিভিউ / ধ্রুবক বন্ধ) → কিছু খোঁজে না, `ready` শুরু থেকেই true, দুটোই null।
 * খোঁজা শেষ না হওয়া পর্যন্ত `ready = false` এবং রেন্ডার আটকে থাকে (delayRender)।
 */

export type IntroOutroAudioSrcs = { ready: boolean; hook: string | null; intro: string | null; outro: string | null };

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
    ctrl.abort();
  }
}

function resolveVoice(path: string): Promise<string | null> {
  let p = cache.get(path);
  if (!p) {
    p = (async () => {
      if (await exists(path)) return staticFile(path);
      console.warn(`ℹ️ public/${path} নেই — এই দৃশ্য ভয়েস ছাড়া (আগের মতো) চলবে।`);
      return null;
    })();
    cache.set(path, p);
  }
  return p;
}

export function useIntroOutroAudio(enabled: boolean = true): IntroOutroAudioSrcs {
  const on = enabled && (INTRO_OUTRO_AUDIO_ENABLED || HOOK_ENABLED);
  const [state, setState] = useState<{ hook: string | null; intro: string | null; outro: string | null } | null>(null);
  const handleRef = useRef<number | null>(null);
  if (on && handleRef.current === null && state === null) {
    handleRef.current = delayRender("Intro/Outro অডিও খোঁজা হচ্ছে");
  }

  useEffect(() => {
    if (!on) return;
    let alive = true;
    const release = () => {
      if (handleRef.current !== null) {
        continueRender(handleRef.current);
        handleRef.current = null;
      }
    };
    // বন্ধ-করা ধ্রুবকের ফাইল খোঁজাই হয় না (null)
    Promise.all([
      HOOK_ENABLED ? resolveVoice(HOOK_AUDIO_PATH) : Promise.resolve(null),
      INTRO_OUTRO_AUDIO_ENABLED ? resolveVoice(INTRO_AUDIO_PATH) : Promise.resolve(null),
      INTRO_OUTRO_AUDIO_ENABLED ? resolveVoice(OUTRO_AUDIO_PATH) : Promise.resolve(null),
    ])
      .then(([hook, intro, outro]) => {
        if (alive) setState({ hook, intro, outro });
      })
      .catch(() => {
        if (alive) setState({ hook: null, intro: null, outro: null });
      })
      .finally(release);
    return () => {
      alive = false;
      release();
    };
  }, [on]);

  if (!on) return { ready: true, hook: null, intro: null, outro: null };
  return state ? { ready: true, ...state } : { ready: false, hook: null, intro: null, outro: null };
}
