import type { HTMLAttributes, ReactNode } from 'react'

interface NoticeProps extends HTMLAttributes<HTMLDivElement> {
  variant: 'info' | 'success' | 'warning' | 'error'
  children: ReactNode
}

export function Notice({ variant, className, children, ...props }: NoticeProps) {
  const classes = ['notice', variant, className].filter(Boolean).join(' ')
  return <div {...props} className={classes} role={variant === 'error' ? 'alert' : 'status'}>{children}</div>
}
