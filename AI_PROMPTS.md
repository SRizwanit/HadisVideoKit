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
| 2 | `svg1.svg`, `svg2.svg`, … `svgN.svg` (one prompt per file; each SVG has 10 stages, 6 s loop, reference-video style) | `public/svg/svg1.svg` … | **Prompt 2A + 2B** |
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
5. **INFOGRAPHIC_WANTED** — `yes` if you want one or more infographics (SMALL short points shown as pills under the SVG at the right time, like "niyat -> fol": steps, a short list, or a left/right pair), otherwise `no`. Optional: if you leave it out, treat it as `no`.

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
      "items": [ { "text": "<1-3 word point>" }, { "text": "<1-3 word point>" } ]
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
7. "sfx" is OPTIONAL. Use it sparingly: at most one segment out of every three. "name" may only be one of: whoosh, pop, chime, ding, swoosh, soft-hit. "volume" is a number from 0 to 1 (use 0.3 to 0.6; the default is 0.4). Put whoosh/swoosh on a strong topic change, pop on a key word, chime/ding on a closing or praise phrase, soft-hit on a key statement or the final message. Never put sfx on the first segment (the intro already plays one). If unsure, omit "sfx".
8. "id" is OPTIONAL; if used, number the segments 1, 2, 3 ... in order.
9. The output must be valid JSON: double quotes only, no trailing commas, no comments, numbers without quotes.
10. "teaser" is OPTIONAL (a block at the top level, next to "language" and "segments"). Include it ONLY if TEASER_WANTED is "yes" AND AUDIO_TIMING has word-level times. It marks the single STRONGEST phrase of the hadith (the core message, the key promise, warning or advice), which the video plays first as a cold open. Rules: "start" = the start time of the FIRST word of that phrase (ideally right after a pause), "end" = the end time of the LAST word of that phrase, optionally plus up to 0.1 second of the pause after it (the video itself adds a 0.15 s tail after "end", so "end" + 0.15 must still be BEFORE the start of the next spoken word; therefore the phrase must end at a REAL PAUSE: the end of a sentence/clause that is followed by a gap or a new segment; never between two words that are spoken without a gap, because the voice would sound cut off); the phrase is one complete, meaningful clause of 3 to 15 words, lasting between 1 and 10 seconds (never less than 0.5 and never more than 12); it must lie inside the audio, with end > start, and it is NOT cut out of the segments (the segments still cover the whole hadith from the start to the end). Do NOT add "text" to teaser. If TEASER_WANTED is "no", or there are no word-level times, OMIT "teaser" completely.
11. "hookSvg" is OPTIONAL (a value at the top level, next to "language" and "segments"). It is the SVG shown in the very first moment of the video (the Hook), so it must match the MAIN TOPIC of the hadith (the same topic as the teaser phrase, if you gave one). Include it ONLY if SVG_COUNT is greater than 0: use one value of the form "svg<N>" (letters "svg" + a number, nothing else) where N is between 1 and SVG_COUNT, preferably the "svg" value of the segment that contains the teaser phrase or the segment that carries the core message. If SVG_COUNT is 0, or you are unsure, OMIT "hookSvg" (the video then uses the SVG of the teaser segment automatically).

