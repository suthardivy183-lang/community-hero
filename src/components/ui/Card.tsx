import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
}

export function Card({ className, interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]',
        interactive &&
          'cursor-pointer transition-all duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-pop)]',
        className,
      )}
      {...props}
    />
  )
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}
