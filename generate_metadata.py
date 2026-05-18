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

        if len(sermon_id) != 8 or not sermon_id.isdigit():
            continue

        sermons.setdefault(sermon_id, {
            "id": sermon_id,
            "date": "",
        })

        if filename == "metadata.json":
            obj_data = s3.get_object(Bucket=BUCKET_NAME, Key=key)
            meta = json.loads(obj_data["Body"].read())
            sermons[sermon_id]["date"] = meta.get("date", "")
            sermons[sermon_id]["preacher"] = meta.get("preacher", "")
            sermons[sermon_id]["title"] = meta.get("title", "")

        if filename == "audio.mp3":
            sermons[sermon_id]["audio"] = public_url(key)

        elif filename == "audio.opus":
            sermons[sermon_id]["audio"] = public_url(key)

        elif filename == "cover.jpg":
            sermons[sermon_id]["cover"] = public_url(key)

        elif filename == "cover.webp":
            sermons[sermon_id]["cover"] = public_url(key)

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

    items.append(item)

items.sort(
    key=lambda x: x["id"],
    reverse=True
)

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