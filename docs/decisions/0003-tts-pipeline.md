# ADR-0003: Multilingual TTS pipeline (ElevenLabs + OpenAI)

* Status: accepted
* Date: 2025-06

## Context and problem statement

The church has members speaking Polish, English, Ukrainian, Tamil, German, and Spanish. Sermons are delivered in Polish. To make the content accessible to everyone, we need:
- Sermon transcription (audio → Polish text)
- Translation into 5 languages
- Synthetic audio (TTS) for each language

AI Act requirement (Art. 50, from 2026-08-02): users must be informed when they are hearing a synthetic voice or reading AI-generated text.

## Considered options (transcription)

* **OpenAI Whisper API** (`gpt-4o-mini-transcribe`)
* **Google Speech-to-Text**
* **Local Whisper** (own GPU)

## Considered options (TTS)

* **ElevenLabs** (`eleven_multilingual_v2`)
* **OpenAI TTS** (`tts-1`, `tts-1-hd`)
* **Google Cloud TTS**
* **Azure Cognitive Services TTS**

## Decision outcome

Transcription: OpenAI `gpt-4o-mini-transcribe`. Translation: GPT-4.1-mini. TTS: ElevenLabs `eleven_multilingual_v2`.

## Rationale

**Transcription (OpenAI Whisper API):**
- Excellent accuracy for Polish, including accents and proper nouns.
- No own GPU infrastructure required.
- Chunking at 15-minute intervals + LLM cleanup pass eliminates ASR errors.

**TTS (ElevenLabs):**
- `eleven_multilingual_v2` supports all 6 languages with natural-sounding voices.
- Dedicated voice IDs per language (EN, UK, TA, DE, ES) — consistent style across sermons.
- OpenAI TTS was rejected due to lower quality for niche languages (Tamil) and lack of custom voice support.
- Google/Azure were rejected due to more robotic-sounding output for longer texts.

**Chunking:**
- Text is split into chunks of ≤ 4500 characters (at paragraph boundaries) before TTS — ElevenLabs limit.
- Chunks are concatenated by ffmpeg into a single opus file.

## AI Act Art. 50 compliance

Disclosure required from 2026-08-02. Implementation:
- **Summaries**: `✦ AI` badge next to every summary (always visible, in all languages).
- **TTS**: `✦ Synthetic voice` notice displayed in the player when the active language ≠ PL and the sermon has TTS audio.

The approach is intentionally unobtrusive (subtle badges instead of modals/popups) — it informs without disrupting the UX.

## Consequences

* Cost to process one sermon (~60 min): ~$0.30 OpenAI + ~$5–8 ElevenLabs (depending on transcript length).
* ElevenLabs has monthly token limits — when backfilling many sermons, tokens may run out before the end of the month.
* The pipeline is idempotent: `backfill_tts.py` skips languages already present in `tts_durations`.
* Titles in sermon series (e.g. "Letter to the Romans") require manual standardisation after processing — GPT does not always preserve a consistent numbering format.