12. "infographics" is OPTIONAL (an array at the top level, next to "language" and "segments"). Include it ONLY if INFOGRAPHIC_WANTED is "yes"; otherwise OMIT it completely. Each entry is a row of SMALL SHORT POINTS (pills), for example "নিয়ত → ফল" or "নিয়ত ঠিক → জীবন ঠিক", shown for a time range: "start" and "end" in seconds from the start of the .wav (end > start, at least 3 seconds long, inside the audio). Entries are sorted by time and must NOT overlap (the next "start" is >= the previous "end"). Give 1 to 3 entries for a normal hadith (maximum 8). Fields: "type" is exactly one of "steps" (pill -> pill with an arrow, for example cause -> result), "list" (pills side by side, for points the hadith counts or names) or "compare" (two sides, for example good versus bad; you may add "side": "left" or "right" to each item, if you omit side the items alternate left, right). "items" has exactly 2 or 3 entries (never more — they sit in ONE row), each { "text": "..." } with a VERY SHORT Bengali point: 1 to 3 words, ideally 12 characters or fewer, never more than 24. Do NOT write full sentences. Do NOT add a "title" (it is not shown). Each item may have "at" (the second its text should appear, from the start of the .wav); if you omit "at" the items appear evenly during the entry's time. VERY IMPORTANT: use ONLY what the hadith text itself says (its own words or a faithful very short wording of them). Do NOT add explanation, fiqh rulings, statistics, names, grades or any fact that is not in HADITH_TEXT. The points should appear while the matching part is being spoken. If you are unsure, OMIT "infographics".

RETURN ONLY THE JSON.
```

## Step 1.3 — Check the answer before you save it (30 seconds)

- [ ] Starts with `{` and ends with `}`, no ` ``` ` and no sentence before or after
- [ ] The Bengali text of all segments, joined, equals your hadith text (no change)
- [ ] Every segment: `end` is larger than `start`; times only go forward
- [ ] No segment is longer than about 25 words
- [ ] `svg` values are only `svg1`, `svg2` … and the numbers are not larger than your SVG count
- [ ] If you used `hookSvg`: it is one `"hookSvg": "svgN"` value at the top level, N is not larger than your SVG count, and it fits the main topic of the hadith. If you did not, there is no `hookSvg` (the video then picks the SVG of the teaser segment)
- [ ] `sfx.name` is one of `whoosh`, `pop`, `chime`, `ding`, `swoosh`, `soft-hit`
- [ ] The last `end` is not (much) larger than the audio length
- [ ] If you asked for a Teaser: there is one `"teaser": { "start": …, "end": … }` block at the top level; `end` is larger than `start`; the span is between 1 and 10 seconds; its start matches the start of a word, its end is the end of a word (plus at most 0.1 s of pause, and `end` + 0.15 s is still before the next word starts) and ends where the speaker really pauses — so the sentence does not sound cut off; the phrase is really spoken there. If you did not ask for one, there is no `teaser` block
- [ ] If you asked for an infographic: `"infographics"` is one array at the top level; every entry has `type` (`steps`, `list` or `compare`), `start` < `end`, exactly 2 or 3 `items`, each a very short point (1 to 3 words, at most 24 characters, no full sentence); the entries do not overlap and are in time order; every item text really comes from the hadith (nothing added). If you did not ask for one, there is no `infographics`

If one item fails, reply to the AI with the exact problem ("segment 3 has end smaller than start") and ask for the **whole JSON again**.

## Step 1.4 — Save and upload

Save as `hadis<ID>_timestamp.json` (same `<ID>` as the `.wav`) → upload to `public/hadis/`.

> If the run says the JSON is not valid, open it in any JSON checker, or paste it back to the AI: "Fix this JSON, change nothing else, return only the JSON."

---

---

# PROMPT 2 — অ্যানিমেটেড SVG (প্রতিটি ফাইল ১০ ধাপের, রেফারেন্স-ভিডিও স্টাইল)

কিট প্রতি segment-এর জন্য মাঝখানে **একটা SVG** চালায়। প্রতিটি SVG একটা স্থির ছবি নয়। সে segment-এর অর্থ অনুযায়ী একটা ছোট গল্প বলে: **১০টি stage**, প্রতি stage ০.৬ সেকেন্ড, মোট ৬ সেকেন্ডের লুপ (আগে ৩ stage × ২ সেকেন্ড ছিল)।

ফাইল নম্বর **ফাঁক ছাড়া** হবে (`svg1`, `svg2`, `svg3` …)। রেন্ডারার প্রথম অনুপস্থিত নম্বরে থেমে যায় (সর্বোচ্চ ৬০টি)।

