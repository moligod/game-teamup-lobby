import type { ButtonHTMLAttributes, ReactNode } from 'react'

type IconButtonVariant = 'default' | 'primary' | 'ghost' | 'danger'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant
  label: string
  children: ReactNode
}

export function IconButton({ variant = 'default', label, className, children, type = 'button', ...props }: IconButtonProps) {
  const classes = ['icon-button', variant === 'default' ? '' : variant, className].filter(Boolean).join(' ')

  return (
    <button {...props} type={type} className={classes} title={label} aria-label={label}>
      {children}
    </button>
  )
}
