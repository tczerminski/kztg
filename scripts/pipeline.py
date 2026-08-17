#!/usr/bin/env python3
import io
import json
import mimetypes
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path

import boto3
import ffmpeg
import openai
import yt_dlp
from botocore.config import Config
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from PIL import Image

load_dotenv(Path(__file__).parent.parent / ".env", override=True)

client = openai.OpenAI()  # reads OPENAI_API_KEY from env automatically
CHUNK_DURATION_SEC = 900  # 15 minutes

IMMUTABLE_CACHE = "public, max-age=31536000, immutable"
SHORT_CACHE = "public, max-age=300, must-revalidate"

PUBLIC_BASE_URL = (os.environ.get("R2_PUBLIC_BASE_URL") or "https://pub-8b5cdf2f2aed4a6e832dd72430dfacc1.r2.dev").rstrip("/")
PUBLIC_COVERS_DIR = Path(__file__).parent.parent / "public" / "images" / "covers"
COVER_MAX_WIDTH = 640

ELEVENLABS_VOICE_IDS: dict[str, str] = {
    "en": "UgBBYS2sOqTuMpoF3BR0",
    "uk": "Ntd0iVwICtUtA6Fvx27M",
    "ta": "ZhJ5LanYnCmLKQUXvsV7",
    "de": "HNYELfQMgCeL9N0RGyxo",
    "es": "8mBRP99B2Ng2QwsJMFQl",
}

LANG_NAMES: dict[str, str] = {
    "en": "English",
    "uk": "Ukrainian",
    "ta": "Tamil",
    "de": "German",
    "es": "Spanish",
}

TTS_TRANSLATION_CHUNK = 8000  # chars per GPT translation call
TTS_AUDIO_CHUNK = 4500        # chars per ElevenLabs TTS call


def log_info(msg: str) -> None:
    print(f"[INFO] {msg}", flush=True)


def log_error(msg: str) -> None:
    print(f"[ERROR] {msg}", file=sys.stderr)


def _yt_cookie_opts() -> dict:
    """Return yt-dlp cookie + JS challenge options."""
    opts: dict = {"remote_components": ["ejs:github"]}
    cookie_file = os.environ.get("YOUTUBE_COOKIES_FILE")
    if cookie_file and Path(cookie_file).exists():
        opts["cookiefile"] = cookie_file
    return opts


