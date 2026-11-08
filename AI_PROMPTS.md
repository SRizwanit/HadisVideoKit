# AI_PROMPTS.md — HadisVideokit

Copy-paste prompts for any AI chat (Claude, ChatGPT, Gemini …) that produce **exactly the files the kit accepts**.
Work **one file at a time, one step at a time**. Never ask the AI for several files in one answer.

> **Golden rules (apply to every prompt below)**
> 1. The AI must **never change the hadith text.** It only copies the text you give it. Hadith/ayah text and translation must come from a verified source you trust.
> 2. **One file per answer.** If the AI sends two files, ask again for one.
> 3. Answers must contain **only the file content** (no explanation, no greeting, no Markdown code fence). Paste the answer into a new file with the exact name given in each step.
> 4. Islamic etiquette: **no faces of humans or animals** in any drawing.

---

## Overview — all files, in the order you make them

| Step | File you create | Where it goes in the repo | Prompt |
|---|---|---|---|
| 0 | `hadis<ID>.wav` (your recorded/generated voice) | `public/hadis/hadis<ID>.wav` | not an AI file |
| 0b | `hook.wav` (the opening question voice, same for every video) — **optional** | `public/audio/hook.wav` | not an AI file (see "About the Hook" below) |
| 1 | `hadis<ID>_timestamp.json` (optionally with a `teaser` block = Audio Teaser) | `public/hadis/hadis<ID>_timestamp.json` | **Prompt 1** |
| 2 | `svg1.svg`, `svg2.svg`, … `svgN.svg` (one prompt per file) | `public/svg/svg1.svg` … | **Prompt 2A + 2B** |
| 3 | SFX list, then each SFX file (one at a time) | `public/sfx/<name>.mp3` | **Prompt 3A + 3B** |

### About the Hook (opening question) — `public/audio/hook.wav`

Every video can start with a **Hook**: a big on-screen question **"এই হাদিসের ব্যাপারে কি আপনার জানা আছে?"** while `hook.wav` plays, then Intro → hadith (Main) → Outro.
- **GitHub Actions has two optional fields for the Hook** (leave them empty and everything is automatic):
  - `hook_text` — the big on-screen text. Empty = the default question above (the constant `HOOK_TEXT` in `src/constants.ts`). If you type a different text, it must match the voice in `hook.wav` **word for word**.
  - `hook_seconds` — how long the Hook lasts. Empty = automatic: the length of `hook.wav` (+ 0.12 s). A number = at least that many seconds (a longer `hook.wav` always wins — the voice is never cut; with no `hook.wav` the Hook is silent for that many seconds). `0` = no Hook.
- **No `public/audio/hook.wav` and no `hook_seconds` = no Hook** (the video starts with Intro, exactly as before). To switch the Hook off for every video without deleting the file, set `HOOK_ENABLED = false` in `src/constants.ts`.
- `hook.wav` is a voice file, so it is **not** made with the prompts below. One file is shared by all hadiths; keep it small (a few seconds) and clear, with no background music.
- Hook, Intro and Outro show **no captions** (captions exist only in Main).

### About the Audio Teaser (cold open) — optional, chosen inside the timestamp JSON

