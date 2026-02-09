# API Testing Notes - 2026-02-07

## Data Ingestion

✅ **Status:** Working
- Successfully ingested 10 artworks via webhook
- Webhook: `POST https://n8n.geuse.io/webhook/data-ingestion`
- Returns empty body on success (200 OK)
- Script updated to handle empty responses

## Search & Curator Webhooks

✅ **Status:** Ready - Tool-Capable Model Available

**Resolution:** Llama 3.2:3b is now available and supports tool calling:
- `llama3.2:3b` - ✅ Tool calling support (67.0 BFCL V2 score)
- Memory efficient (3B parameters vs 70B)
- Uses pythonic function call syntax: `[func1(param=value), func2(param=value)]`
- Successfully validated in Phase 1 for search chat workflows

**Available Models:**
- `llama3.2:3b` - Chat + tool calling ✅ (Phase 1 validated)
- `llava:latest` - Vision model
- `mxbai-embed-large:latest` - Embeddings (not used)
- `nomic-embed-text:latest` - Embeddings ✅ (active)

### API Testing Results (2026-02-07 Updated)

**Search:** `POST /webhook/art-search-chat/chat`

✅ **Status: Working** (HTTP 200)

Request:
```json
{
  "chatInput": "impressionist paintings",
  "sessionId": "phase2-validation-test"
}
```

Response:
```json
{
  "output": "Found 10 match(es) for **impressionist paintings**:\n\n1. **Untitled** — Unknown artist...",
  "results": [
    {
      "rank": 1,
      "title": "Untitled",
      "artist": "Unknown artist",
      "similarity_score": 0.6922145,
      "matched_because": "Semantic similarity score: 69.2%",
      ...
    }
  ]
}
```

**Curator:** `POST /webhook/curator-assistant/chat`

⚠️ **Status: Error** (HTTP 500)

Request:
```json
{
  "chatInput": "Tell me about impressionist art",
  "sessionId": "phase2-validation-test"
}
```

Response:
```json
{
  "message": "Error in workflow"
}
```

**Note:** Curator endpoint may need AI Agent node configuration for tool-calling with llama3.2:3b.

## Next Steps

1. ✅ ~~Install tool-capable model~~ - llama3.2:3b now available
2. ✅ ~~Test search endpoint~~ - Working (HTTP 200)
3. ⚠️ Configure curator AI Agent node in n8n for tool-calling with llama3.2:3b
4. Test curator endpoint after configuration
5. Proceed to Phase 3: Curator Chat UI implementation