> **segment আর SVG-র সম্পর্ক:** `hadis<ID>_timestamp.json`-এর প্রতিটি segment-এর `"svg": "svgN"` মান বলে দেয় সেই segment-এ কোন ফাইল চলবে। তাই SVG-র গল্প অবশ্যই ওই segment-এর **text-এর অর্থের** সঙ্গে মিলবে (নিচে ১০-stage আইডিয়ার ফরম্যাটের নমুনা আছে)।

## রেফারেন্স স্টাইল (ReferenceVideo1.mp4 — "নবীজির পছন্দের খাবার" অনুযায়ী)

রেফারেন্স ভিডিওর প্রতিটি দৃশ্যের ছবির যে ধারা, নতুন SVG-ও সেই ধারায় হবে:

- **ফ্ল্যাট ভেক্টর ইলাস্ট্রেশন:** সরল আকৃতি (বৃত্ত, আয়তক্ষেত্র, বক্ররেখা), নরম দুই-টোন শেড (একটা হালকা হাইলাইট + একটা গাঢ় পাশ), বাইরের সরু রিম-রেখা। বাস্তবের ফটোর মতো নয়, আবার খুব সরলও নয়: বস্তুটা চেনা যায় এমন বিস্তারিত।
- **একটাই প্রধান বস্তু মাঝখানে** (ছবির প্রায় ৬০%), তার চারপাশে ছোট সহায়ক বস্তু (যেমন রেফারেন্সে খেজুরের বাটির পাশে দানা, মধুর বোয়ামের পাশে চামচ)।
- **পেছনে সানবার্স্ট রশ্মি** (কেন্দ্র থেকে ছড়ানো হালকা রশ্মি) আর নরম আলোর বৃত্ত। রশ্মি ধীরে ঘোরে।
- **ধাপে ধাপে গড়ে ওঠে:** প্রতি ধাপে ঠিক একটা নতুন উপাদান যোগ হয়, একসঙ্গে সব নয় (রেফারেন্সে ৭টি আজওয়া খেজুর এক এক করে পড়ে, গ্লাসে দুধ ভরে, পাত্র থেকে তেল ঢালা হয়)। প্রতিটি উপাদান ছোট থেকে বড় হয়ে "পপ" করে ফোটে (সামান্য ওভারশুট)।
- **ছোট অ্যাকসেন্ট:** ৪-কোণা ঝিলিক (sparkle), ভাপ/ধোঁয়া, ছোট ভাসমান কণা, শেষ ধাপে হালকা আলোর ঝলক।
- **SVG-র ভেতরে কোনো লেখা নেই:** রেফারেন্সে ক্যাপশন, নম্বর ও শিরোনাম আলাদা স্তরে আসে; কিট সেটা নিজেই দেখায়।
- **রঙ:** রেফারেন্সের পটভূমি হালকা বেইজ, কিন্তু আমাদের SVG স্বচ্ছ এবং তিনটি গাঢ় পটভূমিতে (গাঢ় সবুজ, গাঢ় নেভি, রাত-সবুজ) পড়তে হয়। তাই একই ফ্ল্যাট ধারা রেখে উজ্জ্বল প্যালেট নিন: সাদা, ক্রিম `#fff6dc`, সোনালি `#f5d77a`/`#f0c040`, সবুজ/টিল `#2ecc71`/`#1abc9c`, আকাশি `#8fd3ff`।
- **ইসলামী শিষ্টাচার:** কোনো মানুষ বা প্রাণীর মুখ/শরীর/হাত নেই। যেখানে রাবী বা ব্যক্তি আসে (যেমন সনদ), সেখানে ব্যক্তির বদলে **প্রতীক** (মেডালিয়ন, তারা, বই, চেইন, বাতি) ব্যবহার করুন।

## Stage কী (১০ ধাপ × ০.৬ সেকেন্ড = ৬ সেকেন্ড)

