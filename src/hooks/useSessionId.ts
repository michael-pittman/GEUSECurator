import { useMemo } from 'react'

export function useSessionId(): string {
  return useMemo(() => {
    const stored = localStorage.getItem('nga-session-id')
    if (stored) return stored
    const id = crypto.randomUUID()
    localStorage.setItem('nga-session-id', id)
    return id
  }, [])
}
