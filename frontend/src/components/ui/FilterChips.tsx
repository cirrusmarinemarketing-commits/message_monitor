type FilterOption<T extends string> = {
  value: T
  label: string
  count?: number
}

type FilterChipsProps<T extends string> = {
  options: FilterOption<T>[]
  active: T
  onChange: (value: T) => void
}

function FilterChips<T extends string>({ options, active, onChange }: FilterChipsProps<T>) {
  return (
    <div className="filter-chips">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`filter-chip${option.value === active ? ' filter-chip-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {typeof option.count === 'number' && (
            <span className="filter-chip-count">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

export default FilterChips
