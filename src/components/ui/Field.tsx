import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const base =
  'w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60'

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(base, className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(base, 'min-h-24 resize-y leading-relaxed', className)} {...props} />
))
Textarea.displayName = 'Textarea'

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  hint?: string
}

export function Label({ className, children, hint, ...props }: LabelProps) {
  return (
    <label className={cn('mb-1.5 flex items-center justify-between text-sm font-medium text-ink', className)} {...props}>
      <span>{children}</span>
      {hint ? <span className="text-xs font-normal text-muted">{hint}</span> : null}
    </label>
  )
}

export function FieldError({ children }: { children?: string }) {
  if (!children) return null
  return <p className="mt-1 text-xs font-medium text-status-rejected">{children}</p>
}
