import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'default' | 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  fullWidth?: boolean
  loading?: boolean
  icon?: ReactNode
  size?: ButtonSize
}

export function Button({
  variant = 'secondary',
  fullWidth = false,
  loading = false,
  icon,
  size = 'md',
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = ['button', variant === 'default' ? '' : variant, size === 'md' ? '' : `button-${size}`, fullWidth ? 'full' : '', className].filter(Boolean).join(' ')

  return (
    <button {...props} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined}>
      {icon}
      {children}
    </button>
  )
}
