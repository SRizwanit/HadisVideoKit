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
| 0c | `hadis<ID>_words.txt` (word timings made in Google Colab; only pasted into Prompt 1, not uploaded to the repo) | not uploaded | **Prompt 0** |
| 1 | `hadis<ID>_timestamp.json` (optionally with a `teaser` block = Audio Teaser) | `public/hadis/hadis<ID>_timestamp.json` | **Prompt 1** |
| 2 | `svg1.svg`, `svg2.svg`, … `svgN.svg` (one prompt per file; each SVG has 3 stages, 6 s loop) | `public/svg/svg1.svg` … | **Prompt 2A + 2B** |
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
- `teaser` is `{ "start": 12.4, "end": 17.9 }` in seconds, measured from the start of the hadith `.wav` (same clock as the segments). That part of the audio is played, plus a short silent tail of 0.15 s after `end`; the fade-out happens inside that tail (so the last word is not faded), and there is a tiny fade-in at the start.
- Length rules (the code enforces them): shorter than 0.5 s → ignored; longer than 12 s → cut to 12 s; `end` beyond the audio → cut to the audio length. The Teaser scene lasts the phrase + 0.15 s.
- The words shown come from the `words` timings of the segments inside that range (so **word-level times give the best result**). Without `words` the segment text is split evenly. Optional `"text"` inside `teaser` is only a fallback when no segment matches.
- **Pick a complete, meaningful phrase** (a full clause, ideally 3–15 words) that starts at a word start and **ends at a real pause** (end of a sentence, followed by silence) — never in the middle of a word and never between two words spoken without a gap. If the voice sounds "cut off" at the end of the Teaser, move `end` to the next pause (or add ~0.05–0.1 s of the silence after the last word). The phrase must be a part of the hadith that is really spoken there; the AI must never write new words.
- To switch the Teaser off for one render: untick `teaser` in GitHub Actions. To switch it off everywhere: `TEASER_ENABLED = false` in `src/constants.ts`.

`<ID>` is the `hadis_id` you type in GitHub Actions, for example `0101` → `hadis0101.wav`, `hadis0101_timestamp.json`. Allowed characters: English letters, digits, `-` and `_` only.

---

# PROMPT 0 — শব্দ-ভিত্তিক সময় বের করা (Google Colab, ফ্রি)

কেন দরকার: Prompt 1 অডিও শুনতে পারে না, সে শুধু আপনার দেওয়া সময় সাজায়। অডিও-দৈর্ঘ্য দিলে সে সমান ভাগে ভাগ করে, তখন টিজার ও ক্যাপশন ঠিক জায়গায় থামে না। তাই আগে `.wav` থেকে প্রতিটা শব্দের আসল সময় বের করে নিন।

## ধাপ 0.1 — Colab খুলুন

1. https://colab.research.google.com → New notebook।
2. মেনু: Runtime → Change runtime type → **T4 GPU** (দ্রুত হয়; CPU-তেও চলে, ধীর)।
3. বাঁ পাশের ফাইল-আইকনে `hadis<ID>.wav` আপলোড করুন।
4. **সেল ১** (ইনস্টল):

```python
!pip -q install stable-ts
```

5. **সেল ২**: নিচের `AUDIO_FILE`, `ID`, `HADITH_TEXT` বদলে চালান। `HADITH_TEXT` অবশ্যই অডিওতে যা বলা হয়েছে হুবহু তা-ই হবে।

