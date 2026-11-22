import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMotionOk } from '../hooks/useMotionOk'

type RevealOnScrollProps = {
  children: ReactNode
  className?: string
  delayMs?: number
}

export function RevealOnScroll({ children, className = '', delayMs = 0 }: RevealOnScrollProps) {
  const motionOk = useMotionOk()
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!motionOk || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const element = ref.current
    if (!element) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [motionOk])

  const shouldReveal = !motionOk || visible

  return (
    <div
      ref={ref}
      className={`reveal-block ${motionOk ? 'reveal-block--animated' : ''} ${shouldReveal ? 'is-visible' : ''} ${className}`.trim()}
      style={motionOk && delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  )
}
