'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  Loader2, Building2, Users, Calendar, AlertTriangle, Settings,
  FileText, X, BookOpen, ChevronRight, Clock, LogOut, RefreshCw,
  Search, TrendingUp, UserCog, FolderEdit
} from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { SchoolPerformanceReportPDF } from '@/components/pdf/SchoolPerformanceReport'
import { useToast } from '@/components/Toast'
import { StudentAvatar } from '@/components/ui/StudentAvatar'
import { useEscapeKey } from '@/hooks/useEscapeKey'

/* ─────────── Constants ─────────── */

const TOTAL_QURAN_PAGES = 604
const DEFAULT_TARGET_SAFHAS = 6

/* ─────────── Types ─────────── */

type ClassPerformance = {
  class_id: string
  display_name_en: string
  total_students: number
  avg_safhas: number | null
  percent_on_target: number | null
  target_safhas?: number
}

type CompletionForecast = {
  classId: string
  className: string
  totalStudents: number
  avgWeeksRemaining: number | null
  projectedDate: string | null
  pace: 'accelerating' | 'steady' | 'declining' | 'no data'
  avgCurrentPage: number
}

/* ─────────── Helpers ─────────── */

const getTimeGreeting = (): string => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/* ─────────── Main Component ─────────── */

export default function AdminDashboard() {
  const router = useRouter()
  const { toast } = useToast()

  // Core state
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [barsVisible, setBarsVisible] = useState(false)
  const [hasAnimatedOnce, setHasAnimatedOnce] = useState(false)

  // Admin info
  const [adminName, setAdminName] = useState('')
  const [greeting, setGreeting] = useState('Welcome')

  // Data
  const [classes, setClasses] = useState<ClassPerformance[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [atRiskStudents, setAtRiskStudents] = useState<any[]>([])
  const [termData, setTermData] = useState<any>(null)
  const [completionData, setCompletionData] = useState<CompletionForecast[]>([])

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [showAtRiskModal, setShowAtRiskModal] = useState(false)
  const [showTermModal, setShowTermModal] = useState(false)
  const [tempTermData, setTempTermData] = useState<any>(null)
  const [savingTerm, setSavingTerm] = useState(false)

  const [selectedClass, setSelectedClass] = useState<ClassPerformance | null>(null)
  const [classStudents, setClassStudents] = useState<any[]>([])
  const [showClassModal, setShowClassModal] = useState(false)
  const [classStudentsLoading, setClassStudentsLoading] = useState(false)

  const [showReportModal, setShowReportModal] = useState(false)
  const [principalName, setPrincipalName] = useState('')
  const [isEndOfTerm, setIsEndOfTerm] = useState(false)
  const [generating, setGenerating] = useState(false)

  /* ─────────── Escape key ─────────── */

  const closeAllModals = useCallback(() => {
    if (showClassModal) return setShowClassModal(false)
    if (showAtRiskModal) return setShowAtRiskModal(false)
    if (showTermModal) return setShowTermModal(false)
    if (showReportModal) return setShowReportModal(false)
  }, [showClassModal, showAtRiskModal, showTermModal, showReportModal])

  useEscapeKey(closeAllModals)

  /* ─────────── Greeting Timer ─────────── */

  useEffect(() => {
    setGreeting(getTimeGreeting())
    const interval = setInterval(() => setGreeting(getTimeGreeting()), 60000)
    return () => clearInterval(interval)
  }, [])

  /* ─────────── Initialize ─────────── */

  useEffect(() => { initialize() }, [])

  async function initialize() {
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) {
        router.push('/login')
        return
      }

      const rawName = user.user_metadata?.full_name
        || user.email?.split('@')[0]
        || 'Principal'
      const formattedName = rawName.toLowerCase().includes('principal') || rawName.toLowerCase().includes('admin')
        ? rawName
        : `Principal ${rawName.charAt(0).toUpperCase() + rawName.slice(1)}`
      setAdminName(formattedName)
      setPrincipalName(formattedName)

      await loadData(true)
    } catch (err) {
      console.error('Initialize error:', err)
      toast('error', 'Failed to load dashboard')
      setLoading(false)
    }
  }

  /* ─────────── Load Data (parallelized) ─────────── */

  async function loadData(isFirstLoad = false) {
    try {
      if (!isFirstLoad) setRefreshing(true)

      const [
        performanceRes,
        studentCountRes,
        riskRes,
        termRes,
        settingsRes,
      ] = await Promise.all([
        supabase.from('class_detailed_performance').select('*'),
        supabase.rpc('get_total_students').then((r: any) => r, () => ({ data: null })),
        supabase.from('students_at_risk').select('*'),
        supabase.from('academic_terms').select('*').eq('is_active', true).limit(1),
        supabase.from('class_settings').select('class_id, target_safhas_per_week'),
      ])

      const targetsMap = new Map<string, number>()
      settingsRes.data?.forEach((s: any) => {
        targetsMap.set(s.class_id, s.target_safhas_per_week)
      })

      const filtered = (performanceRes.data || [])
        .filter((c: any) => c.total_students > 0)
        .map((c: any) => ({
          ...c,
          target_safhas: targetsMap.get(c.class_id) || DEFAULT_TARGET_SAFHAS,
        }))
        .sort((a: any, b: any) => (b.avg_safhas || 0) - (a.avg_safhas || 0))

      setClasses(filtered)

      if (studentCountRes?.data !== null && studentCountRes?.data !== undefined) {
        setTotalStudents(studentCountRes.data)
      } else {
        const total = filtered.reduce((sum: number, c: any) => sum + (c.total_students || 0), 0)
        setTotalStudents(total)
      }

      const sortedRisk = (riskRes.data || []).sort(
        (a: any, b: any) => (b.red_weeks || 0) - (a.red_weeks || 0)
      )
      setAtRiskStudents(sortedRisk)

      setTermData(termRes.data?.[0] || null)

      await fetchCompletionData()

      if (isFirstLoad && !hasAnimatedOnce) {
        setTimeout(() => {
          setBarsVisible(true)
          setHasAnimatedOnce(true)
        }, 100)
      } else if (!barsVisible) {
        setBarsVisible(true)
      }
    } catch (err) {
      console.error('Load data error:', err)
      toast('error', 'Failed to load dashboard data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  /* ─────────── Completion Forecast ─────────── */

  async function fetchCompletionData() {
    try {
      const [studentsRes, classesRes] = await Promise.all([
        supabase.from('students').select('id, full_name, current_page, class_id').eq('status', 'active'),
        supabase.from('classes').select('id, display_name_en'),
      ])

      const students = studentsRes.data
      if (!students?.length) {
        setCompletionData([])
        return
      }

      const classMap = new Map(classesRes.data?.map((c: any) => [c.id, c.display_name_en]) || [])

      const { data: progress } = await supabase
        .from('weekly_progress')
        .select('student_id, start_safha, end_safha, week_start')
        .eq('hifz_type', 'hifz')
        .in('student_id', students.map(s => s.id))
        .order('week_start', { ascending: false })

      const progressByStudent = new Map<string, any[]>()
      progress?.forEach(p => {
        if (!progressByStudent.has(p.student_id)) progressByStudent.set(p.student_id, [])
        progressByStudent.get(p.student_id)!.push(p)
      })

      const studentMetrics = students
        .filter(s => classMap.has(s.class_id))
        .map(s => {
          const entries = (progressByStudent.get(s.id) || []).slice(0, 8)
          const recent = entries.slice(0, 3)

          const avgOverall = entries.length
            ? entries.reduce((a, p) => a + Math.max(0, p.end_safha - p.start_safha + 1), 0) / entries.length
            : 0

          const avgRecent = recent.length
            ? recent.reduce((a, p) => a + Math.max(0, p.end_safha - p.start_safha + 1), 0) / recent.length
            : 0

          const pagesRemaining = Math.max(TOTAL_QURAN_PAGES - (s.current_page || 1), 0)
          const weeksRemaining = avgOverall > 0 ? Math.ceil(pagesRemaining / avgOverall) : null

          let projectedDate: string | null = null
          if (weeksRemaining !== null) {
            const d = new Date()
            d.setDate(d.getDate() + weeksRemaining * 7)
            projectedDate = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
          }

          let pace: CompletionForecast['pace'] = 'no data'
          if (avgOverall > 0 && avgRecent > 0) {
            const ratio = avgRecent / avgOverall
            if (ratio >= 1.1) pace = 'accelerating'
            else if (ratio <= 0.9) pace = 'declining'
            else pace = 'steady'
          }

          return {
            studentId: s.id,
            className: classMap.get(s.class_id) as string,
            classId: s.class_id,
            currentPage: s.current_page || 1,
            weeksRemaining,
            projectedDate,
            pace,
          }
        })

      const byClass = new Map<string, any[]>()
      studentMetrics.forEach(m => {
        if (!byClass.has(m.classId)) byClass.set(m.classId, [])
        byClass.get(m.classId)!.push(m)
      })

      const classCompletion: CompletionForecast[] = Array.from(byClass.entries()).map(([classId, metrics]) => {
        const withData = metrics.filter(m => m.weeksRemaining !== null && !isNaN(m.weeksRemaining))
        const avgWeeks = withData.length
          ? Math.round(withData.reduce((a, m) => a + m.weeksRemaining, 0) / withData.length)
          : null

        let projectedDate: string | null = null
        if (avgWeeks !== null) {
          const d = new Date()
          d.setDate(d.getDate() + avgWeeks * 7)
          projectedDate = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
        }

        const paceCount = { accelerating: 0, steady: 0, declining: 0 }
        metrics.forEach(m => {
          if (m.pace !== 'no data') paceCount[m.pace as keyof typeof paceCount]++
        })
        const dominantPace = Object.entries(paceCount).sort((a, b) => b[1] - a[1])[0][0] as CompletionForecast['pace']

        return {
          classId,
          className: metrics[0].className,
          totalStudents: metrics.length,
          avgWeeksRemaining: avgWeeks,
          projectedDate,
          pace: dominantPace,
          avgCurrentPage: Math.round(metrics.reduce((a, m) => a + m.currentPage, 0) / metrics.length),
        }
      })
        .filter(c => c.totalStudents > 0)
        .sort((a, b) => (a.avgWeeksRemaining ?? 9999) - (b.avgWeeksRemaining ?? 9999))

      setCompletionData(classCompletion)
    } catch (err) {
      console.error('Completion forecast error:', err)
    }
  }

  /* ─────────── Class Summary ─────────── */

  async function openClassSummary(c: ClassPerformance) {
    setSelectedClass(c)
    setShowClassModal(true)
    setClassStudents([])
    setClassStudentsLoading(true)

    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, current_hizb, current_page, status')
        .eq('class_id', c.class_id)
        .eq('status', 'active')
        .order('full_name')

      if (error) throw error

      const studentIds = (data || []).map(s => s.id)
      const progressMap = new Map()

      if (studentIds.length > 0) {
        const { data: progressData } = await supabase
          .from('weekly_progress')
          .select('student_id, end_surah, week_start')
          .in('student_id', studentIds)
          .order('week_start', { ascending: false })

        progressData?.forEach((p: any) => {
          if (!progressMap.has(p.student_id)) progressMap.set(p.student_id, p)
        })
      }

      const enriched = (data || []).map((s: any) => ({
        ...s,
        latest_surah: progressMap.get(s.id)?.end_surah || null,
      }))

      setClassStudents(enriched)
    } catch (err) {
      console.error(err)
      toast('error', 'Failed to load class details')
    } finally {
      setClassStudentsLoading(false)
    }
  }

  /* ─────────── Save Term ─────────── */

  function openTermModal() {
    setTempTermData({ ...termData })
    setShowTermModal(true)
  }

  async function saveTerm() {
    if (!tempTermData?.name?.trim()) {
      toast('warning', 'Term name is required')
      return
    }
    if (!tempTermData.current_week || tempTermData.current_week < 1) {
      toast('warning', 'Week must be at least 1')
      return
    }

    setSavingTerm(true)
    try {
      const { error } = await supabase.rpc('update_active_term', {
        new_name: tempTermData.name.trim(),
        new_week: Number(tempTermData.current_week),
      })
      if (error) throw error
      setShowTermModal(false)
      await loadData()
      toast('success', 'Term updated successfully')
    } catch (err: any) {
      console.error(err)
      toast('error', `Failed to update term: ${err.message}`)
    } finally {
      setSavingTerm(false)
    }
  }

  /* ─────────── Generate School Report ─────────── */

  async function generateSchoolReport() {
    if (!principalName.trim()) {
      toast('warning', 'Please enter Principal name')
      return
    }

    setGenerating(true)
    toast('info', 'Generating school report...')

    try {
      const [classesRes, riskRes] = await Promise.all([
        supabase.from('class_detailed_performance').select('*').filter('total_students', 'gt', 0),
        supabase.from('students_at_risk').select('*'),
      ])

      const sorted = (classesRes.data || []).sort(
        (a: any, b: any) => (b.avg_safhas || 0) - (a.avg_safhas || 0)
      )

      const blob = await pdf(
        <SchoolPerformanceReportPDF
          principalName={principalName}
          classes={sorted}
          atRiskStudents={riskRes.data || []}
          termName={termData?.name || ''}
          currentWeek={termData?.current_week || 1}
          totalStudents={totalStudents}
          isEndOfTerm={isEndOfTerm}
        />
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `School_Report_Week${termData?.current_week || ''}.pdf`
      link.click()
      URL.revokeObjectURL(url)

      setShowReportModal(false)
      toast('success', 'Report downloaded')
    } catch (err: any) {
      console.error(err)
      toast('error', 'PDF generation failed')
    } finally {
      setGenerating(false)
    }
  }

  /* ─────────── Logout ─────────── */

  async function handleLogout() {
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch {
      router.push('/login')
    }
  }

  /* ─────────── Memoized values ─────────── */

  const maxAvg = useMemo(
    () => Math.max(...classes.map(c => c.avg_safhas || 0), 1),
    [classes]
  )

  const filteredClasses = useMemo(
    () => classes.filter(c =>
      c.display_name_en.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [classes, searchQuery]
  )

  const atRiskByClass = useMemo(() => {
    const map = new Map<string, number>()
    atRiskStudents.forEach(s => {
      map.set(s.class_name, (map.get(s.class_name) || 0) + 1)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [atRiskStudents])

  const atRiskPercentage = totalStudents > 0
    ? Math.round((atRiskStudents.length / totalStudents) * 100)
    : 0

  /* ─────────── Loading ─────────── */

  if (loading) {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/30 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-indigo-500 w-8 h-8" />
        <p className="text-sm text-slate-400">Loading admin dashboard...</p>
      </div>
    )
  }

  /* ─────────── Render ─────────── */

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/30 text-white">

      {/* ═══════════ HEADER ═══════════ */}
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-30">
        <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">

          {/* Top Row: Logo + Greeting + Icons */}
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 bg-indigo-900/30 rounded-xl flex items-center justify-center border border-indigo-800/30 shrink-0">
                <img
                  src="/logo/logo.png"
                  className="w-9 h-9 object-contain"
                  alt="Logo"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold truncate">El-Kanemi College of Islamic Theology</h1>
                <p className="text-xs sm:text-sm font-medium text-indigo-400 flex items-center gap-1.5">
                  <span>{greeting},</span>
                  <span className="font-semibold text-white truncate max-w-[140px] sm:max-w-none">{adminName}</span>
                  <span>👋</span>
                </p>
              </div>
            </div>

            {/* Icon buttons */}
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => loadData()}
                disabled={refreshing}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleLogout}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Action Row: Badge + Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <span className="text-xs bg-purple-900/30 text-purple-300 px-3 py-1 rounded-full border border-purple-800/50 inline-flex items-center gap-1.5">
              🎓 Administrator Dashboard
            </span>

            <div className="flex gap-2 w-full sm:w-auto">
              <Link
                href="/dashboard/admin/classes"
                className="bg-indigo-800 hover:bg-indigo-700 px-4 py-2.5 rounded-xl flex items-center gap-2 justify-center font-semibold text-sm transition-colors shadow-lg shadow-indigo-950/20 text-white flex-1 sm:flex-none"
              >
                <FolderEdit className="w-4 h-4" />
                <span className="hidden sm:inline">Manage Classes</span>
                <span className="sm:hidden">Classes</span>
              </Link>

              <Link
                href="/dashboard/admin/teachers"
                className="bg-blue-700 hover:bg-blue-600 px-4 py-2.5 rounded-xl flex items-center gap-2 justify-center font-semibold text-sm transition-colors shadow-lg shadow-blue-900/20 text-white flex-1 sm:flex-none"
              >
                <UserCog className="w-4 h-4" />
                <span className="hidden sm:inline">Manage Teachers</span>
                <span className="sm:hidden">Teachers</span>
              </Link>

              <button
                onClick={() => setShowReportModal(true)}
                className="bg-indigo-700 hover:bg-indigo-600 px-4 py-2.5 rounded-xl flex items-center gap-2 justify-center font-semibold text-sm transition-colors shadow-lg shadow-indigo-900/20 flex-1 sm:flex-none"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Generate Report</span>
                <span className="sm:hidden">Report</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════ MAIN ═══════════ */}
      <main className="p-4 sm:p-6 space-y-6 pb-24 max-w-6xl mx-auto">

        {/* ─── Overview Stats ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<Building2 className="w-4 h-4" />}
            value={classes.length}
            label="Active Classes"
            color="blue"
            index={0}
          />
          <StatCard
            icon={<Users className="w-4 h-4" />}
            value={totalStudents}
            label="Total Students"
            color="indigo"
            index={1}
          />
          <StatCard
            icon={<Calendar className="w-4 h-4" />}
            value={`W${termData?.current_week || 1}`}
            label={termData?.name || 'Academic Term'}
            color="purple"
            index={2}
            action={
              <button
                onClick={openTermModal}
                className="mt-2 text-[10px] text-purple-300 hover:text-purple-200 flex items-center gap-1 transition-colors"
              >
                <Settings className="w-3 h-3" />
                Manage
              </button>
            }
          />
          <StatCard
            icon={<AlertTriangle className="w-4 h-4" />}
            value={atRiskStudents.length}
            label="At-Risk"
            color="red"
            index={3}
            subtext={totalStudents > 0 ? `${atRiskPercentage}%` : undefined}
            onClick={() => setShowAtRiskModal(true)}
          />
        </div>

        {/* ─── Search Bar (if enough classes) ─── */}
        {classes.length >= 5 && (
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search classes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 outline-none transition-all"
            />
          </div>
        )}

        {/* ─── Class Leaderboard ─── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">Class Performance Leaderboard</h2>
          </div>

          {classes.length === 0 ? (
            <EmptyStateBox
              icon={<Building2 className="w-8 h-8 text-slate-700" />}
              title="No active classes"
              description="Classes will appear here once students are enrolled"
            />
          ) : filteredClasses.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No classes match "<span className="text-white">{searchQuery}</span>"
            </div>
          ) : (
            <div className="space-y-2">
              {filteredClasses.map((c, index) => {
                const barPct = ((c.avg_safhas || 0) / maxAvg) * 100
                const target = c.target_safhas || DEFAULT_TARGET_SAFHAS
                const onTarget = (c.avg_safhas || 0) >= target
                const barColor = onTarget
                  ? '#10b981'
                  : (c.avg_safhas || 0) >= Math.floor(target * 0.66)
                  ? '#f59e0b'
                  : '#ef4444'
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`

                return (
                  <div
                    key={c.class_id}
                    onClick={() => openClassSummary(c)}
                    className="bg-slate-900/60 backdrop-blur rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-800/60 transition-all overflow-hidden group animate-slide-up"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className="relative">
                      <div
                        className="absolute top-0 left-0 h-full opacity-10 transition-all duration-700 ease-out"
                        style={{
                          width: barsVisible ? `${barPct}%` : '0%',
                          backgroundColor: barColor,
                        }}
                      />

                      <div className="relative p-4 flex justify-between items-center gap-2">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-xl shrink-0">{medal}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold group-hover:text-indigo-300 transition-colors truncate">
                              {c.display_name_en}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <p className="text-xs text-slate-400">{c.total_students} students</p>
                              <span className="text-slate-600">·</span>
                              <p className="text-xs font-medium" style={{ color: barColor }}>
                                {onTarget ? '✓ On Target' : 'Below Target'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-lg font-bold text-indigo-400">
                              {c.avg_safhas?.toFixed(1) || '0'}
                            </p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                              of {target}/wk
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition-colors" />
                        </div>
                      </div>

                      <div className="h-1 bg-slate-800">
                        <div
                          className="h-1 transition-all duration-700 ease-out"
                          style={{
                            width: barsVisible ? `${barPct}%` : '0%',
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ─── Completion Forecast ─── */}
        {completionData.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold">Completion Forecast</h2>
              <span className="text-xs text-slate-500 ml-1">— at current pace</span>
            </div>

            <div className="space-y-2">
              {completionData.map((c, idx) => {
                const paceColor = c.pace === 'accelerating' ? 'text-indigo-400'
                  : c.pace === 'declining' ? 'text-red-400'
                  : c.pace === 'steady' ? 'text-blue-400'
                  : 'text-slate-500'
                const paceIcon = c.pace === 'accelerating' ? '↑'
                  : c.pace === 'declining' ? '↓'
                  : c.pace === 'steady' ? '→'
                  : '—'
                const pctDone = Math.round((c.avgCurrentPage / TOTAL_QURAN_PAGES) * 100)

                return (
                  <div
                    key={c.classId}
                    className="bg-slate-900/60 backdrop-blur p-4 rounded-xl border border-slate-800 animate-slide-up"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{c.className}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {c.totalStudents} students • Avg page {c.avgCurrentPage}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {c.avgWeeksRemaining !== null ? (
                          <>
                            <p className="text-lg font-bold text-blue-400">
                              {c.avgWeeksRemaining}<span className="text-xs text-slate-400 font-normal"> wks</span>
                            </p>
                            <p className="text-[10px] text-slate-500">Est. {c.projectedDate}</p>
                          </>
                        ) : (
                          <p className="text-xs text-slate-500">No data yet</p>
                        )}
                      </div>
                    </div>

                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700"
                        style={{ width: `${pctDone}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center mt-2">
                      <p className="text-[10px] text-slate-500">{pctDone}% complete</p>
                      <p className={`text-[10px] font-semibold ${paceColor}`}>
                        {paceIcon} {c.pace.charAt(0).toUpperCase() + c.pace.slice(1)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>

      {/* ═══════════ MODALS ═══════════ */}

      {/* Class Summary Modal */}
      {showClassModal && selectedClass && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4" onClick={() => setShowClassModal(false)}>
          <div
            className="bg-slate-900 rounded-2xl w-full max-w-2xl border border-slate-800 flex flex-col max-h-[90vh] animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold">{selectedClass.display_name_en}</h3>
                <div className="flex gap-3 mt-1 flex-wrap">
                  <p className="text-xs text-slate-400">{selectedClass.total_students} students</p>
                  <p className="text-xs text-indigo-400">
                    Avg {selectedClass.avg_safhas?.toFixed(1) || '0'} safhas/wk
                  </p>
                  <p className="text-xs text-blue-400">
                    {selectedClass.percent_on_target?.toFixed(0) || 0}% on target
                  </p>
                </div>
              </div>
              <button onClick={() => setShowClassModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-2">
              {classStudentsLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-indigo-500 w-6 h-6" />
                </div>
              ) : classStudents.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-10">No active students.</p>
              ) : (
                classStudents.map((s: any) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-3 hover:border-slate-700 transition-colors"
                  >
                    <StudentAvatar name={s.full_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.full_name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <BookOpen className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="text-xs text-slate-400 truncate">
                          {s.latest_surah || 'Not yet logged'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs bg-indigo-900/30 text-indigo-300 px-2 py-1 rounded-lg font-semibold border border-indigo-800/30">
                        P. {s.current_page || 1}
                      </span>
                      <p className="text-[10px] text-slate-500 mt-1">Juz {s.current_hizb || 1}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* At-Risk Modal */}
      {showAtRiskModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4" onClick={() => setShowAtRiskModal(false)}>
          <div
            className="bg-slate-900 rounded-2xl w-full max-w-2xl border border-red-800/50 flex flex-col max-h-[90vh] animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-red-400">At-Risk Students</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {atRiskStudents.length} of {totalStudents} students ({atRiskPercentage}%)
                </p>
              </div>
              <button onClick={() => setShowAtRiskModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-3">
              {atRiskStudents.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-4xl mb-2">🎉</div>
                  <p className="text-indigo-400 font-semibold">No at-risk students!</p>
                  <p className="text-xs text-slate-500 mt-1">Everyone is on track</p>
                </div>
              ) : (
                <>
                  <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">By Class</p>
                    <div className="space-y-1.5">
                      {atRiskByClass.map(([className, count]) => (
                        <div key={className} className="flex justify-between items-center text-sm">
                          <span className="text-slate-300 truncate">{className}</span>
                          <span className="text-red-400 font-semibold shrink-0 ml-2">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {atRiskStudents.map((s: any) => (
                      <div
                        key={s.student_id}
                        className="p-3 rounded-xl bg-slate-950/60 border border-red-900/30 flex items-center gap-3"
                      >
                        <StudentAvatar name={s.full_name} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{s.full_name}</p>
                          <p className="text-xs text-slate-400 truncate">{s.class_name}</p>
                        </div>
                        <span className="text-xs bg-red-900/40 text-red-300 px-2 py-1 rounded-lg font-semibold border border-red-800/40 shrink-0">
                          {s.red_weeks} red wk{s.red_weeks !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Term Modal */}
      {showTermModal && tempTermData && (
        <Modal onClose={() => !savingTerm && setShowTermModal(false)} title="Manage Academic Term">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5 font-medium">Term Name</label>
              <input
                value={tempTermData.name || ''}
                onChange={(e) => setTempTermData({ ...tempTermData, name: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500/40 outline-none"
                placeholder="e.g. Term 1 - 2024/2025"
                disabled={savingTerm}
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1.5 font-medium">Current Week</label>
              <input
                type="number"
                min={1}
                max={52}
                value={tempTermData.current_week || 1}
                onChange={(e) => setTempTermData({ ...tempTermData, current_week: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-lg font-bold text-center focus:ring-2 focus:ring-indigo-500/40 outline-none"
                disabled={savingTerm}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setShowTermModal(false)}
              disabled={savingTerm}
              className="flex-1 bg-slate-700 hover:bg-slate-600 p-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={saveTerm}
              disabled={savingTerm}
              className="flex-1 bg-indigo-700 hover:bg-indigo-600 p-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {savingTerm ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : 'Save'}
            </button>
          </div>
        </Modal>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <Modal onClose={() => !generating && setShowReportModal(false)} title="Generate School Report">
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Principal Name</label>
              <input
                value={principalName}
                onChange={(e) => setPrincipalName(e.target.value)}
                placeholder="Enter Principal name"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500/40 outline-none"
                disabled={generating}
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-2 font-medium">Report Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEndOfTerm(false)}
                  disabled={generating}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50 ${
                    !isEndOfTerm
                      ? 'bg-indigo-700 border-indigo-500 text-white shadow-md'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  📊 Weekly
                </button>
                <button
                  type="button"
                  onClick={() => setIsEndOfTerm(true)}
                  disabled={generating}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50 ${
                    isEndOfTerm
                      ? 'bg-amber-700 border-amber-500 text-white shadow-md'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  📋 End of Term
                </button>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowReportModal(false)}
                disabled={generating}
                className="flex-1 bg-slate-700 hover:bg-slate-600 p-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={generateSchoolReport}
                disabled={generating}
                className={`flex-1 p-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                  isEndOfTerm ? 'bg-amber-700 hover:bg-amber-600' : 'bg-indigo-700 hover:bg-indigo-600'
                }`}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : 'Generate PDF'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950/80 backdrop-blur-md py-2.5 text-center z-30">
        <p className="text-[10px] text-slate-600 tracking-widest uppercase">Alfirdaus Technologies Ltd</p>
      </footer>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function StatCard({ icon, value, label, color, subtext, action, onClick, index }: {
  icon: React.ReactNode
  value: string | number
  label: string
  color: 'blue' | 'indigo' | 'red' | 'purple'
  subtext?: string
  action?: React.ReactNode
  onClick?: () => void
  index?: number
}) {
  const colors = {
    blue: 'border-l-blue-500 text-blue-400 bg-blue-900/30',
    indigo: 'border-l-indigo-500 text-indigo-400 bg-indigo-900/30',
    red: 'border-l-red-500 text-red-400 bg-red-900/30',
    purple: 'border-l-purple-500 text-purple-400 bg-purple-900/30',
  }

  return (
    <div
      onClick={onClick}
      className={`bg-slate-900/60 backdrop-blur border border-slate-800 border-l-4 ${colors[color].split(' ')[0]} p-3 sm:p-4 rounded-xl ${onClick ? 'cursor-pointer hover:bg-slate-800/60' : ''} transition-all animate-slide-up`}
      style={{ animationDelay: `${(index || 0) * 60}ms` }}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${colors[color].split(' ').slice(1).join(' ')}`}>
        {icon}
      </div>
      <p className="text-lg sm:text-xl font-bold">{value}</p>
      <div className="flex items-baseline gap-1">
        <p className="text-xs text-slate-400 truncate">{label}</p>
        {subtext && <span className="text-[10px] text-slate-500 shrink-0">· {subtext}</span>}
      </div>
      {action}
    </div>
  )
}

function EmptyStateBox({ icon, title, description }: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="text-center py-12 px-4 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
      <div className="w-16 h-16 mx-auto bg-slate-800/60 rounded-full flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  )
}

function Modal({ children, onClose, title }: {
  children: React.ReactNode
  onClose: () => void
  title: string
}) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl w-full max-w-md space-y-3 animate-slide-up shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
