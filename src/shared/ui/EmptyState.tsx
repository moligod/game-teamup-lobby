import type { HTMLAttributes, ReactNode } from 'react'

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  compact?: boolean
  children: ReactNode
}

export function EmptyState({ compact = false, className, children, ...props }: EmptyStateProps) {
  const classes = ['empty', compact ? 'compact-empty' : '', className].filter(Boolean).join(' ')
  return <div {...props} className={classes}>{children}</div>
}
