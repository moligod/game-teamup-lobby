import type { ReactNode } from 'react'

interface MetricCardProps {
  label: ReactNode
  value: ReactNode
}

export function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
