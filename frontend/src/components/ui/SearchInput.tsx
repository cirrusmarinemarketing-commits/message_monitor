import { useEffect, useState } from 'react'

type SearchInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

/** Debounces upward onChange calls so typing doesn't re-filter on every keystroke. */
function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  const [draft, setDraft] = useState(value)
  // Adjust state during render (React's recommended pattern for mirroring
  // a prop into local state) instead of an effect that calls setState
  // synchronously.
  const [prevValue, setPrevValue] = useState(value)

  if (value !== prevValue) {
    setPrevValue(value)
    setDraft(value)
  }

  useEffect(() => {
    if (draft === value) return

    const timeout = setTimeout(() => onChange(draft), 200)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  return (
    <input
      className="search-input"
      placeholder={placeholder ?? 'Search…'}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
    />
  )
}

export default SearchInput