def download_sermon(yt_url: str, sermon_dir: Path) -> dict:
    """Download audio(.opus), thumbnail(.webp), info.json. Returns yt-dlp info dict."""
    ydl_opts = {
        "format": "bestaudio[protocol=https][ext=webm]/bestaudio[protocol=https]/bestaudio",
        "extract_audio": True,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "opus",
                "preferredquality": "48",
            },
            {"key": "FFmpegMetadata"},
            {"key": "FFmpegThumbnailsConvertor", "format": "webp"},
        ],
        "postprocessor_args": {
            "ExtractAudio": [
                "-af",
                "highpass=f=70,lowpass=f=12000,acompressor=threshold=-18dB:ratio=2:attack=20:release=250,loudnorm",
                "-c:a", "libopus",
                "-b:a", "48k",
                "-vbr", "on",
                "-compression_level", "10",
                "-application", "voip",
            ],
        },
        "writethumbnail": True,
        "write_info_json": True,
        "outtmpl": str(sermon_dir / "%(id)s.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
        **_yt_cookie_opts(),
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(yt_url, download=True)

    return info


def generate_transcription_audio(audio_path: Path, output_path: Path) -> None:
    """Convert to mono 16kHz mp3 for transcription."""
    (
        ffmpeg
        .input(str(audio_path))
        .output(str(output_path), ar=16000, ac=1, audio_bitrate="48k")
        .overwrite_output()
        .run(quiet=True)
    )


def split_into_chunks(audio_path: Path, chunks_dir: Path) -> list[Path]:
    """Split audio into ~15min chunks."""
    chunks_dir.mkdir(parents=True, exist_ok=True)
    pattern = str(chunks_dir / "chunk_%03d.mp3")

    (
        ffmpeg
        .input(str(audio_path))
        .output(pattern, f="segment", segment_time=CHUNK_DURATION_SEC, c="copy")
        .overwrite_output()
        .run(quiet=True)
    )

    return sorted(chunks_dir.glob("chunk_*.mp3"))


def transcribe_chunk(chunk_path: Path) -> str:
    """Transcribe a single chunk via OpenAI Audio API."""
    with chunk_path.open("rb") as f:
        result = client.audio.transcriptions.create(
            model="gpt-4o-mini-transcribe",
            file=f,
        )
    return result.text


def extract_bible_refs(transcript: str) -> dict:
    """Return {pl, en, uk, ta, de, es} each a list of 'Abbrev chapter' strings."""
    resp = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "Na podstawie transkrypcji kazania wypisz fragmenty biblijne, do których podano KONKRETNY numer rozdziału. "
                    "WAŻNE: uwzględniaj TYLKO fragmenty z numerem rozdziału (np. 'J 2', '1 Sm 4', 'Rz 8'). "
                    "Jeśli księga jest wspomniana bez konkretnego rozdziału — POMIŃ ją całkowicie. "
                    "Nie powtarzaj tych samych fragmentów. Sortuj według kolejności w Biblii. "
                    "Zwróć obiekt JSON z kluczami: pl, en, uk, ta, de, es — "
                    "każdy zawiera tablicę referencji z oficjalnymi skrótami ksiąg dla danego języka. "
                    "WAŻNE: używaj WYŁĄCZNIE oficjalnych skrótów — NIGDY pełnych nazw ksiąg. "
                    "Zamiast 'Ewangelia Jana' pisz 'J', zamiast 'List do Rzymian' pisz 'Rz', "
                    "zamiast 'Dzieje Apostolskie' pisz 'Dz', zamiast 'Apokalipsa' pisz 'Ap', "
                    "zamiast 'Kohelet' pisz 'Koh'. "
                    "pl: Rdz Wj Kpł Lb Pwt Joz Sdz Rt 1 Sm 2 Sm 1 Krl 2 Krl 1 Krn 2 Krn Ezd Ne Est Hi "
                    "Ps Prz Koh PnP Iz Jr Lm Ez Dn Oz Jl Am Ab Jon Mi Na Ha So Ag Za Ml "
                    "Mt Mk Łk J Dz Rz 1 Kor 2 Kor Ga Ef Flp Kol 1 Tes 2 Tes 1 Tm 2 Tm Tt Flm Hbr Jk 1 P 2 P 1 J 2 J 3 J Jud Ap. "
                    "en: Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song "
                    "Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal "
                    "Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev. "
                    "de: Gen Ex Lev Num Dtn Jos Ri Rut 1Sam 2Sam 1Kön 2Kön 1Chr 2Chr Esra Neh Est Hiob Ps Spr Pred Hld "
                    "Jes Jer Klgl Ez Dan Hos Joel Am Obd Jona Mi Nah Hab Zef Hag Sach Mal "
                    "Matt Mk Lk Joh Apg Röm 1Kor 2Kor Gal Eph Phil Kol 1Thess 2Thess 1Tim 2Tim Tit Phlm Hebr Jak 1Pet 2Pet 1Joh 2Joh 3Joh Jud Offb. "
                    "es: Gén Éx Lev Núm Dt Jos Jue Rut 1Sam 2Sam 1Re 2Re 1Cr 2Cr Esd Neh Est Job Sal Prov Ecl Cant "
                    "Is Jr Lam Ez Dn Os Jl Am Abd Jon Mi Na Hab Sof Ag Zac Mal "
                    "Mt Mc Lc Jn Hch Rom 1Cor 2Cor Gál Ef Flp Col 1Tes 2Tes 1Tim 2Tim Tit Flm Heb Sant 1Pe 2Pe 1Jn 2Jn 3Jn Jud Ap. "
                    "uk: Бут Вих Лев Чис Повт Нав Суд Рут 1 Сам 2 Сам 1 Цар 2 Цар 1 Хр 2 Хр Езд Неєм Ест Йов "
                    "Пс Прип Кгл Пісн Іс Єр Плч Єз Дан Ос Йоіл Ам Авд Йон Мих Нав Авак Соф Аг Зах Мал "
                    "Мт Мк Лк Ів Дії Рим 1 Кор 2 Кор Гал Еф Флп Кол 1 Сол 2 Сол 1 Тим 2 Тим Тит Флм Євр Як 1 Пт 2 Пт 1 Ів 2 Ів 3 Ів Юд Од. "
                    "ta: ஆதி யாத் லேவி எண் உபா யோசு நியா ரூத் 1 சாமு 2 சாமு 1 இரா 2 இரா நேகே யோபு சங்கீ நீதி பிர உன்ன "
                    "ஏசா எரே புல எசே தானி ஓசே யோவே ஆமோ ஓபா யோனா மீகா நாகூ அபக் செப் ஆகா சக்கரி மல் "
                    "மத்தேயு மாற்கு லூக்கா யோவான் அப்போஸ்தலர் ரோமர் 1 கொரி 2 கொரி கலா எபேசி பிலிப் கொலோ 1 தெச 2 தெச "
                    "1 தீமோ 2 தீமோ தீத்து பிலே எபிரே யாக்கோ 1 பேது 2 பேது 1 யோவா 2 யோவா 3 யோவா யூதா வெளி. "
                    'Przykład: {"pl": ["Rz 1", "1 Sm 4", "1 Kor 13"], "en": ["Rom 1", "1Sam 4", "1Cor 13"], ...} '
                    "Jeśli brak fragmentów, zwróć puste tablice we wszystkich językach."
                ),
            },
            {"role": "user", "content": transcript[:12000]},
        ],
        response_format={"type": "json_object"},
    )
    parsed = json.loads(resp.choices[0].message.content)
    empty: dict = {"pl": [], "en": [], "uk": [], "ta": [], "de": [], "es": []}
    for lang in empty:
        if isinstance(parsed.get(lang), list):
            empty[lang] = parsed[lang]
    return empty


