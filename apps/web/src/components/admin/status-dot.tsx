type StatusDotProps = {
  status: string
  size?: 'sm' | 'md'
  className?: string
  ariaLabel?: string
}

export function StatusDot({ status, size = 'md', className = '', ariaLabel }: StatusDotProps) {
  const color =
    status === 'live'
      ? 'bg-green-500'
      : status === 'upcoming'
        ? 'bg-yellow-500'
        : 'bg-neutral-400'

  const dim = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'
  return <span className={`inline-block rounded-full ${dim} ${color} ${className}`.trim()} aria-label={ariaLabel} />
}
