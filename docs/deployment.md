# Deployment Guide - NGA Curator

## Live URLs

**Production Site:** https://www.geuse.io/curator/
**API Backend (n8n):** https://ai.geuse.io

## Infrastructure

### Frontend
- **Platform:** AWS S3 Static Site Hosting
- **Bucket:** `s3://www.geuse.io`
- **Path:** `/curator/`
- **CDN:** CloudFront
- **Base URL:** `/curator/`

### Backend
- **n8n (webhooks + workflows):** https://ai.geuse.io
- **Ollama:** http://ollama.geuse.io
- **Qdrant:** http://qdrant.geuse.io
- **PostgreSQL:** postgres.geuse.io:5432

## How Requests Flow (High Level)

The "backend" for the Curator UI is primarily a set of n8n webhooks that call into:
- Ollama (LLM + embeddings, sometimes vision)
- PostgreSQL (canonical data store)
- Qdrant (vector search)

### Webhook Endpoints Used By The Frontend

These paths are configured at build time via `.env` / `.env.example`:

- Search chat: `/webhook/AvbnMRIDp33SQl10/webhook/art-search-chat/chat`
- Curator chat: `/webhook/viTJbYAQaPs80m4O/webhook/curator-assistant/chat`
- Artwork detail: `/webhook/detail`
- Flag / moderation: `/webhook/flag`
- Newest feed: `/webhook/LNfYCLoZluQYsHow/webhook/home-newest` (see `.env.example`)
- Discover feed: defaults to newest unless `VITE_DISCOVER_ENDPOINT` is set (see `.env.example`)

### Data Ingestion (How The Database Gets Populated)

Ingestion is not performed by the frontend. It is driven by:

1. An n8n ingestion webhook (default): `POST https://ai.geuse.io/webhook/BsryWt8HYdCsVN46/webhook/data-ingestion`
2. A local feeder script in this repo: `scripts/data_ingestion_pipeline.py`
3. Postgres schema bootstrap SQL in this repo: `scripts/init_curator_schema.sql`

The feeder script downloads NGA open data CSVs, filters to artworks with primary images, then sends batches to the n8n webhook. The n8n workflow is responsible for vision/tagging/embeddings and writing to PostgreSQL + Qdrant.
When `--cache-thumbnails-s3` is enabled, the feeder script generates a high-quality IIIF URL (default `!600,600`), validates minimum bytes/dimensions, uploads to `s3://www.geuse.io/curator/artwork-cache/thumbs/`, and rewrites `iiifthumburl` so the frontend serves images from S3/CloudFront.
If quality checks fail for an item, ingestion falls back to the original source URL for that artwork.

Recommended refresh command:

```bash
python scripts/data_ingestion_pipeline.py --limit 1000 --batch-size 20 --cache-thumbnails-s3

# Optional quality overrides:
# --cache-image-size 800 --cache-min-width 500 --cache-min-height 500 --cache-min-bytes 25000
```

## n8n Workflow Inventory (Known)

Current production workflows on n8n `2.7.5`:

- Qdrant Search Helper: `61VAJ3acwD4guNB1`
- Home Newest: `LNfYCLoZluQYsHow`
- Art Search Chat: `AvbnMRIDp33SQl10`
- Curator Helper: `mrBvmL4wIUlZIGtY`
- Data Ingestion: `BsryWt8HYdCsVN46`
- Curator Assistant: `viTJbYAQaPs80m4O`

Webhook pattern in production:
- `/webhook/<workflowId>/webhook/<path>`

## Deployment Process

### Prerequisites
- AWS CLI configured with access to `www.geuse.io` bucket
- Node.js and npm installed
- Production environment variables configured

### Build & Deploy

```bash
# 1. Build production bundle
npm run build

# 2. Upload to S3
aws s3 sync dist/ s3://www.geuse.io/curator/ \
  --delete \
  --exclude "artwork-cache/*" \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.html" \
  --exclude "*.svg"

# 3. Upload HTML with no-cache
aws s3 sync dist/ s3://www.geuse.io/curator/ \
  --exclude "artwork-cache/*" \
  --exclude "*" \
  --include "*.html" \
  --cache-control "public, max-age=0, must-revalidate" \
  --content-type "text/html"

# 4. Upload SVG with correct content-type (optional, but safer than relying on autodetect)
aws s3 sync dist/ s3://www.geuse.io/curator/ \
  --exclude "artwork-cache/*" \
  --exclude "*" \
  --include "*.svg" \
  --cache-control "public, max-age=0, must-revalidate" \
  --content-type "image/svg+xml"
```

### Verify Deployment

```bash
# Check HTTP status
curl -I https://www.geuse.io/curator/

# List deployed files
aws s3 ls s3://www.geuse.io/curator/ --recursive

# Test asset loading (replace with the current hashed filename from S3 listing)
curl -I https://www.geuse.io/curator/assets/<hash>.js
```

## Cache Strategy

**Static Assets (JS/CSS):**
- Cache-Control: `public, max-age=31536000, immutable`
- 1 year cache duration
- Immutable flag prevents revalidation
- Content-addressed filenames ensure cache busting

**HTML Files:**
- Cache-Control: `public, max-age=0, must-revalidate`
- Always revalidate with server
- Ensures users get latest version

**SVG Icons:**
- Cache-Control: `public, max-age=0, must-revalidate`
- Same as HTML for flexibility

## Environment Configuration

### Build-time Variables (.env)

