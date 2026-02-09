import { useEffect, useRef } from 'react'
import { HeartButton } from './HeartButton'
import { CuratorBottomSheet } from './CuratorBottomSheet'
import { useBottomSheet } from '../../hooks/useBottomSheet'
import type { Artwork } from '../../types/artwork'

function getHighResUrl(thumbUrl: string): string {
  return thumbUrl.replace(/\/full\/!?\d+,\d+\//, '/full/!600,600/')
}

interface DetailModalProps {
  artwork: Artwork
  onClose: () => void
  isFavorited: boolean
  onToggleFavorite: () => void
  sessionId: string
}

export function DetailModal({ artwork, onClose, isFavorited, onToggleFavorite, sessionId }: DetailModalProps) {
  const primaryImage = artwork.images?.find((img) => img.viewtype === 'primary') ?? artwork.images?.[0]
  const rawThumbUrl = primaryImage?.iiifurl || primaryImage?.iiifthumburl || artwork.iiifthumburl
  const imageUrl = rawThumbUrl ? getHighResUrl(rawThumbUrl) : undefined
  const modalRef = useRef<HTMLDivElement>(null)
  const sheet = useBottomSheet()

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (sheet.isOpen) {
          sheet.close()
        } else {
          onClose()
        }
      }
    }

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
    document.body.style.overflow = 'hidden'

    const closeButton = modalRef.current?.querySelector<HTMLButtonElement>('button[aria-label="Close modal"]')
    closeButton?.focus()

    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.removeEventListener('keydown', handleTab)
      document.body.style.overflow = ''
    }
  }, [onClose, sheet])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
    >
      <div
        ref={modalRef}
        className="relative max-h-[95vh] sm:max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl sm:rounded-3xl backdrop-blur-2xl bg-surface-card/95 border border-glass-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar with close and heart */}
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
          <button
            onClick={onClose}
            className="rounded-full backdrop-blur-xl bg-surface-dark/60 p-2 text-text-secondary hover:text-text-primary transition-all"
            aria-label="Close modal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <HeartButton isFavorited={isFavorited} onToggle={onToggleFavorite} />
        </div>

        {/* Image */}
        {imageUrl && (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-3xl bg-surface-dark">
            <img
              src={imageUrl}
              alt={primaryImage?.assistivetext || artwork.title}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          </div>
        )}

        {/* Info */}
        <div className="p-5 sm:p-6">
          <h2 id="detail-modal-title" className="text-xl sm:text-2xl font-semibold text-text-primary leading-tight">
            {artwork.title}
          </h2>
          <p className="mt-1.5 text-base text-text-secondary">{artwork.attribution}</p>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {artwork.displaydate && (
              <div>
                <span className="text-text-muted text-xs">Date</span>
                <p className="mt-0.5 text-text-primary">{artwork.displaydate}</p>
              </div>
            )}
            {artwork.medium && (
              <div>
                <span className="text-text-muted text-xs">Medium</span>
                <p className="mt-0.5 text-text-primary">{artwork.medium}</p>
              </div>
            )}
            {artwork.classification && (
              <div>
                <span className="text-text-muted text-xs">Classification</span>
                <p className="mt-0.5 text-text-primary">{artwork.classification}</p>
              </div>
            )}
            {artwork.creditline && (
              <div className="col-span-2">
                <span className="text-text-muted text-xs">Credit</span>
                <p className="mt-0.5 text-text-primary text-xs">{artwork.creditline}</p>
              </div>
            )}
          </div>

          {artwork.ai_description && (
            <div className="mt-4">
              <span className="text-text-muted text-xs">About this work</span>
              <p className="mt-1 text-sm text-text-secondary leading-relaxed">{artwork.ai_description}</p>
            </div>
          )}

          {/* Curator trigger */}
          {!sheet.isOpen && (
            <button
              onClick={sheet.open}
              className="mt-5 w-full rounded-2xl bg-accent/15 border border-accent/25 px-4 py-3.5 text-sm font-medium text-accent hover:bg-accent/25 transition-colors flex items-center justify-center gap-2"
              aria-label={`Ask the Curator about ${artwork.title}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Ask the Curator
            </button>
          )}
        </div>

        {/* Curator bottom sheet */}
        <CuratorBottomSheet
          artwork={artwork}
          sessionId={sessionId}
          isOpen={sheet.isOpen}
          onClose={sheet.close}
          dragOffset={sheet.dragOffset}
          onTouchStart={sheet.onTouchStart}
          onTouchMove={sheet.onTouchMove}
          onTouchEnd={sheet.onTouchEnd}
        />
      </div>
    </div>
  )
}
