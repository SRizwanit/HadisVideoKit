# 🕌 HadisVideokit — Islamic Encyclopedia & Al-Hadith S2

> An **automatic hadith video kit** built with React + Remotion + GitHub Actions.
> You only put a `.wav` + `_timestamp.json` (+ AI-made SVG/SFX) in the repo, type the **book name** and **hadith number (in Bengali)** in GitHub Actions, press Run, and the video renders. No video editor or PC needed.

**Version 2.58 (English edition) — add-on ✅: 3 season themes + `time_mode` | Parts 1–13 done ✅ (Part 9 = 9A–9L, Part 12 = 12A–12E, Part 13 = 13A–13C) | Part 14 (real `render.mjs`, AI prompts) was split into 3 sub-parts: 14A ✅ (`renderPlan.mjs` ✅ · `test-render-plan.mjs` ✅) · 14B ✅ (code done; first real browser render is your GitHub run) · 14C ⬜ (file 1/2: `AI_PROMPTS.md` ✅ · file 2/2: `README.md` ⬜) | Next: `পরের ফাইল` (14C file 2: `README.md`) | Then Part 15 (final end-to-end test + README) | One single workflow (`render.yml`) does everything 📱**

6 themes: Emerald Night, Royal Navy, Green Day & Night (with fireflies) **+ 3 season themes: Monsoon (বর্ষা), Winter (শীত), Spring (বসন্ত)** — and a new **`time_mode`** input (Day / Night / DayToNight with fireflies / NightToDay) for every day-night theme. Book name and Bengali hadith number come straight from GitHub Actions inputs (no book-code list).

> 📝 In this version the finished-Part notes (9K–13C) are condensed again: checklists, "how it was verified" stories, preview-image details and the old change log are removed. **All files/APIs/fixed rules/numbers/constants that Parts 14–15 or later edits still need are kept, and the Part 14 plan is kept in full (now spread across 14A–14C).**
> ℹ️ User-facing strings inside code (the YAML, Bengali on-screen text such as "আজকের হাদিস") stay in Bengali on purpose, because that is what the video and your repo actually use. Only comments/explanations are translated.

---

## 📌 How to use this file

The whole kit cannot be built in one go (tokens would run out), so the work is split into **15 Parts** (Part 9 → 12 sub-parts, Part 12 → 5, Part 13 → 3, **Part 14 → 3**). Parts 1–13, 14A, 14B and 14C file 1 (`AI_PROMPTS.md`) are done. The next message is **`পরের ফাইল`** (14C file 2: `README.md`) ("দাও" = "give").

1. Tell the chat: **"Part N দাও"** (e.g. `Part 15 দাও`).
2. I give the code for that Part as a **new zip of the whole project** (`HadisVideokit-partN.zip`) plus the updated `HadisVideokit.md`.
3. Upload the zip to the GitHub repo and run **Actions → Render Hadis Video** (mobile workflow below). No commands to run.
4. When Actions turns green ✅, ask for the next Part.

> ⚠️ If a Part errors, copy the red text of the failed Actions step and send it; only that file will be fixed.

---

## 📱 Mobile workflow — one single workflow: `render.yml`

You have no PC, so **everything is done by one workflow (`.github/workflows/render.yml`)**: unzip, check, video render, Release. No local `npm install` / `npm run dev`.

| action | What happens | Where the result is |
|---|---|---|
| `check` | Bundle + render an image of every composition (verification) | Artifacts → `check-images` |
| `render` | Render the video (real after Part 14) | Artifacts → `videos` |
| `render_and_release` | Render + upload to a GitHub Release | Releases tab |
| `thumbnail_only` | Only the 4K thumbnails (no video) — quick way to tune `series` / `thumbnail_night` | Artifacts → `thumbnails` |

> 🔒 **Once you paste this `render.yml` by hand you never need to change it again.** All logic lives in `scripts/`, which updates through the zip. Part 14 puts the real render into `scripts/render.mjs`, which the workflow already calls with fixed arguments.

### 🖼️ Thumbnail + 📝 publish files (added after Part 14B)

Every `render` / `render_and_release` run now also produces (each can be switched off with its tick box):

| Output | File(s) in `out/` | Notes |
|---|---|---|
| **4K thumbnail** (Hook + Teaser + Intro in one image) | `hadis<ID>_thumbnail_9x16_4K.png/.jpg`, `hadis<ID>_thumbnail_16x9_4K.png/.jpg` | One per chosen orientation, **always 4K** (2160×3840 / 3840×2160) whatever `quality` is. JPG because YouTube's thumbnail limit is 2 MB. Artifacts → `thumbnails`. |
| **YouTube/Facebook text** | `hadis<ID>_publish.txt` | 3 title options (≤100 chars), description, tags (≤500 chars), Facebook caption, hashtags (`#Shorts` only if portrait is rendered). Hadith text is copied **verbatim from the JSON** — verify it before publishing. |
| **Subtitles** | `hadis<ID>.srt` | Same timing for every orientation/quality. Cues: Hook question, Teaser phrase, then each segment (offset = Hook + Teaser + Intro, exactly like `timing.ts`). YouTube Studio → Subtitles → Upload file (With timing). Artifacts → `publish-files`. |

New workflow inputs: `thumbnail` (tick), `series` (e.g. `12` → "পর্ব ১২" badge on the thumbnail only), `thumbnail_night` (0–1; **only affects `greenDayNight`** — emerald/navy are static themes; 0 = bright day, 0.5 = golden dusk, 0.9 = night + fireflies, empty = theme default in `THUMBNAIL_NIGHT_BY_THEME`), `publish_files` (tick), `app_link` (optional `https://…`, goes into description/caption). Action `thumbnail_only` renders only the thumbnails.

Files: `src/scenes/ThumbnailScene.tsx` (design; compositions `ThumbnailPortrait` / `ThumbnailLandscape` in `Root.tsx`, still frame 45, rendered with `--scale 2`), `scripts/lib/srt.mjs`, `scripts/lib/publishText.mjs` (pure, no browser; tested by `node scripts/test-render-plan.mjs`). If the JSON has no `teaser` block, the middle card of the thumbnail is simply left out.

> ⚠️ `render.yml` is **not** updated by the zip (GitHub forbids it) — paste the new `.github/workflows/render.yml` by hand once.

### 🎵 Background music + audio (added after Part 14C)

New optional workflow input **`background_music`** — either a **direct download link** (`https://…/song.mp3`) or the **file name of an audio file already in `public/`**; **empty = no music** (the pipeline behaves exactly as before, the voice is still normalized to -14 LUFS).

- **Link:** downloaded (redirects followed, 3 attempts, 150 MB cap), validated with `ffprobe`, saved as `public/background1.<ext>` (extension from the real file type, then the URL, then `Content-Type`; any older `background1.*` is removed) and committed to the repo so you can reuse it later just by typing the name. Dropbox / Google Drive / GitHub share links are converted to direct links automatically.
- **File name:** `public/<name>` is used directly (case-insensitive, `public/` prefix and a missing extension are accepted). If it does not exist: a clear `::error::` listing the audio files in `public/`; the videos are still rendered (without music) but the run ends ❌ and no Release is created.
- **Download/validation problems** (HTML page instead of audio, 404, corrupt file, no audio stream) → `::warning::` and the render continues without music.

What happens to every rendered video (new step after each `renderMedia`; code `scripts/lib/audioMix.mjs`, FFmpeg installed by a new workflow step):

| Setting | Value |
|---|---|
| Voice loudness | two-pass `loudnorm`, **I = -14 LUFS**, TP = -1.5, LRA = 11 (the whole Remotion mix: narration + Intro/Outro/Hook voices + SFX) |
| Music level | levelled to -14 LUFS first, then `AUDIO_SETTINGS.bgVolume = 0.08` (≈ -22 dB below the voice; 0.06–0.10 recommended; env override `BG_MUSIC_VOLUME`) |
| Ducking | `sidechaincompress` with the voice as sidechain: threshold 0.02, ratio 8, attack 20 ms, release 600 ms |
| Length | music longer than the video → trimmed to the exact length; shorter → seamless loop (`-stream_loop -1` on a PCM WAV) then trimmed; 1 s fade-in, 2 s fade-out |
| Output | `amix normalize=0` + peak limiter at -1.5 dBTP, AAC 192k / 48 kHz stereo; **video stream copied** (`-c:v copy`) |

Safety: any ffmpeg problem keeps the original Remotion audio (the render never fails because of the audio step); a video with no audio stream gets music only (or is skipped when there is no music). `scripts/prepare-bgmusic.mjs` resolves the input and exports `BG_MUSIC_FILE` via `$GITHUB_ENV`; `render.mjs` reads it. Tests: `node scripts/test-audio-mix.mjs`. **`render.yml` changed (new input + 4 steps) — paste the new file by hand; the copy embedded further below in this document is an older snapshot and was not updated.**

### One-time setup

1. Create a new GitHub repo (e.g. `hadis-videokit`). "Desktop site" in the phone browser helps.
2. **Add file → Create new file** → name `.github/workflows/render.yml` (typing `/` creates the folder).
3. Paste the `render.yml` code below, **Commit changes**.
4. If you made `setup.yml` earlier, delete it.

### After every Part (each time you get a new zip)

1. **Add file → Upload files** → upload `HadisVideokit-partN.zip` and Commit.
2. **Actions → Render Hadis Video → Run workflow** → `action = check`, `zip_file` = the zip name → Run.
3. The workflow: unzips → commits → deletes the zip → `npm ci` → `typecheck` → renders **images** of the compositions.
4. Open **Artifacts → `check-images`** at the bottom of the run page. The **Summary** lists the compositions.

**Overwrite safety:** unzipping never deletes/replaces your `src/logo.jpg`, `src/google-play-badge.png` and files in `public/` (audio, SVG, SFX).
**`.github/workflows/` files:** GitHub does not allow automatic changes; if a zip changes a workflow file, the Summary shows ⚠️ and you update it by hand.

### `.github/workflows/render.yml` (copy-paste code)

