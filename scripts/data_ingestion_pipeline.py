#!/usr/bin/env python3
"""
NGA Data Ingestion Pipeline — Webhook Feeder

Downloads NGA open data CSVs from GitHub, filters for artworks with images,
and sends them in batches to the n8n data-ingestion webhook for processing.

The n8n workflow handles: AI vision analysis, tag generation, embedding
creation, PostgreSQL storage, and Qdrant vector storage.

Usage:
    python data_ingestion_pipeline.py --limit 100
    python data_ingestion_pipeline.py --limit 500 --batch-size 5
"""

from __future__ import annotations

import argparse
import io
import logging
import mimetypes
import os
import re
import time
from typing import Optional
from urllib.parse import urlparse

import pandas as pd
import requests
try:
    import boto3
except ImportError:  # pragma: no cover - handled at runtime by flags
    boto3 = None
try:
    from PIL import Image
except ImportError:  # pragma: no cover - handled at runtime by flags
    Image = None

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

NGA_DATA_URL = "https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data"
WEBHOOK_URL = os.getenv(
    "WEBHOOK_URL",
    "https://ai.geuse.io/webhook/BsryWt8HYdCsVN46/webhook/data-ingestion",
)
BATCH_SIZE = 5  # artworks per request (keep small for vision processing)
REQUEST_TIMEOUT = 300
THUMBNAIL_FETCH_TIMEOUT = 30
S3_CACHE_BUCKET = os.getenv("S3_CACHE_BUCKET", "www.geuse.io")
S3_CACHE_PREFIX = os.getenv("S3_CACHE_PREFIX", "curator/artwork-cache/thumbs")
S3_PUBLIC_BASE_URL = os.getenv("S3_PUBLIC_BASE_URL", "https://www.geuse.io")
CACHE_IMAGE_SIZE = 600
CACHE_MIN_WIDTH = 400
CACHE_MIN_HEIGHT = 400
CACHE_MIN_BYTES = 15000


def download_nga_data(limit: Optional[int] = None):
    """Download NGA objects and published_images CSV files."""
    logger.info("Downloading NGA data from GitHub...")

    objects_url = f"{NGA_DATA_URL}/objects.csv"
    logger.info(f"Loading objects from {objects_url}")
    objects_df = pd.read_csv(objects_url, nrows=limit * 3 if limit else None)
    logger.info(f"Loaded {len(objects_df)} objects")

    images_url = f"{NGA_DATA_URL}/published_images.csv"
    logger.info(f"Loading images from {images_url}")
    images_df = pd.read_csv(images_url)
    logger.info(f"Loaded {len(images_df)} images")

    return objects_df, images_df


def filter_artworks_with_images(
    objects_df,
    images_df,
    limit: Optional[int] = None,
    sample_percent: Optional[float] = None,
):
    """Filter objects to only include those with published primary images."""
    logger.info("Filtering artworks with images...")

    primary_images = images_df[images_df['viewtype'] == 'primary'].copy()

    merged = objects_df.merge(
        primary_images,
        left_on='objectid',
        right_on='depictstmsobjectid',
        how='inner'
    )

    if sample_percent is not None and 0 < sample_percent < 100:
        merged = merged.sample(frac=(sample_percent / 100.0)).reset_index(drop=True)
        logger.info("Applied random sample: %.2f%% -> %s artworks", sample_percent, len(merged))

    if limit:
        merged = merged.head(limit)

    logger.info(f"Found {len(merged)} artworks with primary images (limited to {limit})")
    return merged


def row_to_artwork(row) -> dict:
    """Convert a DataFrame row to the artwork dict expected by the webhook."""
    def safe_str(val):
        return str(val) if pd.notna(val) else ''

    return {
        'objectid': int(row['objectid']),
        'title': safe_str(row.get('title')),
        'attribution': safe_str(row.get('attribution')),
        'displaydate': safe_str(row.get('displaydate')),
        'medium': safe_str(row.get('medium')),
        'dimensions': safe_str(row.get('dimensions')),
        'classification': safe_str(row.get('visualbrowserclassification', row.get('classification', ''))),
        'creditline': safe_str(row.get('creditline')),
        'iiifurl': safe_str(row.get('iiifurl')),
        'iiifthumburl': safe_str(row.get('iiifthumburl')),
    }