| Stage | সময় | keyframe % | কী ঘটে |
|---|---|---|---|
| ১ | ০–০.৬ s | ০–১০% | পটভূমি: সানবার্স্ট রশ্মি ও নরম আলো (লুপে সবসময় থাকে, শুধু একটু উজ্জ্বল-ম্লান হয়) |
| ২ | ০.৬–১.২ s | ১০–২০% | প্রধান বস্তুর মূল কাঠামো পপ করে ফোটে |
| ৩ | ১.২–১.৮ s | ২০–৩০% | প্রধান বস্তুর বিস্তারিত (রেখা, ফিতা, ছোট কণা) |
| ৪ | ১.৮–২.৪ s | ৩০–৪০% | দ্বিতীয় উপাদান (প্রথম সহায়ক বস্তু) পপ করে |
| ৫ | ২.৪–৩.০ s | ৪০–৫০% | দ্বিতীয় উপাদানের বিস্তারিত + সংযোগ + ঝিলিক |
| ৬ | ৩.০–৩.৬ s | ৫০–৬০% | তৃতীয় উপাদান পপ করে |
| ৭ | ৩.৬–৪.২ s | ৬০–৭০% | তৃতীয় উপাদানের বিস্তারিত + পরের ধাপের ইঙ্গিত |
| ৮ | ৪.২–৪.৮ s | ৭০–৮০% | গতি/আলো চলে (যেমন আলো চেইন ধরে এগোয়, তেল ঢালা, ভাপ ওঠে) |
| ৯ | ৪.৮–৫.৪ s | ৮০–৯০% | শেষ উপাদান জ্বলে ওঠে, সব মিলে সম্পূর্ণ দৃশ্য |
| ১০ | ৫.৪–৬.০ s | ৯০–১০০% | আলোর ঝলক (halo pulse), তারপর সব মিলিয়ে গিয়ে stage ১-এ ফেরে |

গল্পটা segment-এর অর্থের সঙ্গে মিলবে (যেমন বীজ → অঙ্কুর → ফলবান গাছ; বা সনদ: বই → রাবী → রাবী → পরের রাবীতে আলো)। এই ছক ঠিক ১০ ধাপের; কোনো গল্পে একটা ধাপ ফাঁকা থাকলে সেখানে ঝিলিক বা আলো দিয়ে ভরুন, ধাপ বাদ দেবেন না।

## ধাপ 2.0 — আগে পরিকল্পনা (Prompt 2A, ফাইল নেই)

```text
I am making a short Islamic hadith video. For each text segment below, suggest ONE animated picture idea told in TEN STAGES (each stage lasts 0.6 seconds, total 6 seconds, then it loops). The look follows a flat-vector reference style: a sunburst of light rays behind one main object, and new elements pop in one at a time.

SEGMENTS (in order):
1. <<< segment 1 text >>>
2. <<< segment 2 text >>>
3. <<< segment 3 text >>>

RULES FOR THE IDEAS
- The ten stages tell a tiny story that matches the meaning of the segment: stage 1 = soft background (sunburst rays and glow), stages 2-3 = the main object appears and gets its details, stages 4-7 = new elements are added one at a time (each stage adds exactly ONE new thing), stage 8 = motion or light moves, stage 9 = the last element lights up and the scene is complete, stage 10 = a halo pulse, then everything fades back to stage 1.
- NO faces and NO bodies of humans or animals. Use only symbols: geometric patterns, stars, crescents, lanterns, books, a mosque dome silhouette without people, plants, trees, leaves, seeds, water drops, sun/moon/clouds, light rays, doors, scales, simple heart shapes, medallions, chains of light. Hands are NOT allowed. When the text names a person (a narrator, a companion), show a symbol for that person (a medallion with a star), never the person.
- Each stage must be drawable with simple flat shapes (circles, rectangles, paths, gradients).
- The ten stages must look clearly different from each other, not the same picture with a small wobble.
- No text inside the picture.

OUTPUT: a numbered list, same count as the segments, numbering from 1 with no gaps, in exactly this form:
"svg1: <title> | s1: <one line> | s2: <one line> | s3: <one line> | s4: <one line> | s5: <one line> | s6: <one line> | s7: <one line> | s8: <one line> | s9: <one line> | s10: <one line>"
Nothing else.
```

