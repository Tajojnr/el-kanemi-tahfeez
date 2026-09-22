'use client'

import { useEffect, useState, useMemo, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { pdf } from '@react-pdf/renderer'
import { StudentReportPDF } from '@/components/pdf/StudentReport'
import { useToast } from '@/components/Toast'
import { StudentAvatar } from '@/components/ui/StudentAvatar'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import {
  ArrowLeft, BookOpen, Award, Share2, FileText,
  Loader2, History, Clock
} from 'lucide-react'

// Madani Mus'haf Juz boundaries
const JUZ_PAGES = [
  { juz: 1, start: 1, end: 21, name: 'Al-Fatihah' },
  { juz: 2, start: 22, end: 41, name: 'Sayaqool' },
  { juz: 3, start: 42, end: 61, name: 'Tilka ar-Rusul' },
  { juz: 4, start: 62, end: 81, name: 'Lan Tanaloo' },
  { juz: 5, start: 82, end: 101, name: 'Wal Muhsanat' },
  { juz: 6, start: 102, end: 121, name: 'La Yuhibbullah' },
  { juz: 7, start: 122, end: 141, name: 'Wa Iza Samiu' },
  { juz: 8, start: 142, end: 161, name: 'Wa Law Annana' },
  { juz: 9, start: 162, end: 181, name: 'Qalal Malao' },
  { juz: 10, start: 182, end: 201, name: 'Wa Alamu' },
  { juz: 11, start: 202, end: 221, name: 'Yatazeroon' },
  { juz: 12, start: 222, end: 241, name: 'Wa Mamin Da’abbah' },
  { juz: 13, start: 242, end: 261, name: 'Wa Ma Ubrioo' },
  { juz: 14, start: 262, end: 281, name: 'Rubama' },
  { juz: 15, start: 282, end: 301, name: 'Subhanallazi' },
  { juz: 16, start: 302, end: 321, name: 'Qala Alam' },
  { juz: 17, start: 322, end: 341, name: 'Iqtaraba' },
  { juz: 18, start: 342, end: 361, name: 'Qad Aflaha' },
  { juz: 19, start: 362, end: 381, name: 'Wa Qalallazina' },
  { juz: 20, start: 382, end: 401, name: 'Amman Khalaqa' },
  { juz: 21, start: 402, end: 421, name: 'Utlu Ma Oohiya' },
  { juz: 22, start: 422, end: 441, name: 'Wa Man Yaqnut' },
  { juz: 23, start: 442, end: 461, name: 'Wa Maliya' },
  { juz: 24, start: 462, end: 481, name: 'Faman Azlamu' },
  { juz: 25, start: 482, end: 501, name: 'Ilayhi Yuraddu' },
  { juz: 26, start: 502, end: 521, name: 'Ha-Meem' },
  { juz: 27, start: 522, end: 541, name: 'Qala Fama Khatbukum' },
  { juz: 28, start: 542, end: 561, name: 'Qad Samiallah' },
  { juz: 29, start: 562, end: 581, name: 'Tabarakallazi' },
  { juz: 30, start: 582, end: 604, name: 'Amma Yatasa’aloon' },
]

export default function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const studentId = resolvedParams.id
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [student, setStudent] = useState<any>(null)
  const [className, setClassName] = useState('')
  const [teacherName, setTeacherName] = useState('')
  const [history, setHistory] = useState<any[]>([])
  const [termName, setTermName] = useState('')
  const [currentWeek, setCurrentWeek] = useState(1)
  const [targetSafhas, setTargetSafhas] = useState(6)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  useEffect(() => {
    loadStudentData()
  }, [studentId])

  async function loadStudentData() {
    try {
      setLoading(true)

      const { data: sData, error: sErr } = await supabase
        .from('students')
        .select('id, full_name, current_hizb, current_page, class_id')
        .eq('id', studentId)
        .single()

      if (sErr || !sData) throw new Error('Student not found')
      setStudent(sData)

      const { data: cData } = await supabase
        .from('classes')
        .select('display_name_en, teacher_name')
        .eq('id', sData.class_id)
        .single()

      if (cData) {
        setClassName(cData.display_name_en)
        setTeacherName(cData.teacher_name || 'Ustaz')
      }

      const { data: sett } = await supabase
        .from('class_settings')
        .select('target_safhas_per_week')
        .eq('class_id', sData.class_id)
        .single()
      if (sett) setTargetSafhas(sett.target_safhas_per_week)

      const { data: tData } = await supabase
        .from('academic_terms')
        .select('name, current_week')
        .eq('is_active', true)
        .limit(1)

      if (tData?.[0]) {
        setTermName(tData[0].name || '')
        setCurrentWeek(tData[0].current_week || 1)
      }

      const { data: pData } = await supabase
        .from('weekly_progress')
        .select('*')
        .eq('student_id', studentId)
        .order('week_start', { ascending: false })

      setHistory(pData || [])
    } catch (err: any) {
      toast('error', err.message || 'Failed to load profile')
      router.push('/dashboard/teacher')
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const hifzLogs = history.filter(p => p.hifz_type === 'hifz')
    const murLogs = history.filter(p => p.hifz_type === 'murajaah')
    const totalSafhas = hifzLogs.reduce((acc, p) => acc + Math.max(0, (p.end_safha || 0) - (p.start_safha || 0) + 1), 0)
    const avgSafhas = hifzLogs.length ? (totalSafhas / hifzLogs.length).toFixed(1) : '0'
    const currentPage = student?.current_page || 1
    const progressPct = Math.min(100, Math.round((currentPage / 604) * 100))

    return { totalSafhas, avgSafhas, hifzCount: hifzLogs.length, murCount: murLogs.length, progressPct }
  }, [history, student])

  const milestones = useMemo(() => {
    const page = student?.current_page || 1
    return [
      { id: 'start', title: 'First Safha', desc: 'Began the noble Quran journey', unlocked: page >= 2, icon: '🌱' },
      { id: 'juz1', title: '1st Juz Milestone', desc: 'Reached 20+ pages', unlocked: page >= 21, icon: '⭐' },
      { id: 'juz5', title: '5 Ajzaa Memorised', desc: 'Completed 100+ pages', unlocked: page >= 101, icon: '🥉' },
      { id: 'juz10', title: '10 Ajzaa (One Third)', desc: 'Completed 200+ pages', unlocked: page >= 201, icon: '🥈' },
      { id: 'half', title: 'Half Quran (15 Ajzaa)', desc: 'Completed 300+ pages', unlocked: page >= 301, icon: '🥇' },
      { id: 'khatm', title: 'Khatmul Quran', desc: 'Complete Mus\'haf memorised', unlocked: page >= 604, icon: '👑' },
    ]
  }, [student])

  function shareToWhatsApp() {
    if (!student) return

    const latestHifz = history.find(p => p.hifz_type === 'hifz')
    const safhasThisWeek = latestHifz ? Math.max(0, latestHifz.end_safha - latestHifz.start_safha + 1) : 0
    const startSurah = latestHifz?.start_surah || 'Al-Fatihah'
    const endSurah = latestHifz?.end_surah || 'Al-Fatihah'
    const notes = latestHifz?.comments || 'Steady progress, masha\'Allah.'

    const message = `*Assalamu Alaikum wa Rahmatullah,* 🌿

Here is the weekly Tahfeez progress update for *${student.full_name}* (*${className}*):

📖 *Weekly Hifz:* ${safhasThisWeek} Safhas (Pages ${latestHifz?.start_safha || 1} to ${latestHifz?.end_safha || 1})
📖 *Surah Range:* ${startSurah} → ${endSurah}
📍 *Current Position:* Juz ${student.current_hizb || 1} · Page ${student.current_page || 1} of 604
🎯 *Progress Target:* ${safhasThisWeek >= targetSafhas ? '✅ Target Met (On Track)' : '⚠️ Below Target'}
📅 *Period:* Week ${currentWeek} (${termName || 'Current Term'})
📝 *Ustaz Remarks:* _"${notes}"_

_May Allah bless ${student.full_name}'s journey in memorising the Holy Quran and grant them steadfastness._ 🤲

— *El-Kanemi College of Islamic Theology*`

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  async function downloadReport() {
    if (!student) return
    setDownloadingPdf(true)
    try {
      const formatted = history.map(p => ({
        weekStart: p.week_start,
        hifzType: p.hifz_type,
        totalSafhas: p.end_safha && p.start_safha ? Math.max(0, p.end_safha - p.start_safha + 1) : 0,
        dangerLevel: p.danger_level || 'safe',
        startSurah: p.start_surah || '-',
        startAyah: p.start_ayah || 1,
        endSurah: p.end_surah || '-',
        endAyah: p.end_ayah || 1,
        comments: p.comments,
      }))

      const blob = await pdf(
        <StudentReportPDF
          studentName={student.full_name}
          className={className}
          teacherName={teacherName}
          academicYear="2024/2025"
          weeklyProgress={formatted}
          targetSafhas={targetSafhas}
          currentWeek={currentWeek}
          termName={termName}
          isEndOfTerm={false}
        />
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${student.full_name.replace(/\s+/g, '_')}_Progress_Report.pdf`
      link.click()
      URL.revokeObjectURL(url)
      toast('success', 'PDF report downloaded')
    } catch {
      toast('error', 'Failed to generate PDF')
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30 text-white pb-24">

      {/* ✅ Premium Loading Overlay injected here */}
      <LoadingOverlay isLoading={loading} text="جاري التحميل | Loading..." />

      {/* HEADER */}
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-30">
        <div className="p-4 sm:p-6 flex justify-between items-center max-w-5xl mx-auto">
          <Link
            href="/dashboard/teacher"
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-slate-300 flex items-center gap-2 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Link>
          <div className="flex gap-2">
            <button
              onClick={shareToWhatsApp}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-950/30"
              title="Share report to parent on WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share to Parent</span>
            </button>
            <button
              onClick={downloadReport}
              disabled={downloadingPdf}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              <span>PDF Report</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

        {/* Profile Hero Card */}
        <div className="bg-slate-900/70 backdrop-blur border border-slate-800 rounded-2xl p-5 sm:p-6 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <StudentAvatar name={student?.full_name || 'Student'} size="lg" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">{student?.full_name}</h1>
                <p className="text-xs text-slate-400 mt-1">
                  {className} · Ustaz: <span className="text-emerald-400 font-medium">{teacherName}</span>
                </p>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 px-4 py-2.5 rounded-xl text-right shrink-0">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Current Position</p>
              <p className="text-lg font-bold text-emerald-400">
                Juz {student?.current_hizb || 1} · Page {student?.current_page || 1}
                <span className="text-xs text-slate-500 font-normal"> / 604</span>
              </p>
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="mt-5 space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-400">Total Quran Memorisation</span>
              <span className="text-emerald-400 font-bold">{stats.progressPct}% Complete ({student?.current_page || 1} of 604 pages)</span>
            </div>
            <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-amber-400 rounded-full transition-all duration-1000"
                style={{ width: `${stats.progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-center">
            <p className="text-2xl font-bold text-emerald-400">{stats.totalSafhas}</p>
            <p className="text-xs text-slate-400 uppercase mt-1 tracking-wide">Total Safhas</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-center">
            <p className="text-2xl font-bold text-emerald-400">{stats.avgSafhas}</p>
            <p className="text-xs text-slate-400 uppercase mt-1 tracking-wide">Avg Safhas/wk</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-center">
            <p className="text-2xl font-bold text-blue-400">{stats.hifzCount}</p>
            <p className="text-xs text-slate-400 uppercase mt-1 tracking-wide">Hifz Sessions</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl text-center">
            <p className="text-2xl font-bold text-purple-400">{stats.murCount}</p>
            <p className="text-xs text-slate-400 uppercase mt-1 tracking-wide">Murajaah Sessions</p>
          </div>
        </div>

        {/* Milestones Badges */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Milestones & Achievements</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            {milestones.map(m => (
              <div
                key={m.id}
                className={`p-3 rounded-xl border text-center transition-all ${
                  m.unlocked
                    ? 'bg-gradient-to-b from-amber-950/30 to-slate-900/80 border-amber-500/50 shadow-lg shadow-amber-950/10'
                    : 'bg-slate-900/30 border-slate-800/60 opacity-40'
                }`}
              >
                <div className="text-2xl mb-1">{m.icon}</div>
                <p className="text-xs font-bold text-white truncate">{m.title}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{m.desc}</p>
                {m.unlocked && (
                  <span className="inline-block mt-2 text-[9px] font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-800/40">
                    Unlocked ✓
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 30-JUZ INTERACTIVE QURAN MAP */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">30-Juz Progress Map</h2>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Completed</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Current</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-700" /> Upcoming</span>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-10 gap-2">
            {JUZ_PAGES.map(j => {
              const currentPage = student?.current_page || 1
              const isCompleted = currentPage >= j.end
              const isCurrent = currentPage >= j.start && currentPage <= j.end

              return (
                <div
                  key={j.juz}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    isCompleted
                      ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-300 shadow-sm'
                      : isCurrent
                      ? 'bg-amber-950/40 border-amber-500 text-amber-300 shadow-md ring-2 ring-amber-500/20'
                      : 'bg-slate-900/40 border-slate-800/60 text-slate-500'
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider">Juz</p>
                  <p className="text-lg font-bold my-0.5">{j.juz}</p>
                  <p className="text-[9px] truncate font-medium">{j.name}</p>
                  <p className="text-[8px] text-slate-400 mt-1">P.{j.start}-{j.end}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* Evaluation History */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-white">Progress Timeline</h2>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-10 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
              <Clock className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No progress evaluations recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(log => {
                const safhas = log.end_safha && log.start_safha ? Math.max(0, log.end_safha - log.start_safha + 1) : 0
                const isM = log.hifz_type === 'murajaah'

                return (
                  <div
                    key={log.id}
                    className={`p-3.5 rounded-xl border flex items-start justify-between gap-4 transition-all ${
                      isM ? 'bg-purple-950/20 border-purple-800/40' : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                          isM ? 'bg-purple-950 text-purple-300 border border-purple-800/50' : 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                        }`}>
                          {isM ? '🔄 Murajaah' : '📖 Hifz'}
                        </span>
                        <span className="text-xs text-slate-400">{log.week_start}</span>
                      </div>
                      {log.start_surah && (
                        <p className="text-sm font-medium text-white">
                          {log.start_surah} → {log.end_surah} (Pages {log.start_safha} - {log.end_safha})
                        </p>
                      )}
                      {log.comments && (
                        <p className="text-xs text-slate-400 italic border-l-2 border-slate-700 pl-2 mt-1">
                          "{log.comments}"
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-white">{safhas}</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Safhas</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

      </main>
    </div>
  )
}