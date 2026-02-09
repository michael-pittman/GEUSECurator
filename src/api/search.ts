import { apiPost } from './client'
import type { SearchRequest, SearchResponse } from '../types/artwork'

const SEARCH_ENDPOINT = import.meta.env.VITE_SEARCH_ENDPOINT || '/webhook/art-search-chat/chat'

interface SearchOptions {
  sessionId?: string
  signal?: AbortSignal
}

export async function searchArtworks(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
  const payload: SearchRequest = {
    chatInput: query,
    sessionId: options.sessionId,
  }

  return apiPost<SearchResponse>(SEARCH_ENDPOINT, payload, { signal: options.signal })
}