**নমুনা (শুধু ফরম্যাট বোঝার জন্য; আপনার segment-এর অর্থ অনুযায়ী আইডিয়া হবে সম্পূর্ণ আলাদা):**

`svg1: <ছবির নাম> | s1: সানবার্স্ট রশ্মি ও নরম আলো | s2: প্রধান বস্তুর কাঠামো পপ করে | s3: প্রধান বস্তুর বিস্তারিত | s4: প্রথম সহায়ক উপাদান পপ করে | s5: তার বিস্তারিত বা সংযোগ + ঝিলিক | s6: দ্বিতীয় সহায়ক উপাদান পপ করে | s7: তার বিস্তারিত + পরের ধাপের ইঙ্গিত | s8: আলো বা গতি চলে | s9: শেষ উপাদান জ্বলে ওঠে, সব মিলে সম্পূর্ণ | s10: halo pulse, তারপর সব মিলিয়ে যায়`

পড়ে অপছন্দের আইডিয়া বদলে নিন, তারপর প্রতিটি নম্বরের জন্য **ধাপ 2.1 একবার করে** চালান।

## ধাপ 2.1 — একটি SVG ফাইলের প্রম্পট (svg1, svg2, svg3 … প্রতিটির জন্য আলাদা)

`N` বদলে ফাইল-নম্বর দিন এবং পরিকল্পনা থেকে ১০টি stage পেস্ট করুন।

