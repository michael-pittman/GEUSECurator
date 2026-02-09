import { useState, useCallback } from 'react'
import { askCurator } from '../api/curator'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface UseCuratorResult {
  messages: Message[]
  loading: boolean
  error: string | null
  sendMessage: (input: string) => Promise<void>
  clearMessages: () => void
}

export function useCurator(sessionId: string, contextObjectId?: number): UseCuratorResult {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim()) return

      const userMessage: Message = {
        role: 'user',
        content: input,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])
      setLoading(true)
      setError(null)

      try {
        const response = await askCurator(input, sessionId, contextObjectId)

        const assistantMessage: Message = {
          role: 'assistant',
          content: response.output,
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, assistantMessage])
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to communicate with the curator. Please try again.'

        setError(errorMessage)

        // Add error as assistant message for visibility
        const errorAssistantMessage: Message = {
          role: 'assistant',
          content: `I apologize, but I encountered an error: ${errorMessage}`,
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, errorAssistantMessage])
      } finally {
        setLoading(false)
      }
    },
    [sessionId, contextObjectId]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    loading,
    error,
    sendMessage,
    clearMessages,
  }
}