FORBIDDEN_SUMMARY_FIRST_WORDS = {"kazanie", "rozważanie", "rozważania", "homilia", "w", "to", "niniejsze"}

SUMMARY_SYSTEM_PROMPT = (
    "Na podstawie transkrypcji kazania napisz krótki opis treści. "
    "Opis: 2–4 zdania, 250–400 znaków. "
    "Pisany z perspektywy redaktora, nie w pierwszej osobie, nie przez kaznodzieję. "
    "Opisuj wprost, o czym jest kazanie: główny temat, fragment Pisma i przesłanie. "
    "Styl: rzeczowy, konkretny, bez clickbaitu. "
    "Nie zaczynaj od pytania retorycznego. "
    "Nie kończ opisu ogólnikowym zdaniem podsumowującym w stylu 'To głębokie spojrzenie na...', "
    "'To praktyczne wskazówki...', 'To wezwanie do...', 'To przesłanie pełne...', 'To rozważanie pokazuje...' "
    "— każde zdanie ma nieść konkretną treść merytoryczną, żadne nie może być czystym ozdobnikiem. "
    "WAŻNE, NAJWAŻNIEJSZA ZASADA: pierwsze słowo opisu nie może być jednym z: "
    "Kazanie, Rozważanie, Rozważania, Homilia, W, To, Niniejsze — złam tę zasadę, a odpowiedź zostanie odrzucona. "
    "Zacznij od konkretnego tematu, osoby, wersetu lub pojęcia teologicznego, np. 'Przypowieść o...', "
    "'Paweł w liście do...', 'Wiara jako...', 'Modlitwa Jezusa w Getsemani...'. "
    "Nie używaj zwrotów: Słuchacz odkryje, odkryjesz, zapraszam, zachęcam, to zaproszenie. "
    "Nie używaj słów: odcinek, starożytny, dawny, antyczny. "
    "Różnicuj konstrukcję zdań między kolejnymi opisami — unikaj sztywnego schematu pytanie/teza na "
    "wstępie i ogólnikowe podsumowanie na końcu; czasem zacznij od cytatu, czasem od konkretnego wydarzenia, "
    "czasem od tezy teologicznej. "
    "Słowo Boże traktuj jako żywe i aktualne, mówiące do ludzi dziś. "
    "Zwróć TYLKO tekst opisu, nic więcej."
)


def _summary_first_word_ok(summary: str) -> bool:
    if not summary:
        return False
    first_word = summary.split()[0].strip(",.:;!?—–-").lower()
    return first_word not in FORBIDDEN_SUMMARY_FIRST_WORDS


