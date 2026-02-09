import { useState, useRef, useCallback } from 'react'
import type { TouchEvent as ReactTouchEvent } from 'react'

export function useBottomSheet() {
  const [isOpen, setIsOpen] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const startYRef = useRef(0)
  const isDraggingRef = useRef(false)

  const open = useCallback(() => {
    setIsOpen(true)
    setDragOffset(0)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setDragOffset(0)
  }, [])

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev)
    setDragOffset(0)
  }, [])

  const onTouchStart = useCallback((e: ReactTouchEvent) => {
    startYRef.current = e.touches[0].clientY
    isDraggingRef.current = true
  }, [])

  const onTouchMove = useCallback((e: ReactTouchEvent) => {
    if (!isDraggingRef.current) return
    const deltaY = e.touches[0].clientY - startYRef.current
    if (deltaY > 0) {
      setDragOffset(deltaY)
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    isDraggingRef.current = false
    if (dragOffset > 100) {
      close()
    } else {
      setDragOffset(0)
    }
  }, [dragOffset, close])

  return {
    isOpen,
    dragOffset,
    open,
    close,
    toggle,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  }
}