```text
Create ONE animated SVG file named svg<N>.svg. Return ONLY the SVG code (starting with <svg and ending with </svg>), no explanation and no Markdown code fence.

STYLE: flat vector illustration (simple shapes, soft two-tone shading with a light highlight, thin gold rim lines). One main object in the middle (about 60% of the picture), a few small helper objects around it, a sunburst of soft light rays behind everything, small four-point sparkles as accents. New elements pop in one at a time (small to big, with a tiny overshoot).

PICTURE IDEA (ten stages, 0.6 seconds each, total loop 6 seconds)
Title: <<< e.g. "the chain of narrators" >>>
Stage 1 (0-10%): <<< e.g. "sunburst rays and soft glow" >>>
Stage 2 (10-20%): <<< e.g. "an open book pops in at the bottom center" >>>
Stage 3 (20-30%): <<< ... >>>
Stage 4 (30-40%): <<< ... >>>
Stage 5 (40-50%): <<< ... >>>
Stage 6 (50-60%): <<< ... >>>
Stage 7 (60-70%): <<< ... >>>
Stage 8 (70-80%): <<< ... >>>
Stage 9 (80-90%): <<< ... >>>
Stage 10 (90-100%): <<< e.g. "a halo pulse, then everything fades back" >>>

TECHNICAL RULES (all are mandatory, the video code depends on them)
1. Root tag exactly: <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg"> . Do NOT write width or height. Draw inside 0..1000 and keep important shapes inside 80..920.
2. Background is TRANSPARENT: no full-size background rectangle, no background fill.
3. Animation only with CSS @keyframes inside one <style> block, or with SMIL (<animate>, <animateTransform>, <animateMotion>, <set>). Never JavaScript.
4. FORBIDDEN: <script>, <foreignObject>, <iframe>, <object>, <embed>, <link>, <image> with external or data links, external fonts, @import, url(http...), any attribute starting with "on" (onclick, onload ...), javascript: links, <!DOCTYPE>, <?xml ...?>. Allowed: gradients through url(#svg<N>-id) and an internal reference such as <mpath href="#svg<N>-route"/> to a path inside the same file.
5. TEN STAGES IN ONE 6-SECOND LOOP. Every animation that creates the stages has duration exactly 6s and runs forever (CSS "infinite" or SMIL repeatCount="indefinite"). Put the stage timing inside the keyframe percentages:
   - Stage k covers (k-1)*10% to k*10% (stage 1 = 0-10%, stage 2 = 10-20% ... stage 10 = 90-100%).
   - Group the shapes by stage: <g class="svg<N>-s1"> ... <g class="svg<N>-s10">. Stage k elements are invisible until about (k-1)*10%, pop in (opacity 0 to 1, scale 0.6 to 1.08 to 1) within the next 5-7%, and stay visible until 90%.
   - Stage 1 is the background (rays and glow) and is always visible (it may only breathe between opacity .5 and 1). At 0% and 100% the picture must be in the same state so the loop is seamless: the groups of stages 2 to 9 are invisible at 0% and fade out between 90% and 100%.
   - Stage 10 is a halo pulse: invisible until 89%, visible around 93%, and invisible again (opacity 0) at 100%.
   - Rays may rotate slowly, but only by the angle between two rays (for 16 rays: 22.5deg per 6s) so the loop is seamless.
   - Smaller extra animations (twinkle, floating dots, dashed ring) may use 2s, 3s or 6s so they also loop evenly.
6. SMIL timing must be time-based only: begin="0s" or a negative/positive time such as begin="-2s" or begin="2s", or begin="otherId.end". NEVER begin="click", begin="indefinite", accessKey, or any event. For a moving light use <animateMotion dur="6s" repeatCount="indefinite" keyPoints=... keyTimes=...> so it moves only during its own stage.
7. STYLE WITH CLASSES AND IDS ONLY. Never write bare element selectors in CSS (no "circle { }", "g { }", "path { }", "svg { }"). Name every class, id and @keyframes with the prefix "svg<N>-" so two SVGs on screen never collide.
8. For rotation or scaling with CSS always set transform-origin in px inside the 1000x1000 space (example: transform-origin: 500px 500px;), the centre of that group.
9. Colours must be readable on three dark backgrounds (dark green, dark navy, night-green): use white (#ffffff), cream (#fff6dc), warm gold (#f5d77a, #f0c040), bright green/teal (#2ecc71, #1abc9c), soft sky blue (#8fd3ff). NEVER use pure black or very dark colours. Use opacity for softness.
10. NO faces and NO bodies of humans or animals (no eyes, no mouths, no hands, no birds, no fish). Symbols, geometry, plants, objects only.
11. Keep it light: under 150 elements, under 30 KB, no heavy blur filters (a simple gradient glow is fine).
12. Text inside the SVG is not allowed (the video shows its own captions).
13. The ten stages must look clearly different. A viewer who watches 0.6 seconds at a time should see the picture grow by exactly one new thing each time.

SELF-CHECK BEFORE YOU ANSWER
- Does the first line start with <svg viewBox="0 0 1000 1000" ?
- Are there ten groups svg<N>-s1 ... svg<N>-s10 with different content?
- Do the stage animations use duration 6s, repeat forever, and use the 10%-step percentages?
- Is the state at 100% equal to the state at 0% (only stage 1 visible)?
- Is every class/id/keyframes name prefixed with svg<N>- ?
- Is there any bare selector, <script>, on...= attribute, or external link? (there must be none)
Then return ONLY the SVG code.
```

## ধাপ 2.2 — সঠিক উত্তরের নমুনা (তুলনার জন্য)

নিচে ১০-stage ফাইলের **কাঠামো** (আপনার ছবি আরও সমৃদ্ধ হবে; `s4`–`s8` একই ছাঁচে):