def generate_summary(transcript: str) -> str:
    """Generate a short, engaging summary that encourages listening.
    Retries if the model ignores the "don't start with X" instruction, since
    that's the one rule it drifts on most — code-level validation beats hoping
    a single prompt attempt complies."""
    messages: list[dict] = [
        {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
        {"role": "user", "content": transcript[:8000]},
    ]
    summary = ""
    for attempt in range(4):
        resp = client.chat.completions.create(model="gpt-4.1-mini", messages=messages)
        summary = resp.choices[0].message.content.strip()
        if _summary_first_word_ok(summary):
            return summary
        messages.append({"role": "assistant", "content": summary})
        messages.append({
            "role": "user",
            "content": (
                f"Zaczęłaś/eś odpowiedź od zakazanego słowa. Napisz to jeszcze raz, inaczej sformułowane, "
                f"tak by pierwsze słowo NIE było jednym z: {', '.join(sorted(FORBIDDEN_SUMMARY_FIRST_WORDS))}."
            ),
        })
    log_error(f"generate_summary: still starting with forbidden word after retries: {summary[:60]!r}")
    return summary


def cleanup_transcript(raw_text: str) -> str:
    """Second LLM pass: punctuation, paragraphs, ASR fixes."""
    resp = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "Popraw transkrypcję kazania. Zachowaj pełną treść, sens i styl mówcy. "
                    "Popraw interpunkcję, podział na akapity i oczywiste błędy ASR. "
                    "Nie streszczaj i nie zmieniaj tonu wypowiedzi."
                ),
            },
            {"role": "user", "content": raw_text},
        ],
    )
    return resp.choices[0].message.content


# --- TTS ---


def split_for_tts(text: str) -> list[str]:
    """Split text into chunks safe for ElevenLabs (≤ TTS_AUDIO_CHUNK chars)."""
    paragraphs = text.split("\n\n")
    chunks: list[str] = []
    current = ""
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(current) + len(para) + 2 <= TTS_AUDIO_CHUNK:
            current = (current + "\n\n" + para).lstrip()
        else:
            if current:
                chunks.append(current)
            current = para[:TTS_AUDIO_CHUNK]
    if current:
        chunks.append(current)
    return chunks or [text[:TTS_AUDIO_CHUNK]]


def translate_title_summary(title: str, summary: str, lang_code: str) -> dict:
    """Translate only title and summary (no transcript). Used when skipping TTS."""
    lang_name = LANG_NAMES[lang_code]
    resp = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    f"Translate the following sermon title and description to {lang_name}. "
                    "Return a JSON object with keys 'title' and 'summary'."
                ),
            },
            {"role": "user", "content": json.dumps({"title": title, "summary": summary})},
        ],
        response_format={"type": "json_object"},
    )
    result = json.loads(resp.choices[0].message.content)
    return {"title": result.get("title", title), "summary": result.get("summary", summary)}


def translate_for_lang(transcript: str, title: str, summary: str, lang_code: str) -> dict:
    """Translate transcript, title and summary to target language."""
    lang_name = LANG_NAMES[lang_code]

    meta_resp = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    f"Translate the following sermon title and description to {lang_name}. "
                    "Return a JSON object with keys 'title' and 'summary'."
                ),
            },
            {"role": "user", "content": json.dumps({"title": title, "summary": summary})},
        ],
        response_format={"type": "json_object"},
    )
    meta_translated = json.loads(meta_resp.choices[0].message.content)

    paragraphs = transcript.split("\n\n")
    translation_chunks: list[str] = []
    current = ""
    for para in paragraphs:
        if len(current) + len(para) + 2 <= TTS_TRANSLATION_CHUNK:
            current = (current + "\n\n" + para).lstrip()
        else:
            if current:
                translation_chunks.append(current)
            current = para
    if current:
        translation_chunks.append(current)

    translated_parts: list[str] = []
    for chunk in translation_chunks:
        resp = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"Translate this sermon transcript segment to {lang_name}. "
                        "Preserve the preaching style and tone. Return only the translation."
                    ),
                },
                {"role": "user", "content": chunk},
            ],
        )
        translated_parts.append(resp.choices[0].message.content.strip())

    return {
        "title": meta_translated.get("title", title),
        "summary": meta_translated.get("summary", summary),
        "transcript": "\n\n".join(translated_parts),
    }


