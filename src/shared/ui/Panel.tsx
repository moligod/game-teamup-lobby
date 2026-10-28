import type { HTMLAttributes, ReactNode } from 'react'

interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: 'section' | 'aside' | 'div'
  children: ReactNode
}

export function Panel({ as: Tag = 'section', className, children, ...props }: PanelProps) {
  const classes = ['panel', className].filter(Boolean).join(' ')
  return <Tag {...props} className={classes}>{children}</Tag>
}
