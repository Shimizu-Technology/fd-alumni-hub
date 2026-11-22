import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMotionOk } from '../hooks/useMotionOk'

type RevealOnScrollProps = {
  children: ReactNode
  className?: string
  delayMs?: number
}

export function RevealOnScroll({ children, className = '', delayMs = 0 }: RevealOnScrollProps) {
  const motionOk = useMotionOk()
  const ref = useRef<HTMLDivElement>(null)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!motionOk || entered || !element || typeof IntersectionObserver === 'undefined') return
    if (element.getBoundingClientRect().top < window.innerHeight) return

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect()
        setEntered(true)
      }
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [entered, motionOk])

  const settle = motionOk && entered

  return (
    <div
      ref={ref}
      className={`reveal-block ${settle ? 'reveal-block--settle' : ''} ${className}`.trim()}
      style={settle && delayMs > 0 ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  )
}
