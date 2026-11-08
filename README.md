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

- `hadis<ID>_thumbnail_9x16_4K.png/.jpg` ও `..._16x9_4K.png/.jpg` — Intro (লোগো + অ্যাপের নাম; **"আজকের হাদিস" রিবন ও কিতাবের নাম/হাদিস নম্বর থাকে না**) + Teaser + Hook এক ছবিতে (উপর → নিচ), **সবসময় 4K** (২১৬০×৩৮৪০ / ৩৮৪০×২১৬০)। Artifacts → `thumbnails`। ইউটিউবের সীমা ২ MB, তাই বড় হলে `.jpg` দাও।
- `hadis<ID>_publish.txt` — ইউটিউব শিরোনাম (৩ বিকল্প), বিবরণ, ট্যাগ, ফেসবুক ক্যাপশন, হ্যাশট্যাগ। ⚠️ হাদিসের লেখা JSON থেকে হুবহু — প্রকাশের আগে নিজে যাচাই করো।
- `hadis<ID>.srt` — সাবটাইটেল (ইউটিউব স্টুডিও → Subtitles → Upload file)। Artifacts → `publish-files`।

নতুন workflow ইনপুট: `thumbnail`, `series` (যেমন 12 → থাম্বনেইলে "পর্ব ১২"), `thumbnail_night` (০–১, **শুধু দিন-রাতের থিমে** — greenDayNight, monsoon, winter, spring — কাজ করে), `publish_files`, `app_link`। **`render.yml` zip দিয়ে আপডেট হয় না — হাতে বসাতে হবে।**

### 🎨 ঋতু-থিম ও 🕒 সময়ের মোড (`time_mode`)

`theme` এখন ৬টা: `emerald`, `navy` (স্থির) আর দিন-রাতের থিম `greenDayNight` + তিনটা নতুন ঋতু-থিম:

| থিম | ঋতু | কী দেখা যায় |
|---|---|---|
| `monsoon` | বর্ষা | ধূসর-সবুজ ভারী মেঘ, তির্যক বৃষ্টি, রাতে বিদ্যুৎ-ঝলক (আস্তে, ~৩.৭ সেকেন্ডে সর্বোচ্চ একবার), সবুজাভ-নীল জোনাকি |
| `winter` | শীত | কুয়াশার ভোর, ভেসে চলা কুয়াশা-স্তর, ঝিলমিল হিমকণা, গোলাপি-কমলা গোধূলি, বরফ-নীল জোনাকি |
| `spring` | বসন্ত | গোলাপি-পিচ দিন, আগুন-রঙা গোধূলি, ঝরা পলাশ/কৃষ্ণচূড়ার পাপড়ি, বেগুনি-গোলাপি রাত, কমলা-সোনালি জোনাকি |

নতুন workflow ইনপুট **`time_mode`** (প্রতিটা দিন-রাতের থিমে কাজ করে; `emerald`/`navy` স্থির — প্রভাব নেই):

| `time_mode` | কী হয় |
|---|---|
| `dayToNight` (ডিফল্ট) | দিন → গোধূলি → রাত; জোনাকি ধীরে ফোটে 🌿✨ — আগের আচরণ হুবহু |
| `day` | পুরো ভিডিও জুড়ে উজ্জ্বল দিন |
| `night` | পুরো ভিডিও জুড়ে রাত — তারা + পূর্ণ জোনাকি |
| `nightToDay` | রাত → ভোর → দিন; চাঁদ ডোবে, সূর্য বাঁ দিক থেকে ওঠে, তারা ও জোনাকি মিলিয়ে যায় |

থাম্বনেইলেও মোড মানা হয় (`day` = উজ্জ্বল দিন, `nightToDay` = সোনালি ভোর; `thumbnail_night` দিলে সেটাই জেতে)। নতুন থিম ও মোড একসাথে দেখতে `action = check` চালিয়ে `check-images` → `check-SeasonThemesPreview.png` খোলো। `render.yml` হাতে বসাতে হবে (zip দিয়ে workflow আপডেট হয় না)।

> আগে `setup.yml` বসিয়ে থাকলে মুছে দাও।

### 🎵 ব্যাকগ্রাউন্ড মিউজিক ও অডিও (ভয়েস -14 LUFS · নরম মিউজিক · ducking)

নতুন ঐচ্ছিক workflow ইনপুট **`background_music`** — দুটোর একটা দেওয়া যায়:

| ইনপুটে কী দেবে | কী হয় |
|---|---|
| সরাসরি ডাউনলোড লিংক (`https://…/song.mp3`) | ডাউনলোড (রিডাইরেক্ট মানে) → ffprobe যাচাই → `public/background1.<ext>` নামে সেভ (এক্সটেনশন ফাইলের আসল ধরন/URL থেকে; আগের `background1.*` মুছে ওভাররাইট) → রিপোতেও কমিট, তাই পরের বার শুধু নাম দিলেই চলে। Dropbox / Google Drive / GitHub-এর শেয়ার-লিংক নিজে সরাসরি-লিংকে বদলে নেয়। |
| `public/` ফোল্ডারের ফাইলের নাম (`background1.mp3`, `my song.mp3`) | ওই ফাইল সরাসরি ব্যবহার (বড়-ছোট হাতের অক্ষর বা এক্সটেনশন বাদ দিলেও চলে)। নাম না মিললে স্পষ্ট ❌ এরর + `public/`-এ থাকা অডিও ফাইলের তালিকা; ভিডিও তৈরি হয় (মিউজিক ছাড়া) কিন্তু রান ❌ দেখায় ও Release হয় না। |
| **ফাঁকা** | মিউজিক ছাড়া, আগের মতোই (তবু ভয়েস -14 LUFS-এ সমান হয়) |

ডাউনলোড বা যাচাই ব্যর্থ হলে (লিংকে ওয়েব-পেজ, ৪০৪, নষ্ট/অডিও-ছাড়া ফাইল) ⚠️ সতর্কতা দিয়ে **মিউজিক ছাড়াই রেন্ডার চলে** — পুরো workflow ভাঙে না।

**অডিও নিয়ম** (সব রেন্ডার জবের ভিডিওতে; Remotion রেন্ডারের পরে FFmpeg চলে, কোড `scripts/lib/audioMix.mjs`):

- **ভয়েস লাউডনেস:** `loudnorm` two-pass, লক্ষ্য **-14 LUFS**, TP -1.5 dB, LRA 11 — মিউজিক থাকুক বা না থাকুক।
- **মিউজিক খুব নরম:** প্রথমে মিউজিক ভয়েসের সমান লেভেলে (-14 LUFS) আনা হয়, তারপর `bgVolume = 0.08` (≈ ভয়েসের চেয়ে -22 dB নিচে; ০.০৬ ≈ -24 dB, ০.১০ ≈ -20 dB)। বদলাতে `scripts/lib/audioMix.mjs`-এর `AUDIO_SETTINGS.bgVolume` (বা env `BG_MUSIC_VOLUME`)।
- **Ducking:** ভয়েস বাজলে `sidechaincompress` মিউজিক আরও নামায় (ratio 8, attack 20 ms, release 600 ms), ভয়েস থামলে মসৃণভাবে ফেরে।
- **দৈর্ঘ্য:** মিউজিক ভিডিওর চেয়ে বড় হলে ঠিক ভিডিওর দৈর্ঘ্যে ছাঁটা; ছোট হলে নিরবচ্ছিন্ন লুপ। শুরুতে ১ সেকেন্ড ফেড-ইন, শেষে ২ সেকেন্ড ফেড-আউট।
- **আউটপুট:** `amix` (`normalize=0`) + AAC 192k; ভিডিও স্ট্রিম **কপি** (কোয়ালিটি/ফ্রেম অপরিবর্তিত)।
- **নিরাপত্তা:** ffmpeg না থাকলে বা মিক্স ব্যর্থ হলে Remotion-এর আসল অডিওসহ ভিডিও যেমন ছিল তেমনই থাকে। ভিডিওতে অডিও স্ট্রিম না থাকলে (মিউজিক দিলে) শুধু মিউজিক যোগ হয়, না দিলে বাদ। ফাইলের নামে স্পেস/বিশেষ চিহ্ন চলে; ফরম্যাট: mp3, wav, m4a, ogg, aac, flac, opus।