After the Hook, the video can play the **strongest phrase of the hadith first** (big text, the spoken word glows), and then Intro → the full hadith from the very beginning. Order: **Hook → Teaser → Intro → Hadith → Outro**.
- **Two things must both be true for the Teaser to play:** (1) the GitHub Actions tick-box **`teaser`** is ON (it is on by default), and (2) the JSON has a `teaser` block. Prompt 1 below can make that block for you. **No `teaser` block = no Teaser** (the video is exactly as before), even if the tick-box is on. **Tick-box OFF = no Teaser**, even if the JSON has the block (so one JSON works both ways).
- `teaser` is `{ "start": 12.4, "end": 17.9 }` in seconds, measured from the start of the hadith `.wav` (same clock as the segments). The audio of exactly that part is played, with a tiny fade at both ends.
- Length rules (the code enforces them): shorter than 0.5 s → ignored; longer than 12 s → cut to 12 s; `end` beyond the audio → cut to the audio length. The Teaser scene lasts the phrase + 0.15 s.
- The words shown come from the `words` timings of the segments inside that range (so **word-level times give the best result**). Without `words` the segment text is split evenly. Optional `"text"` inside `teaser` is only a fallback when no segment matches.
- **Pick a complete, meaningful phrase** (a full clause, ideally 3–15 words) that starts at a word start and **ends at a real pause** (end of a sentence, followed by silence) — never in the middle of a word and never between two words spoken without a gap. If the voice sounds "cut off" at the end of the Teaser, move `end` to the next pause (or add ~0.1–0.15 s of the silence after the last word). The phrase must be a part of the hadith that is really spoken there; the AI must never write new words.
- To switch the Teaser off for one render: untick `teaser` in GitHub Actions. To switch it off everywhere: `TEASER_ENABLED = false` in `src/constants.ts`.

`<ID>` is the `hadis_id` you type in GitHub Actions, for example `0101` → `hadis0101.wav`, `hadis0101_timestamp.json`. Allowed characters: English letters, digits, `-` and `_` only.

---

# PROMPT 1 — Timestamp JSON (one file: `hadis<ID>_timestamp.json`)

## Step 1.1 — Collect what the AI needs

You need these things before you paste the prompt:

1. **HADITH_TEXT** — the exact hadith text (Bengali), exactly as it is spoken in the audio.
2. **AUDIO_TIMING** — when each part is spoken. Use one of:
   - a transcript with timestamps from a speech tool (word-level is best), or
   - the audio length in seconds, if you have nothing else (the AI will then split the time evenly).
3. **SVG_COUNT** — how many SVG files you plan to make (for example `4`). If you plan none, write `0`.
4. **TEASER_WANTED** — `yes` if you want the Audio Teaser (cold open) after the Hook (needs word-level times), otherwise `no`.

## Step 1.2 — Paste this prompt

