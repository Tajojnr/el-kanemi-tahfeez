export function StudentAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Generate consistent color from name
  const colors = [
    'bg-emerald-800 text-emerald-200',
    'bg-blue-800 text-blue-200',
    'bg-purple-800 text-purple-200',
    'bg-amber-800 text-amber-200',
    'bg-rose-800 text-rose-200',
    'bg-cyan-800 text-cyan-200',
  ]
  const colorIdx = name.charCodeAt(0) % colors.length

  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
  }

  return (
    <div className={`${sizes[size]} ${colors[colorIdx]} rounded-full flex items-center justify-center font-bold shrink-0`}>
      {initials}
    </div>
  )
}