import { type ReactNode, useEffect } from 'react'

export type ToastVariant = 'success' | 'error' | 'warning'
export type ToastPlacement = 'corner' | 'center' | 'top'

interface ToastProps {
  children: ReactNode
  variant: ToastVariant
  onDismiss: () => void
  duration?: number
  placement?: ToastPlacement
}

export function Toast({ children, variant, onDismiss, duration = 3000, placement = 'top' }: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, duration)
    return () => window.clearTimeout(timer)
  }, [duration, onDismiss])

  return (
    <div className={`toast-viewport ${placement}`} aria-live="polite">
      <div className={`toast toast-${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
        {children}
      </div>
    </div>
  )
}
