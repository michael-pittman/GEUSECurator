import { apiPost } from './client'
import type { CuratorRequest, CuratorResponse } from '../types/artwork'

const CURATOR_ENDPOINT = import.meta.env.VITE_CURATOR_ENDPOINT || '/webhook/curator-assistant/chat'

export async function askCurator(
  query: string,
  sessionId: string,
  contextObjectId?: number
): Promise<CuratorResponse> {
  return apiPost<CuratorResponse>(CURATOR_ENDPOINT, {
    chatInput: query,
    sessionId,
    contextObjectId,
  } satisfies CuratorRequest)
}
