#!/usr/bin/env node
/**
 * Generates js/metadata.js by listing R2 (audio + metadata.json + covers).
 * Covers are downloaded from R2, converted to webp, and saved to dist/images/covers/.
 * Re-runs skip already-downloaded covers.
 */
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config as dotenvConfig } from "dotenv";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenvConfig({ path: path.join(ROOT, ".env") });

// =========================
// CONFIG
// =========================

const R2_ACCOUNT_ID        = process.env.R2_ACCOUNT_ID ?? "";
const R2_ACCESS_KEY_ID     = process.env.R2_ACCESS_KEY_ID ?? "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";
const R2_ENDPOINT          = process.env.R2_ENDPOINT
  ?? `https://${R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`;
const BUCKET_NAME          = process.env.R2_BUCKET ?? "kztg";
const PUBLIC_BASE_URL      = (
  process.env.R2_PUBLIC_BASE_URL
  ?? "https://pub-8b5cdf2f2aed4a6e832dd72430dfacc1.r2.dev"
).replace(/\/$/, "");

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error("Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY.");
  process.exit(1);
}

const OUTPUT_FILE  = path.join(ROOT, "js/metadata.js");
const COVERS_DIR   = path.join(ROOT, "dist/images/covers");
const COVERS_MAX_W = 640;

// =========================
// R2 CLIENT
// =========================

const s3 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: "auto",
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

function publicUrl(key) {
  return `${PUBLIC_BASE_URL}/${key}`;
}

// =========================
// COVER: download from R2 → dist/images/covers/<id>.webp
// =========================

async function fetchCover(r2Key, sermonId) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
  const outPath = path.join(COVERS_DIR, `${sermonId}.webp`);

  if (fs.existsSync(outPath)) return `/images/covers/${sermonId}.webp`;

  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: r2Key }));
    const chunks = [];
    for await (const c of res.Body) chunks.push(c);
    const buffer = Buffer.concat(chunks);

    const img = sharp(buffer);
    const meta = await img.metadata();
    const pipeline = meta.width > COVERS_MAX_W
      ? img.resize(COVERS_MAX_W, null, { fit: "inside", kernel: "lanczos3" })
      : img;

    await pipeline.webp({ quality: 82, effort: 4 }).toFile(outPath);
    console.log(`  cover saved: dist/images/covers/${sermonId}.webp (${meta.width}×${meta.height})`);
    return `/images/covers/${sermonId}.webp`;
  } catch (err) {
    console.warn(`  WARNING: could not fetch cover for ${sermonId}: ${err.message}`);
    return publicUrl(r2Key);
  }
}

// =========================
// LIST R2
// =========================

const audioPriority = { ".opus": 0, ".mp3": 1, ".m4a": 2, ".aac": 3, ".ogg": 4, ".wav": 5 };
const coverPriority = { ".webp": 0, ".jpg": 1, ".jpeg": 2, ".png": 3 };
const sermons = {};
let token;

do {
  const res = await s3.send(new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    ...(token ? { ContinuationToken: token } : {}),
  }));

  for (const obj of res.Contents ?? []) {
    const parts = obj.Key.split("/");
    if (parts.length !== 3 || parts[0] !== "sermons") continue;

    const [, id, filename] = parts;
    const ext = path.extname(filename).toLowerCase();

    sermons[id] ??= { id, date: "", _audioRank: null, _coverRank: null };

    if (filename === "metadata.json") {
      const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: obj.Key }));
      const chunks = [];
      for await (const c of r.Body) chunks.push(c);
      const meta = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!sermons[id].date)     sermons[id].date     = meta.date     ?? "";
      if (!sermons[id].preacher) sermons[id].preacher = meta.preacher ?? "";
      if (!sermons[id].title)    sermons[id].title    = meta.title    ?? "";
    }

    if (ext in audioPriority) {
      const rank = audioPriority[ext];
      if (sermons[id]._audioRank === null || rank < sermons[id]._audioRank) {
        sermons[id].audio = publicUrl(obj.Key);
        sermons[id]._audioRank = rank;
      }
    }

    if (ext in coverPriority) {
      const rank = coverPriority[ext];
      if (sermons[id]._coverRank === null || rank < sermons[id]._coverRank) {
        sermons[id]._coverKey = obj.Key;
        sermons[id]._coverRank = rank;
      }
    }
  }

  token = res.IsTruncated ? res.NextContinuationToken : undefined;
} while (token);

// =========================
// BUILD ITEMS
// =========================

const items = [];

for (const sermon of Object.values(sermons)) {
  if (!sermon.audio) continue;

  const coverKey = sermon._coverKey;
  if (coverKey) sermon.cover = await fetchCover(coverKey, sermon.id);

  delete sermon._audioRank;
  delete sermon._coverRank;
  delete sermon._coverKey;

  items.push(sermon);
}

items.sort((a, b) =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0
);

// =========================
// WRITE
// =========================

fs.writeFileSync(OUTPUT_FILE, `window.SERMONS=${JSON.stringify(items)};`, "utf8");
console.log(`\nGenerated ${OUTPUT_FILE}`);
console.log(`Items: ${items.length}`);