```text
You are a subtitle-timing assistant. Produce ONE JSON file and nothing else.

INPUT
- HADITH_TEXT (Bengali, must be copied EXACTLY, letter by letter):
<<< paste the hadith text here >>>
- AUDIO_TIMING (seconds measured from the very start of the .wav file):
<<< paste the timestamps here, or: "audio length = 38.5 seconds, no timestamps" >>>
- SVG_COUNT: <<< number, e.g. 4 >>>
- TEASER_WANTED: <<< yes or no >>>

OUTPUT FORMAT — return exactly this JSON structure and NOTHING else
(no explanation, no greeting, no Markdown code fence, no comments):
{
  "language": "bn",
  "teaser": { "start": 12.4, "end": 17.9 },
  "segments": [
    {
      "id": 1,
      "start": 0.0,
      "end": 3.4,
      "text": "<exact words of this part>",
      "words": [
        { "word": "<one word>", "start": 0.0, "end": 0.7 }
      ],
      "svg": "svg1",
      "sfx": { "name": "whoosh", "volume": 0.6 }
    }
  ]
}

HARD RULES (a file that breaks any rule is rejected by the video code)
1. Text: copy HADITH_TEXT exactly. Do NOT correct, translate, shorten, reorder, add or remove any word, diacritic or punctuation. Joining all "text" values in order must give back HADITH_TEXT.
2. Times: "start" and "end" are numbers in seconds (decimals allowed, e.g. 3.4), measured from the start of the .wav. Never negative. For every segment end > start. Segments are sorted by start (each start is >= the previous start).
3. Segment length: each segment has fewer than 25 words (aim for 8 to 18). Split at natural pauses or sentence ends. Do not create one huge segment.
4. Gaps: segments should follow each other without overlap. A small gap is allowed only where there is real silence in the audio. Do not invent a gap.
5. "words" is OPTIONAL. Include it ONLY if AUDIO_TIMING has word-level times. If you include it: every word of the segment appears once, in order, with word start/end inside the segment's start/end, and each "word" is non-empty. If you do not have word-level times, OMIT "words" completely (do not guess).
6. "svg" is OPTIONAL. If SVG_COUNT is greater than 0, give every segment an "svg" value of the form "svg1", "svg2", ... up to "svg<SVG_COUNT>" (letters "svg" + a number, nothing else). Spread them in order; reuse from svg1 again when the numbers run out. If SVG_COUNT is 0, OMIT "svg".
7. "sfx" is OPTIONAL. Use it sparingly: at most one segment out of every three. "name" may only be one of: whoosh, pop, chime, ding, swoosh. "volume" is a number from 0 to 1 (use 0.3 to 0.6; the default is 0.4). Put whoosh/swoosh on a strong topic change, pop on a key word, chime/ding on a closing or praise phrase. Never put sfx on the first segment (the intro already plays one). If unsure, omit "sfx".
8. "id" is OPTIONAL; if used, number the segments 1, 2, 3 ... in order.
9. The output must be valid JSON: double quotes only, no trailing commas, no comments, numbers without quotes.
10. "teaser" is OPTIONAL (a block at the top level, next to "language" and "segments"). Include it ONLY if TEASER_WANTED is "yes" AND AUDIO_TIMING has word-level times. It marks the single STRONGEST phrase of the hadith (the core message, the key promise, warning or advice), which the video plays first as a cold open. Rules: "start" = the start time of the FIRST word of that phrase (ideally right after a pause), "end" = the end time of the LAST word of that phrase PLUS up to 0.15 seconds, but never later than the start of the next spoken word (so the phrase must end at a REAL PAUSE: the end of a sentence/clause that is followed by a gap or a new segment; never between two words that are spoken without a gap, because the voice would sound cut off); the phrase is one complete, meaningful clause of 3 to 15 words, lasting between 1 and 10 seconds (never less than 0.5 and never more than 12); it must lie inside the audio, with end > start, and it is NOT cut out of the segments (the segments still cover the whole hadith from the start to the end). Do NOT add "text" to teaser. If TEASER_WANTED is "no", or there are no word-level times, OMIT "teaser" completely.

RETURN ONLY THE JSON.
```

## Step 1.3 — Check the answer before you save it (30 seconds)

- [ ] Starts with `{` and ends with `}`, no ` ``` ` and no sentence before or after
- [ ] The Bengali text of all segments, joined, equals your hadith text (no change)
- [ ] Every segment: `end` is larger than `start`; times only go forward
- [ ] No segment is longer than about 25 words
- [ ] `svg` values are only `svg1`, `svg2` … and the numbers are not larger than your SVG count
- [ ] `sfx.name` is one of `whoosh`, `pop`, `chime`, `ding`, `swoosh`
- [ ] The last `end` is not (much) larger than the audio length
- [ ] If you asked for a Teaser: there is one `"teaser": { "start": …, "end": … }` block at the top level; `end` is larger than `start`; the span is between 1 and 10 seconds; its start matches the start of a word, its end is the end of a word (plus at most 0.15 s of pause) and ends where the speaker really pauses — so the sentence does not sound cut off; the phrase is really spoken there. If you did not ask for one, there is no `teaser` block

If one item fails, reply to the AI with the exact problem ("segment 3 has end smaller than start") and ask for the **whole JSON again**.

## Step 1.4 — Save and upload

Save as `hadis<ID>_timestamp.json` (same `<ID>` as the `.wav`) → upload to `public/hadis/`.

> If the run says the JSON is not valid, open it in any JSON checker, or paste it back to the AI: "Fix this JSON, change nothing else, return only the JSON."

---

# PROMPT 2 — Animated SVG (one prompt per SVG file)

The kit plays **one SVG per segment** in the middle of the video. Make them **one file per AI answer**: `svg1.svg`, then `svg2.svg`, and so on.
Files must be numbered **without gaps** (`svg1`, `svg2`, `svg3` …). The renderer looks for `svg1`, `svg2` … in order and **stops at the first missing number** (maximum 60 files).

## Step 2.0 — Plan the pictures first (Prompt 2A, one answer, no file)

Paste this to get a plan. It creates no file; you only read it and approve it.

```text
I am making a short Islamic hadith video. For each text segment below, suggest ONE simple animated picture idea.

