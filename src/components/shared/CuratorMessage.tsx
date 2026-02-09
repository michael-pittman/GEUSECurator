interface CuratorMessageProps {
  message: {
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
  }
}

export function CuratorMessage({ message }: CuratorMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      role="listitem"
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-accent text-surface-dark'
            : 'bg-glass-warm-strong backdrop-blur-xl border border-glass-border text-text-primary'
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </p>
        <time
          className={`text-xs mt-2 block ${
            isUser ? 'text-surface-dark/60' : 'text-text-secondary'
          }`}
          dateTime={message.timestamp.toISOString()}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </div>
    </div>
  )
}