def generate_tts_audio(text: str, voice_id: str, output_path: Path) -> int:
    """Generate TTS via ElevenLabs, save as opus. Returns duration in seconds."""
    el = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"], timeout=120)
    chunks = split_for_tts(text)
    tmp_files: list[Path] = []

    try:
        for i, chunk in enumerate(chunks):
            audio_bytes = b"".join(
                el.text_to_speech.convert(
                    voice_id=voice_id,
                    text=chunk,
                    model_id="eleven_multilingual_v2",
                    output_format="mp3_44100_128",
                )
            )
            tmp_path = output_path.with_name(f"_tts_{i}.mp3")
            tmp_path.write_bytes(audio_bytes)
            tmp_files.append(tmp_path)

        if len(tmp_files) == 1:
            (
                ffmpeg
                .input(str(tmp_files[0]))
                .output(str(output_path), acodec="libopus", audio_bitrate="48k")
                .overwrite_output()
                .run(quiet=True)
            )
        else:
            list_path = output_path.with_name("_tts_list.txt")
            list_path.write_text(
                "\n".join(f"file '{f.absolute()}'" for f in tmp_files),
                encoding="utf-8",
            )
            concat_path = output_path.with_name("_tts_concat.mp3")
            (
                ffmpeg
                .input(str(list_path), format="concat", safe=0)
                .output(str(concat_path), c="copy")
                .overwrite_output()
                .run(quiet=True)
            )
            (
                ffmpeg
                .input(str(concat_path))
                .output(str(output_path), acodec="libopus", audio_bitrate="48k")
                .overwrite_output()
                .run(quiet=True)
            )
            list_path.unlink(missing_ok=True)
            concat_path.unlink(missing_ok=True)

        probe = ffmpeg.probe(str(output_path))
        return int(float(probe["format"]["duration"]))

    finally:
        for f in tmp_files:
            f.unlink(missing_ok=True)


# --- Metadata ---


def extract_tag_value(tags: list[str], prefix: str) -> str:
    prefix_lower = prefix.lower()
    for tag in tags:
        if tag.lower().startswith(prefix_lower):
            return tag.split(":", 1)[-1].strip()
    return ""


def extract_service_title(tags: list[str]) -> str:
    for tag in tags:
        if tag.lower().startswith("usługa:"):
            value = tag.split(":", 1)[-1].strip()
            if value.lower() != "kazanie":
                return value
    return ""


def parse_date(upload_date: str) -> str:
    if len(upload_date) == 8 and upload_date.isdigit():
        return f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}"
    return ""


_PREACHER_PREFIXES = ("br. ", "brat ", "brother ", "pastor ", "ks. ", "dr. ")


_QUOTE_CHARS = '"\u201c\u201d\u2018\u2019'


def clean_title(raw: str, preacher: str) -> tuple[str, str]:
    """Returns (cleaned_title, preacher) — extracts preacher from title if not provided."""
    title = raw.strip().lstrip(_QUOTE_CHARS).rstrip(_QUOTE_CHARS).strip()

    if not preacher and " - " in title:
        parts = title.rsplit(" - ", 1)
        suffix = parts[1].strip()
        for prefix in _PREACHER_PREFIXES:
            if suffix.lower().startswith(prefix):
                preacher = suffix[len(prefix):].strip()
                title = parts[0]
                break

    if preacher:
        pattern = (
            r"\s*-\s+(?:"
            + "|".join(re.escape(p) for p in _PREACHER_PREFIXES)
            + r")?"
            + re.escape(preacher)
            + r"\s*$"
        )
        title = re.sub(pattern, "", title, flags=re.IGNORECASE)

    # Strip any quotes left behind after speaker removal, normalize whitespace
    title = title.strip().rstrip(_QUOTE_CHARS).strip()
    title = re.sub(r"cz\.(\d)", r"cz. \1", title)
    title = re.sub(r":\s*(cz\.)", r" \1", title)
    return re.sub(r" {2,}", " ", title).strip(), preacher



def build_metadata(info: dict) -> dict:
    tags = info.get("tags") or []
    video_id = info.get("id", "")
    upload_date = info.get("upload_date") or ""
    duration = info.get("duration") or 0

    preacher = extract_tag_value(tags, "Kaznodzieja:")
    raw_title = extract_service_title(tags) or info.get("title", "")
    title, preacher = clean_title(raw_title, preacher)

    return {
        "title": title,
        "preacher": preacher,
        "date": parse_date(upload_date),
        "youtube_url": f"https://www.youtube.com/watch?v={video_id}",
        "video_id": video_id,
        "duration": int(duration),
    }


def cache_control_for(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".webp", ".jpg", ".png", ".opus", ".mp3"}:
        return IMMUTABLE_CACHE
    return SHORT_CACHE


