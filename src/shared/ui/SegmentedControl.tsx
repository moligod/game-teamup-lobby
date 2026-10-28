interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  ariaLabel: string
  options: ReadonlyArray<SegmentedOption<T>>
  value: T
  onValueChange: (value: T) => void
}

export function SegmentedControl<T extends string>({ ariaLabel, options, value, onValueChange }: SegmentedControlProps<T>) {
  return (
    <div className="segmented-control" aria-label={ariaLabel} role="group">
      {options.map((option) => (
        <button
          aria-pressed={value === option.value}
          className={value === option.value ? 'active' : ''}
          key={option.value}
          onClick={() => onValueChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
