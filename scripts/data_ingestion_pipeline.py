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
import logging
import os
import time
from typing import Optional

import pandas as pd
import requests

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

NGA_DATA_URL = "https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data"
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "https://ai.geuse.io/webhook/data-ingestion")
BATCH_SIZE = 5  # artworks per request (keep small for vision processing)
REQUEST_TIMEOUT = 300


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


def filter_artworks_with_images(objects_df, images_df, limit: Optional[int] = None):
    """Filter objects to only include those with published primary images."""
    logger.info("Filtering artworks with images...")

    primary_images = images_df[images_df['viewtype'] == 'primary'].copy()

    merged = objects_df.merge(
        primary_images,
        left_on='objectid',
        right_on='depictstmsobjectid',
        how='inner'
    )

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

    args = parser.parse_args()

    logger.info(f"Starting ingestion: limit={args.limit}, batch_size={args.batch_size}")
    logger.info(f"Webhook: {args.webhook_url}")
    logger.info(f"Vision enabled: {args.enable_vision}")
    logger.info(f"Inter-batch delay: {args.inter_batch_delay}s")
    logger.info(f"Max retries: {args.max_retries} (base delay {args.retry_delay}s)")

    # Download data
    objects_df, images_df = download_nga_data(args.limit)

    # Filter for artworks with images
    artworks_df = filter_artworks_with_images(objects_df, images_df, args.limit)

    if len(artworks_df) == 0:
        logger.error("No artworks found with images. Exiting.")
        return

    # Convert to list of dicts
    all_artworks = [row_to_artwork(row) for _, row in artworks_df.iterrows()]
    logger.info(f"Prepared {len(all_artworks)} artworks for ingestion")

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