def make_s3_client():
    """Returns (s3_client, bucket_name)."""
    bucket = os.environ.get("R2_BUCKET", "kztg")
    account_id = os.environ["R2_ACCOUNT_ID"]
    endpoint = f"https://{account_id}.eu.r2.cloudflarestorage.com"
    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )
    return s3, bucket


def r2_list_keys(s3, bucket: str, video_id: str) -> set[str]:
    """Return filenames (not full keys) already in R2 for this sermon."""
    prefix = f"sermons/{video_id}/"
    resp = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)
    return {obj["Key"].removeprefix(prefix) for obj in resp.get("Contents", [])}


def write_cover_webp(s3, bucket: str, video_id: str, sermon_dir: Path, r2_keys: set[str]) -> str | None:
    """Resize/convert the sermon's raw cover into public/images/covers/<id>.webp,
    matching the old sync_metadata.js behavior (max 640px wide, quality 82).
    Skips work if that file already exists locally. Returns the site-relative
    path to store as the sermon's `cover` field, or None if there's no cover."""
    out_path = PUBLIC_COVERS_DIR / f"{video_id}.webp"
    if out_path.exists():
        return f"/images/covers/{video_id}.webp"

    local_webp = sermon_dir / f"{video_id}.webp"
    if local_webp.exists():
        raw_bytes = local_webp.read_bytes()
    elif f"{video_id}.webp" in r2_keys:
        resp = s3.get_object(Bucket=bucket, Key=f"sermons/{video_id}/{video_id}.webp")
        raw_bytes = resp["Body"].read()
    else:
        return None

    img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    if img.width > COVER_MAX_WIDTH:
        new_height = round(img.height * COVER_MAX_WIDTH / img.width)
        img = img.resize((COVER_MAX_WIDTH, new_height), Image.LANCZOS)

    PUBLIC_COVERS_DIR.mkdir(parents=True, exist_ok=True)
    img.save(out_path, "WEBP", quality=82, method=4)
    log_info(f"  cover saved: images/covers/{video_id}.webp ({img.width}×{img.height})")
    return f"/images/covers/{video_id}.webp"


CONTENT_DIR = Path(__file__).parent.parent / "src" / "content" / "sermons"


def load_local_sermon(video_id: str) -> dict | None:
    """Read the repo-committed sermon JSON, if present. This is the source of
    truth for text data (metadata, translations, transcripts) — R2 only holds media."""
    path = CONTENT_DIR / f"{video_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def write_local_sermon(video_id: str, data: dict) -> None:
    CONTENT_DIR.mkdir(parents=True, exist_ok=True)
    path = CONTENT_DIR / f"{video_id}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def upload_file_to_r2(s3, bucket: str, video_id: str, path: Path) -> None:
    key = f"sermons/{video_id}/{path.name}"
    content_type, _ = mimetypes.guess_type(path.name)
    extra: dict = {"CacheControl": cache_control_for(path)}
    if content_type:
        extra["ContentType"] = content_type
    with path.open("rb") as fh:
        s3.put_object(Bucket=bucket, Key=key, Body=fh, **extra)
    log_info(f"  → uploaded {path.name}")


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Sermon processing pipeline")
    parser.add_argument("urls", nargs="*", metavar="YT_URL")
    parser.add_argument("--force", action="store_true",
                        help="Delete existing R2 files for each video and reprocess from scratch")
    parser.add_argument("--skip-tts", action="store_true",
                        help="Translate title+summary only, skip TTS audio generation")
    args = parser.parse_args()

    urls = args.urls
    if not urls and not sys.stdin.isatty():
        urls = [line.strip() for line in sys.stdin if line.strip()]

    if not urls:
        log_info("No URLs to process.")
        return

    for yt_url in urls:
        try:
            process_sermon(yt_url, force=args.force, skip_tts=args.skip_tts)
        except Exception as exc:
            log_error(f"Failed processing {yt_url}: {exc}")
            continue


def r2_delete_prefix(s3, bucket: str, video_id: str) -> None:
    """Delete all R2 objects under sermons/{video_id}/."""
    prefix = f"sermons/{video_id}/"
    resp = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)
    keys = [obj["Key"] for obj in resp.get("Contents", [])]
    if not keys:
        return
    s3.delete_objects(Bucket=bucket, Delete={"Objects": [{"Key": k} for k in keys]})
    log_info(f"  → deleted {len(keys)} object(s) from R2")