```yaml
name: Render Hadis Video

# একটাই workflow — সব কাজ এখান থেকে (ফোন থেকেই):
#   action = check               → যাচাই (বান্ডল + ছবি রেন্ডার), Artifacts: check-images
#   action = render              → ভিডিও রেন্ডার; **প্রতিটা জব শেষ হওয়ার সাথে সাথেই** Artifact আপলোড — ভিডিওর সাথে থাম্বনেইল + প্রকাশের ফাইলও একই Artifact-এ (নিচে দেখো)
#   action = render_and_release  → রেন্ডার + GitHub Release-এ আপলোড
#   action = thumbnail_only      → শুধু 4K থাম্বনেইল (ভিডিও নয়; কয়েক মিনিটে) — সিরিজ নম্বর/ব্যাকগ্রাউন্ড ঠিক করতে, Artifacts: thumbnails (শুধু এই action-এ আলাদা)
#
# 📦 Artifact আপলোড (প্রতিটা জব শেষ হলেই — সব শেষ হওয়ার অপেক্ষা নেই):
#   ✅ এখন প্রতিটা ভিডিও Artifact-এর ভেতরেই সব থাকে — আলাদা thumbnails / publish-files Artifact আর হয় না:
#       🎬 ভিডিও (.mp4) + 🖼️ থাম্বনেইল (PNG + JPG, টিক থাকলে) + 📝 প্রকাশের ফাইল (publish.txt + .srt, টিক থাকলে)
#   থাম্বনেইল (টিক থাকলে)      → আগে তৈরি হয় (দ্রুত), প্রতিটা ভিডিও Artifact-এর সাথে আপলোড হয়
#   প্রকাশের ফাইল (txt + srt) → প্রথম রেন্ডার জবের সময় তৈরি হয়, প্রতিটা ভিডিও Artifact-এর সাথে আপলোড হয়
#   জব ১ 9:16 HD  শেষ → video-9x16-HD   │ জব ২ 9:16 4K শেষ → video-9x16-4K
#   জব ৩ 16:9 HD  শেষ → video-16x9-HD   │ জব ৪ 16:9 4K শেষ → video-16x9-4K
#   (যে জবগুলো orientation/quality ইনপুটে বাছা হয়নি সেগুলো বাদ; ক্রম সবসময় 9:16 HD → 9:16 4K → 16:9 HD → 16:9 4K)
#   ⚠️ প্রথম জব ব্যর্থ হলে (প্রকাশের ফাইল তখনো তৈরি হয়নি) পরের জবের Artifact-এ প্রকাশের ফাইল নাও থাকতে পারে।
#   (শুধু action = thumbnail_only হলে ভিডিও নেই, তাই থাম্বনেইল আলাদা Artifact: thumbnails)
#   একটা জব ব্যর্থ হলে আগে শেষ হওয়া জবের Artifact আগেই আপলোড হয়ে গেছে; বাকি জবগুলো তবু চলে, আর শেষে রান ❌ দেখায়।
#   render_and_release: সব জব সফল হলে তবেই শেষে GitHub Release (ব্যর্থ হলে Release হয় না)।
#
# 🎨 থিম (theme) — ৬টা:
#   emerald        = এমারেল্ড নাইট (স্থির)           │ navy = রয়্যাল নেভি (স্থির)
#   greenDayNight  = সবুজ Day & Night (সূর্য-চাঁদ, মেঘ, তারা, জোনাকি)
#   monsoon  (বর্ষা)  = ধূসর-সবুজ ভারী মেঘ + তির্যক বৃষ্টি + রাতে বিদ্যুৎ-ঝলক; জোনাকি সবুজাভ-নীল
#   winter   (শীত)   = কুয়াশার ভোর + ভেসে চলা কুয়াশা-স্তর + ঝিলমিল হিমকণা; গোধূলি গোলাপি-কমলা; জোনাকি বরফ-নীল
#   spring   (বসন্ত)  = গোলাপি-পিচ দিন, আগুন-রঙা গোধূলি + ঝরা পলাশ/কৃষ্ণচূড়ার পাপড়ি; রাত বেগুনি-গোলাপি; জোনাকি কমলা-সোনালি
#
# 🕒 সময়ের মোড (time_mode) — নতুন ইনপুট; প্রতিটা দিন-রাতের থিমে (greenDayNight, monsoon, winter, spring) কাজ করে:
#   dayToNight = দিন → গোধূলি → রাত; জোনাকি ধীরে ধীরে ফোটে 🌿✨ (ডিফল্ট — আগের মতোই)
#   day        = পুরো ভিডিও জুড়ে উজ্জ্বল দিন (জোনাকি প্রায় নেই)
#   night      = পুরো ভিডিও জুড়ে রাত — তারা + পূর্ণ জোনাকি
#   nightToDay = রাত → ভোর/গোধূলি → দিন; চাঁদ ডুবে সূর্য ওঠে (বাঁ দিক থেকে), তারা ও জোনাকি মিলিয়ে যায়
#   ⚠️ emerald / navy স্থির থিম — time_mode তাদের উপর কিছু বদলায় না। থাম্বনেইলেও মোড মানা হয় (ওপরে thumbnail_night দেখো)।
#
# নতুন zip আপলোড করেছো? zip_file ঘরে zip-এর নাম লেখো (যেমন HadisVideokit-part3.zip);
# workflow আগে zip খুলে ফাইল কমিট করবে, তারপর কাজ করবে। zip_file ফাঁকা = zip খোলা হবে না।
#
# ⚠️ এই ফাইলটা কিটের ভেতরের সব স্ক্রিপ্ট (scripts/*.mjs) ব্যবহার করে, তাই পরের Part-এ
#    এটা আর বদলাতে হবে না; শুধু zip আপডেট হবে।
#
# 🎣 হুক ও টিজার (নতুন ইনপুট):
#   hook_text    = ভিডিওর শুরুর বড় লেখা (ফাঁকা = src/constants.ts-এর HOOK_TEXT)
#   hook_seconds = হুক কত সেকেন্ড (ফাঁকা = অটো, hook.wav-এর দৈর্ঘ্য; সংখ্যা = অন্তত ততটা, অডিও কাটবে না;
#                  ০ = হুক বন্ধ)
#   teaser       = টিক থাকলে হুকের পরে অডিও টিজার (cold open): হাদিসের শক্তিশালী অংশ আগে বাজে, তারপর
#                  Intro → হাদিস শুরু থেকে। অংশটা আসে hadis<id>_timestamp.json-এর "teaser": {"start":..,"end":..} থেকে
#                  (JSON-এ না থাকলে টিজার হবে না)। টিক তুলে দিলে টিজার বন্ধ।
#   ক্রম: [ Hook ][ Teaser ][ Intro ][ Main ][ Outro ]
#
# 🖼️ থাম্বনেইল (নতুন ইনপুট):
#   thumbnail    = টিক থাকলে (ডিফল্ট) ভিডিওর পাশে 4K থাম্বনেইল: Hook + Teaser + Intro এক ছবিতে।
#                  ওরিয়েন্টেশন অনুযায়ী (9:16 → ২১৬০×৩৮৪০, 16:9 → ৩৮৪০×২১৬০), PNG + JPG; কোয়ালিটি ইনপুট যাই হোক সবসময় 4K।
#                  Artifacts: প্রতিটা ভিডিও Artifact-এর ভেতরে (thumbnail_only হলে আলাদা thumbnails); render_and_release হলে Release-এও যায়।
#   series       = সিরিজ নম্বর (যেমন 12 বা ১২) → থাম্বনেইলের ডান-উপরে "পর্ব ১২" ব্যাজ। ফাঁকা = ব্যাজ নেই। ভিডিওতে কিছু বদলায় না।
#   thumbnail_night = থাম্বনেইলের ব্যাকগ্রাউন্ডের দিন-রাত, ০ (দিন) থেকে ১ (রাত); ফাঁকা = থিমের ডিফল্ট।
#                  ⚠️ শুধু দিন-রাতের থিমে প্রভাব ফেলে (greenDayNight, monsoon, winter, spring; emerald/navy স্থির থিম)। যেমন 0 = উজ্জ্বল দিন, 0.5 = সোনালি গোধূলি, 0.9 = রাত + জোনাকি।
#                  ফাঁকা থাকলে time_mode অনুযায়ী ডিফল্ট: day → 0 (দিন), nightToDay → 0.4 (সোনালি ভোর), night / dayToNight → থিমের রাতের লুক (০.৮–০.৯)।
#
# 📝 প্রকাশের ফাইল (নতুন ইনপুট):
#   publish_files = টিক থাকলে (ডিফল্ট) ভিডিওর পাশে দুটো ফাইল:
#                   out/hadis<id>_publish.txt → ইউটিউব শিরোনাম (৩ বিকল্প) + বিবরণ + ট্যাগ + ফেসবুক ক্যাপশন + হ্যাশট্যাগ
#                   out/hadis<id>.srt         → সাবটাইটেল (ইউটিউব স্টুডিও → Subtitles → Upload file, With timing)
#                   Artifacts: প্রতিটা ভিডিও Artifact-এর ভেতরে; render_and_release হলে Release-এও যায়। হাদিসের লেখা JSON থেকে হুবহু — প্রকাশের আগে নিজে যাচাই করো।
#   app_link      = অ্যাপের লিংক (https://...); দিলে বিবরণ ও ক্যাপশনে বসে। ফাঁকা = লিংক ছাড়া লাইন।
#
# 🎵 ব্যাকগ্রাউন্ড মিউজিক + অডিও (নতুন ইনপুট):
#   background_music = ঐচ্ছিক। এই দুটোর যেকোনো একটা দেওয়া যায়:
#                   ১) সরাসরি ডাউনলোড লিংক (https://.../song.mp3) → ডাউনলোড + ffprobe যাচাই করে public/background1.<ext> নামে সেভ
#                      (আগের background1.* মুছে ওভাররাইট হয়, আর রিপোতেও কমিট হয় — পরের বার শুধু ফাইলের নাম দিলেই চলে)
#                   ২) public/ ফোল্ডারে থাকা ফাইলের নাম (যেমন background1.mp3) → ওই ফাইলই সরাসরি ব্যবহার; না থাকলে স্পষ্ট এরর
#                   ফাঁকা = ব্যাকগ্রাউন্ড মিউজিক ছাড়া, আগের মতোই। লিংক/ফাইল নষ্ট বা পড়া না গেলে ⚠️ দিয়ে মিউজিক ছাড়াই রেন্ডার চলে।
#   অডিও নিয়ম (সব রেন্ডার জবের ভিডিওতে; কোড scripts/lib/audioMix.mjs, FFmpeg):
#                   • ভয়েস সবসময় ≈ -14 LUFS (two-pass loudnorm; মিউজিক থাকুক বা না থাকুক)
#                   • মিউজিক খুব নরম (ভলিউম 0.08 ≈ ভয়েসের চেয়ে -22 dB নিচে; audioMix.mjs-এর `bgVolume`) + ভয়েস বাজলে আরও নেমে যায় (ducking)
#                   • মিউজিক ভিডিওর চেয়ে বড় হলে ছাঁটা (শেষে ফেড-আউট), ছোট হলে লুপ — ঠিক ভিডিওর দৈর্ঘ্য পর্যন্ত
#                   • ভিডিও স্ট্রিম কপি হয় (কোয়ালিটি অপরিবর্তিত), অডিও AAC 192k

on:
  workflow_dispatch:
    inputs:
      action:
        description: "কী করবে?"
        required: true
        default: "check"
        type: choice
        options:
          - check
          - render
          - render_and_release
          - thumbnail_only
      zip_file:
        description: "রিপোতে আপলোড করা zip-এর নাম (যেমন HadisVideokit-part3.zip)। ফাঁকা = zip খোলা হবে না"
        required: false
        default: ""
        type: string
      hadis_id:
        description: "ফাইলের কী (যেমন 0101 → hadis0101.wav)"
        required: false
        default: "0101"
        type: string
      hadis_bookname:
        description: "কিতাবের নাম (ভিডিওতে দেখাবে)"
        required: false
        default: "সহীহ বুখারী"
        type: string
      hadis_number:
        description: "হাদিস নম্বর (বাংলা সংখ্যায়, যেমন ১২৩)"
        required: false
        default: "১"
        type: string
      theme:
        description: "থিম (emerald/navy = স্থির; greenDayNight, monsoon = বর্ষা, winter = শীত, spring = বসন্ত = দিন-রাতের)"
        required: false
        default: "emerald"
        type: choice
        options:
          - emerald
          - navy
          - greenDayNight
          - monsoon
          - winter
          - spring
      time_mode:
        description: "সময়ের মোড (দিন-রাতের থিমে): dayToNight = দিন→রাত + জোনাকি | day = শুধু দিন | night = শুধু রাত | nightToDay = রাত→দিন। emerald/navy-তে প্রভাব নেই"
        required: false
        default: "dayToNight"
        type: choice
        options:
          - dayToNight
          - day
          - night
          - nightToDay
      orientation:
        description: "ওরিয়েন্টেশন"
        required: false
        default: "portrait"
        type: choice
        options:
          - portrait
          - landscape
          - both
      quality:
        description: "কোয়ালিটি"
        required: false
        default: "hd"
        type: choice
        options:
          - hd
          - 4k
          - both
      intro_seconds:
        description: "Intro কত সেকেন্ড"
        required: false
        default: ""
        type: string
      outro_seconds:
        description: "Outro কত সেকেন্ড"
        required: false
        default: ""
        type: string
      hook_text:
        description: "হুকের লেখা (ভিডিওর শুরুর বড় লেখা)। ফাঁকা = ডিফল্ট: এই হাদিসের ব্যাপারে কি আপনার জানা আছে?"
        required: false
        default: "এই হাদিসের ব্যাপারে আপনার জানা আছে কি?"
        type: string
      hook_seconds:
        description: "হুক কত সেকেন্ড। ফাঁকা = অটো (hook.wav-এর দৈর্ঘ্য), সংখ্যা = অন্তত ততটা, ০ = হুক বন্ধ"
        required: false
        default: ""
        type: string
      teaser:
        description: "অডিও টিজার (cold open): হুকের পরে হাদিসের শক্তিশালী অংশ আগে বাজবে (JSON-এ teaser থাকলে)"
        required: false
        default: true
        type: boolean
      thumbnail:
        description: "4K থাম্বনেইল (Hook + Teaser + Intro এক ছবিতে, PNG + JPG) বানাবে"
        required: false
        default: true
        type: boolean
      series:
        description: "সিরিজ নম্বর (যেমন 12 বা ১২) → থাম্বনেইলে 'পর্ব ১২' ব্যাজ। ফাঁকা = ব্যাজ নেই"
        required: false
        default: ""
        type: string
      thumbnail_night:
        description: "থাম্বনেইলের ব্যাকগ্রাউন্ড ০ (দিন) থেকে ১ (রাত), শুধু দিন-রাতের থিমে (greenDayNight/monsoon/winter/spring)। ফাঁকা = time_mode/থিমের ডিফল্ট"
        required: false
        default: ""
        type: string
      publish_files:
        description: "প্রকাশের ফাইল বানাবে: ইউটিউব/ফেসবুক ক্যাপশন-ট্যাগ (.txt) + সাবটাইটেল (.srt)"
        required: false
        default: true
        type: boolean
      app_link:
        description: "অ্যাপের লিংক (https://...) — বিবরণ/ক্যাপশনে বসবে। ফাঁকা = লিংক ছাড়া"
        required: false
        default: "https://play.google.com/store/apps/details?id=com.srizwan.islamipedia"
        type: string
      background_music:
        description: "ব্যাকগ্রাউন্ড মিউজিক (ঐচ্ছিক): সরাসরি ডাউনলোড লিংক (https://...) অথবা public/ ফোল্ডারের ফাইলের নাম (যেমন background1.mp3)। ফাঁকা = মিউজিক ছাড়া"
        required: false
        default: "background1.mp3"
        type: string

permissions:
  contents: write

concurrency:
  group: render-hadis
  cancel-in-progress: false

jobs:
  run:
    runs-on: ubuntu-24.04
    timeout-minutes: 350
    env:
      HADIS_ID: ${{ inputs.hadis_id }}
      HADIS_BOOKNAME: ${{ inputs.hadis_bookname }}
      HADIS_NUMBER: ${{ inputs.hadis_number }}
      THEME: ${{ inputs.theme }}
      TIME_MODE: ${{ inputs.time_mode }}
      ORIENTATION: ${{ inputs.orientation }}
      QUALITY: ${{ inputs.quality }}
      INTRO_SECONDS: ${{ inputs.intro_seconds }}
      OUTRO_SECONDS: ${{ inputs.outro_seconds }}
      HOOK_TEXT: ${{ inputs.hook_text }}
      HOOK_SECONDS: ${{ inputs.hook_seconds }}
      TEASER: ${{ inputs.teaser }}
      SERIES: ${{ inputs.series }}
      THUMB_NIGHT: ${{ inputs.thumbnail_night }}
      APP_LINK: ${{ inputs.app_link }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Unpack zip
        if: ${{ inputs.zip_file != '' }}
        env:
          ZIP_FILE: ${{ inputs.zip_file }}
        run: |
          set -euo pipefail

          if ! [[ "$ZIP_FILE" =~ ^[A-Za-z0-9._-]+\.zip$ ]]; then
            echo "::error::zip ফাইলের নাম ঠিক নেই। শুধু ইংরেজি অক্ষর, সংখ্যা, . - _ এবং শেষে .zip থাকতে হবে (ফোল্ডার পাথ নয়)।"
            exit 1
          fi
          if [ ! -f "$ZIP_FILE" ]; then
            echo "::error::'$ZIP_FILE' রিপোর রুটে পাওয়া যায়নি। আগে Add file → Upload files দিয়ে আপলোড করো।"
            exit 1
          fi

          # .github/workflows স্বয়ংক্রিয় আপডেট করা যায় না (GitHub অনুমতি দেয় না) → বাদ।
          # লোগো, badge ও public/ এর তোমার নিজের ফাইল কখনো ওভাররাইট হবে না।
          unzip -o -q "$ZIP_FILE" \
            -x ".github/workflows/*" "public/*" "src/logo.jpg" "src/google-play-badge.png" "__MACOSX/*" "*.DS_Store"
          unzip -n -q "$ZIP_FILE" "public/*" "src/logo.jpg" "src/google-play-badge.png" || true

          # zip-এর workflow ফাইল রিপোর সাথে মেলে কিনা দেখা
          {
            echo "### 🔧 Workflow ফাইল যাচাই"
            changed=0
            for f in $(unzip -Z1 "$ZIP_FILE" | grep -E '^\.github/workflows/.*\.ya?ml$' || true); do
              mkdir -p /tmp/wf && unzip -o -q "$ZIP_FILE" "$f" -d /tmp/wf
              if [ ! -f "$f" ] || ! diff -q "/tmp/wf/$f" "$f" > /dev/null; then
                echo "- ⚠️ \`$f\` নতুন/বদলেছে → GitHub-এ হাতে আপডেট করতে হবে (HadisVideokit.md দেখো)"
                changed=1
              fi
            done
            if [ "$changed" = "0" ]; then echo "- ✅ workflow ফাইল আপ-টু-ডেট"; fi
          } >> "$GITHUB_STEP_SUMMARY"

          rm -f "$ZIP_FILE"
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add -A
          if git diff --cached --quiet; then
            echo "কোনো পরিবর্তন নেই।"
          else
            git commit -q -m "chore: unpack $ZIP_FILE"
            git push
          fi

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci --no-audit --no-fund

      - name: Typecheck
        run: npm run typecheck

      - name: Install Chrome system libraries
        run: |
          sudo apt-get update -y
          sudo apt-get install -y --no-install-recommends \
            libnss3 libdbus-1-3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 \
            libgbm1 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
            libasound2t64 libpango-1.0-0 libcairo2

      # ---------- action = check ----------
      - name: Bundle & render check images
        if: ${{ inputs.action == 'check' }}
        run: npm run check

      - name: Upload check images
        if: ${{ always() && inputs.action == 'check' }}
        uses: actions/upload-artifact@v4
        with:
          name: check-images
          path: out/*.png
          if-no-files-found: warn
          retention-days: 7

      # ---------- 🎵 অডিও: FFmpeg + ব্যাকগ্রাউন্ড মিউজিক (শুধু render / render_and_release) ----------
      # FFmpeg: ভয়েস -14 LUFS (loudnorm), মিউজিক ducking (sidechaincompress), লুপ/ট্রিম — scripts/lib/audioMix.mjs
      - name: Install FFmpeg (audio mixing)
        if: ${{ startsWith(inputs.action, 'render') }}
        run: |
          sudo apt-get install -y --no-install-recommends ffmpeg
          ffmpeg -version | head -n 1

      # background_music ফাঁকা হলে কিছুই করে না (মিউজিক ছাড়া রেন্ডার)। লিংক হলে ডাউনলোড → public/background1.<ext>; ফাইলের নাম হলে public/ থেকে।
      # সফল হলে BG_MUSIC_FILE (ও BG_MUSIC_DOWNLOADED) পরের স্টেপগুলোর জন্য সেট হয়। ডাউনলোড/যাচাই ব্যর্থ = ⚠️, মিউজিক ছাড়াই চলবে।
      - name: Prepare background music
        id: bgmusic
        if: ${{ startsWith(inputs.action, 'render') }}
        env:
          BACKGROUND_MUSIC: ${{ inputs.background_music }}
        run: node scripts/prepare-bgmusic.mjs

      # ডাউনলোড করা হলে ফাইলটা রিপোতেও রাখি, যাতে পরের বার শুধু নাম (background1.mp3) দিলেই চলে। ব্যর্থ হলে রেন্ডার থামে না।
      - name: Save background music to repo (public/background1.*)
        if: ${{ startsWith(inputs.action, 'render') && env.BG_MUSIC_DOWNLOADED == 'true' }}
        continue-on-error: true
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add -A -- 'public/background1.*'
          if git diff --cached --quiet; then
            echo "background1 অপরিবর্তিত — কমিট লাগবে না।"
          else
            git commit -q -m "chore: save background music (public/background1)"
            git push || { git pull --rebase && git push; }
          fi

      # ---------- action = render / render_and_release / thumbnail_only ----------
      # একটাই সহায়ক স্ক্রিপ্ট সব `node scripts/render.mjs` কল বানায় (আর্গুমেন্ট এক জায়গায়): bash render-helper.sh <orientation> <quality> <thumbnail> <publish_files> <thumbnail_only>
      - name: Prepare render helper
        if: ${{ startsWith(inputs.action, 'render') || inputs.action == 'thumbnail_only' }}
        run: |
          cat > "$RUNNER_TEMP/render-helper.sh" <<'HELPER_EOF'
          #!/usr/bin/env bash
          set -euo pipefail
          ORI="$1"
          QUAL="$2"
          THUMB="$3"
          PUB="$4"
          THUMB_ONLY="$5"
          node scripts/render.mjs \
            --id "$HADIS_ID" \
            --book "$HADIS_BOOKNAME" \
            --number "$HADIS_NUMBER" \
            --theme "$THEME" \
            --time-mode "$TIME_MODE" \
            --orientation "$ORI" \
            --quality "$QUAL" \
            --intro "$INTRO_SECONDS" \
            --outro "$OUTRO_SECONDS" \
            --hook-text "$HOOK_TEXT" \
            --hook-seconds "$HOOK_SECONDS" \
            --teaser "$TEASER" \
            --thumbnail "$THUMB" \
            --thumbnail-only "$THUMB_ONLY" \
            --series "$SERIES" \
            --thumb-night "$THUMB_NIGHT" \
            --publish-files "$PUB" \
            --app-link "$APP_LINK"
          HELPER_EOF
          chmod +x "$RUNNER_TEMP/render-helper.sh"

      # ---------- থাম্বনেইল (আগে, দ্রুত; ভিডিও জবের আগেই আপলোড) ----------
      - name: Render thumbnails
        id: thumbs
        continue-on-error: true
        if: ${{ (startsWith(inputs.action, 'render') && inputs.thumbnail) || inputs.action == 'thumbnail_only' }}
        run: bash "$RUNNER_TEMP/render-helper.sh" "$ORIENTATION" "$QUALITY" true false true

      # শুধু thumbnail_only-তে আলাদা Artifact। render / render_and_release-এ থাম্বনেইল প্রতিটা ভিডিও Artifact-এর ভেতরে যায়।
      - name: Upload thumbnails
        if: ${{ !cancelled() && inputs.action == 'thumbnail_only' && steps.thumbs.outcome == 'success' }}
        uses: actions/upload-artifact@v4
        with:
          name: thumbnails
          path: |
            out/*_thumbnail_*.png
            out/*_thumbnail_*.jpg
          if-no-files-found: warn
          retention-days: 7

      # ---------- ভিডিও জব: প্রতিটা শেষ হলেই আপলোড (ক্রম = render.mjs-এর ক্রম) ----------
      # প্রকাশের ফাইল (txt + srt) শুধু প্রথম জবে বানানো হয় (বাকিগুলোতে `false`), কিন্তু out/-এ থেকে যায় — তাই প্রতিটা ভিডিও Artifact-এ
# ভিডিওর সাথে থাম্বনেইল + প্রকাশের ফাইলও একসাথে আপলোড হয় (আলাদা Artifact নেই)।
      # জব 1: 9x16 HD
      - name: Render 9x16 HD
        id: job_p_hd
        continue-on-error: true
        if: ${{ !cancelled() && startsWith(inputs.action, 'render') && (inputs.orientation != 'landscape' && inputs.quality != '4k') }}
        run: bash "$RUNNER_TEMP/render-helper.sh" portrait hd false "${{ inputs.publish_files }}" false

      - name: Upload 9x16 HD video
        if: ${{ !cancelled() && steps.job_p_hd.outcome == 'success' }}
        uses: actions/upload-artifact@v4
        with:
          name: video-9x16-HD
          path: |
            out/*_9x16_HD.mp4
            out/*_thumbnail_*.png
            out/*_thumbnail_*.jpg
            out/hadis*_publish.txt
            out/hadis*.srt
          if-no-files-found: error
          retention-days: 7
          compression-level: 0

      # জব 2: 9x16 4K
      - name: Render 9x16 4K
        id: job_p_4k
        continue-on-error: true
        if: ${{ !cancelled() && startsWith(inputs.action, 'render') && (inputs.orientation != 'landscape' && inputs.quality != 'hd') }}
        run: bash "$RUNNER_TEMP/render-helper.sh" portrait 4k false "${{ inputs.publish_files && inputs.quality == '4k' }}" false

      - name: Upload 9x16 4K video
        if: ${{ !cancelled() && steps.job_p_4k.outcome == 'success' }}
        uses: actions/upload-artifact@v4
        with:
          name: video-9x16-4K
          path: |
            out/*_9x16_4K.mp4
            out/*_thumbnail_*.png
            out/*_thumbnail_*.jpg
            out/hadis*_publish.txt
            out/hadis*.srt
          if-no-files-found: error
          retention-days: 7
          compression-level: 0

      # জব 3: 16x9 HD
      - name: Render 16x9 HD
        id: job_l_hd
        continue-on-error: true
        if: ${{ !cancelled() && startsWith(inputs.action, 'render') && (inputs.orientation != 'portrait' && inputs.quality != '4k') }}
        run: bash "$RUNNER_TEMP/render-helper.sh" landscape hd false "${{ inputs.publish_files && inputs.orientation == 'landscape' }}" false

      - name: Upload 16x9 HD video
        if: ${{ !cancelled() && steps.job_l_hd.outcome == 'success' }}
        uses: actions/upload-artifact@v4
        with:
          name: video-16x9-HD
          path: |
            out/*_16x9_HD.mp4
            out/*_thumbnail_*.png
            out/*_thumbnail_*.jpg
            out/hadis*_publish.txt
            out/hadis*.srt
          if-no-files-found: error
          retention-days: 7
          compression-level: 0

      # জব 4: 16x9 4K
      - name: Render 16x9 4K
        id: job_l_4k
        continue-on-error: true
        if: ${{ !cancelled() && startsWith(inputs.action, 'render') && (inputs.orientation != 'portrait' && inputs.quality != 'hd') }}
        run: bash "$RUNNER_TEMP/render-helper.sh" landscape 4k false "${{ inputs.publish_files && inputs.orientation == 'landscape' && inputs.quality == '4k' }}" false

      - name: Upload 16x9 4K video
        if: ${{ !cancelled() && steps.job_l_4k.outcome == 'success' }}
        uses: actions/upload-artifact@v4
        with:
          name: video-16x9-4K
          path: |
            out/*_16x9_4K.mp4
            out/*_thumbnail_*.png
            out/*_thumbnail_*.jpg
            out/hadis*_publish.txt
            out/hadis*.srt
          if-no-files-found: error
          retention-days: 7
          compression-level: 0

      - name: List rendered files
        if: ${{ !cancelled() && (startsWith(inputs.action, 'render') || inputs.action == 'thumbnail_only') }}
        run: |
          {
            if ls out/*.mp4 > /dev/null 2>&1; then
              echo "### 🎬 রেন্ডার হওয়া ভিডিও"
              ls -lh out/*.mp4 | awk '{print "- `" $9 "` — " $5}'
            fi
            if ls out/*_thumbnail_* > /dev/null 2>&1; then
              echo ""
              echo "### 🖼️ থাম্বনেইল (4K)"
              ls -lh out/*_thumbnail_* | awk '{print "- `" $9 "` — " $5}'
            fi
            if ls out/*_publish.txt out/*.srt > /dev/null 2>&1; then
              echo ""
              echo "### 📝 প্রকাশের ফাইল (ক্যাপশন/ট্যাগ + সাবটাইটেল)"
              ls -lh out/*_publish.txt out/*.srt 2>/dev/null | awk '{print "- `" $9 "` — " $5}'
            fi
          } >> "$GITHUB_STEP_SUMMARY"

      # কোনো জব ব্যর্থ হলে রান ❌ (জবগুলো `continue-on-error`-এ চলে যাতে আগের শেষ হওয়া জবের Artifact আগেই আপলোড হয়); Release-ও তখন হয় না
      - name: Check render results
        if: ${{ !cancelled() && (startsWith(inputs.action, 'render') || inputs.action == 'thumbnail_only') }}
        env:
          R_THUMBS: ${{ steps.thumbs.outcome }}
          R_P_HD: ${{ steps.job_p_hd.outcome }}
          R_P_4K: ${{ steps.job_p_4k.outcome }}
          R_L_HD: ${{ steps.job_l_hd.outcome }}
          R_L_4K: ${{ steps.job_l_4k.outcome }}
        run: |
          failed=0
          for pair in "থাম্বনেইল=$R_THUMBS" "9:16 HD=$R_P_HD" "9:16 4K=$R_P_4K" "16:9 HD=$R_L_HD" "16:9 4K=$R_L_4K"; do
            name="${pair%%=*}"; outcome="${pair#*=}"
            if [ "$outcome" = "failure" ]; then
              echo "::error::জব ব্যর্থ: $name"
              failed=1
            fi
          done
          if [ "$failed" = "1" ]; then
            echo "যে জবগুলো শেষ হয়েছিল তাদের Artifact আগেই আপলোড হয়ে গেছে। ব্যর্থ জবের কারণ ওপরের স্টেপের লগে।"
            exit 1
          fi
          echo "✅ সব জব সফল।"

      # background_music-এ দেওয়া ফাইলের নাম public/-এ না পাওয়া গেলে: ভিডিও (মিউজিক ছাড়া) তৈরি হয়ে Artifact-এ উঠে গেছে,
      # কিন্তু রান ❌ দেখায় ও Release হয় না — নাম ঠিক করে (বা লিংক দিয়ে) আবার চালাও।
      - name: Fail if background music file was not found
        if: ${{ !cancelled() && env.BG_MUSIC_ERROR != '' }}
        run: |
          echo "::error::$BG_MUSIC_ERROR"
          echo "ভিডিওগুলো ব্যাকগ্রাউন্ড মিউজিক ছাড়া তৈরি হয়েছে। ফাইলের নাম ঠিক করে আবার চালাও।"
          exit 1

      - name: Create GitHub Release
        if: ${{ inputs.action == 'render_and_release' }}
        env:
          GH_TOKEN: ${{ github.token }}
          HADIS_ID: ${{ inputs.hadis_id }}
          HADIS_BOOKNAME: ${{ inputs.hadis_bookname }}
          HADIS_NUMBER: ${{ inputs.hadis_number }}
          RUN_NUMBER: ${{ github.run_number }}
        run: |
          TAG="hadis${HADIS_ID}-run${RUN_NUMBER}"
          shopt -s nullglob
          FILES=(out/*.mp4 out/*_thumbnail_*.png out/*_thumbnail_*.jpg out/hadis*_publish.txt out/hadis*.srt)
          gh release create "$TAG" "${FILES[@]}" \
            --title "${HADIS_BOOKNAME} নং : ${HADIS_NUMBER}" \
            --notes "ইসলামী বিশ্বকোষ ও আল হাদিস S2 — hadis${HADIS_ID}"
```

