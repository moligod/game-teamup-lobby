import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../theme/ThemeProvider'
import { IconButton } from './IconButton'

interface ThemeToggleProps {
  darkLabel: string
  lightLabel: string
}

export function ThemeToggle({ darkLabel, lightLabel }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const nextIsDark = theme === 'light'
  const label = nextIsDark ? darkLabel : lightLabel

  return (
    <IconButton className="theme-toggle" label={label} onClick={toggleTheme} variant="ghost">
      {nextIsDark ? <Moon size={17} /> : <Sun size={17} />}
    </IconButton>
  )
}