যাচাই: `node scripts/test-audio-mix.mjs` (ffmpeg থাকলে আসল লুপ/ট্রিম/ducking/-14 LUFS-ও যাচাই হয়)। **`render.yml` zip দিয়ে আপডেট হয় না — নতুনটা হাতে বসাতে হবে।**

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
- `src/themes.ts`, `src/fonts.ts`, `src/lib/dayNight.ts` — ৬টা থিম (৩ + ঋতু-থিম monsoon/winter/spring), বাংলা ফন্ট, দিন-রাতের হিসাব (`timeMode` সহ)
- `src/lib/bnDigits.ts`, `src/lib/displayText.ts` — বাংলা সংখ্যা ও "কিতাব নং : নম্বর" লেবেল
- `src/lib/loadHadis.ts`, `src/lib/timing.ts` — WAV/JSON লোড, ভিডিওর দৈর্ঘ্য ও ফ্রেম হিসাব
- `src/lib/useLayout.ts`, `src/lib/sky.ts`, `src/components/Background.tsx` (+ `DayNightSky`, `Fireflies`, `SeasonEffects`) — লেআউট ও ৬ থিমের ব্যাকগ্রাউন্ড
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
- `scripts/lib/audioMix.mjs` — অডিও (FFmpeg): ভয়েস -14 LUFS, নরম ব্যাকগ্রাউন্ড মিউজিক, ducking, লুপ/ট্রিম; `scripts/prepare-bgmusic.mjs` — `background_music` ইনপুট (লিংক বা `public/`-এর ফাইলের নাম) → `public/background1.<ext>`; `scripts/test-audio-mix.mjs` — এদের টেস্ট

## নিচের প্রোগ্রেস বার ও রেন্ডার সেটিং

- **প্রোগ্রেস বার:** পুরো ভিডিও জুড়ে (Hook → Outro) নিচে বাঁ→ডানে ভরে; থিমের রঙে, মাথায় উজ্জ্বল বিন্দু। `src/components/ProgressBar.tsx`; বন্ধ করতে `src/constants.ts`-এ `PROGRESS_BAR_ENABLED = false`; উচ্চতা/মার্জিন/অবস্থান ওই ফাইলের `PROGRESS_BAR_*`।
- **রেন্ডার সেটিং:** H.264, CRF ১৮ (ডিফল্ট; `--crf` দিয়ে বদলানো যায়), AAC ১৯২k, yuv420p, ৩০ fps — YouTube/Shorts-এ কম কম্প্রেশন-ক্ষতি।

## 📊 ইনফোগ্রাফিক — ছোট ছোট পয়েন্ট (ঐচ্ছিক)

হাদিসের মূল পাঠ থেকে নেওয়া **ছোট ছোট পয়েন্ট** (গোল-কোনা পিল, সোনালি বর্ডার), নির্দিষ্ট সময়ে SVG-র ঠিক নিচে ফোটে — যেমন `নিয়ত → ফল`, `নিয়ত ঠিক → জীবন ঠিক`। বড় কার্ড/শিরোনাম/সংখ্যা-ব্যাজ নেই। timestamp JSON-এ top-level `infographics` অ্যারে দিলেই চলে — না দিলে ভিডিও আগের মতোই।

```json
"infographics": [
  { "start": 18.0, "end": 23.5, "type": "steps",
    "items": [ { "text": "নিয়ত" }, { "text": "ফল" } ] },
  { "start": 23.9, "end": 30.9, "type": "list",
    "items": [ { "text": "দুনিয়া" }, { "text": "নারী" } ] }
]
```

