'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  Building2, Plus, ArrowLeft, ArrowLeftRight, Settings, Trash2, X, RefreshCw,
  Upload, Users, Eye, GraduationCap, Check, Loader2, FileSpreadsheet
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import { StudentAvatar } from '@/components/ui/StudentAvatar'
import { useEscapeKey } from '@/hooks/useEscapeKey'

type ClassPerformance = {
  id: string
  display_name_en: string
  status: 'active' | 'archived'
  teacher_name?: string | null
  target_safhas?: number
  total_students?: number
}

type Student = {
  id: string
  full_name: string
  current_page: number
  current_hizb: number
}

export default function ClassManagementPage() {
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [classes, setClasses] = useState<ClassPerformance[]>([])
  const [selectedClass, setSelectedClass] = useState<ClassPerformance | null>(null)
  const [roster, setRoster] = useState<Student[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newClassTarget, setNewClassTarget] = useState(6)

  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editTarget, setEditTarget] = useState(6)

  const [showImportModal, setShowImportModal] = useState(false)
  const [bulkInput, setBulkInput] = useState('')

  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferStudent, setTransferStudent] = useState<Student | null>(null)
  const [targetClassId, setTargetClassId] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)

  const closeAllModals = useCallback(() => {
    setShowCreateModal(false)
    setShowEditModal(false)
    setShowImportModal(false)
    setShowTransferModal(false)
  }, [])

  useEscapeKey(closeAllModals)

  useEffect(() => { loadData() }, [])

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true)
      else setRefreshing(true)

      const [classesRes, settingsRes, studentCountRes] = await Promise.all([
        supabase.from('classes').select('*').order('display_name_en'),
        supabase.from('class_settings').select('class_id, target_safhas_per_week'),
        supabase.from('students').select('class_id').eq('status', 'active'),
      ])

      const targets = new Map(settingsRes.data?.map(s => [s.class_id, s.target_safhas_per_week]) || [])
      
      const counts = new Map<string, number>()
      studentCountRes.data?.forEach(s => {
        counts.set(s.class_id, (counts.get(s.class_id) || 0) + 1)
      })

      const combined = (classesRes.data || []).map((c: any) => ({
        id: c.id,
        display_name_en: c.display_name_en,
        status: c.status || 'active',
        teacher_name: c.teacher_name,
        target_safhas: targets.get(c.id) || 6,
        total_students: counts.get(c.id) || 0,
      }))

      setClasses(combined)
    } catch (err) {
      toast('error', 'Failed to load classes')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function viewRoster(c: ClassPerformance) {
    setSelectedClass(c)
    setRosterLoading(true)
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, current_page, current_hizb')
        .eq('class_id', c.id)
        .eq('status', 'active')
        .order('full_name')

      if (error) throw error
      setRoster(data || [])
    } catch {
      toast('error', 'Failed to load roster')
    } finally {
      setRosterLoading(false)
    }
  }

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault()
    if (!newClassName.trim()) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/classes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClassName.trim(), target: newClassTarget }),
      })
      if (!res.ok) throw new Error()
      toast('success', 'Class created successfully')
      setShowCreateModal(false)
      setNewClassName('')
      await loadData(true)
    } catch {
      toast('error', 'Failed to create class')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpdateClass(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClass) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/classes/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClass.id, name: editName.trim(), target: editTarget }),
      })
      if (!res.ok) throw new Error()
      toast('success', 'Class settings updated')
      setShowEditModal(false)
      await loadData(true)
      setSelectedClass(prev => prev ? { ...prev, display_name_en: editName, target_safhas: editTarget } : null)
    } catch {
      toast('error', 'Failed to update class')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function toggleArchiveClass(c: ClassPerformance) {
    const action = c.status === 'active' ? 'archive' : 'activate'
    try {
      const res = await fetch('/api/admin/classes/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: c.id, archive: c.status === 'active' }),
      })
      if (!res.ok) throw new Error()
      toast('success', `Class ${c.status === 'active' ? 'archived' : 'activated'}`)
      await loadData(true)
      if (selectedClass?.id === c.id) setSelectedClass(null)
    } catch {
      toast('error', `Failed to ${action} class`)
    }
  }

  async function handleBulkImport(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClass || !bulkInput.trim()) return
    setIsSubmitting(true)

    const names = bulkInput
      .split('\n')
      .map(n => n.trim())
      .filter(n => n.length > 0)

    if (names.length === 0) {
      toast('warning', 'No valid names detected')
      setIsSubmitting(false)
      return
    }

    try {
      const res = await fetch('/api/admin/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClass.id, studentNames: names }),
      })
      if (!res.ok) throw new Error()
      toast('success', `Successfully imported ${names.length} students`)
      setShowImportModal(false)
      setBulkInput('')
      await viewRoster(selectedClass)
      await loadData(true)
    } catch {
      toast('error', 'Failed to import roster')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleTransferStudent(e: React.FormEvent) {
    e.preventDefault()
    if (!transferStudent || !targetClassId) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/students/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: transferStudent.id, targetClassId }),
      })
      if (!res.ok) throw new Error()
      toast('success', `${transferStudent.full_name} transferred successfully`)
      setShowTransferModal(false)
      setTransferStudent(null)
      setTargetClassId('')
      if (selectedClass) await viewRoster(selectedClass)
      await loadData(true)
    } catch {
      toast('error', 'Failed to transfer student')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/30 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-indigo-500 w-8 h-8" />
        <p className="text-sm text-slate-400">Loading Class Management...</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/30 text-white pb-24">

      {/* HEADER */}
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-30">
        <div className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/admin" className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-slate-300">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                Class Management
              </h1>
              <p className="text-xs text-slate-400">Manage school classes, weekly targets & rosters</p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={() => setShowCreateModal(true)} className="bg-indigo-700 hover:bg-indigo-600 px-4 py-2.5 rounded-xl flex items-center gap-2 font-semibold text-sm transition-colors flex-1 sm:flex-none justify-center">
              <Plus className="w-4 h-4" /> Add Class
            </button>
            <button onClick={() => loadData(true)} className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
              <RefreshCw className={`w-4 h-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="p-4 sm:p-6 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* CLASSES LIST (left-2-cols) */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-bold text-slate-400 uppercase tracking-wide">Classes ({classes.length})</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {classes.map(c => (
              <div key={c.id} onClick={() => viewRoster(c)} className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-36 ${selectedClass?.id === c.id ? 'bg-indigo-950/20 border-indigo-500/60 shadow-lg shadow-indigo-950/10' : c.status === 'archived' ? 'bg-slate-900/40 border-slate-800 opacity-60' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'}`}>
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-semibold text-white truncate text-base">{c.display_name_en}</h3>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${c.status === 'active' ? 'bg-indigo-950/60 text-indigo-400' : 'bg-red-950/60 text-red-400'}`}>{c.status}</span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-1">Ustaz: {c.teacher_name || 'Unassigned'}</p>
                </div>

                <div className="flex justify-between items-end border-t border-slate-800/80 pt-3">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Weekly Target</span>
                    <p className="text-sm font-bold text-indigo-300">{c.target_safhas} Safhas</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-950/60 px-2.5 py-1 rounded-lg border border-slate-800">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-bold text-slate-300">{c.total_students}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ROSTER PANEL (right-1-col) */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col max-h-[80vh]">
          {selectedClass ? (
            <>
              {/* Roster Header */}
              <div className="border-b border-slate-800 pb-4 shrink-0 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-bold text-lg text-indigo-300 truncate">{selectedClass.display_name_en}</h3>
                    <p className="text-xs text-slate-400">Class Roster</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditName(selectedClass.display_name_en); setEditTarget(selectedClass.target_safhas || 6); setShowEditModal(true) }} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all" title="Edit Class Settings"><Settings className="w-4 h-4" /></button>
                    <button onClick={() => toggleArchiveClass(selectedClass)} className={`p-1.5 rounded-lg border transition-all ${selectedClass.status === 'active' ? 'bg-red-950/40 border-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-indigo-950/40 border-indigo-900/30 text-indigo-400 hover:bg-indigo-900/50'}`} title={selectedClass.status === 'active' ? 'Archive' : 'Activate'}><GraduationCap className="w-4 h-4" /></button>
                  </div>
                </div>

                <button onClick={() => setShowImportModal(true)} className="w-full bg-slate-800 hover:bg-slate-700 text-xs font-semibold py-2 rounded-xl flex items-center justify-center gap-2 text-slate-300 transition-colors">
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Bulk Import Students</span>
                </button>
              </div>

              {/* Roster list */}
              <div className="overflow-y-auto flex-1 py-3 space-y-2">
                {rosterLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500 w-5 h-5" /></div>
                ) : roster.length === 0 ? (
                  <div className="text-center py-10">
                    <Users className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">No active students in roster</p>
                  </div>
                ) : (
                  roster.map(s => (
                    <div key={s.id} className="p-2 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between gap-3 group hover:border-slate-700 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <StudentAvatar name={s.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{s.full_name}</p>
                          <p className="text-[10px] text-slate-500">Page {s.current_page} · Juz {s.current_hizb}</p>
                        </div>
                      </div>
                      <button onClick={() => { setTransferStudent(s); setTargetClassId(''); setShowTransferModal(true) }} className="p-1.5 bg-slate-800 hover:bg-blue-900 text-slate-400 hover:text-white rounded-lg transition-colors" title="Transfer student to another class"><ArrowLeftRight className="w-3.5 h-3.5" /></button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-20 flex-1 flex flex-col justify-center">
              <Building2 className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 font-semibold text-sm">No Class Selected</p>
              <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto">Click any class on the left to manage roster and settings</p>
            </div>
          )}
        </div>
      </main>

      {/* CREATE CLASS MODAL */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)} title="Create Class">
          <form onSubmit={handleCreateClass} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Class Name *</label>
              <input type="text" required placeholder="e.g. Huffaz 3" value={newClassName} onChange={e => setNewClassName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500/40 outline-none text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Weekly Safhas Target</label>
              <input type="number" min={1} max={30} value={newClassTarget} onChange={e => setNewClassTarget(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500/40 outline-none text-sm text-center font-bold" />
            </div>
            <ModalButtons onCancel={() => setShowCreateModal(false)} label="Create Class" loading={isSubmitting} />
          </form>
        </Modal>
      )}

      {/* EDIT CLASS SETTINGS MODAL */}
      {showEditModal && selectedClass && (
        <Modal onClose={() => setShowEditModal(false)} title="Class Settings">
          <form onSubmit={handleUpdateClass} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Class Name</label>
              <input type="text" required value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500/40 outline-none text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Weekly Safhas Target</label>
              <input type="number" min={1} max={30} value={editTarget} onChange={e => setEditTarget(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500/40 outline-none text-sm text-center font-bold" />
            </div>
            <ModalButtons onCancel={() => setShowEditModal(false)} label="Save Changes" loading={isSubmitting} />
          </form>
        </Modal>
      )}

      {/* BULK IMPORT MODAL */}
      {showImportModal && selectedClass && (
        <Modal onClose={() => setShowImportModal(false)} title="Bulk Import Students">
          <form onSubmit={handleBulkImport} className="space-y-4">
            <div>
              <div className="flex gap-2 items-center mb-1.5">
                <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
                <label className="text-xs text-slate-400 block font-medium">Enter Full Names (One per line)</label>
              </div>
              <textarea required value={bulkInput} onChange={e => setBulkInput(e.target.value)} placeholder="Ahmad Hassan&#10;Muhammad Aliyu&#10;Bilal Abdullahi" rows={8} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500/40 outline-none text-sm font-mono" />
            </div>
            <ModalButtons onCancel={() => setShowImportModal(false)} label={`Import to ${selectedClass.display_name_en}`} loading={isSubmitting} />
          </form>
        </Modal>
      )}

      {/* TRANSFER STUDENT MODAL */}
      {showTransferModal && transferStudent && (
        <Modal onClose={() => setShowTransferModal(false)} title="Transfer Student">
          <form onSubmit={handleTransferStudent} className="space-y-4">
            <div>
              <p className="text-xs text-slate-400">Transfer student:</p>
              <p className="text-sm font-bold text-white mt-0.5">{transferStudent.full_name}</p>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1.5 font-medium">Select Target Class</label>
              <select required value={targetClassId} onChange={e => setTargetClassId(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500/40 outline-none text-sm">
                <option value="">-- Select Class --</option>
                {classes.filter(c => c.id !== selectedClass?.id && c.status === 'active').map(c => (
                  <option key={c.id} value={c.id}>{c.display_name_en}</option>
                ))}
              </select>
            </div>

            <ModalButtons onCancel={() => setShowTransferModal(false)} label="Confirm Transfer" loading={isSubmitting} disabled={!targetClassId} />
          </form>
        </Modal>
      )}

    </div>
  )
}

function Modal({ children, onClose, title }: any) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl w-full max-w-md space-y-4 animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
          <h3 className="font-bold text-lg text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalButtons({ onCancel, label, loading, disabled }: any) {
  return (
    <div className="flex gap-2 pt-2">
      <button type="button" onClick={onCancel} disabled={loading} className="flex-1 bg-slate-700 hover:bg-slate-600 p-2.5 rounded-xl font-medium transition-colors text-sm">Cancel</button>
      <button type="submit" disabled={loading || disabled} className="flex-1 bg-indigo-700 hover:bg-indigo-600 p-2.5 rounded-xl font-semibold transition-colors text-sm flex items-center justify-center gap-2 text-white">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : label}
      </button>
    </div>
  )
}
