import { useState, useRef, useEffect } from 'react'
import type { FormEvent } from 'react'
import { CuratorMessage } from './CuratorMessage'
import { useCurator } from '../hooks/useCurator'

interface CuratorPanelProps {
  sessionId: string
  isOpen: boolean
  onClose: () => void
}

export function CuratorPanel({ sessionId, isOpen, onClose }: CuratorPanelProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { messages, loading, sendMessage } = useCurator(sessionId)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmedInput = input.trim()
    if (!trimmedInput || loading) return

    setInput('')
    await sendMessage(trimmedInput)
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-surface-dark/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="curator-panel-title"
    >
      <div
        className="fixed right-0 top-0 h-full w-full sm:w-96 bg-surface-card border-l border-glass-border flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-glass-border bg-glass-white backdrop-blur-xl">
          <h2
            id="curator-panel-title"
            className="text-lg font-semibold text-primary"
          >
            Ask the Curator
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-glass-white-strong transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
            aria-label="Close curator panel"
          >
            <svg
              className="w-5 h-5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto p-4 space-y-4"
          role="list"
          aria-live="polite"
          aria-label="Chat messages"
        >
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-primary/60 text-sm text-center px-4">
                I'm GEUSE Curator. This is an AI-powered search and curator
                experience for the National Gallery of Art collection.
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <CuratorMessage key={index} message={message} />
          ))}

          {loading && (
            <div className="flex justify-start" role="status" aria-live="polite">
              <div className="bg-glass-white-strong backdrop-blur-xl border border-glass-border rounded-2xl px-4 py-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                  <div
                    className="w-2 h-2 bg-accent rounded-full animate-pulse"
                    style={{ animationDelay: '0.2s' }}
                  />
                  <div
                    className="w-2 h-2 bg-accent rounded-full animate-pulse"
                    style={{ animationDelay: '0.4s' }}
                  />
                </div>
                <span className="sr-only">Curator is typing...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="p-4 border-t border-glass-border bg-surface-card"
        >
          <div className="flex items-end space-x-2">
            <div className="flex-1">
              <label htmlFor="curator-input" className="sr-only">
                Ask the curator
              </label>
              <input
                ref={inputRef}
                id="curator-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about artworks, artists, styles..."
                disabled={loading}
                className="w-full px-4 py-3 bg-glass-white border border-glass-border rounded-xl text-primary placeholder-primary/50 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-xl text-sm"
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="px-4 py-3 bg-accent text-white rounded-xl hover:bg-accent/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-accent disabled:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              aria-label="Send message"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
