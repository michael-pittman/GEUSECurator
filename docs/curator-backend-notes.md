# Curator Backend Architecture Notes

## Status (2026-02-08)

**Resolved:** curator chat backend is now running with HTTP delegation and passes end-to-end validation.

## Historical Root Cause

The previous curator runtime path loaded Ollama models directly in the main workflow:

- `llama3.2:3b` chat model (~1.9 GB)
- `mxbai-embed-large` embeddings (~1.5 GB)
- Total runtime demand ~3.4 GB on a host with ~1.3 GB available

This caused OOM errors on `POST /webhook/curator-assistant/chat`.

## Implemented Architecture

Main curator flow now uses the same proven delegation shape as search:

```
Chat Trigger
  ↓
HTTP Request → Helper Webhook (/webhook/curator-helper)
  ↓
Code Node → Format Response
  ↓
Return to User
```

## Completed Backend Work

1. ✅ Activated helper workflow `sGgv6lUC6udEkKKB` (`Helper - Curator Operations`)
2. ✅ Refactored main curator workflow `2e0HoMh3hrIYZ2SZUQrMS` to delegated HTTP path
3. ✅ Removed memory-heavy AI Agent/Ollama execution path from main curator runtime
4. ✅ Fixed helper operation routing for `search`, `review_queue`, `artwork_details`
5. ✅ Updated helper SQL to match live schema (joins `artwork_images` for IIIF fields)
6. ✅ Validated end-to-end curator chat for search, review queue, and context artwork detail

## Current Workflow Inventory

- Search workflow: `cjsDoFFAvajWLhIo3Xy6Q`
- Curator main workflow: `2e0HoMh3hrIYZ2SZUQrMS`
- Curator helper workflow: `sGgv6lUC6udEkKKB`
- Search helper workflow: `417KSfsuYiWGa0AT`

## Validation Reference

See `docs/phase4-validation.md` for:
- request/response test evidence
- execution IDs
- final Phase 4 pass criteria
