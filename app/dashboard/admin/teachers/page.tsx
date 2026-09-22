'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  Users, UserPlus, KeyRound, ArrowLeftRight, UserX, UserCheck,
  Search, ArrowLeft, Loader2, Copy, Check, AlertTriangle, X, Shield, RefreshCw
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import { StudentAvatar } from '@/components/ui/StudentAvatar'
import { useEscapeKey } from '@/hooks/useEscapeKey'

type TeacherWithClass = {
  id: string
  auth_user_id: string
  full_name: string
  email: string
  is_active: boolean
  created_at: string
  assigned_class_id?: string
  assigned_class_name?: string
}

type ClassItem = {
  id: string
  display_name_en: string
  auth_user_id: string | null
  teacher_name: string | null
}

export default function TeacherManagementPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [teachers, setTeachers] = useState<TeacherWithClass[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createClassId, setCreateClassId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Password Reveal Modal (after create or reset)
  const [passwordReveal, setPasswordReveal] = useState<{
    show: boolean
    teacherName: string
    teacherEmail: string
    password: string
    isReset?: boolean
  }>({ show: false, teacherName: '', teacherEmail: '', password: '' })
  const [copied, setCopied] = useState(false)

  // Reassign Modal
  const [reassignModal, setReassignModal] = useState<{
    show: boolean
    teacher: TeacherWithClass | null
    selectedClassId: string
  }>({ show: false, teacher: null, selectedClassId: '' })

  // Toggle Status Modal
  const [toggleModal, setToggleModal] = useState<{
    show: boolean
    teacher: TeacherWithClass | null
  }>({ show: false, teacher: null })

  // Reset Password Confirmation Modal
  const [resetModal, setResetModal] = useState<{
    show: boolean
    teacher: TeacherWithClass | null
  }>({ show: false, teacher: null })

  // Escape key handler
  const closeAllModals = useCallback(() => {
    if (passwordReveal.show) return setPasswordReveal(prev => ({ ...prev, show: false }))
    if (showCreateModal) return setShowCreateModal(false)
    if (reassignModal.show) return setReassignModal({ show: false, teacher: null, selectedClassId: '' })
    if (toggleModal.show) return setToggleModal({ show: false, teacher: null })
    if (resetModal.show) return setResetModal({ show: false, teacher: null })
  }, [passwordReveal.show, showCreateModal, reassignModal.show, toggleModal.show, resetModal.show])

  useEscapeKey(closeAllModals)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData(isSilent = false) {
    try {
      if (!isSilent) setLoading(true)
      else setRefreshing(true)

      const [teachersRes, classesRes] = await Promise.all([
        supabase.from('teachers').select('*').order('created_at', { ascending: false }),
        supabase.from('classes').select('id, display_name_en, auth_user_id, teacher_name').order('display_name_en'),
      ])

      const classList: ClassItem[] = classesRes.data || []
      const classMap = new Map<string, ClassItem>()
      classList.forEach(c => {
        if (c.auth_user_id) classMap.set(c.auth_user_id, c)
      })

      const combined: TeacherWithClass[] = (teachersRes.data || []).map((t: any) => {
        const assigned = classMap.get(t.auth_user_id)
        return {
          ...t,
          assigned_class_id: assigned?.id,
          assigned_class_name: assigned?.display_name_en,
        }
      })

      setTeachers(combined)
      setClasses(classList)
    } catch (err) {
      console.error('Error loading teachers:', err)
      toast('error', 'Failed to load teachers')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Filtered teachers
  const filteredTeachers = useMemo(() => {
    return teachers.filter(t => {
      const matchSearch =
        t.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.assigned_class_name && t.assigned_class_name.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchStatus =
        statusFilter === 'all' ? true :
        statusFilter === 'active' ? t.is_active : !t.is_active

      return matchSearch && matchStatus
    })
  }, [teachers, searchQuery, statusFilter])

  // Handle Create Teacher
  async function handleCreateTeacher(e: React.FormEvent) {
    e.preventDefault()
    if (!createName.trim() || !createEmail.trim()) {
      toast('warning', 'Please provide name and email')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/teachers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: createName.trim(),
          email: createEmail.trim(),
          classId: createClassId || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create teacher')

      setShowCreateModal(false)
      setCreateName('')
      setCreateEmail('')
      setCreateClassId('')

      // Reveal password
      setPasswordReveal({
        show: true,
        teacherName: data.teacher.full_name,
        teacherEmail: data.teacher.email,
        password: data.generatedPassword,
        isReset: false,
      })

      await loadData(true)
      toast('success', 'Teacher account created successfully')
    } catch (err: any) {
      console.error(err)
      toast('error', err.message || 'Failed to create teacher')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Reset Password
  async function handleResetPassword() {
    const target = resetModal.teacher
    if (!target) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/teachers/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authUserId: target.auth_user_id,
          teacherName: target.full_name,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reset password')

      setResetModal({ show: false, teacher: null })

      setPasswordReveal({
        show: true,
        teacherName: target.full_name,
        teacherEmail: target.email,
        password: data.newPassword,
        isReset: true,
      })

      toast('success', `Password reset for ${target.full_name}`)
    } catch (err: any) {
      toast('error', err.message || 'Failed to reset password')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Reassign Class
  async function handleReassignClass() {
    const target = reassignModal.teacher
    if (!target || !reassignModal.selectedClassId) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/teachers/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: reassignModal.selectedClassId,
          newTeacherId: target.id,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reassign class')

      setReassignModal({ show: false, teacher: null, selectedClassId: '' })
      await loadData(true)
      toast('success', 'Class reassigned successfully')
    } catch (err: any) {
      toast('error', err.message || 'Failed to reassign')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Toggle Active/Inactive
  async function handleToggleStatus() {
    const target = toggleModal.teacher
    if (!target) return

    setIsSubmitting(true)
    const nextState = !target.is_active

    try {
      const res = await fetch('/api/admin/teachers/toggle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: target.id,
          authUserId: target.auth_user_id,
          activate: nextState,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update status')

      setToggleModal({ show: false, teacher: null })
      await loadData(true)
      toast('success', nextState ? 'Teacher account activated' : 'Teacher account deactivated')
    } catch (err: any) {
      toast('error', err.message || 'Failed to update status')
    } finally {
      setIsSubmitting(false)
    }
  }

  function copyPassword() {
    navigator.clipboard.writeText(passwordReveal.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
    toast('success', 'Password copied to clipboard')
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/30 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-indigo-500 w-8 h-8" />
        <p className="text-sm text-slate-400">Loading teacher management...</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/30 text-white pb-24">

      {/* HEADER */}
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-30">
        <div className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/admin"
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-slate-300 hover:text-white"
              title="Back to Admin Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                Teacher Management
              </h1>
              <p className="text-xs text-slate-400">Manage credentials, roles & class assignments</p>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-indigo-700 hover:bg-indigo-600 px-4 py-2.5 rounded-xl flex items-center gap-2 flex-1 sm:flex-none justify-center font-semibold text-sm transition-colors shadow-lg shadow-indigo-900/20"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Teacher</span>
            </button>
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">

        {/* SEARCH & FILTERS */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by teacher name, email or class..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 outline-none transition-all"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500/40 outline-none"
          >
            <option value="all">All Teachers ({teachers.length})</option>
            <option value="active">Active ({teachers.filter(t => t.is_active).length})</option>
            <option value="inactive">Deactivated ({teachers.filter(t => !t.is_active).length})</option>
          </select>
        </div>

        {/* TEACHER LIST */}
        {filteredTeachers.length === 0 ? (
          <div className="text-center py-16 px-4 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
            <Users className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-1">No teachers found</h3>
            <p className="text-sm text-slate-400 mb-4">
              {searchQuery ? 'Try adjusting your search query' : 'Get started by creating your first teacher'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-indigo-700 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                + Add Teacher
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredTeachers.map((t, idx) => (
              <div
                key={t.id}
                className={`bg-slate-900/70 backdrop-blur border ${
                  t.is_active ? 'border-slate-800 hover:border-slate-700' : 'border-red-900/30 opacity-70'
                } p-4 sm:p-5 rounded-2xl space-y-4 transition-all animate-slide-up`}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                {/* Header info */}
                <div className="flex items-start gap-3">
                  <StudentAvatar name={t.full_name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white truncate">{t.full_name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        t.is_active ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-800/40' : 'bg-red-900/40 text-red-300 border border-red-800/40'
                      }`}>
                        {t.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{t.email}</p>
                  </div>
                </div>

                {/* Class Assignment Badge */}
                <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-slate-400">Assigned Class</span>
                  {t.assigned_class_name ? (
                    <span className="text-xs font-semibold text-indigo-400 bg-indigo-950/50 border border-indigo-800/50 px-2.5 py-1 rounded-lg">
                      {t.assigned_class_name}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 italic">No class assigned</span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/60">
                  <button
                    onClick={() => setResetModal({ show: true, teacher: t })}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                    title="Generate a new password for this teacher"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    <span>Reset Pass</span>
                  </button>

                  <button
                    onClick={() => setReassignModal({ show: true, teacher: t, selectedClassId: t.assigned_class_id || '' })}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                    title="Assign or move to another class"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 text-blue-400" />
                    <span>Assign Class</span>
                  </button>

                  <button
                    onClick={() => setToggleModal({ show: true, teacher: t })}
                    className={`p-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      t.is_active
                        ? 'bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-900/40'
                        : 'bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 border border-indigo-900/40'
                    }`}
                  >
                    {t.is_active ? (
                      <>
                        <UserX className="w-3.5 h-3.5 text-red-400" />
                        <span>Deactivate</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Reactivate</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ═══════════ MODALS ═══════════ */}

      {/* CREATE TEACHER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl w-full max-w-md space-y-4 animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                Add New Teacher
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTeacher} className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ustaz Mashhood"
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500/40 outline-none text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. mashhood@elkanemi.school"
                  value={createEmail}
                  onChange={e => setCreateEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500/40 outline-none text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Assign Class (Optional)</label>
                <select
                  value={createClassId}
                  onChange={e => setCreateClassId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500/40 outline-none text-sm"
                >
                  <option value="">-- No class (assign later) --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.display_name_en} {c.teacher_name ? `(Currently: ${c.teacher_name})` : '(Vacant)'}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Assigning a class with an existing teacher will replace and deactivate the previous teacher.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 p-2.5 rounded-xl font-medium transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-indigo-700 hover:bg-indigo-600 text-white p-2.5 rounded-xl font-semibold transition-colors text-sm flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PASSWORD REVEAL MODAL */}
      {passwordReveal.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-indigo-800/60 p-6 rounded-2xl w-full max-w-md space-y-4 animate-slide-up shadow-2xl">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-indigo-900/40 text-indigo-400 rounded-full flex items-center justify-center mx-auto border border-indigo-800/50">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-white">
                {passwordReveal.isReset ? 'Password Reset Successfully' : 'Teacher Account Created'}
              </h3>
              <p className="text-xs text-slate-400">
                Share these login credentials with <strong className="text-white">{passwordReveal.teacherName}</strong>
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2.5">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Email</p>
                <p className="text-sm font-mono text-slate-200">{passwordReveal.teacherEmail}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">Temporary Password</p>
                <p className="text-base font-mono font-bold text-indigo-400 select-all">{passwordReveal.password}</p>
              </div>
            </div>

            <button
              onClick={copyPassword}
              className={`w-full p-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                copied
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-700 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Credentials</span>
                </>
              )}
            </button>

            <button
              onClick={() => setPasswordReveal(prev => ({ ...prev, show: false }))}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 p-2.5 rounded-xl font-medium text-xs transition-colors"
            >
              Done / Close
            </button>
          </div>
        </div>
      )}

      {/* RESET PASSWORD CONFIRMATION MODAL */}
      {resetModal.show && resetModal.teacher && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setResetModal({ show: false, teacher: null })}>
          <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl w-full max-w-md space-y-3 animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-400" />
              Reset Teacher Password
            </h3>
            <p className="text-sm text-slate-300">
              Generate a brand new password for <span className="font-semibold text-white">{resetModal.teacher.full_name}</span>?
            </p>
            <p className="text-xs text-slate-500">
              Their old password will immediately stop working.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setResetModal({ show: false, teacher: null })}
                disabled={isSubmitting}
                className="flex-1 bg-slate-700 hover:bg-slate-600 p-2.5 rounded-xl font-medium transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={isSubmitting}
                className="flex-1 bg-amber-700 hover:bg-amber-600 text-white p-2.5 rounded-xl font-semibold transition-colors text-sm flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate New Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REASSIGN CLASS MODAL */}
      {reassignModal.show && reassignModal.teacher && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setReassignModal({ show: false, teacher: null, selectedClassId: '' })}>
          <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl w-full max-w-md space-y-4 animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-blue-400" />
              Assign Class
            </h3>
            <p className="text-sm text-slate-300">
              Select the class to assign to <strong className="text-white">{reassignModal.teacher.full_name}</strong>:
            </p>

            <select
              value={reassignModal.selectedClassId}
              onChange={e => setReassignModal(prev => ({ ...prev, selectedClassId: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500/40 outline-none text-sm"
            >
              <option value="">-- Select Class --</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.display_name_en} {c.teacher_name ? `(Currently: ${c.teacher_name})` : '(Vacant)'}
                </option>
              ))}
            </select>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setReassignModal({ show: false, teacher: null, selectedClassId: '' })}
                disabled={isSubmitting}
                className="flex-1 bg-slate-700 hover:bg-slate-600 p-2.5 rounded-xl font-medium transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleReassignClass}
                disabled={isSubmitting || !reassignModal.selectedClassId}
                className="flex-1 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white p-2.5 rounded-xl font-semibold transition-colors text-sm flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOGGLE STATUS MODAL */}
      {toggleModal.show && toggleModal.teacher && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setToggleModal({ show: false, teacher: null })}>
          <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl w-full max-w-md space-y-3 animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className={`font-bold text-lg ${toggleModal.teacher.is_active ? 'text-red-400' : 'text-indigo-400'} flex items-center gap-2`}>
              <AlertTriangle className="w-5 h-5" />
              {toggleModal.teacher.is_active ? 'Deactivate Teacher' : 'Reactivate Teacher'}
            </h3>
            <p className="text-sm text-slate-300">
              Are you sure you want to {toggleModal.teacher.is_active ? 'deactivate' : 'reactivate'}{' '}
              <strong className="text-white">{toggleModal.teacher.full_name}</strong>?
            </p>
            {toggleModal.teacher.is_active && (
              <p className="text-xs text-slate-500">
                This will unassign them from their class and prevent them from logging in.
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setToggleModal({ show: false, teacher: null })}
                disabled={isSubmitting}
                className="flex-1 bg-slate-700 hover:bg-slate-600 p-2.5 rounded-xl font-medium transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleToggleStatus}
                disabled={isSubmitting}
                className={`flex-1 p-2.5 rounded-xl font-semibold transition-colors text-sm text-white flex items-center justify-center gap-2 ${
                  toggleModal.teacher.is_active ? 'bg-red-700 hover:bg-red-600' : 'bg-indigo-700 hover:bg-indigo-600'
                }`}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : toggleModal.teacher.is_active ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
