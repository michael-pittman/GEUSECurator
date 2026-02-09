const BASE_URL = import.meta.env.VITE_N8N_BASE_URL || 'https://n8n.geuse.io'

interface ApiPostOptions {
  signal?: AbortSignal
}

export async function apiPost<T>(endpoint: string, body: unknown, options: ApiPostOptions = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  })

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}