> ℹ️ Only the comments above are translated. Descriptions, error messages and the Release title inside the YAML stay in Bengali so that the file is identical to the one already in your repo.
> 🧪 The Chrome-library install step could not be run in my environment (browser download blocked), so your first run is its real test. If it fails, copy the red text and send it.
> 📌 **Contract with Part 14:** the workflow passes exactly `--id --book --number --theme --orientation --quality --intro --outro` (all as strings; the numbers/seconds may be empty or have English/Bengali digits), expects videos at `out/*.mp4` (`if-no-files-found: error`), and a non-zero exit code on any error.

---

## ✅ Progress tracker

| Part | Topic | Status |
|---|---|---|
| 1 | Project setup and config | ✅ |
| 2 | Types, constants, Zod schema + mobile verify workflow | ✅ |
| 3 | 3 themes and fonts + unified `render.yml` | ✅ |
| **+** | **Add-on (after Part 14): 3 season themes (`monsoon`, `winter`, `spring`) + `time_mode` workflow input (`day` / `night` / `dayToNight` / `nightToDay`)** | ✅ Done — logic cases pass in plain Node (106/106 in `test-render-plan.mjs`); first real browser render = your GitHub run |
| 4 | Bengali digits and input normalizer | ✅ |
| 5 | Data loader and calculateMetadata | ✅ |
| 6 | Layout + background (with fireflies) | ✅ |
| 7 | Logo and header | ✅ |
| 8 | Intro scene | ✅ |
| 9A–9L | Animated SVG stage (sanitize, sync, load, `AnimatedSvg`, picker, inventory, `FallbackSvg`, `SvgStage`, cross-fade) | ✅ |
| 10 | Animated colorful caption | ✅ |
| 11 | Audio and SFX engine | ✅ |
| 12A–12E | Outro scene: `outroPlan.ts`, `PlayBadge.tsx`, `OutroScene.tsx`, `OutroPreview` | ✅ |
| 13A–13C | `MainScene.tsx`, `HadisVideo.tsx` + final `Root.tsx`, `HadisVideoPreview` + sample SFX | ✅ |
| **14A** | `scripts/lib/renderPlan.mjs`: argument parsing, validation, job list, output names, file pre-checks, `--dry-run` + pure cases | ✅ Done — `renderPlan.mjs` ✅ · `test-render-plan.mjs` ✅ (65 cases) |
| **14B** | `scripts/render.mjs`: the real bundle + `selectComposition` + `renderMedia` loop (HD/4K, both orientations, concurrency/crf, errors, progress) | ✅ Done — flow proven with stand-in modules; first real render = your GitHub run |
| **14C** | `AI_PROMPTS.md` (3 prompts) + `README.md` (usage) | 🔄 In progress — `AI_PROMPTS.md` ✅ · `README.md` ⬜ |
| 15 | Final end-to-end test and README (troubleshooting, time estimates) | ⬜ Pending |

> When a Part (or sub-part) finishes, ⬜ becomes ✅ and a short "done note" is added at the end of that Part.

---

## 🧭 Step 0: Core decisions of the kit (all Parts follow these)

### Video structure

| Section | Time | Contents |
|---|---|---|
| **Intro** | 3 seconds (changeable) | Round logo, "ইসলামী বিশ্বকোষ ও আল হাদিস S2", "আজকের হাদিস", "(book name) নং : (number)" |
| **Main** | Length of the `.wav` | Top: logo + app name + Today's Hadith + book/number. Middle: Animated SVG. Bottom: Animated colorful caption. Audio + SFX |
| **Outro** | 4 seconds (changeable) | "আজই প্লে স্টোর থেকে ইনস্টল করুন:" + round logo + app name + animated Google Play badge |

### Format and resolution

Compositions are always designed at the base size; for 4K Remotion's `--scale 2` enlarges them (one code base, design never breaks).

| Orientation | Base (HD) | 4K (scale=2) |
|---|---|---|
| 9:16 (Portrait) | 1080 × 1920 | 2160 × 3840 |
| 16:9 (Landscape) | 1920 × 1080 | 3840 × 2160 |

FPS = **30**.

### GitHub Actions inputs (core decision)

| Input | Example | Purpose |
|---|---|---|
| `action` | `check` / `render` / `render_and_release` | What to do |
| `zip_file` | `HadisVideokit-part3.zip` | Unzip a new zip (empty = do not unzip) |
| `hadis_id` | `0101` | **Only for finding files** → `hadis0101.wav`, `hadis0101_timestamp.json` |
| `hadis_bookname` | `সহীহ বুখারী` | Book name shown in the video |
| `hadis_number` | `১২৩` | Hadith number (Bengali digits; English digits are converted by the code) |
| `theme` | `emerald` / `navy` / `greenDayNight` / `monsoon` / `winter` / `spring` | Theme |
| `time_mode` | `dayToNight` (default) / `day` / `night` / `nightToDay` | Time of day for the day-night themes (`greenDayNight`, `monsoon`, `winter`, `spring`); no effect on `emerald` / `navy` |
| `orientation` | `portrait` / `landscape` / `both` | 9:16 / 16:9 |
| `quality` | `hd` / `4k` / `both` | Resolution |
| `intro_seconds` / `outro_seconds` | `3` / `4` | Intro and Outro duration |

The table lists the core inputs only; the real `render.yml` now has **20 inputs** (GitHub allows up to 25). The video shows **"সহীহ বুখারী নং : ১২৩"**. **One hadith per run** (run separately for several).

### File naming rule

```
hadis<hadis_id>.wav
hadis<hadis_id>_timestamp.json
Example: hadis0101.wav, hadis0101_timestamp.json
```
The code does not analyse the meaning of `hadis_id`; it is only a key to match file names.

### Repo structure (final)

```
hadis-videokit/
├─ .github/workflows/render.yml   # the one workflow (unzip + verify + render + Release)
├─ public/                        # Remotion staticFile() reads from here
│  ├─ hadis/
│  │  ├─ hadis0101.wav, hadis0101_timestamp.json
│  │  ├─ hadis0000.wav (6 s silent sample) + hadis0000_timestamp.json   # for verification, may be deleted
│  │  ├─ hadis0000same_timestamp.json   # dev sample (cross-fade cells); may be deleted with hadis0000
│  │  └─ hadis0000gap_timestamp.json    # dev sample (gap + tail); may be deleted with hadis0000
│  ├─ svg/                        # svg1.svg, svg2.svg (samples), svg3.svg ...
│  ├─ audio/                      # hook.wav (opening question voice, optional), intro.wav, outro.wav — Hook/Intro/Outro voice (audio only, no captions)
│  └─ sfx/                        # whoosh.mp3 (sample, synthetic 0.9 s; replace with your own), pop.mp3, chime.mp3 ...
├─ src/
│  ├─ logo.jpg, google-play-badge.png (1600×474), index.ts, Root.tsx, HadisVideo.tsx
│  ├─ types.ts, constants.ts, themes.ts, fonts.ts, assets.d.ts
│  ├─ lib/        # dayNight, sky, useNightFactor, bnDigits, displayText, loadHadis, timing, useLayout, fitText,
│  │              # useSfxSrc, introOutroAudio, useIntroOutroAudio, svgSanitize, svgSync, svgLoad, svgPicker, svgInventory, svgStage, svgTransition,
│  │              # captionWords (+ paging, safe clamp), audioPlan, outroPlan, sceneFade
│  ├─ components/ # Background(+DayNightSky, Fireflies), Header, Logo, Ribbon, FitText, AnimatedSvg, FallbackSvg,
│  │              # SvgStage, Caption, HadisAudio, SfxPlayer, IntroOutroAudio, PlayBadge
│  ├─ scenes/     # IntroScene, MainScene, OutroScene
│  └─ dev/        # *Preview / *Check images + pure *Cases files (ThemePreview, DataCheck, BackgroundPreview,
│                 # HeaderPreview, IntroPreview, SvgSanitizeCheck, SvgSyncPreview, AnimatedSvgPreview, SvgPickerCheck,
│                 # SvgInventoryCheck, SvgStagePreview, CaptionPreview, AudioPreview, AudioSmoke, OutroPreview,
│                 # MainSceneCheck, HadisVideoPreview)
├─ scripts/
│  ├─ check.mjs                   # verification (render images) — done
│  ├─ render.mjs                  # real render — Part 14B ✅ (replaced the stub)
│  ├─ lib/renderPlan.mjs          # pure arguments/jobs/names maths — Part 14A, file 1 ✅
│  └─ test-render-plan.mjs        # pure cases for renderPlan.mjs — Part 14A, file 2 ✅
├─ AI_PROMPTS.md                  # Part 14C, file 1 ✅
├─ remotion.config.ts, package.json, tsconfig.json
└─ README.md                      # Part 14C, finished in Part 15
```

> You wanted SVGs under `svg/svg1…`. In Remotion static files must live in `public/`, so the path is `public/svg/svg1.svg`.

### Timestamp JSON schema (tell the AI to produce exactly this format)

Book name/number are **not** here (they come from the workflow inputs).

```json
{
  "language": "bn",
  "teaser": { "start": 12.4, "end": 17.9 },
  "segments": [
    {
      "id": 1,
      "start": 0.0,
      "end": 3.4,
      "text": "নিশ্চয়ই সকল আমল নিয়তের উপর নির্ভরশীল",
      "words": [
        { "word": "নিশ্চয়ই", "start": 0.0, "end": 0.7 },
        { "word": "সকল", "start": 0.7, "end": 1.1 }
      ],
      "svg": "svg1",
      "sfx": { "name": "whoosh", "volume": 0.6 }
    }
  ]
}
```

Rules:
- `start`/`end` are in seconds, measured **from the start of the `.wav`** (the code adds the Intro offset itself).
- `words` is optional (if absent, the segment time is split equally). `svg` optional (if absent, svgs rotate serially). `sfx` optional.
- Keep a segment under **~25 words** (longer text is clipped with "…" at the minimum font).
- `teaser` is optional (v2.56): `{ "start", "end", "text"? }` in seconds from the start of the hadith `.wav` — the strongest phrase, played first (cold open) after the Hook. No `teaser` = no Teaser. The segments still cover the whole hadith. Clamp rules: `start < 0 → 0`; `end > wav → wav length`; length `> 12 s → start + 12 s`; length `< 0.5 s` (or start beyond the wav) → ignored with a console warning; optional `text` is only a fallback.

