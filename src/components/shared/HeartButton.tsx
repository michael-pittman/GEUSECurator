import { useRef, useCallback } from 'react'

interface HeartButtonProps {
  isFavorited: boolean
  onToggle: () => void
  size?: 'sm' | 'md'
}

export function HeartButton({ isFavorited, onToggle, size = 'md' }: HeartButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      // Trigger bounce animation via class toggle
      const el = buttonRef.current
      if (el) {
        el.classList.remove('animate-heart-bounce')
        // Force reflow to restart animation
        void el.offsetWidth
        el.classList.add('animate-heart-bounce')
      }
      onToggle()
    },
    [onToggle]
  )

  const sizeClasses = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      className={`${sizeClasses} flex items-center justify-center rounded-full backdrop-blur-xl bg-surface-dark/60 border border-glass-border transition-all hover:scale-110 active:scale-90 focus-visible:outline-2 focus-visible:outline-accent ${isFavorited ? 'text-accent' : 'text-text-secondary'}`}
      aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      <svg
        className={`${iconSize} transition-colors`}
        viewBox="0 0 24 24"
        fill={isFavorited ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={isFavorited ? 0 : 2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
    </button>
  )
}
