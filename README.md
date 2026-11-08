# HadisVideokit

ইসলামী বিশ্বকোষ ও আল হাদিস S2 — Remotion ভিত্তিক অটো হাদিস ভিডিও কিট।

> 🚧 কিট ধাপে ধাপে তৈরি হচ্ছে (এখন Part 13 সম্পূর্ণ (13A–13C) — পুরো ভিডিও `HadisVideo` + আসল দুই কম্পোজিশন `HadisPortrait`/`HadisLandscape` + `HadisVideoPreview` যাচাই; এরপর Part 14)। অগ্রগতি ও পূর্ণ গাইড: `HadisVideokit.md`

## 📱 মোবাইল থেকে ব্যবহার — একটাই workflow: `render.yml`

একবার `.github/workflows/render.yml` হাতে বসাও (কোড `HadisVideokit.md`-তে বা zip-এর ভেতরে)। এরপর:

1. রিপোতে নতুন zip আপলোড করো (**Add file → Upload files**)।
2. **Actions → Render Hadis Video → Run workflow** → `action = check`, `zip_file` = zip-এর নাম (যেমন `HadisVideokit-part3.zip`)।
3. রান শেষে **Artifacts → check-images** থেকে ছবি দেখো; **Summary**-তে কম্পোজিশনের তালিকা।

| action | কী হয় |
|---|---|
| `check` | বান্ডল + সব কম্পোজিশনের ছবি (যাচাই) |
| `render` | ভিডিও রেন্ডার (Part 14-এর পর চালু) |
| `render_and_release` | রেন্ডার + GitHub Release |
| `thumbnail_only` | শুধু 4K থাম্বনেইল (ভিডিও নয়) — সিরিজ নম্বর/ব্যাকগ্রাউন্ড ঠিক করতে |

### 🖼️ থাম্বনেইল ও 📝 প্রকাশের ফাইল

প্রতিটা `render` রানে `out/`-এ (টিক তুলে বন্ধ করা যায়):

- `hadis<ID>_thumbnail_9x16_4K.png/.jpg` ও `..._16x9_4K.png/.jpg` — Intro (অ্যাপের নামসহ) + Teaser + Hook এক ছবিতে (উপর → নিচ), **সবসময় 4K** (২১৬০×৩৮৪০ / ৩৮৪০×২১৬০)। Artifacts → `thumbnails`। ইউটিউবের সীমা ২ MB, তাই বড় হলে `.jpg` দাও।
- `hadis<ID>_publish.txt` — ইউটিউব শিরোনাম (৩ বিকল্প), বিবরণ, ট্যাগ, ফেসবুক ক্যাপশন, হ্যাশট্যাগ। ⚠️ হাদিসের লেখা JSON থেকে হুবহু — প্রকাশের আগে নিজে যাচাই করো।
- `hadis<ID>.srt` — সাবটাইটেল (ইউটিউব স্টুডিও → Subtitles → Upload file)। Artifacts → `publish-files`।

নতুন workflow ইনপুট: `thumbnail`, `series` (যেমন 12 → থাম্বনেইলে "পর্ব ১২"), `thumbnail_night` (০–১, **শুধু greenDayNight থিমে** কাজ করে), `publish_files`, `app_link`। **`render.yml` zip দিয়ে আপডেট হয় না — হাতে বসাতে হবে।**

> আগে `setup.yml` বসিয়ে থাকলে মুছে দাও।

## 💻 লোকালি (যাদের পিসি আছে)

```bash
npm install
npm run dev        # Remotion Studio
npm run typecheck  # টাইপ যাচাই
npm run check      # বান্ডল + ছবি রেন্ডার (out/check-*.png)
```

প্রয়োজন: Node.js 20 বা তার বেশি।

## ফোল্ডার

