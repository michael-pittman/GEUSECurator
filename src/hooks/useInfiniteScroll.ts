import { useEffect, useRef } from 'react'

export function useInfiniteScroll(
  onLoadMore: () => void,
  enabled: boolean
) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const callbackRef = useRef(onLoadMore)

  useEffect(() => {
    callbackRef.current = onLoadMore
  }, [onLoadMore])

  useEffect(() => {
    if (!enabled || !sentinelRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          callbackRef.current()
        }
      },
      { rootMargin: '300px' }
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [enabled])

  return sentinelRef
}
