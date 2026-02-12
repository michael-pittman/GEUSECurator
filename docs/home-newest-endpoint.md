# Home "Newest" Endpoint Spec

The frontend calls `POST /webhook/home-newest` for the "Check out more" row on the home page. This endpoint should return artworks ordered by **when they were ingested** (newest first), so the home screen stays fresh after each ingestion run.

## Request

```
POST /webhook/home-newest
Content-Type: application/json

{
  "limit": 40,
  "offset": 0
}
```

`limit` and `offset` are optional.

- Home row sends `{}` (or `{"limit": 20, "offset": 0}`) and renders the first page.
- Discover flow sends paginated requests and advances `offset` until no more results.

## Response

Same shape as the search endpoint for compatibility:

```json
{
  "output": "Newest artworks page",
  "limit": 40,
  "offset": 0,
  "nextOffset": 40,
  "hasMore": true,
  "totalCount": 160000,
  "results": [
    {
      "objectid": 12345,
      "title": "Artwork Title",
      "attribution": "Artist Name",
      "displaydate": "c. 1900",
      "medium": "Oil on canvas",
      "classification": "Painting",
      "creditline": "...",
      "images": [...],
      "iiifthumburl": "https://media.nga.gov/iiif/..."
    }
  ]
}
```

The `results` array must contain `Artwork` objects in the same format as `art-search-chat` returns. At minimum: `objectid`, `title`, `attribution`, `displaydate`, `medium`, `classification`, `creditline`, `iiifthumburl` (or `images[0].iiifthumburl`).

Pagination metadata:

- `nextOffset` (number or `null`) when available
- `hasMore` (boolean) when available
- `totalCount` (optional) for UI counters/diagnostics

## Backend Implementation (n8n)

1. **Postgres query** (not Qdrant):
   - Query `artworks` table (has iiifurl, iiifthumburl, updated_at)
   - `ORDER BY updated_at DESC NULLS LAST, objectid DESC`
   - `LIMIT {{$json.limit || 20}}`
   - `OFFSET {{$json.offset || 0}}`
   - Select fields that map to `Artwork`: object_id, title, attribution, display_date, medium, classification, creditline, primary image iiifurl/iiifthumburl

2. **Format** the rows into the `results` array shape expected by the frontend (see `Artwork` in `src/types/artwork.ts` and how `art-search-chat` structures its response).

3. **Webhook** triggers on POST, executes the query, returns JSON with `results` plus pagination metadata (`nextOffset`, `hasMore`, optional `totalCount`).

If this endpoint is not deployed, the frontend falls back to semantic search (`recent art collection`) so the app continues to work.
