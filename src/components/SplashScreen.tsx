import { useState, useEffect, useMemo } from 'react'

interface SplashScreenProps {
  onComplete: () => void
}

// Pre-computed stumble values per letter so they're stable across renders
const STUMBLE = [
  { rotation: -12, xDrift: -8 },
  { rotation: 18, xDrift: 12 },
  { rotation: -22, xDrift: -5 },
  { rotation: 15, xDrift: 10 },
  { rotation: -10, xDrift: -14 },
]

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<'typing' | 'hold' | 'sinking' | 'fadeout'>('typing')
  const letters = useMemo(() => 'geuse'.split(''), [])

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('hold'), 1200),
      setTimeout(() => setPhase('sinking'), 2200),
      setTimeout(() => setPhase('fadeout'), 4400),
      setTimeout(() => onComplete(), 5200),
    ]
    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  const isSinking = phase === 'sinking' || phase === 'fadeout'

  return (
    <div
      className={`splash-screen ${phase === 'fadeout' ? 'splash-fadeout' : ''}`}
      aria-hidden="true"
    >
      <div className="splash-word">
        {letters.map((letter, i) => {
          const s = STUMBLE[i]
          return (
            <span
              key={i}
              className="splash-letter"
              style={{
                animationDelay: `${i * 200}ms`,
                ...(isSinking
                  ? {
                      transform: `translateY(110vh) rotate(${s.rotation}deg) translateX(${s.xDrift}px)`,
                      opacity: 0,
                      transitionDelay: `${i * 0.1}s`,
                    }
                  : {}),
              }}
            >
              {letter}
            </span>
          )
        })}
      </div>
    </div>
  )
}
