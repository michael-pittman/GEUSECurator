import { useState, useEffect, useRef } from 'react'
import type { TouchEvent as ReactTouchEvent } from 'react'
import { CuratorMessage } from './CuratorMessage'
import { useCurator } from '../../hooks/useCurator'
import type { Artwork } from '../../types/artwork'

interface CuratorBottomSheetProps {
  artwork: Artwork
  sessionId: string
  isOpen: boolean
  onClose: () => void
  dragOffset: number
  onTouchStart: (e: ReactTouchEvent) => void
  onTouchMove: (e: ReactTouchEvent) => void
  onTouchEnd: () => void
}

export function CuratorBottomSheet({
  artwork,
  sessionId,
  isOpen,
  onClose,
  dragOffset,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: CuratorBottomSheetProps) {
  const [input, setInput] = useState('')
  const { messages, loading, sendMessage } = useCurator(sessionId, artwork.objectid)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || loading) return
    setInput('')
    await sendMessage(trimmed)
  }

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20 animate-slide-up"
      style={{ transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined }}
      role="dialog"
      aria-label={`Curator chat about ${artwork.title}`}
    >
      <div className="h-[45vh] sm:h-[350px] flex flex-col rounded-t-2xl bg-surface-card/98 backdrop-blur-2xl border-t border-glass-border shadow-2xl">
        {/* Drag handle */}
        <div
          className="flex justify-center py-2 cursor-grab active:cursor-grabbing"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="w-10 h-1 rounded-full bg-glass-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Ask the Curator</h3>
            <p className="text-xs text-text-secondary line-clamp-1">About: {artwork.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-glass-warm transition-colors"
            aria-label="Close curator chat"
          >
            <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 space-y-3" role="list" aria-live="polite">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-text-muted text-center px-4">
                Ask me anything about this artwork
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <CuratorMessage key={i} message={msg} />
          ))}
          {loading && (
            <div className="flex justify-start" aria-live="polite">
              <div className="bg-glass-warm-strong rounded-2xl px-4 py-3 flex gap-1">
                <span className="w-2 h-2 rounded-full bg-text-secondary animate-pulse" />
                <span className="w-2 h-2 rounded-full bg-text-secondary animate-pulse" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-text-secondary animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="sr-only">Curator is thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-glass-border">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this artwork..."
              className="flex-1 rounded-xl bg-glass-warm border border-glass-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
              aria-label="Message to curator"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="px-3 py-2 rounded-xl bg-accent text-surface-dark text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-light transition-colors"
              aria-label="Send message"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
