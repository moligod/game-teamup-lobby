import type { HTMLAttributes, ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  icon?: ReactNode
  children: ReactNode
}

export function Badge({ tone = 'neutral', icon, className, children, ...props }: BadgeProps) {
  const classes = ['badge', `badge-${tone}`, className].filter(Boolean).join(' ')
  return (
    <span {...props} className={classes}>
      {icon}
      {children}
    </span>
  )
}
