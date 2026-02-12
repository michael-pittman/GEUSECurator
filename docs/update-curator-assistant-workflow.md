Update the main curator assistant workflow to use HTTP delegation to the new curator helper.

## Context

**New Helper Workflow Created:**
- Workflow ID: `sGgv6lUC6udEkKKB`
- Webhook URL: `https://ai.geuse.io/webhook/curator-helper`
- Handles: search, artwork_details, review_queue operations

**Main Curator Workflow:**
- Workflow ID: `2e0HoMh3hrIYZ2SZUQrMS`
- Current issue: Direct AI Agent node loads full llama3.2:3b model (OOM error)
- Needs: HTTP delegation pattern like search workflow uses

**Reference Pattern (from Search Chat):**
The working search chat workflow (ID: `cjsDoFFAvajWLhIo3Xy6Q`) uses:
1. Chat Trigger receives user input
2. HTTP Request node → calls helper webhook
3. Code node → formats response
4. Return response to user

## Task

Update the curator workflow to use the new helper:

1. **Examine Current Workflow**
   - Get the curator assistant workflow structure
   - Identify the AI Agent node causing memory issues
   - Understand current flow

2. **Redesign Flow**
   Replace AI Agent approach with HTTP delegation:
   - Chat Trigger (keep as-is)
   - Add HTTP Request node → POST to `/webhook/curator-helper`
   - Add Code node → format response for chat
   - Remove or disconnect memory-intensive nodes

3. **Configure HTTP Request Node**
   ```javascript
   {
     method: 'POST',
     url: 'https://ai.geuse.io/webhook/curator-helper',
     body: {
       query: '{{ $json.chatInput }}',
       sessionId: '{{ $json.sessionId }}',
       limit: 10
     }
   }
   ```

4. **Add Response Formatter Code Node**
   Format helper response into chat response:
   ```javascript
   const helperResponse = $input.item.json;
   return {
     output: helperResponse.message,
     data: helperResponse.data,
     success: helperResponse.success
   };
   ```

5. **Save and Activate**
   - Save the updated workflow
   - Ensure it's activated
   - Document changes

## Important

- Use the n8n-mcp tools (search with ToolSearch first)
- Reference the working search chat workflow for exact patterns
- Preserve the webhook trigger configuration
- Keep session ID handling
- Test with a simple query after saving

Provide the updated workflow version and any test results.