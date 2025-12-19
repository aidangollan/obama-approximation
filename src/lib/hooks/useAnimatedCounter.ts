import { useEffect, useRef, useState } from 'react'

/**
 * Hook that animates a number counter smoothly
 * Speed is proportional to the difference between current and target
 */
export function useAnimatedCounter(targetValue: number, duration: number = 500): number {
  const [displayValue, setDisplayValue] = useState(targetValue)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const startValueRef = useRef(targetValue)

  useEffect(() => {
    // If target hasn't changed or is same as display, no animation needed
    if (targetValue === displayValue) {
      return
    }

    // Cancel any existing animation
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current)
    }

    startValueRef.current = displayValue
    startTimeRef.current = null

    // Calculate duration based on difference (faster for larger gaps)
    const difference = Math.abs(targetValue - displayValue)
    const adaptiveDuration = Math.min(1000, Math.max(200, difference / 10))

    const animate = (currentTime: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = currentTime
      }

      const elapsed = currentTime - startTimeRef.current
      const progress = Math.min(elapsed / adaptiveDuration, 1)

      // Easing function (easeOutCubic for smooth deceleration)
      const easeProgress = 1 - Math.pow(1 - progress, 3)

      const current = startValueRef.current + (targetValue - startValueRef.current) * easeProgress
      setDisplayValue(Math.round(current))

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setDisplayValue(targetValue)
        animationRef.current = null
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [targetValue])

  return displayValue
}

