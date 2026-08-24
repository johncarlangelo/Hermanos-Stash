import { useId } from 'react'
import { FieldRow, Input } from '../../components/ui/Inputs'

/**
 * Shared "File name" input rendered identically by every tool that produces
 * a file, so naming behavior feels like one product-wide feature.
 */
export function OutputNameField({
  value,
  onChange,
  error,
  placeholder
}: {
  value: string
  onChange: (next: string) => void
  error: string | null
  placeholder?: string
}): React.JSX.Element {
  const inputId = useId()
  return (
    <div className="flex flex-col gap-1">
      <FieldRow label="File name" htmlFor={inputId}>
        <Input
          id={inputId}
          mono
          value={value}
          placeholder={placeholder}
          invalid={error !== null}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
      </FieldRow>
      {error !== null && (
        <p role="alert" className="pl-[5.75rem] text-[11.5px] leading-snug text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
