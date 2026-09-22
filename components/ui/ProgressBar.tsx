export function ProgressBar({ value, max, status }: { value: number; max: number; status: 'safe' | 'warning' | 'danger' }) {
  const pct = Math.min((value / max) * 100, 100)
  const colors = {
    safe: 'bg-indigo-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
  }
  return (
    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full ${colors[status]} transition-all duration-500 rounded-full`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}