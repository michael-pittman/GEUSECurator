import type { Artwork } from '../types/artwork'

const DEFAULT_CATALOG_URL = 'https://www.geuse.io/curator/artwork-cache/catalog.json'

export const CATALOG_URL =
  import.meta.env.VITE_ARTWORK_CATALOG_URL || DEFAULT_CATALOG_URL

export interface CatalogItem {
  objectid: number
  title?: string
  attribution?: string
  displaydate?: string
  medium?: string
  classification?: string
  creditline?: string
  iiifthumburl?: string
}

interface CatalogManifest {
  generatedAt?: string
  count?: number
  items?: CatalogItem[]
}

export function toArtwork(item: CatalogItem): Artwork {
  const thumb = item.iiifthumburl || ''
  return {
    objectid: Number(item.objectid),
    title: item.title || '',
    attribution: item.attribution || '',
    displaydate: item.displaydate || '',
    medium: item.medium || '',
    classification: item.classification || '',
    beginyear: null,
    endyear: null,
    creditline: item.creditline || '',
    iiifthumburl: thumb,
    images: thumb
      ? [
          {
            uuid: '',
            iiifurl: thumb,
            iiifthumburl: thumb,
            viewtype: 'primary',
            sequence: 1,
            width: 0,
            height: 0,
            assistivetext: item.title || '',
          },
        ]
      : [],
  }
}

export async function fetchCatalogFallback(): Promise<Artwork[]> {
  const res = await fetch(CATALOG_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`)
  const manifest: CatalogManifest = await res.json()
  const items = Array.isArray(manifest.items) ? manifest.items : []
  return items
    .filter((item) => Number.isFinite(Number(item.objectid)) && Boolean(item.iiifthumburl))
    .map(toArtwork)
}

export function shuffleRandom<T>(items: T[]): T[] {
  const clone = [...items]
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = clone[i]
    clone[i] = clone[j]
    clone[j] = tmp
  }
  return clone
}
