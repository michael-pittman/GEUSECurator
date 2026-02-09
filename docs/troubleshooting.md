# Troubleshooting Guide - NGA Curator

## CloudFront Timeout Issues

### Problem
CloudFront has a 30-second origin response timeout, but n8n workflows take longer:
- Data ingestion: 30-40 seconds per artwork
- Search with AI: Can exceed 30 seconds under load

### Symptoms
- `504 Gateway Timeout` errors from CloudFront
- Ingestion script reports failures
- Search API returns timeout HTML pages

### Solutions

#### Solution 1: Manually Ingest via n8n UI (Recommended for Now)

1. **Access n8n directly:** https://ai.geuse.io
2. **Open workflow:** "CuratorInTheGeuse - AI Data Ingestion"
3. **Manually execute** with test data:
   ```json
   {
     "artworks": [
       {
         "objectid": 1234,
         "title": "Test Artwork",
         "attribution": "Test Artist",
         "displaydate": "2000",
         "medium": "Oil on canvas",
         "classification": "painting",
         "iiifurl": "https://media.nga.gov/iiif/...",
         "iiifthumburl": "https://media.nga.gov/iiif/.../full/!200,200/0/default.jpg"
       }
     ],
     "enableVision": false
   }
   ```
4. **Monitor** executions tab for success

#### Solution 2: Increase CloudFront Timeout

If you manage the CloudFront distribution in front of n8n:

```bash
# Get distribution config
aws cloudfront get-distribution-config --id YOUR_N8N_DIST_ID > dist-config.json

# Edit dist-config.json:
# - Find "OriginResponseTimeout": 30
# - Change to: "OriginResponseTimeout": 120

# Update distribution
aws cloudfront update-distribution \
  --id YOUR_N8N_DIST_ID \
  --if-match ETAG_FROM_GET \
  --distribution-config file://dist-config.json
```

#### Solution 3: Use Sample Data (Testing Only)

Create a small dataset manually via SQL:

```sql
-- Connect to PostgreSQL
psql -h postgres.geuse.io -U your_user -d nga_curator

-- Insert sample artworks
INSERT INTO artworks (objectid, title, attribution, displaydate, medium, classification)
VALUES
  (1, 'Sample Portrait', 'Unknown Artist', '1900', 'Oil on canvas', 'painting'),
  (2, 'Sample Landscape', 'Test Artist', '1850', 'Watercolor', 'painting');

-- Insert sample images
INSERT INTO artwork_images (objectid, iiifurl, iiifthumburl, viewtype)
VALUES
  (1, 'https://media.nga.gov/iiif/example1.ptif', 'https://media.nga.gov/iiif/example1.ptif/full/!200,200/0/default.jpg', 'primary'),
  (2, 'https://media.nga.gov/iiif/example2.ptif', 'https://media.nga.gov/iiif/example2.ptif/full/!200,200/0/default.jpg', 'primary');
```

#### Solution 4: Direct API Call (Development)

Call n8n directly without CloudFront (if accessible):

```python
import requests

# If n8n has a direct URL without CloudFront
DIRECT_URL = "http://n8n-server-ip:5678/webhook/data-ingestion"

response = requests.post(DIRECT_URL, json={
    "artworks": [...],
    "enableVision": False
}, timeout=300)  # 5 minute timeout
```

### Frontend Workaround

While backend is being fixed, you can:
1. Show a "Loading sample data..." message
2. Use mock data for UI demonstrations
3. Display message: "Gallery coming soon - backend optimization in progress"

### Monitoring

Check n8n execution status:
```bash
# If n8n API is accessible
curl https://ai.geuse.io/api/v1/executions
```

Or visit: https://ai.geuse.io → Executions tab

### Long-term Solution

**Option A: Async Processing**
- Modify ingestion to return immediately
- Process in background queue
- Add status endpoint to check progress

**Option B: Batch Optimization**
- Reduce embedding generation time
- Cache common queries
- Optimize database writes

**Option C: Infrastructure**
- Increase CloudFront timeout to 120s
- Add Redis cache layer
- Use server-sent events (SSE) for progress