def _guess_content_type(url: str, headers: dict) -> str:
    header_type = (headers.get('Content-Type') or '').split(';')[0].strip()
    if header_type.startswith('image/'):
        return header_type

    parsed = urlparse(url)
    guessed, _ = mimetypes.guess_type(parsed.path)
    if guessed and guessed.startswith('image/'):
        return guessed

    return 'image/jpeg'


def _extension_for_content_type(content_type: str) -> str:
    ext = mimetypes.guess_extension(content_type)
    if ext == '.jpe':
        return '.jpg'
    return ext or '.jpg'


def _build_iiif_sized_url(iiifurl: str, target_size: int) -> str:
    """
    Build a deterministic IIIF sized URL.
    Accepts either base iiif id URL or full IIIF image URL.
    """
    base = (iiifurl or '').strip().rstrip('/')
    if not base:
        return ''

    size_part = f'!{target_size},{target_size}'
    if '/full/' in base:
        # Normalize any existing size segment to target size.
        return re.sub(r'/full/[^/]+/0/default\.(jpg|png|jpeg)$', f'/full/{size_part}/0/default.jpg', base)
    return f'{base}/full/{size_part}/0/default.jpg'


def _inspect_image_quality(image_bytes: bytes) -> tuple[int, int]:
    if Image is None:
        raise RuntimeError(
            "Pillow is not installed. Run `pip install -r scripts/requirements.txt` and retry."
        )
    with Image.open(io.BytesIO(image_bytes)) as img:
        return img.size


def cache_thumbnail_to_s3(
    artwork: dict,
    s3_client,
    bucket: str,
    prefix: str,
    public_base_url: str,
    thumbnail_fetch_timeout: int = THUMBNAIL_FETCH_TIMEOUT,
    target_size: int = CACHE_IMAGE_SIZE,
    min_width: int = CACHE_MIN_WIDTH,
    min_height: int = CACHE_MIN_HEIGHT,
    min_bytes: int = CACHE_MIN_BYTES,
) -> dict:
    """
    Download high-quality image bytes and upload to S3.
    Rewrites iiifthumburl to public S3 URL so frontend loads from S3/CloudFront.
    """
    source_iiifurl = (artwork.get('iiifurl') or '').strip()
    source_thumb = (artwork.get('iiifthumburl') or '').strip()
    source_url = _build_iiif_sized_url(source_iiifurl, target_size) or source_thumb
    if not source_url:
        return artwork

    objectid = artwork.get('objectid')
    if not objectid:
        return artwork

    try:
        resp = requests.get(source_url, timeout=thumbnail_fetch_timeout)
        resp.raise_for_status()
        image_bytes = resp.content
        if len(image_bytes) < min_bytes:
            logger.warning(
                "Cached image too small for objectid %s: %s bytes < %s (source: %s)",
                objectid, len(image_bytes), min_bytes, source_url
            )
            return artwork

        width, height = _inspect_image_quality(image_bytes)
        if width < min_width or height < min_height:
            logger.warning(
                "Cached image dimensions too low for objectid %s: %sx%s < %sx%s (source: %s)",
                objectid, width, height, min_width, min_height, source_url
            )
            return artwork

        content_type = _guess_content_type(source_url, resp.headers)
        ext = _extension_for_content_type(content_type)
        key = f"{prefix.rstrip('/')}/{objectid}{ext}"

        s3_client.put_object(
            Bucket=bucket,
            Key=key,
            Body=image_bytes,
            ContentType=content_type,
            CacheControl='public, max-age=604800',
            Metadata={
                'source-iiifthumburl': source_url[:1024],
                'source-iiifurl': source_iiifurl[:1024],
                'objectid': str(objectid),
                'width': str(width),
                'height': str(height),
                'min-width-required': str(min_width),
                'min-height-required': str(min_height),
                'min-bytes-required': str(min_bytes),
            },
        )

        artwork['iiifthumburl'] = f"{public_base_url.rstrip('/')}/{key}"
        return artwork
    except requests.exceptions.RequestException as exc:
        logger.warning("Thumbnail download failed for objectid %s: %s", objectid, exc)
        return artwork
    except Exception as exc:  # noqa: BLE001
        logger.warning("S3 thumbnail cache upload failed for objectid %s: %s", objectid, exc)
        return artwork