```svg
<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="svg1-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#fff6c8" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#f5d77a" stop-opacity="0"/>
    </radialGradient>
    <style>
      /* Stage 1: পটভূমি (সবসময় আছে, শুধু উজ্জ্বল-ম্লান) */
      @keyframes svg1-k1 {
        0%   { opacity: .5; transform: scale(.85); }
        10%, 90% { opacity: 1; transform: scale(1); }
        100% { opacity: .5; transform: scale(.85); }
      }
      /* Stage 2: ১০% এ পপ করে ফোটে, ৯০% এর পর মিলিয়ে যায় */
      @keyframes svg1-k2 {
        0%, 9%  { opacity: 0; transform: scale(.6); }
        14%     { opacity: 1; transform: scale(1.08); }
        17%, 90% { opacity: 1; transform: scale(1); }
        100%    { opacity: 0; transform: scale(.6); }
      }
      /* Stage 3: ২০% এ ফোটে (k3 ... k9 একই ছাঁচে: শুরু = (k-1)*10%) */
      @keyframes svg1-k3 {
        0%, 19% { opacity: 0; transform: scale(.6); }
        24%     { opacity: 1; transform: scale(1.08); }
        27%, 90% { opacity: 1; transform: scale(1); }
        100%    { opacity: 0; transform: scale(.6); }
      }
      /* Stage 10: আলোর ঝলক, শেষে অদৃশ্য */
      @keyframes svg1-k10 {
        0%, 89% { opacity: 0; transform: scale(.5); }
        93%     { opacity: .9; }
        100%    { opacity: 0; transform: scale(2.6); }
      }
      @keyframes svg1-spin { from { transform: rotate(0deg); } to { transform: rotate(22.5deg); } }
      .svg1-s1  { animation: svg1-k1 6s ease-in-out infinite; transform-origin: 500px 520px; }
      .svg1-rays { animation: svg1-spin 6s linear infinite; transform-origin: 500px 520px; }
      .svg1-s2  { animation: svg1-k2 6s ease-in-out infinite; transform-origin: 500px 780px; }
      .svg1-s3  { animation: svg1-k3 6s ease-in-out infinite; transform-origin: 500px 780px; }
      /* .svg1-s4 ... .svg1-s9 : একই ধরনের */
      .svg1-s10 { animation: svg1-k10 6s ease-out infinite; transform-origin: 500px 520px; }
    </style>
  </defs>

  <!-- Stage 1: সানবার্স্ট রশ্মি + আলো -->
  <g class="svg1-s1">
    <circle cx="500" cy="520" r="330" fill="url(#svg1-glow)" opacity=".35"/>
    <g class="svg1-rays"><!-- ১৬টি রশ্মি, প্রতিটি ২২.৫° ব্যবধানে --></g>
  </g>
  <!-- Stage 2: প্রধান বস্তুর কাঠামো -->
  <g class="svg1-s2"> ... </g>
  <!-- Stage 3: বিস্তারিত -->
  <g class="svg1-s3"> ... </g>
  <!-- Stage 4 ... Stage 9 -->
  <!-- Stage 10: আলোর ঝলক -->
  <g class="svg1-s10">
    <circle cx="500" cy="520" r="150" fill="none" stroke="#f5d77a" stroke-width="12"/>
  </g>
</svg>
```

## ধাপ 2.3 — প্রতিটি SVG সেভের আগে যাচাই

- [ ] `<svg viewBox="0 0 1000 1000"` দিয়ে শুরু, `</svg>` দিয়ে শেষ
- [ ] দশটি গ্রুপ আছে: `svg<N>-s1` … `svg<N>-s10`, আর প্রতিটির আকৃতি আলাদা (প্রতি ধাপে ঠিক একটা নতুন জিনিস)
- [ ] stage-এর অ্যানিমেশনগুলো `6s` এবং চিরকাল চলে, শতকরা হিসাব ১০%-এর ধাপে (stage k শুরু (k-1)*10%)
- [ ] ০% আর ১০০% এর অবস্থা একই (শুধু stage ১ দেখা যায়; লুপে ঝাঁকুনি নেই)
- [ ] রশ্মি ঘুরলে শুধু দুই রশ্মির মাঝের কোণে (১৬ রশ্মিতে ২২.৫°)
- [ ] `<script>`, `onclick=`/`onload=`, `http` লিংক, `<image>` নেই
- [ ] `circle {` ধরনের খোলা selector নেই
- [ ] মুখ, চোখ, হাত, পাখি, মাছ নেই; লেখা নেই
- [ ] রঙ গাঢ় পটভূমিতে পড়া যায় (কালো/খুব গাঢ় রঙ নেই)
- [ ] ১৫০টির কম element, ৩০ KB-র কম
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
| `soft-hit` | only if you put it in the JSON | a soft emphasis on a key statement or the final message |

