# API Contract (Phase 1 + Phase 4)

Validated against live n8n webhooks on:
- 2026-02-07 (Phase 1 baseline)
- 2026-02-08 (Phase 4 curator delegation)

Base URL: `https://ai.geuse.io`

## 1) Search Chat

Endpoint: `POST /webhook/art-search-chat/chat`

Request:

```json
{
  "chatInput": "Codex Pipeline Validation",
  "sessionId": "codex-phase1-final"
}
```

Response (200):

```json
{
  "output": "Found 10 match(es) for **Codex Pipeline Validation**:\n\n1. **Untitled** — Unknown artist (Date unknown)",
  "results": [
    {
      "rank": 1,
      "title": "Untitled",
      "artist": "Unknown artist",
      "date": "Date unknown",
      "medium": "Medium not specified",
      "classification": "Unclassified",
      "description": "",
      "matched_because": "Semantic similarity score: 100.0%",
      "iiifthumburl": null,
      "similarity_score": 0.9999997
    }
  ]
}
```

## 2) Ingestion

Endpoint: `POST /webhook/data-ingestion`

Request:

```json
{
  "enableVision": false,
  "artworks": [
    {
      "objectid": 901234567,
      "title": "Codex Pipeline Validation",
      "attribution": "Unknown Artist",
      "displaydate": "1900",
      "medium": "Oil on canvas",
      "dimensions": "24 x 18 in",
      "classification": "Painting",
      "creditline": "Validation Run",
      "iiifurl": "https://media.nga.gov/iiif/public/objects/1/0/5/4/2/105425-primary-0-nativeres.ptif",
      "iiifthumburl": "https://media.nga.gov/iiif/public/objects/1/0/5/4/2/105425-primary-0-nativeres.ptif/full/!200,200/0/default.jpg"
    }
  ]
}
```

Response body on direct webhook calls can be empty due gateway timeout behavior, but the workflow execution result is:

```json
{
  "success": true,
  "message": "Successfully processed 1 artwork(s)",
  "processed": 1,
  "needs_review": 1,
  "results": [
    {
      "objectid": 901234567,
      "title": "Codex Pipeline Validation",
      "ai_confidence": 0.3,
      "needs_review": true,
      "status": "ingested"
    }
  ]
}
```

## 3) Qdrant Search Helper (internal helper webhook)

Endpoint: `POST /webhook/qdrant-search-helper`

Request:

```json
{
  "query": "Codex Pipeline Validation",
  "limit": 3
}
```

Response (200):

```json
{
  "success": true,
  "query": "Codex Pipeline Validation",
  "count": 3,
  "results": [
    {
      "rank": 1,
      "title": "Untitled",
      "artist": "Unknown artist",
      "date": "Date unknown",
      "medium": "Medium not specified",
      "classification": "Unclassified",
      "description": "",
      "matched_because": "Semantic similarity score: 100.0%",
      "iiifthumburl": null,
      "similarity_score": 0.9999997
    }
  ]
}
```

## 4) Curator Chat (delegated)

Endpoint: `POST /webhook/curator-assistant/chat`

### 4.1 Search-style request

Request:

```json
{
  "chatInput": "Find impressionist paintings",
  "sessionId": "phase4-e2e-4"
}
```

Response (200):

```json
{
  "output": "Found 10 artworks matching \"Find impressionist paintings\"...",
  "success": true,
  "operation": "search",
  "count": 10,
  "data": [
    {
      "rank": 1,
      "title": "Untitled",
      "artist": "Unknown artist"
    }
  ]
}
```

### 4.2 Review queue request

Request:

```json
{
  "chatInput": "What artworks need review?",
  "sessionId": "phase4-e2e-3"
}
```

Response (200):

```json
{
  "output": "2 artworks in review queue\n\n1. **Codex Pipeline Validation** — Unknown Artist (1900), confidence 30%",
  "success": true,
  "operation": "review_queue",
  "count": 2,
  "data": [
    {
      "objectid": 901234567,
      "title": "Codex Pipeline Validation",
      "needsReview": true
    }
  ]
}
```

### 4.3 Context artwork details request

Request:

```json
{
  "chatInput": "Tell me about this artwork",
  "contextObjectId": 901234567,
  "sessionId": "phase4-e2e-5"
}
```

Response (200):

```json
{
  "output": "**Codex Pipeline Validation**\nUnknown Artist (1900)\nMedium: Oil on canvas",
  "success": true,
  "operation": "artwork_details",
  "data": {
    "objectid": 901234567,
    "title": "Codex Pipeline Validation",
    "classification": "Painting"
  }
}
```

## 5) Curator Helper (internal helper webhook)

Endpoint: `POST /webhook/curator-helper`

Request:

```json
{
  "operation": "review_queue",
  "limit": 3,
  "sessionId": "phase4-helper-review-2"
}
```

Response (200):

```json
{
  "success": true,
  "operation": "review_queue",
  "count": 2,
  "message": "2 artworks in review queue",
  "data": [
    {
      "objectid": 901234567,
      "title": "Codex Pipeline Validation"
    }
  ]
}
```
