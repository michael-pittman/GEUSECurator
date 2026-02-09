# Phase 4 Validation (2026-02-08)

## Scope

Phase 4 backend optimization targets:
1. Create and activate curator helper webhook.
2. Refactor main curator workflow to HTTP delegation.
3. Validate end-to-end curator chat behavior.

## Workflow Update Summary

### Main Curator Workflow

- Workflow: `CuratorInTheGeuse - AI Curator Assistant` (`2e0HoMh3hrIYZ2SZUQrMS`)
- Status: `active`
- Runtime path is now:
  - `Curator Assistant Chat`
  - `Run Curator Helper` (HTTP POST to `https://ai.geuse.io/webhook/curator-helper`)
  - `Format Curator Response`
- Direct Ollama/AI Agent/tool nodes were removed from the execution path to prevent OOM.

### Curator Helper Workflow

- Workflow: `Helper - Curator Operations` (`sGgv6lUC6udEkKKB`)
- Status: `active` (activated during this phase)
- Supported operations validated:
  - `search`
  - `review_queue`
  - `artwork_details`
- SQL adjusted to match live schema:
  - Uses `artwork_images` join for `iiifurl`/`iiifthumburl`
  - Removes invalid `artworks.iiifurl` and `artworks.iiifthumburl` references

## Test Results

All tests run against live webhooks at `https://ai.geuse.io`.

| Test | Endpoint | Payload (summary) | Result |
|---|---|---|---|
| Helper search | `POST /webhook/curator-helper` | `{"query":"impressionist paintings","limit":3}` | ✅ `success:true`, `operation:"search"`, `count:3` |
| Helper review queue | `POST /webhook/curator-helper` | `{"operation":"review_queue","limit":3}` | ✅ `success:true`, `operation:"review_queue"`, `count:2` |
| Helper artwork details | `POST /webhook/curator-helper` | `{"operation":"artwork_details","objectid":901234567}` | ✅ `success:true`, details returned for `Codex Pipeline Validation` |
| Main curator search | `POST /webhook/curator-assistant/chat` | `{"chatInput":"Find impressionist paintings"}` | ✅ `operation:"search"`, formatted `output` returned |
| Main curator review queue | `POST /webhook/curator-assistant/chat` | `{"chatInput":"What artworks need review?"}` | ✅ `operation:"review_queue"`, formatted queue returned |
| Main curator artwork details | `POST /webhook/curator-assistant/chat` | `{"chatInput":"Tell me about this artwork","contextObjectId":901234567}` | ✅ `operation:"artwork_details"`, formatted details returned |

## Execution Evidence

- Pre-refactor memory failure example: main workflow execution `3249` returned Ollama OOM (`model requires more system memory ...`).
- Workflow validation checks:
  - `n8n_validate_workflow(2e0HoMh3hrIYZ2SZUQrMS)` => `valid: true`
  - `n8n_validate_workflow(sGgv6lUC6udEkKKB)` => `valid: true`
- Final regression executions (main workflow):
  - `3278` (`search`)
  - `3279` (`review_queue`)
  - `3280` (`artwork_details`)
- Final regression executions (helper workflow):
  - `3281`, `3282`, `3283` (delegated calls from final main workflow tests)

## Phase 4 Status

`PASS` — curator backend optimization is validated end-to-end with HTTP delegation and no Ollama OOM in the curator chat execution path.