SEGMENTS (in order):
1. <<< segment 1 text >>>
2. <<< segment 2 text >>>
3. <<< segment 3 text >>>

RULES FOR THE IDEAS
- NO faces and NO bodies of humans or animals. Use only symbols: geometric patterns, stars, crescents, lanterns, books, a mosque dome silhouette without people, plants, trees, leaves, water drops, sun/moon/clouds, light rays, doors, scales, hearts as simple shapes, hands NOT allowed.
- Each idea must be drawable with simple shapes (circles, rectangles, paths) and a looping motion (rotate, pulse, float, glow, grow, wave).
- The picture should hint at the meaning of the segment, not illustrate people.

OUTPUT: a numbered list: "svg1: <idea in one line> — <motion in one line>", "svg2: ...". Same count as the segments, numbering from 1 with no gaps. Nothing else.
```

Read the list. Change any idea you do not like. Then do **Step 2.1 for each number, one at a time.**

## Step 2.1 — Paste this prompt for ONE SVG file (repeat for svg1, svg2, svg3 …)

Replace `N` with the file number and describe the idea from your plan.

```text
Create ONE animated SVG file named svg<N>.svg. Return ONLY the SVG code (starting with <svg and ending with </svg>), no explanation and no Markdown code fence.

PICTURE IDEA
<<< e.g. "svg2: a lantern whose light slowly pulses, with small stars twinkling around it" >>>

