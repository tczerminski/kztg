import json
import mimetypes
import os
from pathlib import Path

import boto3


def extract_tag_value(tags, prefix):
    prefix_lower = prefix.lower()
    for tag in tags:
        if tag.lower().startswith(prefix_lower):
            return tag.split(":", 1)[-1].strip()
    return ""


def extract_service_title(tags):
    for tag in tags:
        if tag.lower().startswith("usługa:"):
            value = tag.split(":", 1)[-1].strip()
            if value.lower() != "kazanie":
                return value
    return ""


def parse_date(upload_date):
    if len(upload_date) == 8 and upload_date.isdigit():
        return f"{upload_date[0:4]}-{upload_date[4:6]}-{upload_date[6:8]}"
    return ""


def main():
    info_files = list(Path(".").glob("*/**/*.info.json"))
    if not info_files:
        raise SystemExit("No .info.json found.")

    info_path = info_files[0]
    item_dir = info_path.parent

    info = json.loads(info_path.read_text(encoding="utf-8"))
    tags = info.get("tags") or []

    upload_date = info.get("upload_date") or ""

    metadata = {
        "preacher": extract_tag_value(tags, "Kaznodzieja:"),
        "date": parse_date(upload_date),
        "title": extract_service_title(tags) or info.get("title", ""),
    }

    metadata_path = item_dir / "metadata.json"
    metadata_path.write_text(
        json.dumps(metadata, ensure_ascii=False),
        encoding="utf-8",
    )

    bucket = os.environ.get("R2_BUCKET", "kztg")
    account_id = os.environ["R2_ACCOUNT_ID"]
    access_key = os.environ["R2_ACCESS_KEY_ID"]
    secret_key = os.environ["R2_SECRET_ACCESS_KEY"]

    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.eu.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )

    sermon_id = item_dir.name
    key_prefix = f"sermons/{sermon_id}/"

    def upload_file(path: Path):
        content_type, _ = mimetypes.guess_type(path.name)
        extra = {"ContentType": content_type} if content_type else {}
        key = key_prefix + path.name
        with path.open("rb") as fh:
            s3.put_object(Bucket=bucket, Key=key, Body=fh, **extra)

    for file_path in item_dir.glob("*.opus"):
        upload_file(file_path)
    for file_path in item_dir.glob("*.webp"):
        upload_file(file_path)
    upload_file(metadata_path)

    print(f"Uploaded to s3://{bucket}/{key_prefix}")


if __name__ == "__main__":
    main()

