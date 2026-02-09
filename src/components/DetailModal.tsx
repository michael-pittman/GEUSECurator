import { useEffect, useRef } from 'react'
import type { Artwork } from '../types/artwork'

interface DetailModalProps {
  artwork: Artwork
  onClose: () => void
  onAskCurator?: (artwork: Artwork) => void
}

export function DetailModal({ artwork, onClose, onAskCurator }: DetailModalProps) {
  const primaryImage = artwork.images?.find((img) => img.viewtype === 'primary') ?? artwork.images?.[0]
  const modalRef = useRef<HTMLDivElement>(null)

  // Handle escape key and focus trap
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    // Focus trap: get all focusable elements
    const getFocusableElements = () => {
      if (!modalRef.current) return []
      return Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      )
    }

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusableElements = getFocusableElements()
      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement.focus()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleEsc)
    document.addEventListener('keydown', handleTab)

    // Set initial focus to close button
    const closeButton = modalRef.current?.querySelector<HTMLButtonElement>('button[aria-label="Close"]')
    closeButton?.focus()

    // Prevent body scroll
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.removeEventListener('keydown', handleTab)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
    >
      <div
        ref={modalRef}
        className="relative max-h-[95vh] sm:max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl sm:rounded-3xl backdrop-blur-2xl bg-surface-card/95 border border-glass-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10 rounded-full backdrop-blur-xl bg-glass-white p-2 text-text-secondary hover:text-text-primary hover:bg-glass-white-strong transition-all"
          aria-label="Close modal"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Image */}
        {primaryImage && (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-2xl sm:rounded-t-3xl bg-black">
            <img
              src={primaryImage.iiifurl || primaryImage.iiifthumburl}
              alt={primaryImage.assistivetext || artwork.title}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          </div>
        )}

        {/* Info */}
        <div className="p-4 sm:p-6 md:p-8">
          <h2 id="detail-modal-title" className="text-xl sm:text-2xl font-semibold text-text-primary leading-tight pr-8">
            {artwork.title}
          </h2>
          <p className="mt-2 text-base sm:text-lg text-text-secondary">{artwork.attribution}</p>

          <div className="mt-4 sm:mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
            {artwork.displaydate && (
              <div>
                <span className="text-text-secondary/60">Date</span>
                <p className="mt-0.5 text-text-primary">{artwork.displaydate}</p>
              </div>
            )}
            {artwork.medium && (
              <div>
                <span className="text-text-secondary/60">Medium</span>
                <p className="mt-0.5 text-text-primary">{artwork.medium}</p>
              </div>
            )}
            {artwork.classification && (
              <div>
                <span className="text-text-secondary/60">Classification</span>
                <p className="mt-0.5 text-text-primary">{artwork.classification}</p>
              </div>
            )}
            {artwork.creditline && (
              <div className="sm:col-span-2">
                <span className="text-text-secondary/60">Credit</span>
                <p className="mt-0.5 text-text-primary text-xs">{artwork.creditline}</p>
              </div>
            )}
          </div>

          {artwork.ai_description && (
            <div className="mt-4 sm:mt-6">
              <span className="text-text-secondary/60 text-sm">About this work</span>
              <p className="mt-1 text-sm text-text-secondary leading-relaxed">{artwork.ai_description}</p>
            </div>
          )}

          {onAskCurator && (
            <button
              onClick={() => onAskCurator(artwork)}
              className="mt-4 sm:mt-6 w-full rounded-xl sm:rounded-2xl bg-accent/20 border border-accent/30 px-4 py-3 text-sm font-medium text-accent hover:bg-accent/30 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label={`Ask the Curator about ${artwork.title}`}
            >
              Ask the Curator about this artwork
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