```python
import json, re, stable_whisper

AUDIO_FILE = "hadis0101.wav"
ID = "0101"
HADITH_TEXT = """এখানে হাদিসের বাংলা টেক্সট হুবহু পেস্ট করুন"""
MAX_WORDS = 18   # একটি segment-এ সর্বোচ্চ শব্দ (কিটের সীমা 25-এর নিচে)

model = stable_whisper.load_model("large-v3")   # মেমরি কম হলে "medium"
text = re.sub(r"\s+", " ", HADITH_TEXT).strip()
result = model.align(AUDIO_FILE, text, language="bn")

# বাক্য-চিহ্নে ভাগ, তারপর বেশি লম্বা হলে শব্দ-সংখ্যায় ভাগ
result.split_by_punctuation(["।", "॥", "?", "!", ",", "،"])
result.split_by_length(max_words=MAX_WORDS)

segments = []
for i, seg in enumerate(result.segments, 1):
    words = [
        {"word": w.word.strip(), "start": round(w.start, 2), "end": round(w.end, 2)}
        for w in seg.words if w.word.strip()
    ]
    if not words:
        continue
    segments.append({
        "id": i,
        "start": words[0]["start"],
        "end": words[-1]["end"],
        "text": " ".join(w["word"] for w in words),
        "words": words,
    })

# segment-এর মাঝের ছোট ফাঁক বন্ধ করা (overlap/উল্টো সময় যেন না থাকে)
for a, b in zip(segments, segments[1:]):
    if b["start"] < a["end"]:
        b["start"] = a["end"]

out = {"language": "bn", "segments": segments}
with open(f"hadis{ID}_timestamp.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

# Prompt 1-এ পেস্ট করার সংক্ষিপ্ত সময়-তালিকা
with open(f"hadis{ID}_words.txt", "w", encoding="utf-8") as f:
    for s in segments:
        for w in s["words"]:
            f.write(f'{w["start"]:.2f}-{w["end"]:.2f} {w["word"]}\n')

print("segments:", len(segments), "| শেষ সময়:", segments[-1]["end"])
```

6. বাঁ পাশের ফাইল-তালিকা রিফ্রেশ করে দুটি ফাইল ডাউনলোড করুন:
   - `hadis<ID>_timestamp.json` (শব্দ-সময়সহ কাঁচা JSON)
   - `hadis<ID>_words.txt` (প্রতি লাইনে `শুরু-শেষ শব্দ`)

## ধাপ 0.2 — সময় ঠিক আছে কিনা মিলিয়ে নিন (জরুরি)

বাংলায় এই টুলের নির্ভুলতা সীমিত, তাই `.wav` চালিয়ে কয়েক জায়গা শুনে দেখুন:
- [ ] প্রথম শব্দ আর শেষ শব্দের সময় অডিওর সঙ্গে মেলে
- [ ] ১০ সেকেন্ড পরপর একটা শব্দ বেছে মিলিয়ে দেখুন, ০.২ সেকেন্ডের বেশি ভুল নেই
- [ ] শেষ `end` অডিওর দৈর্ঘ্যের চেয়ে বেশি নয়
- [ ] সব segment-এর `text` জুড়লে হাদিসের টেক্সট হুবহু ফিরে আসে (টুল বানান বদলালে `HADITH_TEXT` ঠিক করে আবার চালান)

কোনো শব্দ খুব ভুল হলে `hadis<ID>_words.txt`-এ সংখ্যাটা হাতে ঠিক করুন।

## ধাপ 0.3 — এরপর কী করবেন

`hadis<ID>_words.txt`-এর পুরো লেখা Prompt 1-এর **AUDIO_TIMING**-এ পেস্ট করুন। সঙ্গে `HADITH_TEXT`, `SVG_COUNT`, `TEASER_WANTED` (আর ইনফোগ্রাফিক চাইলে `INFOGRAPHIC_WANTED`) দিন। AI তখন সময় বানাবে না, শুধু `svg`, `sfx`, `hookSvg`, `teaser` (আর চাইলে `infographics`) যোগ করে JSON সাজাবে।

> Prompt 1-এর নিয়ম ৫ ("words শুধু শব্দ-স্তরের সময় থাকলেই") এখন সবসময় পূরণ হবে, তাই `words` রাখবেন। টিজারও তখন শব্দের সীমানা ধরে কাটা হবে।

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
5. **INFOGRAPHIC_WANTED** — `yes` if you want one or more information cards (infographic) that appear in the SVG area at the right time (steps, a list of points, or a left/right comparison), otherwise `no`. Optional: if you leave it out, treat it as `no`.

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
- INFOGRAPHIC_WANTED: <<< yes or no >>>

