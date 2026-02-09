import type { ReactNode } from 'react'

interface HorizontalScrollProps {
  children: ReactNode
  className?: string
}

export function HorizontalScroll({ children, className = '' }: HorizontalScrollProps) {
  return (
    <div
      className={`flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-hide px-5 ${className}`}
    >
      {children}
    </div>
  )
}