### Animated SVG rules (very important)

Remotion renders frame by frame, so ordinary CSS/SMIL animation may not play correctly. Solution (built in Part 9): inline the SVG and set the time on every frame with the **Web Animations API + SMIL `setCurrentTime`**. Conditions for the SVG you ask the AI to make:
- `viewBox="0 0 1000 1000"`, background **transparent**
- Animation only by **CSS `@keyframes`** or **SMIL** (`<animate>`, `<animateTransform>`, `<animateMotion>`, `<set>`)
- **No `<script>`, no external image/font, no `on…=` attributes**
- Loop length 2–6 s, `infinite`/`repeatCount="indefinite"`, durations that divide the loop length (2, 3, 6 s)
- SMIL must be **time based** (`begin="0s"`, `begin="-2s"`, `begin="id.end"`); never `click`/`indefinite`/`accessKey`
- Style with **classes/ids only — no bare element selectors** (`circle{…}` leaks to other inline SVGs); ids/keyframe names written inside the SVG only (the code prefixes them)
- File names `svg1.svg`, `svg2.svg`… (any `[A-Za-z0-9_-]+.svg` works; numbered ones rotate first; without gaps — the render-time probe stops at the first missing number)
- Colours visible on all 3 themes: white/golden/bright green-teal; avoid pure black
- **Islamic etiquette: no faces of animals/humans** — symbolic, geometric, nature, object-based drawings

---

## 🎨 Themes

| ID | Name | Background | Specialty |
|---|---|---|---|
| `emerald` | Emerald Night | Dark green gradient | Golden accent, faint geometric pattern |
| `navy` | Royal Navy | Dark blue-violet gradient | Sky-blue/white accent, slow star particles |
| `greenDayNight` | Green Day & Night | Green sky, day → evening → night | **Firefly animation** 🌿✨ |
| `monsoon` | Monsoon · বর্ষা — বৃষ্টির মেঘ | Heavy grey-green clouds, wet green hills | Slanted **rain** + **lightning** (soft, at most once per ~3.7 s, stronger at night), teal-green fireflies |
| `winter` | Winter · শীত — কুয়াশার ভোর | Pale icy morning → rose-orange dusk → deep indigo night | Drifting **fog layers** + sparkling **frost dust**, many crisp stars, ice-blue fireflies |
| `spring` | Spring · বসন্ত — ফুলের পাপড়ি | Peach-pink day → fiery palash dusk → plum night | Falling **palash / krishnachura petals** (sway, spin, flip), orange-gold fireflies |

`greenDayNight`: Intro = morning (soft sun, rays, clouds, very few fireflies) → Main slowly afternoon → dusk → night (`progress = frame / mainFrames`; sun sinks, moon + stars appear, fireflies increase) → Outro = deep night, full moon, twinkling stars, most/brightest fireflies. ~32 fireflies with fixed `random(seed)` positions (same every render), almost invisible by day. Text always sits on a semi-transparent dark panel, so reading is never hard.

**Season themes (add-on, version 2.58)** — three more day-night themes, each unique like the six seasons of Bangladesh (Monsoon · Winter · Spring; Summer, Late-autumn and Autumn are free slots for later). They are built on the same sky as `greenDayNight` (`src/components/DayNightSky.tsx`: sun, moon, stars, clouds, hills) and add a season effect on top (`src/components/SeasonEffects.tsx`: rain + lightning / fog + frost dust / falling petals) and their own fireflies. All values come from `scenery` in `src/themes.ts` (`hills`, `starCount`, `cloudCount`, `cloudDayOpacity`, `cloudNightOpacity`, `sunStrength`, `moonStrength`, `effect`); `greenDayNight` has no `effect` and its values equal the old hard-coded ones. Every palette keeps text on a dark panel (worst text/panel contrast ratio 9.15 : 1, checked for all four day-night themes over `nightFactor` 0…1).

**Time mode (`time_mode` → prop `timeMode` → `timing.timeMode`)** — works for every day-night theme; `emerald` / `navy` are static and ignore it:

| `time_mode` | `nightFactor` over the video | What you see |
|---|---|---|
| `dayToNight` (default) | 0 in Hook/Teaser/Intro → 0.95 at end of Main → 1 in Outro (exactly the old behaviour; prop omitted) | Bright day → dusk → night; fireflies appear one by one 🌿✨ |
| `day` | always 0 | Bright day, (almost) no fireflies |
| `night` | always 1 | Stars + all fireflies the whole video |
| `nightToDay` | `1 − dayToNight` → 1 in Intro … 0.05 at end of Main → 0 in Outro | Night → dawn → day; the moon sets on the right, the sun rises from the left (sun/moon x mirrored via `DayNightSky mirror`), stars and fireflies fade out |

Where it flows: `computeNightFactor({..., timeMode})` in `src/lib/dayNight.ts`; `Timing.timeMode` (optional, added only when given — timings without it are unchanged) is set by `HadisVideo` through `timingFromConfig`, so `Background`, `Caption`, `Header`, `SvgStage`, `Intro`/`Outro`/`Hook`/`Teaser` and `ProgressBar` all see the same `nightFactor`. Thumbnail: `ThumbnailScene` default `nightFactor` = `thumbnail_night` if given, else `day` → 0, `nightToDay` → 0.4 (golden dawn), else the theme default `THUMBNAIL_NIGHT_BY_THEME` (monsoon 0.9, winter 0.9, spring 0.8). Script side: `--time-mode` in `scripts/lib/renderPlan.mjs` (`TIME_MODES`, `DEFAULT_TIME_MODE`; `dayToNight` is not put into `inputProps`, so existing props stay byte-for-byte the same).

---

## ✅ Parts 1–8 — Done (what later Parts need)

> No new packages after Part 2; `render.yml`/`package.json` unchanged by Parts 3–13.

**Part 1 — setup.** `package.json` (`"type": "module"`), `tsconfig.json`, `remotion.config.ts` (jpeg, h264, overwrite), `.gitignore`, `src/index.ts`, `src/assets.d.ts`. Pinned: `remotion` + all `@remotion/*` = `4.0.541`; `react`/`react-dom` = `19.2.3`; `zod` = `4.3.6`; `typescript` = `5.9.3`. Scripts: `dev`, `render`, `typecheck`, `upgrade`, `check`.

**Part 2 — types/constants/mobile verify.** `constants.ts`: `FPS=30`; `THEME_IDS`, `ORIENTATIONS`, `QUALITIES`; `BASE_SIZES`; `QUALITY_SCALE` (hd=1, 4k=2); output labels (`9x16`/`16x9`, `HD`/`4K`); default intro 3 s / outro 4 s (max 15 s); `TRANSITION_FRAMES=12`; Bengali texts (`APP_NAME`, `TAGLINE`, `OUTRO_TEXT`, `NUMBER_LABEL`); path helpers `hadisAudioPath`, `hadisTimestampPath`, `svgPath`, `sfxPath`; `VOICE_VOLUME=1`, `DEFAULT_SFX_VOLUME=0.4`. `types.ts`: `hadisVideoSchema`/`HadisVideoProps` (`hadisId`, `hadisBookname`, `hadisNumber`, `theme`, `orientation`, `introSeconds`, `outroSeconds`), `defaultHadisProps`, timestamp schemas, `parseTimestampFile()` (Bengali error where/what). `hadisId` and SFX names allow only English letters, digits, `-`, `_`. `scripts/check.mjs` (`npm run check`): bundle → every composition → `out/check-<ID>.png` → Summary; picks up new compositions itself; a `[HADIS_DATA]` error from `selectComposition` is listed as "⚠️ skipped" (run stays green), code bugs are ❌.

**Part 3 — themes/fonts/`render.yml`.** `themes.ts` (`THEMES`, `getTheme`, `getThemeColors(themeId, nightFactor)`, `skyGradient`; 6 `captionColors` per theme; `greenDayNight` has `scenery` + `dusk` set), `dayNight.ts` (`computeNightFactor`: Intro 0, rises through Main to 0.95, 1 within the first 15 Outro frames), `fonts.ts` (Baloo Da 2 titles = `FONT_DISPLAY`, Hind Siliguri body = `FONT_BODY`; `bengali` + `latin` subsets; `loadFont()`), `ThemePreview`. All text on the dark `panelBg` panel.

**Part 4 — Bengali digits.** `toBnDigits`, `cleanText` (removes invisible characters, keeps ZWJ/ZWNJ), `normalizeBookname`, `normalizeHadisNumber`, `buildHadisLabel(bookname, number)` → `"সহীহ বুখারী নং : ১২৩"`. Header and Intro both use it, so **`render.mjs` may pass the raw strings**.

**Part 5 — data loader.** `loadHadis.ts`: `loadTimestamp`, `loadAudioSeconds`, `loadHadis`, **`calculateHadisMetadata`** (total frames + `width/height` at base HD), `useHadisTimestamp`, `HadisDataError` (message starts `[HADIS_DATA]`, includes the path searched). `timing.ts`: `computeTiming`, `timingFromConfig`, `buildFrameSegments`, `findActiveSegment`, `splitWords`, `secondsToFrames`. Total = `(intro + wav + outro) × 30`; Main = `ceil(wav × 30)` min 1; segments beyond the WAV are trimmed + warning. Sample `hadis0000.wav` (6 s) + JSON.

**Part 6 — layout + background.** `useLayout()` / `computeLayout(width, height)`: Portrait top margin 3.5 % | header 18 % | SVG 43 % (826×826) | caption 24 % | bottom safe 8.5 %; Landscape: thin header 15 %, SVG left 768×768, caption right; `unit = min(w,h)/1080` (4K exactly 2×). `useNightFactor(timing, frameOffset?)`; `Background theme timing`; all animation from `useCurrentFrame()` + `random(seed)`.

**Part 7 — logo/header.** `Logo`, `Header theme bookname number timing frameOffset`, `FitText` (+ `fitText.ts`; shrink → two lines → "…"). **Bengali top-clipping fix (14C-fix):** `FitText` keeps `0.34em` top / `0.2em` bottom padding inside its `overflow: hidden` box (cancelled by equal negative margins, so layout is unchanged) — Bengali matra / ই-kar / reph rise above the line box and used to be cut. Never put a tight `overflow: hidden` (or `clip-path`) directly around Bengali text without that room. `frameOffset` is essential inside Main (day/night colours).

**Part 8 — Intro scene.** `IntroScene theme bookname number timing` (90-frame sequence compressed/held, last 12 frames fade-out, SFX `whoosh` frame 0 + `chime` frame 48, volume 0.4), `Ribbon`, `splitAppName()`, `useSfxSrc(name)` (`.mp3` then `.wav`, missing → `null` + one warning, no crash). `introSeconds = 0` draws nothing.

### 👁️ Your own visual checks (run `action = check`, then Artifacts → `check-images`)

> If a header is not all ✅, copy the red text/row and send it.

| Image | Header / what to look for |
|---|---|
| first `check` run | Green ✅ (Chrome-library step is tested only on GitHub) |
| `check-ThemePreview.png` | Bengali conjuncts unbroken, readable in all 5 panels |
| `check-DataCheck.png` | 1080×1920, 390 frames = 13.00 s, 3 segments, Bengali correct |
| `check-BackgroundPreview.png` | 6 Portrait + 4 Landscape tiles; coloured boxes; fireflies/moon/sun correct |
| `check-HeaderPreview.png` / `check-IntroPreview.png` | logo round, text clear, long names inside |
| `check-SvgSanitizeCheck.png` | "সব ✅ · 23/23" |
| `check-SvgSyncPreview.png` | 7 ✅ rows; cells visibly different per frame |
| `check-AnimatedSvgPreview.png` | "সব ✅ · 22/22"; 3 empty "fallback আসবে" boxes |
| `check-SvgPickerCheck.png` | "সব ✅ · 26/26" |
| `check-SvgInventoryCheck.png` | "সব ✅ · 27/27"; `source = probe` normal in `check` |
| `check-SvgStagePreview.png` (1080×9189) | "সব ✅ · 57/57"; 8 cross-fade cells show two see-through stars; row 10 exactly **1** "কোনো SVG পাওয়া যায়নি" warning |
| `check-CaptionPreview.png` (taller than before: +10 cases) | "সব ✅ · 43/43" (9 rows + 34 cases); active word glows; long text = pages of ≤ 2 lines at a fixed font; box inside the safe margins |
| `check-AudioPreview.png` (1080×3270) | "সব ✅ · 33/33"; 3 timelines, nothing cut |
| `check-AudioSmoke.png` | "AudioSmoke ✅", Intro 90 · Main 180 · Outro 120 frames |
| `check-OutroPreview.png` (1080×5196) | "সব ✅ · 44/44"; badge sharp and unstretched with space around it, tap hint below, all inside the dark panel |
| `check-MainSceneCheck.png` (1080×2240) | "সব ✅ · 13/13"; header top, SVG middle, caption bottom; no overlap |
| `check-HadisPortrait.png` + `check-HadisLandscape.png` | The two real compositions at frame 45 (middle of the 90-frame Intro): round logo, two-line name, ribbon, "সহীহ বুখারী নং : ১"; correct 9:16 / 16:9 |
| `check-HadisVideoPreview.png` (1080×4570) | "সব ✅ · 34/34" (16 rows + 18 `sceneFade` cases); 33 cells: Intro fades out → Main fades in (f96 half-visible) → caption + SVG → Outro with badge; greenDayNight f190 lighter than f340 |

**Things only you can judge (Studio or first real video):** caption highlight matches the audio · voice starts right after the Intro, SFX on time and not too loud (default 0.4) · 10-frame voice fade does not cut the last syllable (`VOICE_FADE_OUT_FRAMES = 0` if it does) · panel blur looks fine (`PANEL_BLUR_UNITS = 0` if not) · SVG cross-fade blur fine (`BLUR_UNITS = 0` if not) · Intro ↔ Main fade smooth · sky smoothly day → night, fireflies drifting · scrubbing frames moves the SVG back and forth · Outro badge pulse/shine/tap tasteful, `chime` loudness, typewriter speed, readable on greenDayNight night (`OUTRO_FADE_OUT = false` keeps the CTA until the last frame).

---

## ✅ Part 9 (9A–9L) — Animated SVG stage — Done (what later Parts need)

No new packages; `render.yml`/`package.json`/`check.mjs` unchanged. Part 13's `MainScene` uses `SvgStage`, not `AnimatedSvg` directly.
⚠️ **React 19 rule (9D):** a new `{ __html }` object re-inserts the inner `<svg>` and the animation looks stuck — always memoize it (`AnimatedSvg` does).