def process_sermon(yt_url: str, *, force: bool = False, skip_tts: bool = False) -> None:
    s3, bucket = make_s3_client()

    log_info(f"Resolving video ID for {yt_url}...")
    with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, **_yt_cookie_opts()}) as ydl:
        pre_info = ydl.extract_info(yt_url, download=False)
        video_id = pre_info["id"]

    if force:
        log_info(f"--force: deleting existing R2 media for {video_id}...")
        r2_delete_prefix(s3, bucket, video_id)

    # Metadata/transcripts live in the repo (src/content/sermons/<id>.json);
    # R2 only holds media (audio, TTS audio, cover image).
    local_sermon = None if force else load_local_sermon(video_id)
    if local_sermon and local_sermon.get("hidden"):
        log_info(f"✓ {video_id} marked hidden, skipping")
        return

    log_info(f"Checking R2 media state for {video_id}...")
    r2_keys = r2_list_keys(s3, bucket, video_id)
    has_audio = f"{video_id}.opus" in r2_keys
    tts_done = {lang: f"{video_id}_{lang}.opus" in r2_keys for lang in ELEVENLABS_VOICE_IDS}
    langs_needed = [lang for lang, done in tts_done.items() if not done]

    has_metadata = local_sermon is not None
    has_transcript = bool(local_sermon and (local_sermon.get("transcript") or {}).get("pl"))

    all_tts_done = not langs_needed
    if has_audio and has_transcript and has_metadata and (skip_tts or all_tts_done):
        log_info(f"✓ {video_id} already complete, skipping")
        return

    sermon_dir = Path(tempfile.gettempdir()) / "kztg-pipeline" / video_id
    sermon_dir.mkdir(parents=True, exist_ok=True)
    to_upload: list[Path] = []  # media only

    try:
        # --- Transcript (pl) ---
        if has_transcript:
            cleaned = local_sermon["transcript"]["pl"]
        else:
            transcript_path = sermon_dir / "transcript.txt"
            if transcript_path.exists():
                log_info("Using existing local scratch transcript...")
                cleaned = transcript_path.read_text(encoding="utf-8")
            else:
                log_info(f"Downloading {video_id} from YouTube...")
                download_sermon(yt_url, sermon_dir)
                audio_file = sermon_dir / f"{video_id}.opus"
                if not audio_file.exists():
                    raise FileNotFoundError(f"Audio not found: {audio_file}")

                transcription_file = sermon_dir / "transcription.mp3"
                log_info("Generating transcription MP3 (mono 16kHz)...")
                generate_transcription_audio(audio_file, transcription_file)

                chunks_dir = sermon_dir / "chunks"
                log_info("Splitting into 15-min chunks...")
                chunks = split_into_chunks(transcription_file, chunks_dir)
                if not chunks:
                    raise RuntimeError("No chunks generated")

                raw_parts: list[str] = []
                for chunk in chunks:
                    log_info(f"Transcribing {chunk.name}...")
                    raw_parts.append(transcribe_chunk(chunk))
                raw_transcript = "\n\n".join(raw_parts)
                (sermon_dir / "transcript_raw.txt").write_text(raw_transcript, encoding="utf-8")

                log_info("Running LLM cleanup pass...")
                cleaned = cleanup_transcript(raw_transcript)
                transcript_path.write_text(cleaned, encoding="utf-8")

                if not has_audio:
                    to_upload.append(audio_file)
                webp = sermon_dir / f"{video_id}.webp"
                if webp.exists() and not (f"{video_id}.webp" in r2_keys):
                    to_upload.append(webp)

        # --- Metadata & summary ---
        if local_sermon:
            metadata = dict(local_sermon)
            summary = metadata.get("summary", "")
            translations: dict = dict(metadata.get("translations", {}))
            tts_durations: dict = dict(metadata.get("tts_durations", {}))
            transcript_by_lang: dict = dict(metadata.get("transcript", {}))
        else:
            metadata = build_metadata(pre_info)
            metadata.pop("youtube_url", None)
            metadata.pop("video_id", None)
            log_info("Generating summary...")
            summary = generate_summary(cleaned)
            translations = {}
            tts_durations = {}
            transcript_by_lang = {}

        transcript_by_lang["pl"] = cleaned

        # --- Translations (metadata only when skip_tts, full when TTS enabled) ---
        for lang_code, voice_id in ELEVENLABS_VOICE_IDS.items():
            if lang_code in translations:
                if skip_tts or tts_done.get(lang_code):
                    log_info(f"Skipping {lang_code.upper()} (already translated)")
                    continue

            if skip_tts:
                log_info(f"Translating {lang_code.upper()} (title+summary only)...")
                lang_meta = translate_title_summary(metadata["title"], summary, lang_code)
                translations[lang_code] = lang_meta
                log_info(f"  → {lang_code.upper()} translated")
            else:
                if tts_done.get(lang_code):
                    log_info(f"Skipping {lang_code.upper()} TTS (already in R2)")
                    continue

                tts_path = sermon_dir / f"{video_id}_{lang_code}.opus"
                scratch_path = sermon_dir / f"{lang_code}_translation.json"
                if tts_path.exists() and scratch_path.exists():
                    log_info(f"Using existing local scratch TTS for {lang_code.upper()}...")
                    lang_scratch = json.loads(scratch_path.read_text(encoding="utf-8"))
                    translations[lang_code] = {
                        "title": lang_scratch["title"],
                        "summary": lang_scratch["summary"],
                    }
                    transcript_by_lang[lang_code] = lang_scratch["transcript"]
                    tts_durations[lang_code] = lang_scratch["duration"]
                    to_upload.append(tts_path)
                    continue

                log_info(f"Translating and generating TTS for {lang_code.upper()}...")
                lang_data = translate_for_lang(cleaned, metadata["title"], summary, lang_code)
                translations[lang_code] = {
                    "title": lang_data["title"],
                    "summary": lang_data["summary"],
                }
                transcript_by_lang[lang_code] = lang_data["transcript"]
                duration = generate_tts_audio(lang_data["transcript"], voice_id, tts_path)
                tts_durations[lang_code] = duration
                scratch_path.write_text(
                    json.dumps(
                        {
                            "title": lang_data["title"],
                            "summary": lang_data["summary"],
                            "transcript": lang_data["transcript"],
                            "duration": duration,
                        },
                        ensure_ascii=False,
                    ),
                    encoding="utf-8",
                )
                to_upload.append(tts_path)
                log_info(f"  → {lang_code.upper()} done ({duration}s)")

        # --- Bible refs ---
        if not isinstance(metadata.get("bible_refs"), dict):
            log_info("Extracting Bible references...")
            metadata["bible_refs"] = extract_bible_refs(cleaned)

        # --- Media URLs & cover (pipeline fully owns the local sermon record now —
        # no separate sync step needed to fill these in) ---
        metadata["audio"] = f"{PUBLIC_BASE_URL}/sermons/{video_id}/{video_id}.opus"
        tts_urls = dict(metadata.get("tts", {}))
        for lang_code in ELEVENLABS_VOICE_IDS:
            if tts_durations.get(lang_code) is not None:
                tts_urls[lang_code] = f"{PUBLIC_BASE_URL}/sermons/{video_id}/{video_id}_{lang_code}.opus"
        if tts_urls:
            metadata["tts"] = tts_urls

        cover_path = write_cover_webp(s3, bucket, video_id, sermon_dir, r2_keys)
        if cover_path:
            metadata["cover"] = cover_path

        # --- Finalize & write metadata directly into the repo ---
        metadata["summary"] = summary
        metadata["translations"] = translations
        metadata["tts_durations"] = tts_durations
        metadata["transcript"] = transcript_by_lang
        write_local_sermon(video_id, metadata)
        log_info(f"  → wrote src/content/sermons/{video_id}.json")

        # --- Upload only new/changed MEDIA files to R2 ---
        if to_upload:
            log_info(f"Uploading {len(to_upload)} media file(s) to R2...")
            for path in to_upload:
                upload_file_to_r2(s3, bucket, video_id, path)
        else:
            log_info("No new media to upload.")
    except BaseException:
        log_info(f"⚠ {video_id} interrupted — local scratch in {sermon_dir} kept for resuming next run")
        raise

    # Only clean up the scratch dir once everything above has actually
    # succeeded — on failure/interruption it stays so a rerun can resume
    # from whatever transcript/translations/TTS audio already finished
    # instead of redoing every language from scratch.
    shutil.rmtree(sermon_dir, ignore_errors=True)
    log_info(f"✓ {video_id} done")


if __name__ == "__main__":
    main()