def send_batch(
    artworks: list,
    webhook_url: str,
    enable_vision: bool = False,
    request_timeout: int = REQUEST_TIMEOUT,
) -> dict:
    """Send a batch of artworks to the n8n ingestion webhook."""
    payload = {
        'artworks': artworks,
        'enableVision': enable_vision,
    }

    response = requests.post(
        webhook_url,
        json=payload,
        headers={'Content-Type': 'application/json'},
        timeout=request_timeout,
    )
    response.raise_for_status()

    # n8n webhook may return empty body on success
    if not response.text.strip():
        return {'processed': len(artworks)}
    try:
        return response.json()
    except ValueError:
        # Some gateway/proxy setups may return non-JSON even on success.
        return {'processed': len(artworks), 'raw_response': response.text[:200]}


def main():
    parser = argparse.ArgumentParser(description='NGA Data Ingestion Pipeline (Webhook Feeder)')
    parser.add_argument('--limit', type=int, default=100, help='Max artworks to ingest (default: 100)')
    parser.add_argument('--batch-size', type=int, default=BATCH_SIZE, help=f'Artworks per webhook call (default: {BATCH_SIZE})')
    parser.add_argument('--webhook-url', type=str, default=WEBHOOK_URL, help='n8n webhook URL')
    parser.add_argument('--enable-vision', action='store_true', help='Enable llava vision analysis in n8n')
    parser.add_argument('--request-timeout', type=int, default=REQUEST_TIMEOUT, help=f'Request timeout in seconds (default: {REQUEST_TIMEOUT})')
    parser.add_argument('--inter-batch-delay', type=float, default=2.0, help='Delay between batches in seconds (default: 2.0)')
    parser.add_argument('--max-retries', type=int, default=3, help='Retries per failed batch (default: 3)')
    parser.add_argument('--retry-delay', type=float, default=5.0, help='Initial retry delay in seconds (default: 5.0)')
    parser.add_argument('--dry-run', action='store_true', help='Download and filter data without sending')
    parser.add_argument(
        '--sample-percent',
        type=float,
        default=1.0,
        help='Random sample percent applied before limit (default: 1.0). Use 100 to disable sampling.',
    )
    parser.add_argument('--cache-thumbnails-s3', action='store_true', help='Cache iiif thumbnails to S3 and rewrite iiifthumburl')
    parser.add_argument('--s3-cache-bucket', type=str, default=S3_CACHE_BUCKET, help=f'S3 bucket for cached thumbnails (default: {S3_CACHE_BUCKET})')
    parser.add_argument('--s3-cache-prefix', type=str, default=S3_CACHE_PREFIX, help=f'S3 key prefix for cached thumbnails (default: {S3_CACHE_PREFIX})')
    parser.add_argument('--s3-public-base-url', type=str, default=S3_PUBLIC_BASE_URL, help=f'Public base URL that serves S3 cache (default: {S3_PUBLIC_BASE_URL})')
    parser.add_argument('--thumbnail-fetch-timeout', type=int, default=THUMBNAIL_FETCH_TIMEOUT, help=f'Thumbnail fetch timeout in seconds (default: {THUMBNAIL_FETCH_TIMEOUT})')
    parser.add_argument('--cache-image-size', type=int, default=CACHE_IMAGE_SIZE, help=f'IIIF square target size for cached images (default: {CACHE_IMAGE_SIZE})')
    parser.add_argument('--cache-min-width', type=int, default=CACHE_MIN_WIDTH, help=f'Minimum cached image width in pixels (default: {CACHE_MIN_WIDTH})')
    parser.add_argument('--cache-min-height', type=int, default=CACHE_MIN_HEIGHT, help=f'Minimum cached image height in pixels (default: {CACHE_MIN_HEIGHT})')
    parser.add_argument('--cache-min-bytes', type=int, default=CACHE_MIN_BYTES, help=f'Minimum cached image payload size in bytes (default: {CACHE_MIN_BYTES})')

    args = parser.parse_args()

    logger.info(f"Starting ingestion: limit={args.limit}, batch_size={args.batch_size}")
    logger.info(f"Webhook: {args.webhook_url}")
    logger.info(f"Vision enabled: {args.enable_vision}")
    logger.info(f"Inter-batch delay: {args.inter_batch_delay}s")
    logger.info(f"Max retries: {args.max_retries} (base delay {args.retry_delay}s)")
    logger.info(f"Sample percent: {args.sample_percent}%")
    logger.info(f"S3 thumbnail cache enabled: {args.cache_thumbnails_s3}")
    logger.info(
        "Cache quality gates: target=%spx, min=%sx%s, min_bytes=%s",
        args.cache_image_size,
        args.cache_min_width,
        args.cache_min_height,
        args.cache_min_bytes,
    )

    s3_client = None
    if args.cache_thumbnails_s3:
        if boto3 is None:
            raise RuntimeError(
                "boto3 is not installed. Run `pip install -r scripts/requirements.txt` and retry."
            )
        if Image is None:
            raise RuntimeError(
                "Pillow is not installed. Run `pip install -r scripts/requirements.txt` and retry."
            )
        s3_client = boto3.client('s3')
        logger.info(
            "S3 thumbnail cache target: s3://%s/%s (public base %s)",
            args.s3_cache_bucket,
            args.s3_cache_prefix,
            args.s3_public_base_url,
        )

    # Download data
    objects_df, images_df = download_nga_data(args.limit)

    # Filter for artworks with images
    artworks_df = filter_artworks_with_images(
        objects_df,
        images_df,
        limit=args.limit,
        sample_percent=args.sample_percent,
    )

    if len(artworks_df) == 0:
        logger.error("No artworks found with images. Exiting.")
        return

    # Convert to list of dicts
    all_artworks = [row_to_artwork(row) for _, row in artworks_df.iterrows()]
    logger.info(f"Prepared {len(all_artworks)} artworks for ingestion")

    if args.cache_thumbnails_s3 and s3_client is not None:
        logger.info("Caching artwork thumbnails to S3 before webhook ingestion...")
        cached_count = 0
        for artwork in all_artworks:
            before = artwork.get('iiifthumburl', '')
            updated = cache_thumbnail_to_s3(
                artwork=artwork,
                s3_client=s3_client,
                bucket=args.s3_cache_bucket,
                prefix=args.s3_cache_prefix,
                public_base_url=args.s3_public_base_url,
                thumbnail_fetch_timeout=args.thumbnail_fetch_timeout,
                target_size=args.cache_image_size,
                min_width=args.cache_min_width,
                min_height=args.cache_min_height,
                min_bytes=args.cache_min_bytes,
            )
            if updated.get('iiifthumburl') != before:
                cached_count += 1
        logger.info("S3 thumbnail caching complete: %s/%s rewritten", cached_count, len(all_artworks))

    if args.dry_run:
        logger.info("DRY RUN — not sending to webhook")
        for a in all_artworks[:3]:
            logger.info(f"  Sample: {a['objectid']} - {a['title'][:60]}")
        return

    # Send in batches
    total_sent = 0
    total_errors = 0

    for i in range(0, len(all_artworks), args.batch_size):
        batch = all_artworks[i:i + args.batch_size]
        batch_num = (i // args.batch_size) + 1
        total_batches = (len(all_artworks) + args.batch_size - 1) // args.batch_size

        logger.info(f"Sending batch {batch_num}/{total_batches} ({len(batch)} artworks)...")

        batch_succeeded = False
        for attempt in range(1, args.max_retries + 1):
            try:
                result = send_batch(
                    batch,
                    args.webhook_url,
                    enable_vision=args.enable_vision,
                    request_timeout=args.request_timeout,
                )
                processed = result.get('processed', len(batch))
                total_sent += processed
                logger.info(f"  Batch {batch_num} complete: {processed} processed")

                if result.get('needs_review'):
                    logger.info(f"  {result['needs_review']} need review")

                batch_succeeded = True
                break
            except requests.exceptions.RequestException as e:
                if attempt < args.max_retries:
                    retry_wait = args.retry_delay * attempt
                    logger.warning(
                        f"  Batch {batch_num} attempt {attempt}/{args.max_retries} failed: {e}. "
                        f"Retrying in {retry_wait:.1f}s..."
                    )
                    time.sleep(retry_wait)
                else:
                    logger.error(f"  Batch {batch_num} failed after {args.max_retries} attempts: {e}")
                    total_errors += len(batch)

        # Small delay between batches to avoid overwhelming the server
        if batch_succeeded and i + args.batch_size < len(all_artworks) and args.inter_batch_delay > 0:
            time.sleep(args.inter_batch_delay)

    logger.info(f"Ingestion complete. Sent: {total_sent}, Errors: {total_errors}")


if __name__ == "__main__":
    main()
