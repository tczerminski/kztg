#!/usr/bin/env python3
import json
import mimetypes
import os
import shutil
import sys
from pathlib import Path

import boto3
import ffmpeg
import openai
import yt_dlp
from botocore.config import Config
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env", override=True)

client = openai.OpenAI()  # reads OPENAI_API_KEY from env automatically
CHUNK_DURATION_SEC = 900  # 15 minutes

IMMUTABLE_CACHE = "public, max-age=31536000, immutable"
SHORT_CACHE = "public, max-age=300, must-revalidate"


def log_info(msg: str) -> None:
    print(f"[INFO] {msg}")


def log_error(msg: str) -> None:
    print(f"[ERROR] {msg}", file=sys.stderr)


def download_sermon(yt_url: str, sermon_dir: Path) -> dict:
    """Download audio(.opus), thumbnail(.webp), info.json. Returns yt-dlp info dict."""
    ydl_opts = {
        "format": "bestaudio*",
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


def generate_summary(transcript: str) -> str:
    """Generate a short, engaging summary that encourages listening."""
    resp = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "Na podstawie transkrypcji kazania napisz opis zachęcający "
                    "do przesłuchania (3-5 zdań, 300-400 znaków). "
                    "Pisz bezpośrednio do potencjalnego słuchacza — tak jak opis "
                    "odcinka podcastu. Styl: zwięzły, ciepły, konkretny. "
                    "Użyj głównego pytania lub napięcia z kazania jako haczyka. "
                    "Nakreśl główny wątek i pokaż, co słuchacz może wynieść. "
                    "Nie zaczynaj od 'W tym kazaniu...'. Nie używaj słów 'odcinek', 'zapraszam', "
                    "'zachęcam' ani pierwszej osoby — "
                    "opis ma być napisany jakby przez redaktora, nie przez kaznodzieję."
                ),
            },
            {"role": "user", "content": transcript[:8000]},
        ],
    )
    return resp.choices[0].message.content.strip()


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


def build_metadata(info: dict) -> dict:
    tags = info.get("tags") or []
    video_id = info.get("id", "")
    upload_date = info.get("upload_date") or ""
    duration = info.get("duration") or 0

    return {
        "title": extract_service_title(tags) or info.get("title", ""),
        "preacher": extract_tag_value(tags, "Kaznodzieja:"),
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


def upload_to_r2(sermon_dir: Path, video_id: str) -> None:
    """Upload opus, webp, metadata.json, transcript.txt to R2."""
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

    prefix = f"sermons/{video_id}/"

    def upload(path: Path) -> None:
        content_type, _ = mimetypes.guess_type(path.name)
        extra: dict = {"CacheControl": cache_control_for(path)}
        if content_type:
            extra["ContentType"] = content_type
        key = prefix + path.name
        with path.open("rb") as fh:
            s3.put_object(Bucket=bucket, Key=key, Body=fh, **extra)
        log_info(f"  → uploaded {path.name}")

    for f in sermon_dir.glob("*.opus"):
        upload(f)
    for f in sermon_dir.glob("*.webp"):
        upload(f)

    metadata_path = sermon_dir / "metadata.json"
    if metadata_path.exists():
        upload(metadata_path)

    transcript_path = sermon_dir / "transcript.txt"
    if transcript_path.exists():
        upload(transcript_path)

    log_info(f"Upload complete → s3://{bucket}/{prefix}")


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python scripts/pipeline.py <yt_url> [<yt_url> ...]", file=sys.stderr)
        sys.exit(1)

    scripts_dir = Path(__file__).parent
    urls = sys.argv[1:]

    for yt_url in urls:
        try:
            process_sermon(yt_url, scripts_dir)
        except Exception as exc:
            log_error(f"Failed processing {yt_url}: {exc}")
            continue


def process_sermon(yt_url: str, scripts_dir: Path) -> None:
    # Resolve video ID without downloading
    log_info(f"Resolving video ID for {yt_url}...")
    with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True}) as ydl:
        pre_info = ydl.extract_info(yt_url, download=False)
        video_id = pre_info["id"]

    sermon_dir = scripts_dir / video_id
    sermon_dir.mkdir(parents=True, exist_ok=True)

    # Idempotency: if already processed locally, upload and clean up
    transcript_path = sermon_dir / "transcript.txt"
    metadata_path = sermon_dir / "metadata.json"
    if transcript_path.exists() and metadata_path.exists():
        log_info(f"{video_id} already processed locally — uploading and cleaning up...")
        upload_to_r2(sermon_dir, video_id)
        shutil.rmtree(sermon_dir)
        log_info(f"✓ {video_id} done (resumed)")
        return

    # 1. Download
    log_info(f"Downloading {video_id}...")
    info = download_sermon(yt_url, sermon_dir)

    audio_file = sermon_dir / f"{video_id}.opus"
    if not audio_file.exists():
        raise FileNotFoundError(f"Audio not found: {audio_file}")

    # 2. Transcription audio
    transcription_file = sermon_dir / "transcription.mp3"
    log_info("Generating transcription MP3 (mono 16kHz)...")
    generate_transcription_audio(audio_file, transcription_file)

    # 3. Split into chunks
    chunks_dir = sermon_dir / "chunks"
    log_info("Splitting into 15-min chunks...")
    chunks = split_into_chunks(transcription_file, chunks_dir)
    if not chunks:
        raise RuntimeError("No chunks generated")

    # 4. Transcribe
    raw_parts: list[str] = []
    for chunk in chunks:
        log_info(f"Transcribing {chunk.name}...")
        raw_parts.append(transcribe_chunk(chunk))

    raw_transcript = "\n\n".join(raw_parts)
    raw_path = sermon_dir / "transcript_raw.txt"
    raw_path.write_text(raw_transcript, encoding="utf-8")

    # 5. Cleanup pass
    log_info("Running LLM cleanup pass...")
    cleaned = cleanup_transcript(raw_transcript)
    transcript_path.write_text(cleaned, encoding="utf-8")

    # 6. Summary
    log_info("Generating summary...")
    summary = generate_summary(cleaned)

    # 7. Metadata
    metadata = build_metadata(info)
    metadata["summary"] = summary
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    # 8. Upload to R2
    log_info("Uploading to R2...")
    upload_to_r2(sermon_dir, video_id)

    # 9. Cleanup: remove entire sermon directory
    log_info("Removing local sermon directory...")
    shutil.rmtree(sermon_dir)

    log_info(f"✓ {video_id} done")


if __name__ == "__main__":
    main()