```bash
VITE_N8N_BASE_URL=https://ai.geuse.io
VITE_SEARCH_ENDPOINT=/webhook/AvbnMRIDp33SQl10/webhook/art-search-chat/chat
VITE_NEWEST_ENDPOINT=/webhook/LNfYCLoZluQYsHow/webhook/home-newest
VITE_DISCOVER_ENDPOINT=/webhook/LNfYCLoZluQYsHow/webhook/home-newest
VITE_CURATOR_ENDPOINT=/webhook/viTJbYAQaPs80m4O/webhook/curator-assistant/chat
VITE_DETAIL_ENDPOINT=/webhook/detail
VITE_FLAG_ENDPOINT=/webhook/flag
```

These are baked into the production build at compile time.

### n8n Runtime Variables (Server-Side)

If n8n is running behind a reverse proxy / CDN (CloudFront, ALB, Nginx, etc), you must set the public URL(s)
so n8n registers webhook routes on the correct host.

If these are wrong, the n8n UI will show webhook "Production URL" values like `https://localhost:5678/...`,
and requests to `https://ai.geuse.io/webhook/<workflowId>/webhook/<path>` will 404 with "webhook is not registered".

Minimum recommended settings for production:

```bash
N8N_HOST=ai.geuse.io
N8N_PROTOCOL=https
N8N_PORT=5678
N8N_WEBHOOK_URL=https://ai.geuse.io/
N8N_EDITOR_BASE_URL=https://ai.geuse.io/
```

After changing these, restart n8n and confirm any workflow Webhook node shows a production URL starting with
`https://ai.geuse.io/webhook/<workflowId>/webhook/...`.

### Vite Configuration

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/curator/',  // Important for S3 subdirectory deployment
})
```

## Build Output

Build output filenames are content-hashed and will change every build. Prefer validating deploys using:
- `aws s3 ls s3://www.geuse.io/curator/ --recursive`
- `curl -I https://www.geuse.io/curator/assets/<current-hash>.js`

## CI/CD Notes

For automated deployments, add to your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Build and Deploy
  run: |
    npm ci
    npm run build
    aws s3 sync dist/ s3://www.geuse.io/curator/ --delete
```

## Rollback Procedure

S3 versioning is not enabled. To rollback:

1. Check out previous commit
2. Run build and deploy commands
3. Or restore from local backup of `dist/` folder

## CloudFront Cache Invalidation

If you need immediate cache invalidation after deployment:

```bash
# Get CloudFront distribution ID
aws cloudfront list-distributions --query "DistributionList.Items[?contains(Aliases.Items, 'www.geuse.io')].Id" --output text

# Create invalidation (replace DISTRIBUTION_ID)
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION_ID \
  --paths "/curator/*"
```

**Note:** CloudFront invalidations cost $0.005 per path (first 1,000 paths/month free).

## Monitoring

### Health Check

```bash
# Quick health check
curl -f https://www.geuse.io/curator/ || echo "Site down!"
```

### Asset Verification

```bash
# Verify all critical assets load
# Tip: pull current hashed asset names from S3 and spot-check a few of them.
aws s3 ls s3://www.geuse.io/curator/assets/ --recursive

curl -I "https://www.geuse.io/curator/index.html" | grep -Ei "HTTP/|cache-control|content-type"

# Replace <hash> with a real filename from the S3 listing above.
curl -I "https://www.geuse.io/curator/assets/<hash>.js" | grep -Ei "HTTP/|cache-control|content-type"
curl -I "https://www.geuse.io/curator/assets/<hash>.css" | grep -Ei "HTTP/|cache-control|content-type"
```

## Troubleshooting

### Issue: Assets not loading (404)

**Cause:** Base path mismatch in vite.config.ts
**Fix:** Ensure `base: '/curator/'` matches S3 deployment path

### Issue: Stale content after deploy

**Cause:** CloudFront cache
**Fix:** Create CloudFront invalidation or wait for TTL expiry

### Issue: CORS errors

**Cause:** Browser blocked cross-origin requests to n8n
**Fix:** Confirm frontend is calling `https://ai.geuse.io` (production) and that the n8n instance/proxy returns correct `Access-Control-Allow-Origin` for the Curator origin (`https://www.geuse.io`).

### Issue: API calls failing

**Cause:** Environment variables not set
**Fix:** Check `.env` file has correct n8n URL

### Issue: Timeouts (especially ingestion)

**Cause:** CloudFront has a 30-second origin response timeout, and some n8n workflows (notably ingestion) can exceed 30 seconds per batch.

**Fix options:**
- Reduce ingestion batch size in `scripts/data_ingestion_pipeline.py` (or pass `--batch-size 1`)
- Increase timeout on the proxy/CDN in front of n8n (if you control it)
- Make ingestion async (return immediately, process in background, provide status endpoint)

## Security

**S3 Bucket Policy:**
- Bucket must allow public read access for static hosting
- Do not enable public write access
- Use CloudFront Origin Access Identity (OAI) for better security

**Content Security Policy:**
Consider adding CSP headers in CloudFront response headers policy:
```
Content-Security-Policy: default-src 'self'; connect-src 'self' https://ai.geuse.io
```

## Performance

**Current Metrics:**
- First Contentful Paint: ~0.5s (on 3G)
- Total Bundle Size: 72 kB gzipped
- Time to Interactive: ~1.2s

**Optimization Applied:**
- ✅ Code splitting by route
- ✅ Gzip compression
- ✅ Long-term caching for assets
- ✅ Lazy loading for images
- ✅ Minified production build

## Next Steps

Consider:
- Enable S3 versioning for easier rollbacks
- Add CloudFront caching layer
- Implement automated deployment via GitHub Actions
- Add custom domain (curator.geuse.io)
- Enable access logs for analytics
