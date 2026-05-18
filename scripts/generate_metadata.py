#!/usr/bin/env python3
import json
import os
from datetime import datetime

import boto3

# =========================
# CONFIG
# =========================

R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")

if not R2_ACCOUNT_ID or not R2_ACCESS_KEY_ID or not R2_SECRET_ACCESS_KEY:
    raise SystemExit("Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY in environment.")

BUCKET_NAME = "kztg"

PREFIX = ""

PUBLIC_BASE_URL = "https://pub-8b5cdf2f2aed4a6e832dd72430dfacc1.r2.dev"

OUTPUT_FILE = "js/metadata.js"

# =========================
# R2 CLIENT
# =========================

s3 = boto3.client(
    "s3",
    endpoint_url=f"https://{R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com",
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name="auto",
)

def public_url(key: str) -> str:
    return f"{PUBLIC_BASE_URL}/{key}"


# =========================
# LOAD OBJECTS
# =========================

sermons = {}

audio_priority = {
    ".opus": 0,
    ".mp3": 1,
    ".m4a": 2,
    ".aac": 3,
    ".ogg": 4,
    ".wav": 5,
}
cover_priority = {
    ".webp": 0,
    ".jpg": 1,
    ".jpeg": 2,
    ".png": 3,
}

continuation_token = None

while True:
    kwargs = {
        "Bucket": BUCKET_NAME,
        "Prefix": PREFIX,
    }

    if continuation_token:
        kwargs["ContinuationToken"] = continuation_token

    response = s3.list_objects_v2(**kwargs)

    for obj in response.get("Contents", []):
        key = obj["Key"]

        parts = key.split("/")

        if len(parts) != 3:
            continue

        _, sermon_id, filename = parts


        sermons.setdefault(sermon_id, {
            "id": sermon_id,
            "date": "",
        })
        sermons[sermon_id].setdefault("_audio_rank", None)
        sermons[sermon_id].setdefault("_cover_rank", None)

        if filename == "metadata.json":
            obj_data = s3.get_object(Bucket=BUCKET_NAME, Key=key)
            meta = json.loads(obj_data["Body"].read())

            if filename == "manifest.json":
                sermons[sermon_id]["date"] = meta.get("date", "")
                sermons[sermon_id]["preacher"] = meta.get("preacher", "")
                sermons[sermon_id]["title"] = meta.get("title", "")
            else:
                if not sermons[sermon_id].get("date"):
                    sermons[sermon_id]["date"] = meta.get("date", "")
                if not sermons[sermon_id].get("preacher"):
                    sermons[sermon_id]["preacher"] = meta.get("preacher", "")
                if not sermons[sermon_id].get("title"):
                    sermons[sermon_id]["title"] = meta.get("title", "")

        _, ext = os.path.splitext(filename)
        ext = ext.lower()

        if ext in audio_priority:
            current_rank = sermons[sermon_id]["_audio_rank"]
            new_rank = audio_priority[ext]
            if current_rank is None or new_rank < current_rank:
                sermons[sermon_id]["audio"] = public_url(key)
                sermons[sermon_id]["_audio_rank"] = new_rank

        if ext in cover_priority:
            current_rank = sermons[sermon_id]["_cover_rank"]
            new_rank = cover_priority[ext]
            if current_rank is None or new_rank < current_rank:
                sermons[sermon_id]["cover"] = public_url(key)
                sermons[sermon_id]["_cover_rank"] = new_rank

    if not response.get("IsTruncated"):
        break

    continuation_token = response.get("NextContinuationToken")

# =========================
# FILTER + SORT
# =========================

items = []

for item in sermons.values():
    if "audio" not in item:
        continue

    item.pop("_audio_rank", None)
    item.pop("_cover_rank", None)
    items.append(item)

def sort_key(entry):
    return (
        entry.get("date", ""),
        entry.get("id", ""),
    )

items.sort(key=sort_key, reverse=True)

# =========================
# FINAL JSON
# =========================

metadata = {
    "generated_at": datetime.now().isoformat() + "Z",
    "count": len(items),
    "items": items,
}

# =========================
# WRITE FILE
# =========================

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    f.write("window.SERMONS=")
    json.dump(items, f, separators=(",", ":"))
    f.write(";")

print(f"Generated {OUTPUT_FILE}")
print(f"Items: {len(items)}")
