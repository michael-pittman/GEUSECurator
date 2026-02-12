export interface Artwork {
  objectid: number
  title: string
  attribution: string
  displaydate: string
  medium: string
  classification: string
  beginyear: number | null
  endyear: number | null
  creditline: string
  images: ArtworkImage[]
  ai_description?: string
  score?: number
  /** Flat IIIF thumb returned by search API at root level */
  iiifthumburl?: string
}

export interface ArtworkImage {
  uuid: string
  iiifurl: string
  iiifthumburl: string
  viewtype: string
  sequence: number
  width: number
  height: number
  assistivetext: string
}

export interface SearchRequest {
  chatInput: string
  sessionId?: string
}

export interface SearchResponse {
  output: string
  results?: Artwork[]
}

export interface CollectionResponse extends SearchResponse {
  limit?: number
  offset?: number
  nextOffset?: number | null
  hasMore?: boolean
  total?: number
  totalCount?: number
}

export interface CuratorRequest {
  chatInput: string
  sessionId: string
  contextObjectId?: number
}

export interface CuratorResponse {
  output: string
  mentions?: { objectid: number; title: string }[]
  related?: number[]
}

export interface FavoriteEntry {
  objectid: number
  title: string
  attribution: string
  iiifthumburl: string | null
  savedAt: number
}