- `type`: `steps` (পিল → পিল, মাঝে তীর) · `list` (পাশাপাশি পিল, মাঝে ছোট ◆) · `compare` (বাঁ-পিল ◆ ডান-পিল; ঐচ্ছিক `side`)
- `start`/`end`: সেকেন্ড, `.wav`-এর শুরু থেকে (segment-এর মতোই)। একটার উপর আরেকটা চলবে না, সময়ের ক্রমে দিতে হবে (সর্বোচ্চ ৮টা)
- `items`: **২–৩টা** ছোট পয়েন্ট (এক সারিতে বসে); প্রতিটা `text` ১–৩ শব্দ (ভালো ১২ অক্ষরের মধ্যে, সর্বোচ্চ ২৪); ঐচ্ছিক `at` (সেকেন্ড) — না দিলে ইনফোগ্রাফিকের সময়ে সমান ভাগে ফোটে
- `title`/`leftTitle`/`rightTitle` এখনও JSON-এ দেওয়া যায় (পুরনো ফাইল চলে), কিন্তু পিল-স্ট্রিপে **আঁকা হয় না**
- **লেআউট (SVG/ক্যাপশন ঢাকে না):** ইনফোগ্রাফিক চলার সময় **Portrait**-এ SVG মসৃণভাবে একটু ছোট (আগের ৮০%) হয়ে উপরে থাকে আর পিল-স্ট্রিপ তার ঠিক নিচে বসে; ক্যাপশন নিজের জায়গায় পুরো আকারে থাকে। **Landscape**-এ SVG বাঁয়ে একই; ডান কলামের উপরে পাতলা পিল-স্ট্রিপ (২৬%), তার নিচে ক্যাপশন-বক্স ছোট হয়ে নামে। শেষ হলে সব আগের মাপে ফেরে। কাছাকাছি ইনফোগ্রাফিক (ফাঁক ≤ ১.৫ সেকেন্ড) এক দল ধরা হয়, তাই মাঝে SVG লাফায় না।
- ফন্ট অটো: `পিলের উচ্চতা × ০.৪৬` থেকে শুরু; সারি স্ট্রিপের চেয়ে লম্বা হলে কমে (সর্বনিম্ন × ০.২৬)। তাই ২টা পয়েন্ট বড় ও পরিষ্কার, ৩টা একটু ছোট
- কোড: `src/components/Infographic.tsx`, `src/lib/infographic.ts` (পিওর হিসাব + `planInfographicPills`), `src/lib/useInfographicMix.ts`, `src/lib/useLayout.ts` (`computeLayout(w, h, mix)`, `infoBox`, `INFOGRAPHIC_SVG_SHRINK`, `INFOGRAPHIC_LANDSCAPE_SHARE`), স্কিমা `src/types.ts`; `SvgStage` ও `Caption` একই mix পায়; `MainScene`-এর stage স্লটের ভেতরে বসে
- AI দিয়ে বানাতে: `AI_PROMPTS.md` Prompt 1-এ `INFOGRAPHIC_WANTED: yes` (নিয়ম ১২)। ⚠️ লেখা শুধু হাদিসের নিজের কথা থেকে — প্রকাশের আগে নিজে যাচাই করো।

## ভিজ্যুয়াল হুক (প্রথম মুহূর্তেই বিষয়ের SVG এনিমেশন)

- Hook দৃশ্যে (ভিডিওর একদম শুরু) প্রথম ফ্রেম থেকেই একটা SVG এনিমেশন দেখায় — Portrait-এ লেখার উপরে, Landscape-এ লেখার বাঁয়ে। কোড: `src/components/HookVisual.tsx`, বাছাই: `src/lib/hookSvg.ts`।
- **কোন SVG:** (১) timestamp JSON-এ `"hookSvg": "svg3"` দিলে সেটা (বিষয়ের সাথে মেলে এমনটা বেছে); (২) না দিলে **টিজারের সেগমেন্টের SVG** (টিজার = হাদিসের মূল বাক্যাংশ = বিষয়ের সারকথা); (৩) টিজার না থাকলে প্রথম সেগমেন্টের SVG; (৪) `public/svg/`-এ কিছুই না থাকলে ৮-কোণা তারা (fallback)। নতুন SVG লাগে না; Main-এর SVG-র ক্রমও বদলায় না।
- `"hookSvg"` ঐচ্ছিক (`AI_PROMPTS.md` Prompt 1-এ নিয়ম ১১)। নাম ভুল/ফোল্ডারে না থাকলে চুপচাপ টিজারের সেগমেন্টের SVG নেয়।
- বন্ধ করতে `src/constants.ts`-এ `HOOK_VISUAL_ENABLED = false` (তখন Hook আগের মতো শুধু বড় লেখা)।

## ক্যাপশন (শব্দ ধরে হাইলাইট · সর্বোচ্চ ২ লাইন · নিরাপদ মার্জিন)

- ক্যাপশনের ফন্ট স্থির (Portrait ৬৬, Landscape ৬০; 4K-তে ×২)। লম্বা সেগমেন্ট শব্দ ধরে **পেজে** ভাগ হয় — প্রতি পেজে সর্বোচ্চ ২ লাইন; পরের পেজ আসে তার প্রথম শব্দ শুরুর ফ্রেমে। হাইলাইট শব্দ ধরে (active রঙিন + pop + আন্ডারলাইন, read সাদা, upcoming ঝাপসা)।
- ক্যাপশন-বাক্স `layout.safe` (নিরাপদ মার্জিন)-এর ভেতরে রাখা হয়; কোড `src/lib/captionWords.ts` (`paginateCaption`, `clampBoxToSafe`) ও `src/components/Caption.tsx`।
