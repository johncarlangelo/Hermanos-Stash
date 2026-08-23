import { forwardRef } from 'react'
import { X } from 'lucide-react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', invalid = false, ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      className={`h-8.5 w-full rounded-md border bg-base px-2.5 text-[13px] text-ink placeholder:text-faint transition-colors duration-150 ease-out focus:outline-none ${
        invalid ? 'border-danger/70' : 'border-line hover:border-line-strong focus:border-accent/70'
      } ${className}`}
      {...rest}
    />
  )
})

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  mono?: boolean
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { className = '', mono = false, ...rest },
  ref
) {
  return (
    <textarea
      ref={ref}
      spellCheck={false}
      className={`w-full resize-none rounded-md border border-line bg-base p-3 text-[12.5px] leading-relaxed text-ink placeholder:text-faint transition-colors duration-150 ease-out focus:border-accent/70 focus:outline-none ${
        mono ? 'font-mono tnum' : ''
      } ${className}`}
      {...rest}
    />
  )
})

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className = '', children, ...rest },
  ref
) {
  return (
    <select
      ref={ref}
      className={`h-8.5 rounded-md border border-line bg-base px-2.5 pr-7 text-[13px] text-ink transition-colors duration-150 ease-out hover:border-line-strong focus:border-accent/70 focus:outline-none cursor-pointer ${className}`}
      style={{ appearance: 'none' }}
      {...rest}
    >
      {children}
    </select>
  )
})

export interface FieldRowProps {
  label: string
  htmlFor?: string
  children: React.ReactNode
}

/** Compact labeled option row used across tool workspaces. */
export function FieldRow({ label, htmlFor, children }: FieldRowProps) {
  return (
    <div className="flex items-center gap-2.5">
      <label htmlFor={htmlFor} className="w-20 shrink-0 text-right text-[12px] text-faint">
        {label}
      </label>
      {children}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150 ease-out cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'border-accent/60 bg-accent-soft' : 'border-line bg-surface'
      }`}
    >
      <span
        className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full transition-all duration-150 ease-out ${
          checked ? 'left-4.5 bg-accent' : 'left-1 bg-faint'
        }`}
      />
    </button>
  )
}

export function TagChip({ tag, active }: { tag: string; active?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-xs border px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wide ${
        active
          ? 'border-accent/50 bg-accent-soft text-accent'
          : 'border-line bg-transparent text-faint'
      }`}
    >
      {tag}
    </span>
  )
}

export function ClearableTagInput({
  value,
  onChange,
  placeholder,
  id
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  id?: string
}) {
  return (
    <div className="relative w-full">
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="peer h-8.5 w-full rounded-md border border-line bg-base pl-2.5 pr-8 text-[13px] text-ink placeholder:text-faint transition-colors duration-150 ease-out hover:border-line-strong focus:border-accent/70 focus:outline-none"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear input"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-1.5 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-faint opacity-0 transition-opacity duration-150 ease-out peer-hover:opacity-100 hover:!opacity-100 focus-visible:opacity-100 cursor-pointer hover:bg-surface hover:text-ink"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}