- **9A–9B `svgSanitize.ts`** (pure, never throws): `sanitizeSvg(text, { prefix })` → `{ svg | null, removed, warnings, viewBox, renamed, prefix }`; removes `<?xml>`, DOCTYPE, `<script>`, `<foreignObject>`, `iframe/object/embed/link`, `on…=`, `javascript:`/`data:text/html` hrefs, external `href`/`url(http…)`/`@import`; keeps everything else byte-for-byte; fixes root (`width/height` → 100 %, `viewBox` kept or built, default `0 0 1000 1000`); idempotent. `prefix` renames ids/classes/keyframes/`href="#x"`/`url(#x)`/SMIL `begin` refs defined by the SVG itself (two SVGs on screen need **different** prefixes). `cleanPrefix`, `describeRemoved`. Known limit: bare element selectors stay page-global (the AI prompt forbids them).
- **9C–9D `svgSync.ts`:** `useSvgSync(ref, localFrame, contentKey, label?)` sets CSS animations (`getAnimations` list cached at first sync so a finished animation can be rewound) and SMIL (`pauseAnimations` + `setCurrentTime`) to the exact frame; stateless (same frame → same image, going backwards works); holds `delayRender` until the first sync. Samples `public/svg/svg1.svg` (CSS, 6 s) and `svg2.svg` (SMIL, 6 s) — your own files replace them.
- **9E `svgLoad.ts`:** `useSvgSource(name)` → `loading | ready | missing` (holds `delayRender` while loading), `svgLoader`, `createSvgLoader`, `classifySvgResponse` (HTML returned by the Studio for a missing file = missing), 15 s timeout, successes cached / failures not, one warning per missing name.
- **9F `AnimatedSvg`:** `<AnimatedSvg name size frame? prefix? loader? onReport? style? />` → load → sanitize → memoized inline → sync; draws `null` when loading/missing/invalid (the fallback is the stage's job).
- **9G–9H `svgPicker.ts`:** `pickSvgNames(segments, available)` — written `svg` always used (if in folder), others rotate through the sorted list (skipping a repeat of the previous), N = 0 → all `null` + one warning, written name not in folder → `null` + one warning; `pickSvgReport`, `pickSvgDetailed`.
- **9I `svgInventory.ts`:** `useSvgInventory()` → `{ names, count, source: "static" | "probe" | null, ready }`; first way `getStaticFiles()` (Studio), second way sequential probe `svg1, svg2…` (max 60, stops at first miss — **this is the real-render path**); `ready` must be true before `pickSvgNames` (avoids a false "no SVG" warning).
- **9J `FallbackSvg`:** transparent geometric 8-point star (ring, two 45° squares, inner star, dot), frame-computed rotation/pulse, dark outline for any sky; used for `null`/missing/invalid.
- **9K `svgStage.ts` + `SvgStage`:** `<SvgStage hadisId theme timing frameOffset? />` (dev props `size?`, `frame?`, `idScope?`, `inventory?`); wrapper exactly at `svgBox`; glow (`radial-gradient`, no blur) + disc stay still, SVG/fallback floats (`±6 × unit`, period 120 frames); draws nothing outside Main / before data; empty folder → fallback star + one warning. Pure: `activeSegmentIndex`, `segmentLocalFrame`, `floatOffset`, `stageGlow`.
- **9L `svgTransition.ts`:** cross-fade starts at the new segment's start, lasts `min(12, ⌊len ÷ 3⌋)`; same neighbour SVG → no transition; old: opacity 1→0, scale 1→1.06, blur 0→6u; new: 0→1, 0.94→1, 6u→0; glow/disc never fade. `BLUR_UNITS = 0` switches blur off.

---

## ✅ Part 10 — Animated colorful caption — Done

- **Files:** `captionWords.ts` (pure), `Caption.tsx`, dev `captionCases.ts` (34) + `CaptionPreview`.
- **API:** `<Caption hadisId theme timing frameOffset? />`. `PANEL_BLUR_UNITS = 10` (0 if blur looks wrong), `CAPTION_PAD_UNITS = 36`. Draws nothing outside Main, in a gap, with no segments/words.
- **Rules:** box enter 10 / exit 8 frames (shortened to ⌊len ÷ 3⌋), contiguous segments → no blink; active word from its start until `max(start+1, min(next start, end + 6))`, colour `(segment index + word index) mod 6`; all computed from the frame.
- **Caption fix (v2.57) — word highlight, max 2 lines, inside the safe margins:** the font no longer shrinks to 3–4 lines. It stays at the base size (Portrait 66, Landscape 60 — ×2 at 4K) and a long segment is split by word into **pages of at most 2 lines** (`paginateCaption`, `CAPTION_MAX_LINES = 2`). A page turns exactly at the `startFrame` of its first word (page 0 from the segment start); the new page text fades in over `PAGE_FADE_FRAMES = 6` (0.3 → 1). The word highlight is unchanged (upcoming / active / read, pop 1.15, underline, 6 rotating colours) and works across pages. Each word is measured separately in a hidden span (base size, same `inline-block` + 0.05 em padding), lines are broken greedily with `LINE_FILL = 0.86` of the inner width and drawn as one `div` per line (`nowrap`), so the DOM has exactly the calculated lines. A lone last word is avoided (one word moves over from the previous page). Only a single word wider than the box shrinks the font (down to `MIN_PAGE_SCALE = 0.3`); if even that fails `data-clipped = 1` and the panel clips. The box goes through `clampBoxToSafe(captionBox, layout.safe)` (no change in the current layouts, because the caption box already sits inside the safe area: Portrait bottom 8.5 %, sides = padding; Landscape bottom 5 %). New data attributes: `data-page`, `data-pages`, `data-page-start`, `data-page-end` (`data-words` = words on the current page, `data-active-word` = index in the whole segment).

---

## ✅ Part 11 — Audio and SFX engine — Done

- **Files:** `audioPlan.ts` (pure), `HadisAudio.tsx`, `SfxPlayer.tsx`, dev `audioCases.ts` (26), `AudioPreview`, `AudioSmoke`.
- **Constants:** `VOICE_FADE_OUT_FRAMES = 10`, `SFX_FADE_OUT_FRAMES = 6`, `SFX_MAX_SECONDS = 4`, `OUTRO_SFX_NAME = "whoosh"`, `OUTRO_SFX_ENABLED = true`.
- **API:** `<HadisAudio hadisId timing />`, `<SfxPlayer hadisId timing />` — **top level of `HadisVideo` only**. Voice starts at `introFrames`, lasts `mainFrames`. One SFX per segment with `sfx` at its start frame; volume default 0.4, clamped 0–1; invalid name → dropped + warning; cue never runs into the Outro; Outro `whoosh` at the first Outro frame; missing SFX files → silent + one ⚠️ per name (`Audio` is only mounted if the file exists).

- **Audio Teaser (v2.56):** JSON `teaser: { start, end }` → after the Hook the phrase plays first (`TeaserScene` + `TeaserAudio`), then Intro → full hadith; `timing.introFrames` = Hook + Teaser + Intro; `timing.teaserFrames` = the Teaser part; no `teaser` = no Teaser. See the 2.56 change-log entry.
- **Hook (v2.55):** `public/audio/hook.wav` + big text `HOOK_TEXT` before Intro; length = audio + 0.12 s; no file = no Hook; `timing.introFrames` = Hook + Intro (Main start), `timing.hookFrames` = Hook part. See the 2.55 change-log entry for all files and rules.
- **Intro/Outro voice (Part 14C-audio):** `public/audio/intro.wav` (5.44 s) and `public/audio/outro.wav` (5.52 s) play **only as audio** in Intro and Outro (captions exist only in Main). Files: `lib/introOutroAudio.ts` (pure: `fitSecondsToAudio`, `planIntroOutroAudio`, `introOutroGain`), `lib/useIntroOutroAudio.ts` (checks the files exist; `ready` flag + `delayRender`; missing file → `null`, no crash), `components/IntroOutroAudio.tsx` (`<Sequence><Audio/></Sequence>` at the top level of `HadisVideo`). Constants: `INTRO_AUDIO_PATH`, `OUTRO_AUDIO_PATH`, `INTRO_OUTRO_AUDIO_ENABLED = true` (set `false` for the old behaviour), `INTRO_OUTRO_AUDIO_VOLUME = 1`, `INTRO_OUTRO_AUDIO_FADE_OUT_FRAMES = 6`, `INTRO_OUTRO_AUDIO_TAIL_SECONDS = 0.1`. **Rules:** Intro voice starts at frame 0 and Outro voice at the end of Main; the scene length is `max(your seconds, audio length + 0.1 s)` (so the default 3 s / 4 s becomes ≈ 5.57 s / 5.63 s with these files, never above 15 s); `0` seconds still means "no scene, no voice"; `calculateHadisMetadata` (`loadHadis.ts`) returns the fitted `introSeconds`/`outroSeconds` in `props`, so `timingFromConfig` gets the same numbers. When a voice file exists, that scene's own SFX is switched off (Intro `whoosh`/`chime`; Outro `whoosh` via `SfxPlayer` option `outroSfx: false`, and the Outro `chime`) so nothing plays over the voice; without the file everything works as before. `DEFAULT_*_SECONDS`, `render.mjs`, `renderPlan.mjs` and `render.yml` are unchanged. The `.wav` files are in `public/`, so zip updates never overwrite them (`unzip -n`).
---

## ✅ Part 12 (12A–12E) — Outro scene — Done (what later Parts need)

- **Files:** `outroPlan.ts` (pure; 33 cases in `outroCases.ts`), `PlayBadge.tsx`, `OutroScene.tsx` (+ optional `visibleText` prop added to `FitText`), dev `OutroPreview` (1080×5196, "সব ✅ · 44/44").
- **API:** `<OutroScene theme timing nightFactor? frameOffset? frame? size? sfx? />` — `outroFrames = 0` → `null`; `frameOffset` defaults to `introFrames + mainFrames`; `frame?`/`size?`/`sfx?` are preview props. `<PlayBadge box tapBox? unit? outroFrames? frame? aspect? label? showTap? tapColor? nightFactor? debugOutline? style? />` + pure `playBadgeLook`. `outroPlan.ts`: `planOutro(frame, outroFrames)`, `outroLayout(computeLayout(w, h))`, `typewriterText/Units/Count`, `outroSpeed`, `sceneFadeFrames`, `settleSpring`, `pulseScale`, `shineLook/shineCenter`, `tapLook`, `badgeSize/badgeBox/badgeIsSharp/scaledBox`, `OUTRO_STEPS`.
- **Timing (120 frames = 4 s):** logo 0 · name 8/14 · CTA typewriter 20–48 · badge bounce 50 · shine 66–90 · pulse from 80 (period 40, 1 → 1.06 → 1) · tap hint 86; fade-in/out `min(12, ⌊n × 25 %⌋)`; shorter Outros are compressed, < 6 frames = static finished scene, > 120 holds (pulse/tap keep looping).
- **Fixed rules:** no background in the scene · all text/badge on the dark panel · all numbers from `outroPlan.ts`/`computeLayout` · closed-form from the frame · Google's clear space = ¼ of the badge height (`CLEAR_SPACE_RATIO`) · aspect `BADGE_ASPECT` (1600/474, no distortion) · 4K = exactly 2× HD · badge ≤ `BADGE_MAX_SCALE` 1.07 and never upscaled past the PNG's 1600 px (1280/1120 px wide at 4K → sharp) · typewriter never splits a conjunct (own cluster rule, no `Intl.Segmenter`) · badge image only through `PlayBadge`.
- **Switches:** `OUTRO_CHIME_ENABLED` (chime plays at badge pop-in; missing file → silent + one ⚠️), `OUTRO_TAP_ENABLED`, `OUTRO_FADE_IN`, `OUTRO_FADE_OUT`, `BADGE_HALO_DAY/NIGHT`, `showTap`.
- **Outro hand cursor polish (Cursor-update 2):** the hand now follows a slightly curved path (`CLICK_ARC`, outward bulge that vanishes at the badge) · it **hovers 3 frames** on the badge before pressing (`CLICK_PHASES.hover`) · the fingertip lands on the badge's **lower-right corner** (`CLICK_TARGET` = 0.92 / 0.84) so the "Play" text stays visible · the badge **shrinks to ≈ 0.97** while pressed and springs back (`BADGE_PRESS_SCALE`) · a soft **`tap` SFX** (`public/sfx/tap.wav`, `.mp3` also works; volume `OUTRO_TAP_VOLUME` = 0.3, switch `CLICK_SFX_ENABLED`, prop `tapSfx`) plays on the exact click frame of every cycle (`clickFrames()` in `outroPlan.ts`; it still plays when the Outro voice file exists; a missing file → silent + one ⚠️) · right after the click the badge gets a **glow** and a small **"ইনস্টল"** pill (`OUTRO_INSTALL_LABEL`, prop `installLabel`) that appears above the badge and fades out (`CLICK_AFTER_FRAMES` = 18). Timing at 120 frames: hand starts f76, arrives f88, hover f88–91, **click f95**, retreat done f111.

---

## ✅ Part 13 (13A–13C) — Assemble the main composition — Done (what Part 14 needs)

- **Files:** `scenes/MainScene.tsx`, `HadisVideo.tsx`, `lib/sceneFade.ts` (pure; 18 cases in `dev/sceneFadeCases.ts`), final `Root.tsx`, `public/sfx/whoosh.mp3` (sample), dev `MainSceneCheck` (1080×2240, 13 rows), `HadisVideoPreview` (1080×4570, 34 rows, 33 cells).
- **`MainScene`:** `<MainScene hadisId theme bookname number timing />` (`frameOffset` defaults to `timing.introFrames`); layers bottom → top: `SvgStage`, `Header`, `Caption`; transparent, no background.
- **`HadisVideo`:** `<HadisVideo {...HadisVideoProps} />` = `HadisVideoView` (the drawing; takes `timing`, preview-only `size`/`idScope`/`audio`/`sfx`) + `useVideoConfig` → `timingFromConfig`. Layers: `Background` (real `timing`) → Intro / Main (wrapped in `MainFadeIn`) / Outro `Sequence`s, **each only when its frames > 0** (`planScenes`) → `HadisAudio` + `SfxPlayer` at the top level. Intro ↔ Main: Intro fades out itself, Main fades in over `min(12, ⌊Main ÷ 3⌋)` frames (opacity 0 → 1, scale 0.97 → 1; **no style outside the window**, so the caption's backdrop blur sees the real background); Intro 0 s → no fade; Main → Outro relies on the Outro's own fade-in.
- **`Root.tsx` (final):** compositions **`HadisPortrait`** (1080×1920) and **`HadisLandscape`** (1920×1080), `component={HadisVideo}`, `schema={hadisVideoSchema}`, 30 fps, `calculateMetadata = forceOrientation(...)` (**the composition ID fixes the size**, a wrong `orientation` prop cannot change it); exports `forceOrientation`, `hadisPortraitDefaults`, `hadisLandscapeDefaults` (`hadisId: "0000"`, "সহীহ বুখারী", "১"). If the files are missing, `calculateMetadata` throws `[HADIS_DATA]`. All dev preview compositions stay (`SvgStagePreview`, `CaptionPreview`, … `HadisVideoPreview`) — **never render those as videos**.
- **Fixed rules:** one `HadisVideo` for both orientations · scene `Sequence` only when frames > 0 · audio at top level · `MainScene`/`OutroScene` get no `frameOffset`/`frame`/`size`/`idScope` in the real video · no timing/size maths in components · no CSS animation, no `Math.random()`.
- **Sample timing of `hadis0000` (Intro 90 · Main 180 · Outro 120 frames):** fade-in covers frames 90–101, segments 90–150 · 150–210 · 210–270, Outro starts at 270; whoosh planned at 90 (vol 0.6) and 270 (vol 0.4).
- **Not testable in my environment (needs your GitHub run/Studio):** `npm ci`, `typecheck` of the whole project, the browser step (`renderStill`) of `check.mjs`, real fonts, real sound/timing.

---

## 🧩 Part 14 — Real `render.mjs` + AI prompt templates → split into 3 sub-parts (14A · 14B · 14C)

**Goal:** put the real form into `scripts/render.mjs` which `render.yml` calls (a stub since Part 3), and ready-made templates for what to tell the AI to produce the files.

**Files (whole Part 14):** `scripts/render.mjs`, `AI_PROMPTS.md`, `README.md` (+ small additions planned below: `scripts/lib/renderPlan.mjs` and `scripts/test-render-plan.mjs`, as the token-saving rule allows, like `outroPlan.ts` in 12A).

Each sub-part delivers a zip of the whole project (`HadisVideokit-part14A.zip`, `…part14B.zip`, `…part14C.zip`) and the updated `HadisVideokit.md`. Messages: `Part 14A দাও`, `Part 14B দাও`, `Part 14C দাও`. **`render.yml` does not change and no new package is needed** (`@remotion/bundler` and `@remotion/renderer` are already dependencies since Part 2).

**Token-saving rules (14A–14C):**
- Each sub-part writes **only that sub-part's files**; earlier files are not rewritten (only small fixes).
- In `HadisVideokit.md` only that sub-part's tick (⬜ → ✅) and short "done note" change.
- If a sub-part still runs out of tokens it can be split further (e.g. 14B → 14B-1, 14B-2), as was done with 9I, 9K, 12, 13.

> 🔒 **Fixed from earlier Parts (14A–14C must follow them):**
> - Render **`HadisPortrait`** / **`HadisLandscape`** only (never a dev `*Preview`/`*Check`). Props: `hadisId`, `hadisBookname`, `hadisNumber`, `theme`, `orientation`, `introSeconds`, `outroSeconds`. The composition ID fixes the size; `orientation` in the props is set to match.
> - 4K = Remotion `scale: 2` (CLI `--scale 2`); the composition stays HD. Total frames and `width/height` come from `calculateMetadata` (via `selectComposition({ inputProps })`) — never computed in the script.
> - `calculateMetadata` throws `[HADIS_DATA] …` (with the searched path) when the `.wav` or JSON is missing/bad → turn it into a clear Bengali message before/while rendering; exit code ≠ 0 on any failure.
> - Audio (voice + SFX) is part of the composition → no separate audio step. Missing SFX files only warn (silent), never stop a render.
> - Workflow contract (see `render.yml` above): exactly the 8 arguments `--id --book --number --theme --orientation --quality --intro --outro`; values arrive as strings (Bengali text allowed; `--intro`/`--outro` may be empty); output must be `out/*.mp4`.
> - `package.json` has `"type": "module"` → scripts are ESM `.mjs`; Node 22; no TypeScript at run time in `scripts/` (so shared constants are duplicated in `renderPlan.mjs` and a case cross-checks them against `src/constants.ts` text).
> - Large renders: 4K and `greenDayNight` are heavy → lower concurrency at 4K; the workflow timeout is 350 min.

| Part | Topic | Main risk caught here |
|---|---|---|
| **14A** | `scripts/lib/renderPlan.mjs`: parse + validate arguments, build the job list, output names, input-file pre-checks, `--dry-run`, + pure cases | Empty/odd inputs from the workflow, wrong names, missing files found too late |
| **14B** | `scripts/render.mjs`: real bundle + `selectComposition` + `renderMedia` loop, HD/4K, both orientations, concurrency/crf, progress, errors | 4K memory, wrong size/scale, `[HADIS_DATA]` not explained, empty/zero-byte mp4 |
| **14C** | `AI_PROMPTS.md` (3 prompts) + `README.md` (usage) | Prompts that give SVG/JSON the code rejects (script, faces, no gaps, schema) |

> 🔗 **Dependency order:** 14A (pure plan) → 14B (render uses the plan) → 14C (docs/prompts).

---

### 🔹 14A — `renderPlan.mjs`: arguments, validation, job list, pre-checks ✅

**Goal:** everything that does not need a browser, as pure functions proven in plain Node (same idea as 9K-1 / 12A).

**Files:** `scripts/lib/renderPlan.mjs` (new), `scripts/test-render-plan.mjs` (new; pure cases, run in plain Node; prints ✅/❌ per case, exit code ≠ 0 on a failure). `scripts/render.mjs` stays the stub (14B). `render.yml`, `package.json`, `check.mjs` unchanged.

**Details:**
- **Arguments (the workflow sends exactly these):** `--id`, `--book`, `--number`, `--theme` (`emerald|navy|greenDayNight`), `--orientation` (`portrait|landscape|both`), `--quality` (`hd|4k|both`), `--intro`, `--outro`; optional extras for hand use/tests: `--concurrency`, `--crf`, `--out-dir` (default `out`), `--frames` (e.g. `0-59`, render only a slice for a quick test), `--dry-run` (print the plan, render nothing). Both `--key value` and `--key=value` work; unknown argument → clear Bengali error.
- **Validation (clear Bengali messages naming the argument):** `id` only `[A-Za-z0-9_-]+` (same rule as `types.ts`, blocks `../`); `theme`/`orientation`/`quality` from the fixed lists; `intro`/`outro`: empty → default (3 / 4), English/Bengali/Arabic-Indic digits accepted, 0…15 (allow decimals like `2.5`), otherwise error; `book`/`number` cleaned like Part 4 (invisible characters removed, spaces collapsed, number digits → Bengali; mixed `"১২৩/ক"` kept; both empty → warning only, since the label then shows nothing).
- **Job list:** `orientation both` × `quality both` → up to 4 jobs, fixed order (portrait before landscape, HD before 4K). Each job: `compositionId` (`HadisPortrait`/`HadisLandscape`), `inputProps` (the 7 props, `orientation` matching the ID), `scale` (1/2), `label`, **`outputFile` = `<outDir>/hadis<id>_9x16_HD.mp4`, `…_16x9_4K.mp4`** (labels from `constants.ts`), `concurrency` and `crf` defaults per job (4K lower concurrency; `--concurrency`/`--crf` override; clamped to sane ranges).
- **Input pre-checks (before any bundle, so errors come in seconds):** `public/hadis/hadis<id>.wav` and `hadis<id>_timestamp.json` exist (non-empty), JSON parses (message names the file and the reason; the full schema check stays in `calculateMetadata`), `src/logo.jpg` and `src/google-play-badge.png` exist; informational (never fatal) notes: how many `public/svg/svg*.svg` and `public/sfx/*` files were found, and a ⚠️ line if no SVG exists (the fallback star will be used) or `public/sfx/` is empty (silent SFX).
- **`--dry-run`:** prints the numbered job table (composition, size, scale, output, concurrency, crf, frames if known) and exits 0 without a browser.
- **Pure cases (`test-render-plan.mjs`):** all argument forms, empty/Bengali-digit/`2.5`/`16`/`-1`/`abc` for intro/outro, bad id (`../x`, spaces), bad theme/orientation/quality, 1/2/4 jobs and their order/names, `orientation` in props matches the ID, scale 1/2, output names for the 4 sizes, concurrency lower at 4K and overridden by `--concurrency`, clamping, missing-file messages (using a temp folder), `--dry-run` writes nothing, the duplicated lists equal the lists in `src/constants.ts` (read as text), deterministic, never throws unexpected errors.

**📂 File progress (14A is delivered one file at a time; the next file comes when you write `পরের ফাইল`):**
- [x] ✅ File 1: `scripts/lib/renderPlan.mjs` — written; smoke-checked in plain Node (all-4-jobs table, error list, warnings, `checkInputs`)
- [x] ✅ File 2: `scripts/test-render-plan.mjs` — all pure cases listed above (65 cases, all ✅ in plain Node, exit code 0; a failing case prints ❌ and exits 1)

**✅ Checklist:**
- [x] ✅ All pure cases ✅ in plain Node (file 2): `node scripts/test-render-plan.mjs`
- [x] ✅ Every error message names the argument/file and says what to do (file 1)
- [x] ✅ Output file names exactly match the pattern above (`out/*.mp4` for the workflow) — `hadis<id>_9x16_HD.mp4` … `_16x9_4K.mp4` (file 1)
- [x] ✅ `--dry-run` works without a browser (`buildPlan` + `formatDryRun` + `checkInputs` write nothing — a case proves no folder is created; the flag itself is wired into `render.mjs` in 14B)
- [ ] ⬜ Type-check of the project still passes (the new files are `.mjs` outside `src/`, so `tsc` is not affected; confirm on your next GitHub run)

**📝 Done note — file 1 (`scripts/lib/renderPlan.mjs`, pure ESM, no TypeScript, no browser, never throws):**
- **Exports 14B/the test use:** `buildPlan(argv)` → `{ ok, errors[], warnings[], plan }` (all errors reported together; `plan = { id, outDir, dryRun, jobs[] }`) · `parseArgs(argv)` (`--key value`, `--key=value`, `--dry-run`, empty value `""` allowed, unknown argument → Bengali error, repeated argument → warning, last wins) · `parseSeconds(raw, argName, default)` (empty → default; English/Bengali/Arabic-Indic digits; decimals `2.5`/`২.৫`/`2,5`; 0…15) · `checkInputs(plan, rootDir)` → `{ ok, errors, warnings, notes }` · `formatDryRun(plan)` (returns the numbered job table as a string; prints nothing) · `formatReport({errors,warnings,notes})` (adds the ❌/⚠️/ℹ️ prefixes) · `cleanText`, `toBnDigits` (copies of `bnDigits.ts`) · the copied constants (`THEME_IDS`, `ORIENTATIONS`, `QUALITIES`, `ORIENTATION_LABEL`, `QUALITY_LABEL`, `QUALITY_SCALE`, `BASE_SIZES`, defaults, `HADIS_DIR`, `SVG_DIR`, `SFX_DIR`) for the cross-check case.
- **Defaults when a value is empty:** `theme emerald`, `orientation portrait`, `quality hd`, `intro 3`, `outro 4`, `out-dir out`, `crf 18`, `concurrency` HD 4 / 4K 2 (clamped 1–8; crf clamped 1–51, with a warning when clamped). A wrong non-empty `theme/orientation/quality` is an error (lists the allowed values). `id` empty → error; `id` not `[A-Za-z0-9_-]+` → error (blocks `../`). `book`/`number` cleaned like Part 4; both empty → warning only.
- **Job:** `{ index, compositionId, orientation, quality, scale, width, height, label, inputProps (7 props, orientation = the job's), outputFile, concurrency, crf, frameRange|null }`; order portrait → landscape, HD → 4K; `width/height` here are only for the table (14B takes the real size from `selectComposition`). `--frames` accepts `0-59` or one number.
- **`checkInputs`:** errors for missing/zero-byte `.wav`, missing/zero-byte/invalid-JSON timestamp (message includes the JSON parse reason), missing `src/logo.jpg` / `src/google-play-badge.png`; notes with the SVG/SFX counts; warnings for no SVG (fallback star) and empty `public/sfx/` (silent). Never fatal for the notes/warnings.
- **For 14B (order):** `buildPlan(process.argv.slice(2))` → print `formatReport`, exit 1 on `!ok` → `checkInputs(plan, process.cwd())` → print `formatReport`, exit 1 on `!ok` (errors in seconds) → if `plan.dryRun` print `formatDryRun(plan)` and exit 0 → only then bundle + render.
- **Not testable in my environment:** nothing browser-related is used here.

**📝 Done note — file 2 (`scripts/test-render-plan.mjs`, 65 pure cases, plain Node, `✅`/`❌` per case, exit 1 on any failure):**
- **Covered:** argument forms (`--key value`, `--key=value`, `=` inside a value, the workflow's 8 arguments with empty intro/outro, empty value followed by another `--arg`, `--dry-run` flag forms, unknown/stray arguments, repeated argument) · intro/outro (empty, Bengali/Arabic-Indic/Persian digits, `2.5`/`২.৫`/`2,5`, 0 and 15 accepted, 16 / -1 / abc / `1.2.3` rejected, argument name in the message) · id (`../x`, spaces, `/`, `.`, non-ASCII rejected; empty/missing rejected) · bad theme/orientation/quality with the allowed list · several errors reported at once · defaults for empty values · book/number cleaning (digits → Bengali, mixed `১২3/ক` kept, invisible characters removed, ZWJ kept, both-empty warning only) · 1/2/4 jobs, order, 4 output names, `--out-dir`, props `orientation` = composition ID, exactly 7 props, scale 1/2 and sizes, concurrency lower at 4K, overrides, clamping with warnings, `--frames` forms · input pre-checks in temp folders (all present, nothing present, zero-byte, broken JSON with reason, other id, no SVG/empty SFX = warnings only, `readme.txt` not counted, missing root) · `--dry-run` writes nothing + table content · `formatReport` prefixes · copied lists/numbers/labels/sizes/folders equal the text of `src/constants.ts` and the composition IDs exist in `src/Root.tsx` · deterministic, input argv not mutated, never throws on odd input, `plan = null` on errors, every error message is Bengali and non-trivial.
- **How to run by hand (optional):** `node scripts/test-render-plan.mjs` (needs only Node; reads `src/constants.ts` and `src/Root.tsx` as text). `render.yml` does not call it, so it never blocks a render.
- **Test-only detail to remember:** an empty `--book`/`--number` adds a warning, so cases that count warnings pass `--book x`.

---

### 🔹 14B — `render.mjs`: the real render ✅

**Goal:** the script `render.yml` already calls now really renders the videos.

**Files:** `scripts/render.mjs` (replaced; uses `scripts/lib/renderPlan.mjs`). Nothing else changes (`render.yml`, `package.json`, `check.mjs`, all `src/`).

```bash
node scripts/render.mjs --id 0101 --book "সহীহ বুখারী" --number ১ \
  --theme greenDayNight --orientation both --quality hd
```

**Details:**
- Flow: parse + validate + pre-checks (14A) → **bundle once** (`@remotion/bundler`, entry `src/index.ts`, `publicDir` = `public/`) → for each job in order: `selectComposition({ id, inputProps })` (gets total frames/size; catches `[HADIS_DATA]` and prints a clear Bengali explanation + the path) → `renderMedia({ codec: "h264", scale, crf, concurrency, inputProps, outputLocation, overwrite, jpegQuality, … })` → verify the file exists and is not zero bytes → next job. Jobs run **one after another** (memory safety); `out/` is created if missing; stale `out/*.mp4` of the same names are overwritten.
- `--frames a-b` → `frameRange` (quick test render, output name gets a `_test` suffix so it never mixes with a real one).
- **Progress:** one log line per ~10 % (job n/total, % , elapsed, ETA); at the end a table: file, size, duration, render time. Also appends the same table to `$GITHUB_STEP_SUMMARY` if set (the workflow's own "List rendered files" step stays).
- **Memory/stability:** concurrency default from 14A (4K lower), browser/bundle closed between jobs, `chromiumOptions` safe defaults for GitHub runners (no extra Chrome-library change), clear message if a render fails with an out-of-memory-like error suggesting `quality = hd` or lower `--concurrency`; **exit code 1** on any failed job (already finished mp4s stay in `out/`).
- **Warnings are kept, not fatal:** missing SVG/SFX/`[HADIS_DATA]` warnings printed once from the render logs (the components already warn once).
- **Verification plan:** `--dry-run` for all argument combinations; a real short test render of `hadis0000` with `--frames 0-59` in `action = render` (needs your GitHub run — my environment has no browser; this is the first real proof) → a few-second mp4 in Artifacts `videos`; then a full `hadis0000` render for `portrait/hd`.

**✅ Checklist:** arguments and output paths (`out/*.mp4`) match `render.yml` exactly — **`render.yml` need not change**.
- [x] ✅ `--dry-run` correct for portrait / landscape / both × hd / 4k / both (all 9 combinations: exit 0, 1/1/2/1/1/2/2/2/4 jobs)
- [x] ✅ Missing `.wav`/JSON gives a clear Bengali error before any heavy work, exit code 1 (also bad arguments → exit 1)
- [ ] ⬜ `hadis0000` short test render (your GitHub run: `action = render`, see "How to test" below) → mp4 plays, correct size, audio present
- [x] ✅ `render.yml`, `package.json`, `check.mjs`, all `src/` untouched
- [ ] ⬜ Type-check passes (`scripts/*.mjs` are outside `tsc`; confirm on your next GitHub run)

**📝 Done note — 14B (`scripts/render.mjs`, replaces the Part 3 stub; uses `scripts/lib/renderPlan.mjs`):**
- **Flow:** `buildPlan` (errors → exit 1) → `checkInputs` against the project root (errors → exit 1, in seconds) → `--dry-run`: prints the job table and exits 0 before any browser → `ensureBrowser()` → **one** `bundle({ entryPoint: src/index.ts, publicDir: public/ })` → jobs **one after another**: `selectComposition({ serveUrl, id, inputProps })` → `renderMedia(...)` → file must exist and be > 0 bytes → next. The bundle's temp folder is removed at the end. Exit code **1** if any job failed (finished mp4s stay in `out/`); a failed job does not stop the others, **except** `[HADIS_DATA]` (same for every job → stops at once).
- **`renderMedia` options used:** `codec h264`, `scale` (1 / 2), `crf` (default 18), `concurrency` (job value, lowered to the frame count if needed, because Remotion rejects more workers than frames), `frameRange`, `overwrite: true`, `imageFormat jpeg`, `jpegQuality 90`, `timeoutInMilliseconds 120000` (heavy SVG/fonts; default is 30 s), `chromiumOptions { enableMultiProcessOnLinux: true }` (no `gl` override, no Chrome-library change), `onProgress`.
- **`--frames a-b`:** quick test render; the file name gets `_test` (`out/hadis0000_9x16_HD_test.mp4`, still matches `out/*.mp4`); a start beyond the video is an error naming the real frame count, an end beyond it is clamped with a ⚠️.
- **Messages (Bengali):** `[HADIS_DATA]` → what happened + the exact reason/path from `calculateMetadata` + what to do; out-of-memory-like errors (`out of memory`, `ENOMEM`, `heap`, `Target closed`, `Page crashed`, `SIGKILL`, `Protocol error` …) → suggests `quality = hd` or a lower `--concurrency`; other errors → first line + full stack (our own known errors show no stack).
- **Progress/summary:** one line per ~10 % (`[job/total] % | elapsed | ETA`); at the end a Markdown table (file, size, video length, render time) and, if failed, a list of failed jobs. The same Markdown (plan table, errors, final table) is appended to `$GITHUB_STEP_SUMMARY`; the workflow's own "List rendered files" step stays.
- **How it was verified here (no browser, no npm install in my environment):** `node --check`; the flow with stand-in `@remotion/bundler` / `@remotion/renderer` modules in a temp copy: all 9 `--dry-run` combinations, missing `.wav`/JSON, bad arguments, a full 4-job run (names, sizes, table, summary file), `--frames` (suffix, start beyond, end clamp), a simulated 4K out-of-memory (the HD job still finishes, exit 1), a zero-byte output, a `[HADIS_DATA]` error (stops early). **Not proven here:** the real `bundle`/`renderMedia` calls, the exact option names against Remotion 4.0.541, real timing and memory — that is the first real proof.
- **How to test (your GitHub run):** `render.yml` → `action = render`, `hadis_id = 0000` (the sample files, about 10 s of video), `orientation = portrait`, `quality = hd`. The workflow has no `--frames` input, so this is a full (short) render; `--frames` is for hand use only. Download the mp4 from Artifacts `videos` and check size, picture and sound. If it fails, send the red text of the step "Render videos" and only `render.mjs` will be fixed (a likely spot: a `renderMedia` option name).
- **For 14C/15:** `README.md` must mention `--dry-run`, `--frames`, `--concurrency`, `--crf`, `--out-dir`, the `_test` suffix, and what to do on the out-of-memory message.

---

### 🔹 14C — `AI_PROMPTS.md` + `README.md` (usage) 🔄 (file 1 ✅ · file 2 ⬜)

**Goal:** ready-made prompts so the daily files (JSON, SVG, SFX list) come out in the exact form the code accepts, plus the README usage part.

**Files:** `AI_PROMPTS.md` (new), `README.md` (usage section; troubleshooting/time estimates are finished in Part 15). No code changes.

**`AI_PROMPTS.md` (three prompts, each copy-paste ready; **changed on your request: the whole file is in English and works step by step, one prompt per file** — Prompt 2 = one prompt per SVG file, Prompt 3 = SFX list + one prompt per SFX file):**
1. **Timestamp JSON generation** — from the hadith text + audio timing, schema-conforming JSON (exactly the Step 0 schema, with word-level timing): `start/end` in seconds from the start of the `.wav`, segments contiguous or with deliberate gaps, **each segment under ~25 words**, text copied exactly (no edits to hadith text), optional `svg` (`svg1…svgN`) and `sfx` (`name`, `volume` 0–1), output = JSON only, validated by `parseTimestampFile` rules (valid names `[A-Za-z0-9_-]`).
2. **Animated SVG generation** — `svg1…svgN` for the segments, following the "Animated SVG rules" of Step 0 verbatim (viewBox 1000×1000, transparent, CSS/SMIL only, time-based SMIL, 2–6 s infinite loops, no script/external/on-events, classes/ids only, no bare element selectors, colours for all 3 themes, **no faces of humans/animals — geometric/nature/object symbols only**), one file per answer, numbered without gaps.
3. **SFX list** — which names (`whoosh`, `pop`, `chime`, `ding`, `swoosh`), where to use each, loudness advice (default 0.4), royalty-free source suggestions; the note that **`public/sfx/whoosh.mp3` is only a synthetic sample — replace it with real royalty-free files named `whoosh`, `pop`, `chime`, `ding`, `swoosh`** (`.mp3` or `.wav`).

**`README.md` (usage part):** what the kit is, one-time setup (`render.yml`), the daily workflow (below), file/folder rules, the 10 inputs, example run, where results appear (Artifacts / Release), "if the run fails" (copy the red text).

**✅ Checklist:**
- [x] ✅ Each prompt, answered literally, gives a file that passes the code (JSON through `parseTimestampFile` rules, SVG through `sanitizeSvg` with nothing removed) — checked in plain Node with samples built from the prompt examples (SVG: the real `svgSanitize.ts`; JSON: the schema rules re-implemented, because `zod` is not installed in my environment)
- [x] ✅ The SFX prompt carries the "replace the sample `whoosh.mp3`" note
- [ ] ⬜ README usage matches the real workflow inputs and file names (file 2)

**📂 File progress (14C is delivered one file at a time):**
- [x] ✅ File 1: `AI_PROMPTS.md` — written, English, step by step
- [ ] ⬜ File 2: `README.md` (usage part; must also mention `--dry-run`, `--frames`, `--concurrency`, `--crf`, `--out-dir`, the `_test` suffix and the out-of-memory advice — see the 14B done note)

**📝 Done note — file 1 (`AI_PROMPTS.md`, English, no code changes):**
- **Structure:** golden rules → overview table of files and repo paths → **Prompt 1** (Steps 1.1 collect input · 1.2 prompt · 1.3 checklist · 1.4 save/upload) → **Prompt 2** (Step 2.0 plan the pictures, no file · 2.1 one prompt per SVG file `svg<N>.svg` · 2.2 a valid example · 2.3 checklist · 2.4 save/upload) → **Prompt 3** (3.0 names table · 3.1 where to use SFX, no file · 3.2 one prompt per SFX file: where to download legally · 3.3 checklist) → final upload checklist.
- **Prompt 1 rules (match `types.ts`):** text copied exactly (joined segments = hadith text) · `start`/`end` seconds from the start of the `.wav`, `end > start`, sorted by `start` · < 25 words per segment (aim 8–18) · `words` only with real word-level times · `svg` = `svg<number>` ≤ SVG_COUNT · `sfx.name` ∈ `whoosh, pop, chime, ding, swoosh`, `volume` 0–1 (0.3–0.6), at most one per three segments, none on segment 1 · `id` optional · valid JSON, JSON only.
- **Prompt 2 rules (match the "Animated SVG rules" + `sanitizeSvg` + `svgSync`):** root `<svg viewBox="0 0 1000 1000" xmlns=…>` with no width/height · transparent · CSS `@keyframes` or time-based SMIL only · forbidden: script, foreignObject, iframe/object/embed/link, external image/font, `@import`, `url(http…)`, `on…=`, `javascript:`, DOCTYPE, `<?xml?>` · 6 s loop, every duration divides 6 (2/3/6 s), infinite · `begin` only `0s`/`±Ns`/`id.end` · classes/ids only, **every class/id/keyframes name prefixed `svg<N>-`**, `transform-origin` in px · white/gold/bright green-teal/sky blue, no pure black · no faces or bodies of humans/animals (no hands, birds, fish either) · < 150 elements, < 30 KB, no text inside the SVG · files numbered without gaps (the render-time probe stops at the first missing number, max 60).
- **Prompt 3 facts (match the code):** built-in uses — `whoosh` at the intro start and at Main → Outro, `chime` when the intro label appears; `pop`/`ding`/`swoosh` only via JSON; `.mp3` or `.wav`; missing file = silent, never an error; longer than 4 s is cut (`SFX_MAX_SECONDS`); default volume 0.4. **The note "replace the synthetic sample `public/sfx/whoosh.mp3` with real royalty-free files named `whoosh`, `pop`, `chime`, `ding`, `swoosh`" is in the file.** Prompt 3B tells the AI **not to invent download links** (only sources, licence type and search words).
- **How it was verified here:** the SVG example inside the file went through the real `svgSanitize.ts` in plain Node (nothing removed, no warnings, `viewBox` kept, content unchanged except the root's `width/height 100%` that `sanitizeSvg` always adds; only class selectors; durations 6/3/3; loops infinite; SMIL `begin` time-based; all names prefixed) · the shipped `svg1.svg`/`svg2.svg` pass the same check · forbidden things (script, on-event, external href) are caught · a JSON sample built from the Prompt 1 format passes the schema rules; end ≤ start, bad `svg` name, bad `sfx` name, volume 1.5 and unsorted segments are rejected. **Not proven here:** how a given AI model actually answers — the first real answers should be run once through `action = render`.

---

## 🧩 Part 15 — Final end-to-end test, README and troubleshooting

**Goal:** from the phone, render and download a real video with `render.yml`, verifying everything together.

**Files:** `README.md` (troubleshooting + time estimates finished), small fixes if needed (if `render.yml` must change it will be said separately; the aim is that it need not).

**Already built:** `render.yml` (10 inputs, `timeout-minutes: 350`, `concurrency`, Bengali inputs via `env`, Artifact upload `videos` 7 days `compression-level: 0`, Release via `gh release create`), real `render.mjs` (Part 14).

**Final test plan:**
1. `emerald / portrait / hd` with the `hadis0101` sample
2. Same ID `navy / landscape / hd`
3. `greenDayNight / both / hd` (verify day-night and fireflies)
4. `greenDayNight / portrait / 4k`
5. `render_and_release` once (do the files reach the Release)
6. Deliberately remove a file and check the error message

**README will contain:** time/memory each setting may need (4K and `greenDayNight` are heavy), Artifact size and Release alternative, what to do if Git LFS is needed.

**✅ Checklist:** Actions → Run workflow → book name and Bengali number → download the `.mp4` from Artifacts → plays fine and shows the correct "book নং : number". 🎉

---

## 🔁 Your daily workflow (after the kit is finished)

1. Pick a hadith from the app and make the audio → `hadis0101.wav`
2. Have the AI (using `AI_PROMPTS.md`) make `hadis0101_timestamp.json`, `svg1…svgN.svg`, SFX list
3. Upload to the repo (Add file → Upload files; keep folder paths): `public/hadis/hadis0101.wav`, `public/hadis/hadis0101_timestamp.json`, `public/svg/svg*.svg`, new SFX in `public/sfx/`
4. **Actions → Render Hadis Video → Run workflow** → `action = render`, `hadis_id`, `hadis_bookname`, `hadis_number` (Bengali), theme, orientation, quality (leave `zip_file` empty)
5. Download the video from Artifact/Release and upload it 🚀

---

## ⚠️ Things to know

- **Islamic etiquette:** hadith/ayah text and translation must come from verified sources; no changes in captions.
- **Repo size:** large `.wav` and videos piling up in Git make the repo heavy; Part 15's README gives Git LFS / old-file cleanup steps if needed.
- **Google Play badge:** aspect ratio and clear space follow Google's guidelines (¼ of the badge height; never distorted) — built in Part 12.
- **Remotion license:** free for personal/small teams; for commercial use as a company, check Remotion's license terms once.

---

## 📝 Change log

**Version 2.57 → 2.58**
- 🎨 **3 new season themes:** `monsoon` (বর্ষা — rain + lightning, heavy clouds), `winter` (শীত — fog layers + frost dust), `spring` (বসন্ত — falling palash/krishnachura petals). All are day-night themes with their own palettes (day / dusk / night), hills, stars, clouds and fireflies. `THEME_IDS` now has 6 entries (in `src/constants.ts` **and** the copy in `scripts/lib/renderPlan.mjs`).
- 🕒 **New workflow input `time_mode`** (`dayToNight` default · `day` · `night` · `nightToDay`) for every day-night theme (`greenDayNight`, `monsoon`, `winter`, `spring`); `emerald`/`navy` ignore it. Default = the old behaviour, so nothing changes unless you pick another mode. `nightToDay` mirrors the sun/moon path (sun rises from the left, moon sets on the right).
- 🧩 **New files:** `src/components/SeasonEffects.tsx`, `src/dev/SeasonThemesPreview.tsx` (composition `SeasonThemesPreview`: 4 themes × 4 modes → `check-images/check-SeasonThemesPreview.png`). **Changed:** `src/constants.ts` (`THEME_IDS`, `TIME_MODES`, `DEFAULT_TIME_MODE`, type `TimeMode`), `src/types.ts` (optional `timeMode`), `src/themes.ts` (3 themes, `SeasonEffect`, extended `Scenery`), `src/lib/sky.ts` (`cloudOpacityFor`, `hillColorsFor`; old `cloudOpacity`/`hillColors` kept), `src/lib/dayNight.ts` (`timeMode`), `src/lib/timing.ts` (`Timing.timeMode`), `src/lib/useNightFactor.ts`, `src/components/Caption.tsx`, `src/components/SvgStage.tsx` (pass `timeMode`), `src/components/DayNightSky.tsx` (`themeId`, `mirror`), `src/components/Background.tsx` (all day-night themes + effects + `timeMode`), `src/HadisVideo.tsx`, `src/Root.tsx`, `src/scenes/ThumbnailScene.tsx`, `scripts/lib/renderPlan.mjs` (`--time-mode`), `scripts/render.mjs` (usage comment), `scripts/test-render-plan.mjs` (+7 cases → 106), `.github/workflows/render.yml`, `README.md`, this md.
- ⚠️ **`render.yml` must be pasted by hand** (the zip step never changes `.github/workflows/*`): the copy-paste block above is now the real current file (it replaced an older copy). New input `time_mode` (after `theme`), new `theme` options, env `TIME_MODE`, `--time-mode "$TIME_MODE"` in the render helper. 20 inputs in total (GitHub's limit is 25).
- ✅ **Checked here (no browser, no `npm ci` — offline):** `test-render-plan.mjs` 106/106 pass; the new/changed TypeScript files compile with no errors against minimal React/Remotion/Zod type stubs; day-night maths run in Node: default = `dayToNight` for every frame, `nightToDay` = `1 − dayToNight`, `day` = 0, `night` = 1; `greenDayNight` hills/clouds equal the old values; all 6 themes × 41 `nightFactor` steps mix without errors; worst text/panel contrast 9.15 : 1. Not rendered here — **first real look = run `action = check` and open `check-SeasonThemesPreview.png`**; `npm run typecheck` runs in the workflow.
- 🔒 Nothing else changed: audio, Hook/Teaser/Intro/Main/Outro layouts, Caption, SVG stage, `emerald`, `navy`, timings, JSON schema, `package.json`, `check.mjs`, `AI_PROMPTS.md`. Existing dev previews still list only the first 3 themes on purpose.

**Version 2.56 → 2.57**
- 🔧 **Caption fix: word-by-word highlight, maximum 2 lines, inside the safe margins.** Before, a long segment shrank the font and wrapped to 3–4 lines (and was cut with "…" when it still did not fit). Now every caption page has **at most 2 lines at a fixed font size**; long text continues on the next page when its first word starts. The highlight is still per word (active = coloured + pop + underline, read = plain, upcoming = dim).
- 🧩 **Files changed (4 code files + this md):** `src/lib/captionWords.ts` (new pure functions `paginateCaption`, `pageIndexAt`, `pageTextOpacity`, `clampBoxToSafe`; constants `CAPTION_MAX_LINES = 2`, `PAGE_FADE_FRAMES = 6`, `PAGE_FADE_FROM = 0.3`, `MIN_PAGE_SCALE = 0.3`; `fitCaption` and every old constant/function are kept unchanged), `src/components/Caption.tsx` (`CaptionBox` measures each word, builds the pages, draws the current page line by line; `CaptionView` clamps the box to `layout.safe`; the 14C "measure the real height and shrink by 6 %" step is gone because the lines are now explicit), `src/dev/captionCases.ts` (24 → 34 cases: 8 paging cases + 2 safe-margin cases), `src/dev/CaptionPreview.tsx` (row 3 also checks `layout.safe`; row 5 now checks "≤ 2 lines, font = base, long text on several pages"; row 6 reads the active word inside its page; new `pages/page/pageStart` fields).
- ✅ **Checked here:** `npm ci` + `tsc --noEmit` clean for the whole project; all 34 pure caption cases pass in plain Node (every page ≤ 2 lines, every word exactly once and in order for 1–300 words, no lone last word, a very wide word shrinks the font instead of overflowing, junk/`null` input never throws, page index never goes backwards, `clampBoxToSafe` leaves the 4 real layouts unchanged and pulls an outside box in, 2 lines at the base font fit the inner height at 1080×1920, 1920×1080, 2160×3840, 3840×2160). **Not rendered here** (no browser could be downloaded) — please look at `check-CaptionPreview.png` on the first run: pages of ≤ 2 lines, highlight moving word by word, page turn on the first word of the next page, text inside the panel and the panel inside the safe margins.
- 🔒 Nothing else changed: Header, SVG stage, Main/Intro/Outro/Hook/Teaser, themes, colours, timing, audio, `render.yml`, scripts, `package.json`, `AI_PROMPTS.md`, `README.md` (no JSON change — the existing `words` timings, or equal splitting, are used as before).

**Version 2.55 → 2.56**
- 🎙️ **New Audio Teaser (cold open) after the Hook:** the strongest phrase of the hadith plays **first** (big text, the spoken word glows, earlier words stay bright, later words dim), then Intro → the **full hadith from the very beginning** → Outro. Video order is now **[ Hook ][ Teaser ][ Intro ][ Main ][ Outro ]** (Hook and Teaser are each optional; with neither, nothing changes).
- ✅ **"Selected" = the timestamp JSON has `"teaser": { "start": 12.4, "end": 17.9 }`** (seconds from the start of the hadith `.wav`, same clock as the segments; word times already exist in the JSON, so the cut is exact). **No `teaser` = no Teaser.** No workflow input, so `render.yml`, `render.mjs`, `renderPlan.mjs` are unchanged. `TEASER_ENABLED = false` in `constants.ts` switches it off everywhere.
- 📏 **Rules (pure, in `lib/teaser.ts`):** `start < 0 → 0`; `end > wav length → wav length`; length `> TEASER_MAX_SECONDS (12) →` cut to `start + 12`; length `< TEASER_MIN_SECONDS (0.5)` or `start ≥ wav length` → no Teaser (a console warning from `loadHadis`); scene length = `ceil((phrase + 0.15 s) × 30) / 30` (e.g. 5.5 s → 5.6667 s = 170 frames, never above 15 s). Shown words come from the JSON `words` whose **midpoint** lies in `[start, end)`; segments without `words` are split evenly; if nothing matches, the optional `teaser.text` is split evenly. Audio has a 4-frame fade at both ends (no click when cutting mid-sentence) and is silent for the 0.15 s tail.
- 🧠 **Same design trick as the Hook:** `timing.introFrames` = **Hook + Teaser + Intro** (everything before Main), plus optional `timing.hookFrames` and `timing.teaserFrames` (inside `introFrames`; added only when > 0, so timings without them are byte-for-byte the same). Main, Caption, SvgStage, Header, `HadisAudio` (the full hadith still starts at `introFrames`), `audioPlan`, `dayNight`, `sceneFade` and Outro needed no change. Intro gets its own length via `introOnlyFrames(timing) = introFrames − hookFrames − teaserFrames`; the Intro voice (`intro.wav`) now starts after Hook + Teaser.
- 🧩 **New files:** `src/lib/teaser.ts` (pure: `clampTeaserRange`, `fitTeaserSeconds`, `teaserWords`, `buildTeaser`, `teaserActiveIndex`, `teaserGain`), `src/scenes/TeaserScene.tsx` (card with “ ” marks, word highlight; font by word count 120/100/84/70/60 px at 1080 base, ×0.85 in Landscape; no `overflow: hidden`), `src/components/TeaserAudio.tsx` (`<Sequence from=hook><Audio trimBefore trimAfter>` plays only the chosen part of `hadis<ID>.wav`).
- ✏️ **Changed:** `src/constants.ts` (`TEASER_ENABLED`, `TEASER_MIN_SECONDS`, `TEASER_MAX_SECONDS`, `TEASER_TAIL_SECONDS`, `TEASER_AUDIO_FADE_FRAMES = 4`, `TEASER_AUDIO_VOLUME`), `src/types.ts` (optional `teaser` in the timestamp schema; optional props `teaserSeconds`, `teaserStartSeconds`, `teaserEndSeconds` — filled by `calculateMetadata`, never typed by you), `src/lib/timing.ts` (`teaserFrames`, `teaserFramesOf`, `introOnlyFrames` minus teaser, `teaserSeconds` in `computeTiming`/`timingFromConfig`), `src/lib/introOutroAudio.ts` (Intro voice cue starts at Hook + Teaser), `src/lib/sceneFade.ts` (`planScenes(intro, main, outro, hookFrames = 0, teaserFrames = 0)` returns a `teaser` entry), `src/lib/loadHadis.ts` (`buildTeaser` → returns the three teaser props), `src/HadisVideo.tsx` (Teaser `<Sequence>`, `TeaserAudio`, Intro timing without Hook/Teaser), `src/dev/sceneFadeCases.ts` (+3 pure cases → 18; the preview header now reads "34/34") and `src/dev/HadisVideoPreview.tsx` (count text only), `AI_PROMPTS.md` (Prompt 1: `TEASER_WANTED`, rule 10, checklist, "About the Audio Teaser"), this md, `README.md`.
- ✅ **Checked here:** all 18 sceneFade cases pass in plain Node (15 old + 3 new: scene split 0/126/186/276/456, range + timing + audio cues, word picking + fade gain); `computeTiming` = `timingFromConfig` with Hook + Teaser; timings without them unchanged. **Not rendered with Remotion here** (no `npm install` possible) — in particular please check on your first run that the `<Audio trimBefore/trimAfter>` cut sounds right (starts/ends exactly on the phrase) and that the Teaser scene looks right (`action = render` with `--frames` or a full render).
- 🔒 Nothing else changed: `render.yml`, scripts, `package.json`, Main, Outro, Caption, SVG stage, themes, Hook. Your own `public/` files are never overwritten by the zip step.

**Version 2.54 → 2.55**
- 🎣 **New Hook scene before Intro:** big on-screen text **"এই হাদিসের ব্যাপারে কি আপনার জানা আছে?"** + your `hook.wav`, then Intro → Main (hadith) → Outro. Video order is now **[ Hook ][ Intro ][ Main ][ Outro ]**.
- ⏱️ **Length = hook.wav length** (no workflow input, `render.yml` unchanged): `hookSeconds = ceil((audio + 0.12 s) × 30) / 30` (4.08 s → 4.2 s = 126 frames; never above 15 s). **No `public/audio/hook.wav` → no Hook** (video is exactly as before). Switch off with `HOOK_ENABLED = false`.
- 🧠 **Key design rule — `timing.introFrames` now means "all frames before Main" = Hook + Intro**, plus a new optional `timing.hookFrames` (the Hook part, inside `introFrames`). That is why Main, Caption, SvgStage, Header, `HadisAudio`, `audioPlan`, `dayNight`, `sceneFade` and Outro needed **no change** (they all use `introFrames` as "where Main starts"). Only the Intro scene gets its own length (`introOnlyFrames(timing) = introFrames − hookFrames`) via a derived `introTiming` in `HadisVideo.tsx`. `hookFrames` is added to the object only when > 0, so timings without a Hook are byte-for-byte the same as before.
- 🧩 **New files:** `src/scenes/HookScene.tsx` (card + words spring up one by one + floating + glow "?" behind; last two words in accent colour; fade-out like Intro; no `overflow: hidden` so Bengali matra is never clipped; pure `hookWordStarts`), `public/audio/hook.wav` (your file, 4.08 s).
- ✏️ **Changed:** `src/constants.ts` (`HOOK_TEXT`, `HOOK_AUDIO_PATH`, `HOOK_ENABLED`, `HOOK_AUDIO_VOLUME`, `HOOK_AUDIO_FADE_OUT_FRAMES = 6`, `HOOK_AUDIO_TAIL_SECONDS = 0.12`), `src/types.ts` (optional `hookSeconds` — filled by `calculateMetadata`, never typed by you), `src/lib/timing.ts` (`hookFrames`, `hookFramesOf`, `introOnlyFrames`, optional `hookSeconds` in `computeTiming`/`timingFromConfig`), `src/lib/introOutroAudio.ts` (`fitHookSeconds`, `hookGain`; `planIntroOutroAudio` now returns `{ hook, intro, outro }` — Intro voice starts after the Hook, Outro unchanged), `src/lib/sceneFade.ts` (`planScenes(intro, main, outro, hookFrames = 0)` returns a `hook` entry), `src/lib/loadHadis.ts` (reads `hook.wav` length and returns `hookSeconds` in `props`), `src/lib/useIntroOutroAudio.ts` (also finds `hook.wav`; missing → `null`), `src/components/IntroOutroAudio.tsx` (`hookSrc`, plays the Hook voice at frame 0), `src/HadisVideo.tsx` (Hook `<Sequence>`; Intro starts after it), `src/dev/sceneFadeCases.ts` (+3 pure cases → 15) and the count text in `src/dev/HadisVideoPreview.tsx` (12 → 15 sceneFade cases, so that preview now shows "31/31"), `AI_PROMPTS.md` ("About the Hook"), this md and the tree.
- ✅ **Checked here:** the 15 sceneFade cases (12 old + 3 new) all pass in plain Node; maths for your file: 4.08 s → 4.2 s → Hook 126 + Intro 90 + Main + Outro; voice cues Hook 0–126, Intro 126–216, Outro after Main; `computeTiming` = `timingFromConfig`; timings without a Hook identical to before. The layout of the big text was checked in a browser at 1080×1920 (3 lines, inside the card). **Not rendered with Remotion here** (no network for `npm install`) — the first real check is your GitHub run (`action = check`, then `render`).
- 🔒 Nothing else changed: `render.yml`, `render.mjs`, `renderPlan.mjs`, `package.json`, `check.mjs`, Main, Outro, Caption, SVG stage, themes. The zip step skips `.github/workflows/*` and never overwrites your own `public/` files (`unzip -n` adds `hook.wav` if it is new).

**Version 2.53 → 2.54**
- 🖼️ **Landscape Intro only:** the app name is now on **one line** (Portrait keeps two lines), and the app name + "আজকের হাদিস" ribbon + book label are **centered** in the text column (they were left-aligned in Landscape).
- 🧩 **File changed (1 code file + this md):** `src/scenes/IntroScene.tsx` — `lines = isPortrait ? splitAppName(...) : [APP_NAME]` with `FitText maxLines={1}` in Landscape; Landscape card width `0.74 → 0.80` of the frame (text column ≈ 1022 px, so the one-line name fits at almost the full 66 px; `FitText` still shrinks it down to 55 % if a different app name is longer); `align` is always `"center"`, `textAlign="center"`, ribbon `alignSelf: "center"`. The logo stays on the left of the card, and the card itself stays centered in the frame.
- 🔒 Nothing else changed: Portrait Intro, Main, Outro, the Bengali clipping fix (2.52), the Intro/Outro voice (2.53), timings, scripts, tests. `splitAppName` is kept (still used for Portrait). Not rendered here — please check the Landscape Intro in your next run.

**Version 2.52 → 2.53**
- 🔊 **Intro and Outro now play your voice files (audio only, no captions):** `inro.wav` (typo) → `public/audio/intro.wav`, `outro.wav` → `public/audio/outro.wav`.
- 🧩 **New files:** `src/lib/introOutroAudio.ts`, `src/lib/useIntroOutroAudio.ts`, `src/components/IntroOutroAudio.tsx`, `public/audio/intro.wav`, `public/audio/outro.wav`. **Changed:** `src/constants.ts` (new constants at the end only), `src/lib/loadHadis.ts` (`loadVoiceSeconds`; `calculateHadisMetadata` fits intro/outro seconds to the voice and returns them in `props`), `src/HadisVideo.tsx` (mounts `IntroOutroAudio`; turns the scene SFX off when a voice file exists), this md.
- ✅ **Checked:** TypeScript clean for the new/changed files; pure maths run in Node (3 s + 5.44 s → 167 frames, 4 s + 5.52 s → 169 frames, user 8 s stays 8 s, 0 stays 0, clamp 15 s, fade 1 → 0 over the last 6 frames). Not rendered here — the first real check is your GitHub run.
- 🔒 Nothing else changed (the Bengali clipping fix of 2.52, all other `src/`, scripts, `render.yml`, `package.json`, tests, Part 15 plan).

**Version 2.51 → 2.52**
- 🔧 **Bug fix (not a font problem): the Bengali app name and book name were clipped at the top** in Intro, Main (Header) and Outro, and the Main caption was clipped at top and bottom. Cause: Bengali glyphs (matra, ই-kar, reph) rise above the line box, but `FitText` (`overflow: hidden`, line-height 1.18–1.3), the Header/Intro label pills (`overflow: hidden`), the Intro name mask (only 6 unit padding) and the Ribbon (`line-height: 1` + `clip-path`) cut them. The caption was clipped for a different reason: every word is `inline-block` with `0.05em` side padding, but the fit calculation measured plain text, so real text wrapped into more lines than estimated and the fixed-height box cut the first and last lines.
- 🧩 **Files changed (6 code files + this md):** `src/components/FitText.tsx` (ascent/descent padding + equal negative margins; exported `ASCENT_PAD_EM = 0.34`, `DESCENT_PAD_EM = 0.2`; no padding below when wrapped to avoid showing the next line), `src/components/Header.tsx` (label pill `overflow: visible`), `src/components/Ribbon.tsx` (`lineHeight` 1 → 1.4; height still set by `height`), `src/scenes/IntroScene.tsx` (name mask padding 0.4em / 0.3em with equal negative margins; slide-in offset 110 % → 150 %; label pill `overflow: visible`), `src/scenes/OutroScene.tsx` (name line `overflow: visible`), `src/components/Caption.tsx` (measuring span now uses the same `inline-block` words; after the estimate it measures the real height and shrinks the font by 6 % steps, down to 75 % of `captionMin`, until it fits — stable inside a segment, so no jitter; render-safe), `src/lib/captionWords.ts` (`LINE_FILL` 0.92 → 0.86).
- 🔒 Nothing else changed: layouts, colours, timings, audio, SVG stage, `outroPlan.ts`, `render.mjs`, `render.yml`, `package.json`, tests. `fitCaption` stays pure and its existing cases still hold (checked: 500 px → 1 line at 66 px; 5000+ px → shrinks and wraps). Part 14C file 2 (`README.md`) is still next.

**Version 2.50 → 2.51**
- 🧩 **Part 14C, file 1 of 2 delivered:** `AI_PROMPTS.md` — **English, step by step, one prompt per file** (as requested): Prompt 1 timestamp JSON; Prompt 2 plan + one prompt per `svg<N>.svg`; Prompt 3 SFX plan + one prompt per SFX file; checklists, valid SVG example, final upload checklist, the "replace the sample `whoosh.mp3`" note. The 14C plan said "Bengali + English headings"; changed to all-English on request. Header, tracker, file tree, 14C section (file progress, checklist ticks, done note) and the continue line updated; next is `পরের ফাইল` (14C file 2: `README.md`). No code changed.

**Version 2.49 → 2.50**
- ✅ **Part 14B delivered:** the real `scripts/render.mjs` (replaces the stub; bundle once, jobs one after another, `selectComposition` + `renderMedia`, `--frames` test renders with `_test` suffix, progress every ~10 %, final table + `$GITHUB_STEP_SUMMARY`, Bengali explanations for `[HADIS_DATA]` and out-of-memory errors, exit code 1 on any failed job). Header, tracker, 14B section (checklist ticks, done note), file tree and the continue line updated; next is `Part 14C দাও`. Nothing else changed (`render.yml`, `package.json`, `check.mjs`, `renderPlan.mjs`, all `src/`).

**Version 2.48 → 2.49**
- ✅ **Part 14A finished (file 2 of 2):** `scripts/test-render-plan.mjs` (65 pure cases, all pass in plain Node). Header, tracker, 14A section (file progress, checklist ticks, done note), file tree and the continue line updated; next is `Part 14B দাও`. Nothing else changed.

**Version 2.47 → 2.48**
- 🧩 **Part 14A, file 1 of 2 delivered:** `scripts/lib/renderPlan.mjs` (argument parsing, validation, job list, output names, input pre-checks, `--dry-run` table, report formatter). `scripts/test-render-plan.mjs` (file 2) came next. Header, tracker, 14A section (file progress, checklist ticks, done note) and the continue line updated. Nothing else changed (`render.mjs` stub, `render.yml`, `package.json`, `check.mjs`, all Parts 1–13 code).

**Version 2.46 → 2.47**
- 🔀 **Part 14 split into 3 sub-parts:** 14A (`scripts/lib/renderPlan.mjs` + `scripts/test-render-plan.mjs`: argument parsing, validation, job list, output names, input pre-checks, `--dry-run`, pure cases), 14B (the real `scripts/render.mjs`: bundle + `selectComposition` + `renderMedia`, HD/4K, both orientations, concurrency/crf, progress, errors), 14C (`AI_PROMPTS.md` three prompts + `README.md` usage). Tracker, file tree, header, "How to use" and continue line updated. **All original Part 14 details (arguments, output names, `--scale 2`, concurrency/crf, missing-file error, the three prompts, Islamic etiquette rule, `render.yml` unchanged) are kept** and spread across 14A–14C.
- 🧹 **Completed Parts condensed:** the long done notes, checklists, "how it was verified" notes, preview-image details and the old change log (2.37 – 2.46) of Parts 9–13 were removed; every API, fixed rule, constant, number and "what Part 14 needs" item is kept (Parts 9, 12, 13 are now one section each). The visual-check table was shortened to image + header + one thing to look at.
- 🔧 Small deliberate additions (planned, not yet built): `renderPlan.mjs` + `test-render-plan.mjs`, optional `--dry-run`, `--frames`, `--concurrency`, `--crf`, `--out-dir`; SVG rules now also say "no gaps in numbering".
- 🔒 Nothing else changed: all code of Parts 1–13, Part 15 plan, Step 0 decisions, themes, JSON schema, `render.yml`, `package.json`, `check.mjs`.

**Older history:** 2.12 condensed Parts 1–8 and made this English edition a separate file (`HadisVideokit_EN.md`; the Bengali one is `HadisVideokit.md`); 2.13 – 2.46 added Parts 9A – 13C (details now live in the "Done" sections).

---

*To continue, write: **"পরের ফাইল"** (= "next file" — 14C file 2: `README.md`)*


## Update: bottom progress bar + render settings + thumbnail order

- **Thumbnail order** (top → bottom): Intro (logo + `APP_NAME` + "পর্ব N" series badge) → Teaser → Hook. The "আজকের হাদিস" ribbon and the book name / hadith number label are **no longer drawn on the thumbnail** (the video's Intro and Header still show them). `ThumbnailScene` still accepts the `bookname`/`number` props (unused) so `Root.tsx` is unchanged. File: `src/scenes/ThumbnailScene.tsx`.
- **Progress bar:** `src/components/ProgressBar.tsx`, mounted at the top level of `HadisVideoView` (`src/HadisVideo.tsx`) above all scenes; fills left→right over the whole video (progress = frame ÷ (totalFrames − 1)); theme accent → accent2 gradient + glow head; dark translucent track. Constants in `src/constants.ts`: `PROGRESS_BAR_ENABLED`, `PROGRESS_BAR_HEIGHT`, `PROGRESS_BAR_SIDE_MARGIN`, `PROGRESS_BAR_BOTTOM` (portrait sits in the Shorts safe area, landscape in the bottom margin). Set `PROGRESS_BAR_ENABLED = false` to turn it off.
- **Render settings** (`scripts/render.mjs` → `renderMedia`): `codec h264`, `crf 18` (default, `--crf` overrides), `audioCodec aac`, `audioBitrate 192k`, `pixelFormat yuv420p`, 30 fps (`FPS`). Everything else in the `renderMedia` options list is unchanged.

## Update: visual hook (topic-matching SVG animation in the very first moment)

- `HookScene` (first scene of the video) now shows an animated SVG from frame 0, next to/above the big question text: portrait = SVG on top (640 u) + text card below (font 108 u); landscape = SVG on the left (600 u) + text card on the right (font 84 u). The SVG is fully visible on the first frame (opacity 1; only a quick 0.85 → 1 scale spring) so the Shorts first frame is never empty. Text/word-stagger/fade-out/voice are unchanged.
- **Which SVG** (`src/lib/hookSvg.ts` → `pickHookSvg`, pure): 1) optional top-level `"hookSvg": "svgN"` in `hadis<ID>_timestamp.json` (must exist in `public/svg/`); 2) the SVG of the segment that contains the teaser start (`teaserStartSeconds`; same rotation/forced-name rules as Main via `pickSvgNames`, so Main's order is untouched); 3) the first segment's SVG; 4) empty folder → fallback star icon. A wrong/missing `hookSvg` silently falls back to step 2.
- Drawing: `src/components/HookVisual.tsx` reuses `StageLayer` (now exported from `SvgStage.tsx`) + the same glow/disc/float as the Main stage; ids/classes use prefix `hook-s0-`; SVG animation runs on the Hook's own frame 0…; waits for inventory + JSON (their `delayRender`).
- Schema: `types.ts` → `timestampFileSchema` gets optional `hookSvg` (`/^svg\d+$/`). `AI_PROMPTS.md` Prompt 1: new rule 11 + checklist item (optional). Toggle: `HOOK_VISUAL_ENABLED` in `constants.ts`. `HookScene` new optional props `hadisId`, `teaserStartSeconds` (without `hadisId` it draws text only, as before; `dev/sceneFadeCases.ts` still imports `hookWordStarts` unchanged).

---

## 📊 Infographic cards + thumbnail clean-up (latest change)

- 🖼️ **Thumbnail (both 9:16 and 16:9):** the "আজকের হাদিস" ribbon and the "book name + হাদিস নং : number" label were removed from the Intro card. Everything else stays: logo, app name, "পর্ব N" badge, Teaser card, Hook card, theme/background, 4K output. **Changed:** `src/scenes/ThumbnailScene.tsx`.
- 📊 **Infographic (optional):** a new optional top-level `infographics` array in the timestamp JSON shows information cards in the SVG area (`svgBox`) at a given time. Types: `steps`, `list`, `compare`. No `infographics` in the JSON → nothing is drawn and the video is unchanged.
  - JSON shape: `{ start, end, type, title?, leftTitle?, rightTitle?, items: [{ text, side?, at? }] }` — seconds from the start of the .wav; 2–6 items; max 8 cards; cards in time order and not overlapping (checked by `parseTimestampFile`).
  - Timing: `buildFrameInfographics` (in `src/lib/infographic.ts`) adds the Intro offset and clamps into Main like segments do; the card fades in/out over `min(12, ⌊length ÷ 3⌋)` frames; items without `at` appear evenly (first after 6 frames, the rest inside the first 75% of the card time), each fading in over 10 frames. No CSS transitions — all frame-driven.
  - Drawing: `src/components/Infographic.tsx` uses `computeLayout().svgBox` (so 4K = exactly 2× HD), the theme palette, `FitText`, Bengali digits for the numbers. The card is opaque so it covers the SVG below it; it sits inside the existing `stage` slot of `MainScene`, so the slot list used by `MainSceneCheck` is unchanged.
  - AI help: `AI_PROMPTS.md` Prompt 1 has the new optional input `INFOGRAPHIC_WANTED` and rule 12 (use only what the hadith itself says — nothing added), plus a checklist line.
- 🧩 **New files:** `src/components/Infographic.tsx`, `src/lib/infographic.ts`. **Changed:** `src/types.ts` (`infographics`, `INFOGRAPHIC_TYPES`, `infographicSchema`), `src/scenes/MainScene.tsx`, `src/scenes/ThumbnailScene.tsx`, `AI_PROMPTS.md`, `README.md`, this md.
- ✅ Checked: `tsc --noEmit` is clean; schema accepts a valid file, rejects a card with fewer than 2 items and overlapping cards; frame conversion and fade/progress values were run once in Node. ⚠️ Not rendered yet — please run `action = check` (or Studio) with a JSON that has `infographics` and look at the card once.
