# Phase 1 Validation (2026-02-07)

## Scope

Validated:

- Ingestion pipeline workflow (`5nvLxjFeJ1LzdBpr`)
- Search helper workflow (`417KSfsuYiWGa0AT`)
- Search chat workflow (`cjsDoFFAvajWLhIo3Xy6Q`)

## Workflow Fixes Applied

1. Ingestion (`5nvLxjFeJ1LzdBpr`)
- Fixed base64 conversion logic.
- Added vision gating via `enableVision` request flag.
- Fixed Postgres insert query execution (removed broken `$1` parameter pattern).
- Fixed merge configuration to preserve non-vision path items.
- Aligned Qdrant collection dimension checks and auto-recreate behavior for active embedding model.
- Active embedding model: `nomic-embed-text:latest` (768).

2. Search helper (`417KSfsuYiWGa0AT`)
- Fixed webhook body field mapping.
- Uses HTTP-based Qdrant search path.
- Active embedding model: `nomic-embed-text:latest`.

3. Search chat (`cjsDoFFAvajWLhIo3Xy6Q`)
- Uses helper webhook path (`Run Qdrant Search Helper`) + formatter response node.
- Active chat model remains `llama3.2:3b`.

## Live Execution Evidence

All timestamps UTC.

- Ingestion success: execution `3237`
  - Started: `2026-02-07T21:37:58.211Z`
  - Stopped: `2026-02-07T21:38:38.414Z`
  - Status: `success`
- Search helper success: execution `3240`
  - Started: `2026-02-07T21:41:01.850Z`
  - Stopped: `2026-02-07T21:41:03.329Z`
  - Status: `success`
- Search chat success: execution `3239`
  - Started: `2026-02-07T21:41:01.677Z`
  - Stopped: `2026-02-07T21:41:03.379Z`
  - Status: `success`

## Webhook Test Results

- `POST /webhook/qdrant-search-helper` returned HTTP 200.
- `POST /webhook/art-search-chat/chat` returned HTTP 200.
- `POST /webhook/data-ingestion` can return CloudFront timeout pages, while n8n execution still completes successfully in the background (confirmed via execution IDs above).

## Known Residuals

- Ingestion end-to-end runtime may exceed CDN request timeout under current infrastructure.
- Search results currently prioritize vector payload content and may not always include full artwork metadata fields.