TECHNICAL RULES (all are mandatory, the video code depends on them)
1. Root tag exactly: <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg"> . Do NOT write width or height. Draw inside 0..1000 and keep important shapes inside 80..920.
2. Background is TRANSPARENT: no full-size background rectangle, no background fill.
3. Animation only with CSS @keyframes inside one <style> block, or with SMIL (<animate>, <animateTransform>, <animateMotion>, <set>). Never JavaScript.
4. FORBIDDEN: <script>, <foreignObject>, <iframe>, <object>, <embed>, <link>, <image> with external or data links, external fonts, @import, url(http...), any attribute starting with "on" (onclick, onload ...), javascript: links, <!DOCTYPE>, <?xml ...?>.
5. Loop: the whole picture repeats every 6 seconds. Every animation duration must divide 6 evenly (2s, 3s or 6s) and loop forever: CSS "infinite" or SMIL repeatCount="indefinite". The last frame must flow smoothly into the first.
6. SMIL timing must be time-based only: begin="0s" or a negative/positive time such as begin="-2s" or begin="1s", or begin="otherId.end". NEVER begin="click", begin="indefinite", accessKey, or any event.
7. STYLE WITH CLASSES AND IDS ONLY. Never write bare element selectors in CSS (no "circle { }", "g { }", "path { }", "svg { }"). Name every class, id and @keyframes with the prefix "svg<N>-" (example: .svg<N>-star, #svg<N>-glow, @keyframes svg<N>-spin) so two SVGs on screen never collide.
8. For rotation or scaling with CSS always set transform-origin in px inside the 1000x1000 space (example: transform-origin: 500px 500px;).
9. Colours must be readable on three dark backgrounds (dark green, dark navy, night-green): use white (#ffffff), warm gold (#f5d77a, #f0c040), bright green/teal (#2ecc71, #1abc9c), soft sky blue (#8fd3ff). NEVER use pure black or very dark colours. Use opacity for softness.
10. NO faces and NO bodies of humans or animals (no eyes, no mouths, no hands, no birds, no fish). Symbols, geometry, plants, objects only.
11. Keep it light: under 150 elements, under 30 KB, no filters with heavy blur (a simple gradient glow is fine).
12. Text inside the SVG is not allowed (the video shows its own captions).

SELF-CHECK BEFORE YOU ANSWER
- Does the first line start with <svg viewBox="0 0 1000 1000" ?
- Is every class/id/keyframes name prefixed with svg<N>- ?
- Is there any bare selector, <script>, on...= attribute, or external link? (there must be none)
- Does every duration divide 6 seconds and repeat forever?
Then return ONLY the SVG code.
```

## Step 2.2 — A tiny example of a correct answer (for you to compare)

This is the **shape** of a valid file (your picture will be richer):

```svg
<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="svg3-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#fff6c8" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#f5d77a" stop-opacity="0"/>
    </radialGradient>
    <style>
      @keyframes svg3-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes svg3-pulse { 0%, 100% { transform: scale(0.85); opacity: 0.4; } 50% { transform: scale(1.1); opacity: 1; } }
      .svg3-star { animation: svg3-spin 6s linear infinite; transform-origin: 500px 500px; }
      .svg3-halo { animation: svg3-pulse 3s ease-in-out infinite; transform-origin: 500px 500px; }
    </style>
  </defs>
  <circle class="svg3-halo" cx="500" cy="500" r="330" fill="url(#svg3-glow)"/>
  <g class="svg3-star">
    <rect x="320" y="320" width="360" height="360" rx="16" fill="none" stroke="#f5d77a" stroke-width="14"/>
    <rect x="320" y="320" width="360" height="360" rx="16" fill="none" stroke="#1abc9c" stroke-width="14" transform="rotate(45 500 500)"/>
  </g>
  <circle cx="500" cy="500" r="40" fill="#ffffff">
    <animate attributeName="r" values="40;56;40" dur="3s" begin="0s" repeatCount="indefinite"/>
  </circle>
</svg>
```

## Step 2.3 — Check each SVG before you save it

- [ ] Starts with `<svg viewBox="0 0 1000 1000"` and ends with `</svg>`
- [ ] No `<script>`, no `onclick=`/`onload=`, no `http` links, no `<image>`
- [ ] No bare selector like `circle {` in the CSS
- [ ] All durations are 2s / 3s / 6s and loop forever
- [ ] No faces, eyes, hands, birds, fish
- [ ] File name is exactly `svg<N>.svg` and the number follows the previous one (no gap)

If something fails, reply to the AI: "Fix only this problem: <problem>. Return the whole SVG again, nothing else."

## Step 2.4 — Save and upload

Save as `svg<N>.svg` → upload to `public/svg/`. Do the next number only after this one is saved.

> Your own `svg1.svg` / `svg2.svg` **replace** the sample pictures that came with the kit. If you make fewer SVGs than you have segments, the kit reuses them in a loop. If there is no SVG at all, a simple star appears instead.

---

# PROMPT 3 — Sound effects (SFX)

## Step 3.0 — Know the names (the code uses these exact names)

| Name | Where the kit uses it | Suggested use inside the JSON |
|---|---|---|
| `whoosh` | automatically at the start of the intro and at the move from main to outro | strong topic change |
| `chime` | automatically when the hadith label appears in the intro | closing or praise phrase |
| `pop` | only if you put it in the JSON | emphasise one key word |
| `ding` | only if you put it in the JSON | a point is completed |
| `swoosh` | only if you put it in the JSON | a smooth change |

- Files are `public/sfx/<name>.mp3` (a `.wav` also works). Names are case-sensitive and use only English letters, digits, `-`, `_`.
- A missing file is **not an error**: that sound is simply silent.
- A sound longer than **4 seconds** is cut. Keep each effect between 0.3 and 2 seconds.
- Default loudness is **0.4**. Use 0.3–0.6 for most; never above 0.8 (the voice must stay clear).

> **Important:** the file `public/sfx/whoosh.mp3` that came with the kit is only a **synthetic sample** so the first render has a sound. **Replace it with real royalty-free files named `whoosh`, `pop`, `chime`, `ding`, `swoosh`** (`.mp3` or `.wav`). Upload them to `public/sfx/` with exactly those names.

## Step 3.1 — Prompt 3A: where to use SFX in this hadith (no file)

```text
I have a hadith video with these text segments (in order):
1. <<< segment 1 text >>>
2. <<< segment 2 text >>>
3. <<< segment 3 text >>>

The only sound effects I can use are: whoosh, pop, chime, ding, swoosh.
Suggest where to use them, following these rules:
- Use at most one effect for every three segments, and none on segment 1.
- whoosh/swoosh only on a strong topic change; pop on one key word; chime or ding on a closing or praise phrase.
- Volume between 0.3 and 0.6 (default 0.4).
- If a segment does not need a sound, say "none".

OUTPUT: a table with columns: segment number | effect name or "none" | volume | one-line reason. Nothing else.
```

Copy the answers into the JSON as `"sfx": { "name": "...", "volume": 0.5 }` (or ask Prompt 1 to include them).

## Step 3.2 — Prompt 3B: find each SFX file (one prompt per file; no file is generated by the AI)

Do this for each name you need: `whoosh`, then `pop`, then `chime`, then `ding`, then `swoosh`. Replace `<NAME>`.

```text
I need ONE royalty-free sound effect for a short Islamic video: "<NAME>".
Description: <<< whoosh = short soft air sweep, 0.5-1 s | pop = small soft bubble pop, 0.2-0.4 s | chime = gentle bell chime, 1-2 s | ding = single clean light bell ding, 0.5-1 s | swoosh = smooth light sweep, 0.5-1 s >>>

Give me:
1. Three free sources where I can download such a sound legally for videos (for example Pixabay Sound Effects, Mixkit, Freesound with a CC0 filter). Say what licence to look for (CC0 or "free for commercial use, no attribution").
2. The exact search words to type for this sound.
3. What to check before using it: length under 2 seconds, no music, no voice, no clipping, mono or stereo MP3, not too loud.
Do not invent file links. Do not give me a download link you are not sure exists.
```

After downloading: rename the file to `<NAME>.mp3` (all lower-case) → upload to `public/sfx/`.

## Step 3.3 — SFX checklist

- [ ] Licence is CC0 or "free for commercial use" (keep the page link for yourself)
- [ ] File name is exactly `whoosh.mp3`, `pop.mp3`, `chime.mp3`, `ding.mp3` or `swoosh.mp3`
- [ ] Each file is under 4 seconds (better under 2)
- [ ] No music and no human voice inside the effect
- [ ] The sample `whoosh.mp3` from the kit has been replaced

---

# After all files are ready — final upload checklist

0. (once) `public/audio/hook.wav` — opening question voice (optional; no file = no Hook)
1. `public/hadis/hadis<ID>.wav`
2. `public/hadis/hadis<ID>_timestamp.json`
3. `public/svg/svg1.svg` … `svgN.svg` (no gaps)
4. `public/sfx/<name>.mp3` for the effects you use
5. GitHub → **Actions → Render Hadis Video → Run workflow** → `action = render`, `hadis_id = <ID>`, `hadis_bookname`, `hadis_number` (Bengali digits are best), theme, orientation, quality. Optional: `hook_text`, `hook_seconds` (both empty = automatic) and the `teaser` tick-box (on = play the Teaser if the JSON has one). Leave `zip_file` empty.

If the run fails, copy the **red text** of the failed step and send it. Most file problems are reported in Bengali with the file name and what to do.