OUTPUT FORMAT — return exactly this JSON structure and NOTHING else
(no explanation, no greeting, no Markdown code fence, no comments):
{
  "language": "bn",
  "teaser": { "start": 12.4, "end": 17.9 },
  "hookSvg": "svg2",
  "infographics": [
    {
      "start": 6.0,
      "end": 14.5,
      "type": "steps",
      "title": "<short title taken from the hadith>",
      "items": [ { "text": "<short phrase>" }, { "text": "<short phrase>" } ]
    }
  ],
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
10. "teaser" is OPTIONAL (a block at the top level, next to "language" and "segments"). Include it ONLY if TEASER_WANTED is "yes" AND AUDIO_TIMING has word-level times. It marks the single STRONGEST phrase of the hadith (the core message, the key promise, warning or advice), which the video plays first as a cold open. Rules: "start" = the start time of the FIRST word of that phrase (ideally right after a pause), "end" = the end time of the LAST word of that phrase, optionally plus up to 0.1 second of the pause after it (the video itself adds a 0.15 s tail after "end", so "end" + 0.15 must still be BEFORE the start of the next spoken word; therefore the phrase must end at a REAL PAUSE: the end of a sentence/clause that is followed by a gap or a new segment; never between two words that are spoken without a gap, because the voice would sound cut off); the phrase is one complete, meaningful clause of 3 to 15 words, lasting between 1 and 10 seconds (never less than 0.5 and never more than 12); it must lie inside the audio, with end > start, and it is NOT cut out of the segments (the segments still cover the whole hadith from the start to the end). Do NOT add "text" to teaser. If TEASER_WANTED is "no", or there are no word-level times, OMIT "teaser" completely.
11. "hookSvg" is OPTIONAL (a value at the top level, next to "language" and "segments"). It is the SVG shown in the very first moment of the video (the Hook), so it must match the MAIN TOPIC of the hadith (the same topic as the teaser phrase, if you gave one). Include it ONLY if SVG_COUNT is greater than 0: use one value of the form "svg<N>" (letters "svg" + a number, nothing else) where N is between 1 and SVG_COUNT, preferably the "svg" value of the segment that contains the teaser phrase or the segment that carries the core message. If SVG_COUNT is 0, or you are unsure, OMIT "hookSvg" (the video then uses the SVG of the teaser segment automatically).

12. "infographics" is OPTIONAL (an array at the top level, next to "language" and "segments"). Include it ONLY if INFOGRAPHIC_WANTED is "yes"; otherwise OMIT it completely. Each entry is one information card shown for a time range: "start" and "end" in seconds from the start of the .wav (end > start, at least 3 seconds long, inside the audio). Entries are sorted by time and must NOT overlap (the next "start" is >= the previous "end"). Give 1 to 3 entries for a normal hadith (maximum 8). Fields: "type" is exactly one of "steps" (an ordered chain, for example cause -> result), "list" (numbered points the hadith counts or names) or "compare" (two sides, for example good versus bad). "title" is optional (a short Bengali heading, up to 80 characters). "items" has 2 to 6 entries, each { "text": "..." } with a SHORT Bengali phrase (ideally under 40 characters; maximum 120). For "compare" you may add "leftTitle" and "rightTitle" (up to 40 characters each) and give each item "side": "left" or "right" (if you omit side, items alternate left, right, left ...). Each item may have "at" (the second its text should appear, from the start of the .wav); if you omit "at" the items appear evenly during the card's time. VERY IMPORTANT: use ONLY what the hadith text itself says (its own words or a faithful very short wording of them). Do NOT add explanation, fiqh rulings, statistics, names, grades or any fact that is not in HADITH_TEXT. The card should appear while the matching part is being spoken. If you are unsure, OMIT "infographics".

RETURN ONLY THE JSON.
```

## Step 1.3 — Check the answer before you save it (30 seconds)

- [ ] Starts with `{` and ends with `}`, no ` ``` ` and no sentence before or after
- [ ] The Bengali text of all segments, joined, equals your hadith text (no change)
- [ ] Every segment: `end` is larger than `start`; times only go forward
- [ ] No segment is longer than about 25 words
- [ ] `svg` values are only `svg1`, `svg2` … and the numbers are not larger than your SVG count
- [ ] If you used `hookSvg`: it is one `"hookSvg": "svgN"` value at the top level, N is not larger than your SVG count, and it fits the main topic of the hadith. If you did not, there is no `hookSvg` (the video then picks the SVG of the teaser segment)
- [ ] `sfx.name` is one of `whoosh`, `pop`, `chime`, `ding`, `swoosh`
- [ ] The last `end` is not (much) larger than the audio length
- [ ] If you asked for a Teaser: there is one `"teaser": { "start": …, "end": … }` block at the top level; `end` is larger than `start`; the span is between 1 and 10 seconds; its start matches the start of a word, its end is the end of a word (plus at most 0.1 s of pause, and `end` + 0.15 s is still before the next word starts) and ends where the speaker really pauses — so the sentence does not sound cut off; the phrase is really spoken there. If you did not ask for one, there is no `teaser` block
- [ ] If you asked for an infographic: `"infographics"` is one array at the top level; every entry has `type` (`steps`, `list` or `compare`), `start` < `end`, 2 to 6 `items` with a short `text`; the entries do not overlap and are in time order; every item text really comes from the hadith (nothing added). If you did not ask for one, there is no `infographics`

If one item fails, reply to the AI with the exact problem ("segment 3 has end smaller than start") and ask for the **whole JSON again**.

## Step 1.4 — Save and upload

Save as `hadis<ID>_timestamp.json` (same `<ID>` as the `.wav`) → upload to `public/hadis/`.

> If the run says the JSON is not valid, open it in any JSON checker, or paste it back to the AI: "Fix this JSON, change nothing else, return only the JSON."

---

---

# PROMPT 2 — অ্যানিমেটেড SVG (প্রতিটি ফাইল ৩ ধাপের)

কিট প্রতি segment-এর জন্য মাঝখানে **একটা SVG** চালায়। এখন প্রতিটি SVG একটা স্থির ছবি নয়। সে একটা ছোট গল্প বলবে: **৩টি stage**, প্রতি stage ২ সেকেন্ড, মোট ৬ সেকেন্ডের লুপ।

ফাইল নম্বর **ফাঁক ছাড়া** হবে (`svg1`, `svg2`, `svg3` …)। রেন্ডারার প্রথম অনুপস্থিত নম্বরে থেমে যায় (সর্বোচ্চ ৬০টি)।

## Stage কী

| Stage | সময় | কী ঘটে |
|---|---|---|
| ১ — শুরু | ০–২ সেকেন্ড | মূল প্রতীক ধীরে ফুটে ওঠে (ছোট থেকে বড়, বা অস্পষ্ট থেকে স্পষ্ট) |
| ২ — বিকাশ | ২–৪ সেকেন্ড | মূল প্রতীকের চারপাশে নতুন উপাদান যোগ হয় (আলো, তারা, পাতা, নকশা) |
| ৩ — পরিণতি | ৪–৬ সেকেন্ড | সব মিলে সম্পূর্ণ দৃশ্য আলোকিত হয়, তারপর মসৃণভাবে মিলিয়ে গিয়ে stage ১-এ ফেরে |

গল্পটা segment-এর অর্থের সঙ্গে মিলবে (যেমন বীজ → অঙ্কুর → ফলবান গাছ)।

## ধাপ 2.0 — আগে পরিকল্পনা (Prompt 2A, ফাইল নেই)

```text
I am making a short Islamic hadith video. For each text segment below, suggest ONE animated picture idea told in THREE STAGES (each stage lasts 2 seconds, total 6 seconds, then it loops).

SEGMENTS (in order):
1. <<< segment 1 text >>>
2. <<< segment 2 text >>>
3. <<< segment 3 text >>>

RULES FOR THE IDEAS
- The three stages must tell a tiny story that matches the meaning of the segment: stage 1 = beginning (one main symbol appears), stage 2 = growth (new elements are added around it), stage 3 = completion (the whole scene glows, then fades back toward stage 1).
- NO faces and NO bodies of humans or animals. Use only symbols: geometric patterns, stars, crescents, lanterns, books, a mosque dome silhouette without people, plants, trees, leaves, seeds, water drops, sun/moon/clouds, light rays, doors, scales, simple heart shapes. Hands are NOT allowed.
- Each stage must be drawable with simple shapes (circles, rectangles, paths).
- The three stages must look clearly different from each other, not the same picture with a small wobble.

OUTPUT: a numbered list, same count as the segments, numbering from 1 with no gaps, in exactly this form:
"svg1: <title> | stage1: <one line> | stage2: <one line> | stage3: <one line>"
Nothing else.
```

পড়ে অপছন্দের আইডিয়া বদলে নিন, তারপর প্রতিটি নম্বরের জন্য **ধাপ 2.1 একবার করে** চালান।

## ধাপ 2.1 — একটি SVG ফাইলের প্রম্পট (svg1, svg2, svg3 … প্রতিটির জন্য আলাদা)

`N` বদলে ফাইল-নম্বর দিন এবং পরিকল্পনা থেকে ৩টি stage পেস্ট করুন।

```text
Create ONE animated SVG file named svg<N>.svg. Return ONLY the SVG code (starting with <svg and ending with </svg>), no explanation and no Markdown code fence.

PICTURE IDEA (three stages, 2 seconds each, total loop 6 seconds)
Title: <<< e.g. "a lantern lights up" >>>
Stage 1 (0-2 s): <<< e.g. "a small lantern fades in at the center" >>>
Stage 2 (2-4 s): <<< e.g. "light rays and small stars appear around it" >>>
Stage 3 (4-6 s): <<< e.g. "everything glows brighter, then softly fades so the loop restarts" >>>

TECHNICAL RULES (all are mandatory, the video code depends on them)
1. Root tag exactly: <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg"> . Do NOT write width or height. Draw inside 0..1000 and keep important shapes inside 80..920.
2. Background is TRANSPARENT: no full-size background rectangle, no background fill.
3. Animation only with CSS @keyframes inside one <style> block, or with SMIL (<animate>, <animateTransform>, <animateMotion>, <set>). Never JavaScript.
4. FORBIDDEN: <script>, <foreignObject>, <iframe>, <object>, <embed>, <link>, <image> with external or data links, external fonts, @import, url(http...), any attribute starting with "on" (onclick, onload ...), javascript: links, <!DOCTYPE>, <?xml ...?>.
5. THREE STAGES IN ONE 6-SECOND LOOP. Every animation that creates the stages has duration exactly 6s and runs forever (CSS "infinite" or SMIL repeatCount="indefinite"). Put the stage timing inside the keyframe percentages:
   - Stage 1 = 0% to 33%, stage 2 = 33% to 66%, stage 3 = 66% to 100%.
   - Group the shapes by stage: <g class="svg<N>-s1">, <g class="svg<N>-s2">, <g class="svg<N>-s3">. Stage 1 elements are visible at the start; stage 2 elements fade/grow in around 33%; stage 3 elements fade/grow in around 66%.
   - At 0% (and 100%) the picture must be in the same state so the loop is seamless: fade the stage 2 and stage 3 groups out between 90% and 100%, keep the stage 1 symbol visible.
   - Smaller extra animations (twinkle, rotate, pulse) may use 2s, 3s or 6s so they also loop evenly.
6. SMIL timing must be time-based only: begin="0s" or a negative/positive time such as begin="-2s" or begin="2s", or begin="otherId.end". NEVER begin="click", begin="indefinite", accessKey, or any event.
7. STYLE WITH CLASSES AND IDS ONLY. Never write bare element selectors in CSS (no "circle { }", "g { }", "path { }", "svg { }"). Name every class, id and @keyframes with the prefix "svg<N>-" so two SVGs on screen never collide.
8. For rotation or scaling with CSS always set transform-origin in px inside the 1000x1000 space (example: transform-origin: 500px 500px;).
9. Colours must be readable on three dark backgrounds (dark green, dark navy, night-green): use white (#ffffff), warm gold (#f5d77a, #f0c040), bright green/teal (#2ecc71, #1abc9c), soft sky blue (#8fd3ff). NEVER use pure black or very dark colours. Use opacity for softness.
10. NO faces and NO bodies of humans or animals (no eyes, no mouths, no hands, no birds, no fish). Symbols, geometry, plants, objects only.
11. Keep it light: under 150 elements, under 30 KB, no heavy blur filters (a simple gradient glow is fine).
12. Text inside the SVG is not allowed (the video shows its own captions).
13. The three stages must look clearly different. A viewer who watches 2 seconds at a time should see three different pictures that build on one another.

SELF-CHECK BEFORE YOU ANSWER
- Does the first line start with <svg viewBox="0 0 1000 1000" ?
- Are there three groups svg<N>-s1, svg<N>-s2, svg<N>-s3 with different content?
- Do the stage animations use duration 6s, repeat forever, and use the 0-33-66-100% percentages?
- Is the state at 100% equal to the state at 0%?
- Is every class/id/keyframes name prefixed with svg<N>- ?
- Is there any bare selector, <script>, on...= attribute, or external link? (there must be none)
Then return ONLY the SVG code.
```

## ধাপ 2.2 — সঠিক উত্তরের নমুনা (তুলনার জন্য)

এটা ৩-stage ফাইলের **কাঠামো** (আপনার ছবি আরও সমৃদ্ধ হবে):

```svg
<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="svg3-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#fff6c8" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#f5d77a" stop-opacity="0"/>
    </radialGradient>
    <style>
      /* Stage 1: মূল প্রতীক (সবসময় আছে, শুরুতে ছোট থেকে বড় হয়) */
      @keyframes svg3-k1 {
        0%   { transform: scale(0.6); opacity: 0.7; }
        30%  { transform: scale(1);   opacity: 1; }
        90%  { transform: scale(1);   opacity: 1; }
        100% { transform: scale(0.6); opacity: 0.7; }
      }
      /* Stage 2: ৩৩% এ ফোটে, ৯০% এ মিলিয়ে যায় */
      @keyframes svg3-k2 {
        0%, 30%   { opacity: 0; transform: scale(0.8); }
        45%, 88%  { opacity: 1; transform: scale(1); }
        100%      { opacity: 0; transform: scale(0.8); }
      }
      /* Stage 3: ৬৬% এ ফোটে, ৯০% এ মিলিয়ে যায় */
      @keyframes svg3-k3 {
        0%, 63%   { opacity: 0; }
        78%, 88%  { opacity: 1; }
        100%      { opacity: 0; }
      }
      @keyframes svg3-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      .svg3-s1 { animation: svg3-k1 6s ease-in-out infinite; transform-origin: 500px 500px; }
      .svg3-s2 { animation: svg3-k2 6s ease-in-out infinite; transform-origin: 500px 500px; }
      .svg3-s3 { animation: svg3-k3 6s ease-in-out infinite; transform-origin: 500px 500px; }
      .svg3-ring { animation: svg3-spin 6s linear infinite; transform-origin: 500px 500px; }
    </style>
  </defs>

  <!-- Stage 1: মূল প্রতীক -->
  <g class="svg3-s1">
    <rect x="400" y="400" width="200" height="200" rx="12" fill="none" stroke="#f5d77a" stroke-width="14"/>
    <circle cx="500" cy="500" r="30" fill="#ffffff"/>
  </g>

  <!-- Stage 2: চারপাশে ঘূর্ণায়মান নকশা -->
  <g class="svg3-s2">
    <g class="svg3-ring">
      <rect x="320" y="320" width="360" height="360" rx="16" fill="none" stroke="#1abc9c" stroke-width="12" transform="rotate(45 500 500)"/>
    </g>
  </g>

  <!-- Stage 3: সম্পূর্ণ আলো -->
  <g class="svg3-s3">
    <circle cx="500" cy="500" r="330" fill="url(#svg3-glow)"/>
    <circle cx="500" cy="190" r="14" fill="#8fd3ff"/>
    <circle cx="810" cy="500" r="14" fill="#8fd3ff"/>
    <circle cx="500" cy="810" r="14" fill="#8fd3ff"/>
    <circle cx="190" cy="500" r="14" fill="#8fd3ff"/>
  </g>
</svg>
```

## ধাপ 2.3 — প্রতিটি SVG সেভের আগে যাচাই

- [ ] `<svg viewBox="0 0 1000 1000"` দিয়ে শুরু, `</svg>` দিয়ে শেষ
- [ ] তিনটি গ্রুপ আছে: `svg<N>-s1`, `svg<N>-s2`, `svg<N>-s3`, আর তিনটির আকৃতি আলাদা
- [ ] stage-এর অ্যানিমেশনগুলো `6s` এবং চিরকাল চলে
- [ ] ০% আর ১০০% এর অবস্থা একই (লুপে ঝাঁকুনি নেই)
- [ ] `<script>`, `onclick=`/`onload=`, `http` লিংক, `<image>` নেই
- [ ] `circle {` ধরনের খোলা selector নেই
- [ ] মুখ, চোখ, হাত, পাখি, মাছ নেই
- [ ] ফাইলের নাম ঠিক `svg<N>.svg` এবং আগেরটার পরের নম্বর

কিছু ভুল হলে AI-কে লিখুন: "Fix only this problem: <সমস্যা>. Return the whole SVG again, nothing else."

## ধাপ 2.4 — সেভ ও আপলোড

`svg<N>.svg` নামে সেভ করে `public/svg/`-এ আপলোড করুন। আগেরটা সেভ হলে তবেই পরেরটা বানান।

> আপনার `svg1.svg`, `svg2.svg` কিটের নমুনা ছবিগুলোকে **প্রতিস্থাপন** করে। segment-এর চেয়ে SVG কম হলে কিট লুপে আবার ব্যবহার করে। কোনো SVG না থাকলে একটা সাধারণ তারা দেখায়।

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