- Files are `public/sfx/<name>.mp3` (a `.wav` also works). Names are case-sensitive and use only English letters, digits, `-`, `_`.
- A missing file is **not an error**: that sound is simply silent.
- A sound longer than **4 seconds** is cut. Keep each effect between 0.3 and 2 seconds.
- Default loudness is **0.4**. Use 0.3–0.6 for most; never above 0.8 (the voice must stay clear).

> **Important:** the file `public/sfx/whoosh.mp3` that came with the kit is only a **synthetic sample** so the first render has a sound. **Replace it with real royalty-free files named `whoosh`, `pop`, `chime`, `ding`, `swoosh`, `soft-hit`** (`.mp3` or `.wav`). Upload them to `public/sfx/` with exactly those names.

## Step 3.1 — Prompt 3A: where to use SFX in this hadith (no file)

```text
I have a hadith video with these text segments (in order):
1. <<< segment 1 text >>>
2. <<< segment 2 text >>>
3. <<< segment 3 text >>>

The only sound effects I can use are: whoosh, pop, chime, ding, swoosh, soft-hit.
Suggest where to use them, following these rules:
- Use at most one effect for every three segments, and none on segment 1.
- whoosh/swoosh only on a strong topic change; pop on one key word; chime or ding on a closing or praise phrase; soft-hit on a key statement or the final message.
- Volume between 0.3 and 0.6 (default 0.4).
- If a segment does not need a sound, say "none".

OUTPUT: a table with columns: segment number | effect name or "none" | volume | one-line reason. Nothing else.
```

Copy the answers into the JSON as `"sfx": { "name": "...", "volume": 0.5 }` (or ask Prompt 1 to include them).

## Step 3.2 — Prompt 3B: find each SFX file (one prompt per file; no file is generated by the AI)

Do this for each name you need: `whoosh`, then `pop`, then `chime`, then `ding`, then `swoosh`, then `soft-hit`. Replace `<NAME>`.

```text
I need ONE royalty-free sound effect for a short Islamic video: "<NAME>".
Description: <<< whoosh = short soft air sweep, 0.5-1 s | pop = small soft bubble pop, 0.2-0.4 s | chime = gentle bell chime, 1-2 s | ding = single clean light bell ding, 0.5-1 s | swoosh = smooth light sweep, 0.5-1 s | soft-hit = soft low thud or gentle impact, 0.3-0.6 s >>>

Give me:
1. Three free sources where I can download such a sound legally for videos (for example Pixabay Sound Effects, Mixkit, Freesound with a CC0 filter). Say what licence to look for (CC0 or "free for commercial use, no attribution").
2. The exact search words to type for this sound.
3. What to check before using it: length under 2 seconds, no music, no voice, no clipping, mono or stereo MP3, not too loud.
Do not invent file links. Do not give me a download link you are not sure exists.
```

After downloading: rename the file to `<NAME>.mp3` (all lower-case) → upload to `public/sfx/`.

## Step 3.3 — SFX checklist

- [ ] Licence is CC0 or "free for commercial use" (keep the page link for yourself)
- [ ] File name is exactly `whoosh.mp3`, `pop.mp3`, `chime.mp3`, `ding.mp3`, `swoosh.mp3` or `soft-hit.mp3`
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
