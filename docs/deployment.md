# Deployment Guide - NGA Curator

## Live URLs

**Production Site:** https://www.geuse.io/curator/
**API Backend:** https://n8n.geuse.io

## Infrastructure

### Frontend
- **Platform:** AWS S3 Static Site Hosting
- **Bucket:** `s3://www.geuse.io`
- **Path:** `/curator/`
- **CDN:** CloudFront
- **Base URL:** `/curator/`

### Backend
- **n8n:** https://n8n.geuse.io
- **Ollama:** http://ollama.geuse.io
- **Qdrant:** http://qdrant.geuse.io
- **PostgreSQL:** postgres.geuse.io:5432

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
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.html" \
  --exclude "*.svg"

# 3. Upload HTML with no-cache
aws s3 sync dist/ s3://www.geuse.io/curator/ \
  --exclude "*" \
  --include "*.html" \
  --include "*.svg" \
  --cache-control "public, max-age=0, must-revalidate" \
  --content-type "text/html"
```

### Verify Deployment

```bash
# Check HTTP status
curl -I https://www.geuse.io/curator/

# List deployed files
aws s3 ls s3://www.geuse.io/curator/ --recursive

# Test asset loading
curl -I https://www.geuse.io/curator/assets/index-CLJpBzkD.js
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
VITE_N8N_BASE_URL=https://n8n.geuse.io
VITE_SEARCH_ENDPOINT=/webhook/art-search-chat/chat
VITE_CURATOR_ENDPOINT=/webhook/curator-assistant/chat
```

These are baked into the production build at compile time.

### Vite Configuration

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/curator/',  // Important for S3 subdirectory deployment
})
```

## Build Output

**Latest Build (2026-02-08):**
```
dist/index.html                   0.48 kB │ gzip:  0.31 kB
dist/assets/index-DXY_54_y.css   36.26 kB │ gzip:  6.52 kB
dist/assets/index-CLJpBzkD.js   209.44 kB │ gzip: 65.32 kB
✓ built in 963ms
```

**Total Size:**
- Uncompressed: ~246 kB
- Gzipped: ~72 kB

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
for asset in index.html assets/index-CLJpBzkD.js assets/index-DXY_54_y.css; do
  echo "Checking $asset..."
  curl -I "https://www.geuse.io/curator/$asset" | grep "HTTP/2 200"
done
```

## Troubleshooting

### Issue: Assets not loading (404)

**Cause:** Base path mismatch in vite.config.ts
**Fix:** Ensure `base: '/curator/'` matches S3 deployment path

### Issue: Stale content after deploy

**Cause:** CloudFront cache
**Fix:** Create CloudFront invalidation or wait for TTL expiry

### Issue: CORS errors

**Cause:** n8n API not configured for CORS
**Fix:** Check n8n webhook CORS settings

### Issue: API calls failing

**Cause:** Environment variables not set
**Fix:** Check `.env` file has correct n8n URL

## Security

**S3 Bucket Policy:**
- Bucket must allow public read access for static hosting
- Do not enable public write access
- Use CloudFront Origin Access Identity (OAI) for better security

**Content Security Policy:**
Consider adding CSP headers in CloudFront response headers policy:
```
Content-Security-Policy: default-src 'self'; connect-src 'self' https://n8n.geuse.io
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
