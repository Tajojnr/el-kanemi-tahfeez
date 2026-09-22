import { Users } from 'lucide-react'

export function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-16 px-4 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl">
      <div className="w-16 h-16 mx-auto bg-slate-800 rounded-full flex items-center justify-center mb-4">
        <Users className="w-8 h-8 text-slate-500" />
      </div>
      <h3 className="text-white font-semibold mb-1">No students yet</h3>
      <p className="text-sm text-slate-400 mb-5">Add your first student to start tracking Hifz progress</p>
      <button
        onClick={onAdd}
        className="bg-emerald-700 hover:bg-emerald-600 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
      >
        + Add Your First Student
      </button>
    </div>
  )
}