- `src/logo.jpg` — লোগো (কোডে গোল করে দেখানো হবে)
- `src/google-play-badge.png` — Google Play badge
- `src/constants.ts`, `src/types.ts` — কিটের স্থির মান ও Zod স্কিমা
- `src/themes.ts`, `src/fonts.ts`, `src/lib/dayNight.ts` — ৩টা থিম, বাংলা ফন্ট, দিন-রাতের হিসাব
- `src/lib/bnDigits.ts`, `src/lib/displayText.ts` — বাংলা সংখ্যা ও "কিতাব নং : নম্বর" লেবেল
- `src/lib/loadHadis.ts`, `src/lib/timing.ts` — WAV/JSON লোড, ভিডিওর দৈর্ঘ্য ও ফ্রেম হিসাব
- `src/lib/useLayout.ts`, `src/lib/sky.ts`, `src/components/Background.tsx` (+ `DayNightSky`, `Fireflies`) — লেআউট ও ৩ থিমের ব্যাকগ্রাউন্ড
- `src/components/Logo.tsx`, `Header.tsx`, `Ribbon.tsx`, `FitText.tsx`, `src/lib/fitText.ts` — গোল লোগো, অ্যানিমেটেড হেডার, রিবন, বক্সে-আঁটা টেক্সট
- `src/scenes/IntroScene.tsx`, `src/lib/useSfxSrc.ts` — Intro সিন; SFX ফাইল থাকলে বাজায়, না থাকলে চুপচাপ বাদ
- `src/lib/outroPlan.ts`, `src/components/PlayBadge.tsx`, `src/scenes/OutroScene.tsx` — Outro সিন: লোগো + অ্যাপের নাম + টাইপ-হওয়া CTA লেখা + Google Play badge (bounce-in, pulse, shine, ট্যাপ-ইঙ্গিত)
- `src/scenes/MainScene.tsx` — Main সিন: Header + SvgStage + Caption
- `src/HadisVideo.tsx`, `src/lib/sceneFade.ts` — পুরো ভিডিও: Background + Intro + Main (নরম ফেড-ইন) + Outro + ভয়েস/SFX; কম্পোজিশন `HadisPortrait` (১০৮০×১৯২০) ও `HadisLandscape` (১৯২০×১০৮০) `src/Root.tsx`-এ
- `src/dev/HadisVideoPreview.tsx` — (dev) পুরো ভিডিওর যাচাই-ছবি: ৩৩টা ঘর + ৩৪টা স্বয়ংক্রিয় সারি; `public/sfx/whoosh.mp3` — নমুনা SFX (নিজের ফাইল দিলে সেটাই চলবে)
- `src/dev/ThemePreview.tsx`, `DataCheck.tsx`, `BackgroundPreview.tsx`, `HeaderPreview.tsx`, `IntroPreview.tsx` — যাচাইয়ের ছবি; Outro-র যাচাই: `OutroPreview.tsx` (`out/check-OutroPreview.png`)
- `src/scenes/HookScene.tsx` — Hook দৃশ্য (Intro-র আগে বড় প্রশ্ন-লেখা "এই হাদিসের ব্যাপারে কি আপনার জানা আছে?"); ভয়েস `public/audio/hook.wav` (না থাকলে Hook নেই; দৈর্ঘ্য = অডিওর দৈর্ঘ্য)
- `src/scenes/TeaserScene.tsx`, `src/components/TeaserAudio.tsx`, `src/lib/teaser.ts` — অডিও টিজার (cold open): Hook-এর পরে হাদিসের সবচেয়ে শক্তিশালী বাক্যাংশ আগে বাজে (timestamp JSON-এ `"teaser": { "start": …, "end": … }` থাকলে; না থাকলে টিজার নেই), তারপর Intro → হাদিস শুরু থেকে
- `public/hadis/` — `hadis0101.wav` ও `hadis0101_timestamp.json` (`hadis0000` নমুনা, যাচাইয়ের জন্য)
- `public/svg/` — `svg1.svg`, `svg2.svg` …
- `public/sfx/` — `whoosh.mp3` ইত্যাদি
- `scripts/check.mjs` — অটো-যাচাই স্ক্রিপ্ট; `scripts/render.mjs` — রেন্ডার (Part 14-এ সম্পূর্ণ)

## নিচের প্রোগ্রেস বার ও রেন্ডার সেটিং

- **প্রোগ্রেস বার:** পুরো ভিডিও জুড়ে (Hook → Outro) নিচে বাঁ→ডানে ভরে; থিমের রঙে, মাথায় উজ্জ্বল বিন্দু। `src/components/ProgressBar.tsx`; বন্ধ করতে `src/constants.ts`-এ `PROGRESS_BAR_ENABLED = false`; উচ্চতা/মার্জিন/অবস্থান ওই ফাইলের `PROGRESS_BAR_*`।
- **রেন্ডার সেটিং:** H.264, CRF ১৮ (ডিফল্ট; `--crf` দিয়ে বদলানো যায়), AAC ১৯২k, yuv420p, ৩০ fps — YouTube/Shorts-এ কম কম্প্রেশন-ক্ষতি।
