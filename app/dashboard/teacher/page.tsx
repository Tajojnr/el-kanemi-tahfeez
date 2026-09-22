'use client'

import Shepherd from 'shepherd.js'
import 'shepherd.js/dist/css/shepherd.css'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Users, TrendingUp, AlertTriangle, Plus, LogOut, Loader2,
  Calendar, X, Settings, FileText, Pencil, Trash2, History,
  Search, MoreVertical, RefreshCw, KeyRound, FolderDown, BookOpen, Repeat,
  Share2, User, Copy, Check, Send
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { pdf } from '@react-pdf/renderer'
import { StudentReportPDF, ClassReportsPDF } from '@/components/pdf/StudentReport'
import { useToast } from '@/components/Toast'
import { StudentAvatar } from '@/components/ui/StudentAvatar'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { useEscapeKey } from '@/hooks/useEscapeKey'

type DisplayStudent = {
  id: string
  name: string
  currentHizb: number
  currentPage: number
  status: 'safe' | 'warning' | 'danger'
  lastWeekSafhas: number
  hifzLoggedThisWeek: boolean
  murajaahLoggedThisWeek: boolean
}

type SortMode = 'danger' | 'name' | 'progress'

const getToday = () => new Date().toISOString().split('T')[0]

const getWeekStart = () => {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

const getTimeGreeting = (): string => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const calcStatus = (safhas: number, target: number): 'safe' | 'warning' | 'danger' => {
  if (safhas <= 0) return 'safe'
  if (safhas < Math.floor(target * 0.66)) return 'danger'
  if (safhas < target) return 'warning'
  return 'safe'
}

export default function TeacherDashboard() {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [classId, setClassId] = useState<string | null>(null)
  const [classNameEn, setClassNameEn] = useState('')
  const [currentWeek, setCurrentWeek] = useState(1)
  const [targetSafhas, setTargetSafhas] = useState(6)
  const [termName, setTermName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [teacherName, setTeacherName] = useState('')
  const [greeting, setGreeting] = useState('Welcome')

  // Password
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)

  // Students
  const [students, setStudents] = useState<DisplayStudent[]>([])
  const [stats, setStats] = useState({ total: 0, onTrack: 0, needAttention: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('danger')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  // Add / Edit / Delete
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [newStudentName, setNewStudentName] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editStudent, setEditStudent] = useState<DisplayStudent | null>(null)
  const [editName, setEditName] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteStudent, setDeleteStudent] = useState<DisplayStudent | null>(null)

  // History
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyStudent, setHistoryStudent] = useState<DisplayStudent | null>(null)
  const [historyLogs, setHistoryLogs] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Target
  const [showTargetModal, setShowTargetModal] = useState(false)
  const [tempTarget, setTempTarget] = useState(6)

  // Progress Modal
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<DisplayStudent | null>(null)
  const [surahs, setSurahs] = useState<any[]>([])
  const [logTab, setLogTab] = useState<'hifz' | 'murajaah'>('hifz')

  // Hifz-specific state
  const [hifzStartPage, setHifzStartPage] = useState(1)
  const [hifzEndPage, setHifzEndPage] = useState(1)
  const [hifzStartSurahId, setHifzStartSurahId] = useState(1)
  const [hifzEndSurahId, setHifzEndSurahId] = useState(1)
  const [hifzStartSurah, setHifzStartSurah] = useState('')
  const [hifzEndSurah, setHifzEndSurah] = useState('')
  const [hifzStartAyah, setHifzStartAyah] = useState(1)
  const [hifzEndAyah, setHifzEndAyah] = useState(1)
  const [hifzJuz, setHifzJuz] = useState(1)
  const [hifzHeadText, setHifzHeadText] = useState('')
  const [hifzTailText, setHifzTailText] = useState('')
  const [hifzComments, setHifzComments] = useState('')

  // Murajaah-specific state
  const [murStartPage, setMurStartPage] = useState(1)
  const [murEndPage, setMurEndPage] = useState(1)
  const [murStartSurahId, setMurStartSurahId] = useState(1)
  const [murEndSurahId, setMurEndSurahId] = useState(1)
  const [murStartSurah, setMurStartSurah] = useState('')
  const [murEndSurah, setMurEndSurah] = useState('')
  const [murStartAyah, setMurStartAyah] = useState(1)
  const [murEndAyah, setMurEndAyah] = useState(1)
  const [murJuz, setMurJuz] = useState(1)
  const [murHeadText, setMurHeadText] = useState('')
  const [murTailText, setMurTailText] = useState('')
  const [murComments, setMurComments] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [downloadingClass, setDownloadingClass] = useState(false)

  // WhatsApp Share Modal
  const [whatsappModal, setWhatsappModal] = useState<{
    show: boolean
    studentName: string
    message: string
    phoneNumber: string
  }>({ show: false, studentName: '', message: '', phoneNumber: '' })
  const [copiedMessage, setCopiedMessage] = useState(false)

  // Report
  const [showReportModal, setShowReportModal] = useState(false)
  const [isEndOfTerm, setIsEndOfTerm] = useState(false)
  const [reportStudent, setReportStudent] = useState<DisplayStudent | null>(null)
  const [teacherInputName, setTeacherInputName] = useState('')

  const closeAllModals = useCallback(() => {
    if (showProgressModal) return setShowProgressModal(false)
    if (showHistoryModal) return setShowHistoryModal(false)
    if (showReportModal) return setShowReportModal(false)
    if (showAddStudent) return setShowAddStudent(false)
    if (showEditModal) return setShowEditModal(false)
    if (showDeleteConfirm) return setShowDeleteConfirm(false)
    if (showTargetModal) return setShowTargetModal(false)
    if (showPasswordModal) return setShowPasswordModal(false)
    if (whatsappModal.show) return setWhatsappModal(prev => ({ ...prev, show: false }))
    if (openMenuId) return setOpenMenuId(null)
  }, [showProgressModal, showHistoryModal, showReportModal, showAddStudent, showEditModal, showDeleteConfirm, showTargetModal, showPasswordModal, whatsappModal.show, openMenuId])

  useEscapeKey(closeAllModals)

  useEffect(() => {
    if (!openMenuId) return
    const handler = () => setOpenMenuId(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [openMenuId])

  useEffect(() => {
    setGreeting(getTimeGreeting())
    const interval = setInterval(() => setGreeting(getTimeGreeting()), 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => { initialize() }, [])

  // SHEPHERD TOUR LOGIC
  useEffect(() => {
    // Check if the user has already seen the tour
    const hasSeenTour = localStorage.getItem('elkanemi_teacher_tour_seen')

    // Only run if they haven't seen it, and the data has finished loading
    if (!hasSeenTour && !loading && students.length > 0) {
      const tour = new Shepherd.Tour({
        useModalOverlay: true,
        defaultStepOptions: {
          cancelIcon: { enabled: true },
          classes: 'shadow-md bg-purple-dark',
          scrollTo: { behavior: 'smooth', block: 'center' }
        }
      })

      tour.addSteps([
        {
          id: 'welcome',
          title: `Welcome, ${teacherName}! 👋`,
          text: 'This is your new El-Kanemi Tahfeez Dashboard. Let us show you around in 4 quick steps.',
          buttons: [
            { text: 'Skip', action: tour.cancel, classes: 'shepherd-button-secondary' },
            { text: 'Next', action: tour.next }
          ]
        },
        {
          id: 'password',
          title: 'Secure Your Account',
          text: 'Since this is your first login, please click here to change your temporary password to a private one.',
          attachTo: { element: '#tour-password', on: 'bottom' },
          buttons: [
            { text: 'Back', action: tour.back, classes: 'shepherd-button-secondary' },
            { text: 'Next', action: tour.next }
          ]
        },
        {
          id: 'log-progress',
          title: 'Log Weekly Progress',
          text: 'Tap the ⋮ menu on any student, then "Log Progress", to quickly record Hifz or Murajaah. The Arabic text will auto-fill!',
          attachTo: { element: '#tour-log', on: 'bottom' },
          buttons: [
            { text: 'Back', action: tour.back, classes: 'shepherd-button-secondary' },
            { text: 'Next', action: tour.next }
          ]
        },
        {
          id: 'whatsapp-share',
          title: 'Share with Parents',
          text: 'Click here to instantly generate a polite WhatsApp progress report for the parents.',
          attachTo: { element: '#tour-whatsapp', on: 'bottom' },
          buttons: [
            { text: 'Back', action: tour.back, classes: 'shepherd-button-secondary' },
            { text: 'Next', action: tour.next }
          ]
        },
        {
          id: 'student-profile',
          title: 'View Hifz Journey',
          text: 'Click any student\'s name to view their full 30-Juz progress map, milestone badges, and history.',
          attachTo: { element: '#tour-profile', on: 'bottom' },
          buttons: [
            { text: 'Back', action: tour.back, classes: 'shepherd-button-secondary' },
            { text: 'Finish', action: tour.complete }
          ]
        }
      ])

      // Start the tour
      tour.start()

      // Mark as seen when closed or completed
      tour.on('complete', () => localStorage.setItem('elkanemi_teacher_tour_seen', 'true'))
      tour.on('cancel', () => localStorage.setItem('elkanemi_teacher_tour_seen', 'true'))
    }
  }, [loading, students, teacherName])

  async function initialize() {
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) { router.push('/login'); return }

      const { data: classData, error: classErr } = await supabase
        .from('classes').select('id, display_name_en, teacher_name')
        .eq('auth_user_id', user.id).single()

      if (classErr || !classData) {
        setError('Unable to load your class. Contact admin.')
        setLoading(false); return
      }

      const cid = classData.id
      setClassId(cid)
      setClassNameEn(classData.display_name_en)

      const rawName = classData.teacher_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Mu\'allim'
      const hasTitle = /^(ustaz|ustadh|ustazah|mu'allim|mu'allima|teacher|sheikh|shaykh)/i.test(rawName)
      const formatted = hasTitle ? rawName : `Mu'allim ${rawName}`
      setTeacherName(formatted)
      setTeacherInputName(formatted)

      const { data: settings } = await supabase.from('class_settings')
        .select('target_safhas_per_week').eq('class_id', cid).single()
      const targetVal = settings?.target_safhas_per_week || 6
      setTargetSafhas(targetVal)
      setTempTarget(targetVal)

      const { data: surahData } = await supabase.from('surah_metadata').select('*').order('id')
      if (surahData?.length) setSurahs(surahData)

      const { data: termData } = await supabase.from('academic_terms')
        .select('current_week, name').eq('is_active', true).limit(1)
      if (termData?.[0]) {
        setCurrentWeek(termData[0].current_week)
        setTermName(termData[0].name || '')
      }

      await loadStudents(cid, targetVal)
    } catch {
      setError('Something went wrong. Please refresh.')
      setLoading(false)
    }
  }

  async function loadStudents(cid: string, target: number = targetSafhas) {
    try {
      const { data: studentsData, error: sErr } = await supabase
        .from('students').select('*').eq('class_id', cid).eq('status', 'active').order('full_name')
      if (sErr) throw sErr

      if (!studentsData?.length) {
        setStudents([])
        setStats({ total: 0, onTrack: 0, needAttention: 0 })
        setLoading(false); return
      }

      const weekStart = getWeekStart()

      const { data: progressData } = await supabase
        .from('weekly_progress')
        .select('student_id, start_safha, end_safha, hifz_type, week_start')
        .in('student_id', studentsData.map(s => s.id))
        .order('week_start', { ascending: false })

      const hifzMap = new Map<string, any>()
      const hifzLoggedSet = new Set<string>()
      const murLoggedSet = new Set<string>()

      progressData?.forEach(p => {
        if (!hifzMap.has(p.student_id) && p.hifz_type === 'hifz') hifzMap.set(p.student_id, p)

        if (p.week_start >= weekStart) {
          if (p.hifz_type === 'hifz') hifzLoggedSet.add(p.student_id)
          if (p.hifz_type === 'murajaah') murLoggedSet.add(p.student_id)
        }
      })

      const display: DisplayStudent[] = studentsData.map((s: any) => {
        const latest = hifzMap.get(s.id)
        const lastWeekSafhas = latest ? Math.max(0, latest.end_safha - latest.start_safha + 1) : 0
        return {
          id: s.id, name: s.full_name,
          currentHizb: s.current_hizb || 1, currentPage: s.current_page || 1,
          status: calcStatus(lastWeekSafhas, target), lastWeekSafhas,
          hifzLoggedThisWeek: hifzLoggedSet.has(s.id),
          murajaahLoggedThisWeek: murLoggedSet.has(s.id),
        }
      })

      setStudents(display)
      setStats({
        total: display.length,
        onTrack: display.filter(s => s.status === 'safe').length,
        needAttention: display.filter(s => s.status !== 'safe').length,
      })
    } catch { toast('error', 'Failed to load students') }
    finally { setLoading(false); setRefreshing(false) }
  }

  const displayedStudents = useMemo(() => {
    let list = students.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    if (sortMode === 'danger') {
      const o = { danger: 0, warning: 1, safe: 2 }
      list = [...list].sort((a, b) => o[a.status] - o[b.status])
    } else if (sortMode === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    else list = [...list].sort((a, b) => b.lastWeekSafhas - a.lastWeekSafhas)
    return list
  }, [students, searchQuery, sortMode])

  async function handleRefresh() {
    if (!classId || refreshing) return
    setRefreshing(true)
    await loadStudents(classId)
    toast('success', 'Refreshed / تم التحديث')
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) { toast('warning', 'At least 6 characters'); return }
    if (newPassword !== confirmPassword) { toast('error', 'Passwords do not match'); return }
    setUpdatingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast('success', 'Password updated / تم تحديث كلمة المرور')
      setShowPasswordModal(false); setNewPassword(''); setConfirmPassword('')
    } catch (err: any) { toast('error', err.message) }
    finally { setUpdatingPassword(false) }
  }

  // AUTO-LOOKUP FROM SAFHA_REFERENCE (El-Kanemi Enhancement)
  const lookupSafhaRef = useCallback(async (page: number, type: 'start' | 'end', isHifz: boolean) => {
    try {
      const { data } = await supabase
        .from('safha_reference')
        .select('*')
        .eq('page', page)
        .maybeSingle()

      if (!data) return

      if (type === 'start') {
        if (isHifz) {
          setHifzStartSurah(data.start_surah)
          setHifzStartAyah(data.start_ayah)
          setHifzJuz(data.juz)
          setHifzHeadText(data.head_of_safha)
          const matchedSurah = surahs.find(s => s.name_english.toLowerCase() === data.start_surah.toLowerCase())
          if (matchedSurah) setHifzStartSurahId(matchedSurah.id)
        } else {
          setMurStartSurah(data.start_surah)
          setMurStartAyah(data.start_ayah)
          setMurJuz(data.juz)
          setMurHeadText(data.head_of_safha)
          const matchedSurah = surahs.find(s => s.name_english.toLowerCase() === data.start_surah.toLowerCase())
          if (matchedSurah) setMurStartSurahId(matchedSurah.id)
        }
      } else {
        if (isHifz) {
          setHifzEndSurah(data.end_surah)
          setHifzEndAyah(data.end_ayah)
          setHifzTailText(data.tail_of_safha)
          const matchedSurah = surahs.find(s => s.name_english.toLowerCase() === data.end_surah.toLowerCase())
          if (matchedSurah) setHifzEndSurahId(matchedSurah.id)
        } else {
          setMurEndSurah(data.end_surah)
          setMurEndAyah(data.end_ayah)
          setMurTailText(data.tail_of_safha)
          const matchedSurah = surahs.find(s => s.name_english.toLowerCase() === data.end_surah.toLowerCase())
          if (matchedSurah) setMurEndSurahId(matchedSurah.id)
        }
      }
    } catch (e) {
      console.warn('Safha lookup error:', e)
    }
  }, [surahs])

  useEffect(() => {
    if (showProgressModal) lookupSafhaRef(hifzStartPage, 'start', true)
  }, [hifzStartPage, showProgressModal, lookupSafhaRef])

  useEffect(() => {
    if (showProgressModal) lookupSafhaRef(hifzEndPage, 'end', true)
  }, [hifzEndPage, showProgressModal, lookupSafhaRef])

  useEffect(() => {
    if (showProgressModal) lookupSafhaRef(murStartPage, 'start', false)
  }, [murStartPage, showProgressModal, lookupSafhaRef])

  useEffect(() => {
    if (showProgressModal) lookupSafhaRef(murEndPage, 'end', false)
  }, [murEndPage, showProgressModal, lookupSafhaRef])

  function openProgressModal(student: DisplayStudent) {
    setSelectedStudent(student)
    setShowProgressModal(true)
    setOpenMenuId(null)
    setLogTab('hifz')
    setHifzStartPage(student.currentPage || 1)
    setHifzEndPage(student.currentPage || 1)
    setHifzStartSurahId(1); setHifzEndSurahId(1)
    setHifzHeadText(''); setHifzTailText(''); setHifzComments('')
    setMurStartPage(1); setMurEndPage(1)
    setMurStartSurahId(1); setMurEndSurahId(1)
    setMurHeadText(''); setMurTailText(''); setMurComments('')
  }

  async function openWhatsAppModal(student: DisplayStudent) {
    setOpenMenuId(null)
    try {
      const { data: latest } = await supabase
        .from('weekly_progress')
        .select('*')
        .eq('student_id', student.id)
        .eq('hifz_type', 'hifz')
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle()

      const safhasThisWeek = latest ? Math.max(0, latest.end_safha - latest.start_safha + 1) : student.lastWeekSafhas
      const startSurah = latest?.start_surah || 'Al-Fatihah'
      const endSurah = latest?.end_surah || 'Al-Fatihah'
      const notes = latest?.comments || 'Steady progress, masha\'Allah.'

      const message = `*Assalamu Alaikum wa Rahmatullah,* 🌿

Here is the weekly Tahfeez progress update for *${student.name}* (*${classNameEn}*):

📖 *Weekly Hifz:* ${safhasThisWeek} Safhas (Pages ${latest?.start_safha || student.currentPage} to ${latest?.end_safha || student.currentPage})
📖 *Surah Range:* ${startSurah} → ${endSurah}
📍 *Current Position:* Juz ${student.currentHizb} · Page ${student.currentPage} of 604
🎯 *Progress Target:* ${safhasThisWeek >= targetSafhas ? '✅ Target Met (On Track)' : '⚠️ Below Target'}
📅 *Period:* Week ${currentWeek} (${termName || 'Current Term'})
📝 *Mu'allim Remarks:* _"${notes}"_

_May Allah bless ${student.name}'s journey in memorising the Holy Quran and grant them steadfastness._ 🤲

— *El-Kanemi College of Islamic Theology*`

      setWhatsappModal({
        show: true,
        studentName: student.name,
        message,
        phoneNumber: '',
      })
      setCopiedMessage(false)
    } catch {
      toast('error', 'Could not prepare WhatsApp message')
    }
  }

  function launchWhatsApp() {
    const cleanNumber = whatsappModal.phoneNumber.replace(/[^0-9]/g, '')
    const baseUrl = cleanNumber ? `https://wa.me/${cleanNumber}` : `https://wa.me/`
    const url = `${baseUrl}?text=${encodeURIComponent(whatsappModal.message)}`
    window.open(url, '_blank')
  }

  function copyWhatsAppText() {
    navigator.clipboard.writeText(whatsappModal.message)
    setCopiedMessage(true)
    setTimeout(() => setCopiedMessage(false), 2500)
    toast('success', 'Message copied to clipboard!')
  }

  async function handleLogProgress(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedStudent || !classId) return

    const startPage = logTab === 'hifz' ? hifzStartPage : murStartPage
    const endPage = logTab === 'hifz' ? hifzEndPage : murEndPage
    const startSurah = logTab === 'hifz' ? hifzStartSurah : murStartSurah
    const endSurah = logTab === 'hifz' ? hifzEndSurah : murEndSurah
    const startAyah = logTab === 'hifz' ? hifzStartAyah : murStartAyah
    const endAyah = logTab === 'hifz' ? hifzEndAyah : murEndAyah
    const juz = logTab === 'hifz' ? hifzJuz : murJuz
    const headText = logTab === 'hifz' ? hifzHeadText : murHeadText
    const tailText = logTab === 'hifz' ? hifzTailText : murTailText
    const comments = logTab === 'hifz' ? hifzComments : murComments

    if (endPage < startPage) {
      toast('error', 'End page must be greater than or equal to start page')
      return
    }

    setIsSubmitting(true)
    try {
      const today = getToday()
      const totalSafhas = Math.max(0, endPage - startPage + 1)

      const res = await fetch('/api/progress/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          weekStart: today,
          hifzType: logTab,
          startSafha: startPage,
          endSafha: endPage,
          startSurah, endSurah, startAyah, endAyah,
          juzNumber: juz,
          headText, tailText,
          comments: comments.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save progress')
      }

      toast('success', `${selectedStudent.name}: ${totalSafhas} Safhas ${logTab === 'hifz' ? 'Hifz' : 'Murajaah'} saved ✓`)
      await loadStudents(classId)

      const { hifzLoggedThisWeek, murajaahLoggedThisWeek } = selectedStudent
      const bothWillBeLogged =
        (logTab === 'hifz' ? true : hifzLoggedThisWeek) &&
        (logTab === 'murajaah' ? true : murajaahLoggedThisWeek)

      if (bothWillBeLogged) {
        setShowProgressModal(false)
      } else {
        setLogTab(logTab === 'hifz' ? 'murajaah' : 'hifz')
      }
    } catch (err: any) {
      console.error('Save progress error:', err)
      toast('error', `Save failed: ${err.message || 'Unknown error'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault()
    if (!classId || !newStudentName.trim()) return
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('students').insert([{
        full_name: newStudentName.trim(), class_id: classId,
        current_hizb: 1, current_page: 1, status: 'active',
      }])
      if (error) throw error
      toast('success', `${newStudentName.trim()} added / تم إضافة الطالب ✓`)
      setNewStudentName(''); setShowAddStudent(false)
      await loadStudents(classId)
    } catch (err: any) { toast('error', err.message) }
    finally { setIsSubmitting(false) }
  }

  async function handleEditStudent(e: React.FormEvent) {
    e.preventDefault()
    if (!editStudent || !classId || !editName.trim()) return
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('students').update({ full_name: editName.trim() }).eq('id', editStudent.id)
      if (error) throw error
      toast('success', 'Name updated / تم تعديل الاسم ✓')
      setShowEditModal(false); setEditStudent(null); setEditName('')
      await loadStudents(classId)
    } catch (err: any) { toast('error', err.message) }
    finally { setIsSubmitting(false) }
  }

  async function handleDeleteStudent() {
    if (!deleteStudent || !classId) return
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('students').update({ status: 'inactive' }).eq('id', deleteStudent.id)
      if (error) throw error
      toast('success', `${deleteStudent.name} archived / تم حذف الطالب ✓`)
      setShowDeleteConfirm(false); setDeleteStudent(null)
      await loadStudents(classId)
    } catch (err: any) { toast('error', err.message) }
    finally { setIsSubmitting(false) }
  }

  async function openHistoryModal(student: DisplayStudent) {
    setOpenMenuId(null)
    setHistoryStudent(student); setShowHistoryModal(true)
    setHistoryLogs([]); setHistoryLoading(true)
    try {
      const { data, error } = await supabase.from('weekly_progress')
        .select('*').eq('student_id', student.id).order('week_start', { ascending: false })
      if (error) throw error
      setHistoryLogs(data || [])
    } catch { toast('error', 'Failed to load history') }
    finally { setHistoryLoading(false) }
  }

  async function saveTarget() {
    if (!classId || tempTarget < 1 || tempTarget > 30) return
    try {
      const { error } = await supabase.from('class_settings')
        .update({ target_safhas_per_week: tempTarget }).eq('class_id', classId)
      if (error) throw error
      setTargetSafhas(tempTarget); setShowTargetModal(false)
      await loadStudents(classId, tempTarget)
      toast('success', `Target: ${tempTarget} Safhas/week`)
    } catch (err: any) { toast('error', err.message) }
  }

  async function generateStudentReport() {
    if (!reportStudent || !teacherInputName.trim()) { toast('warning', 'Enter teacher name'); return }
    try {
      toast('info', 'Generating...')
      const { data: progress } = await supabase.from('weekly_progress')
        .select('*').eq('student_id', reportStudent.id).order('week_start')
      const formatted = (progress || []).map((p: any) => ({
        weekStart: p.week_start, hifzType: p.hifz_type,
        totalSafhas: p.end_safha && p.start_safha ? Math.max(0, p.end_safha - p.start_safha + 1) : 0,
        dangerLevel: p.danger_level || 'safe',
        startSurah: p.start_surah || '-', startAyah: p.start_ayah,
        endSurah: p.end_surah || '-', endAyah: p.end_ayah,
        headOfSafha: p.head_of_safha, tailOfSafha: p.tail_of_safha,
        comments: p.comments,
      }))
      const blob = await pdf(
        <StudentReportPDF studentName={reportStudent.name} className={classNameEn}
          teacherName={teacherInputName} academicYear="2024/2025" weeklyProgress={formatted}
          targetSafhas={targetSafhas} currentWeek={currentWeek} termName={termName} isEndOfTerm={isEndOfTerm} />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `${reportStudent.name.replace(/\s+/g, '_')}_Report.pdf`
      link.click(); URL.revokeObjectURL(url)
      setShowReportModal(false)
      toast('success', 'Report downloaded')
    } catch { toast('error', 'PDF generation failed') }
  }

  async function handleBulkClassDownload() {
    if (!students.length || !classId) return
    setDownloadingClass(true)
    toast('info', 'Compiling class reports...')
    try {
      const { data: allProgress } = await supabase.from('weekly_progress')
        .select('*').in('student_id', students.map(s => s.id)).order('week_start')
      const byStudent = new Map<string, any[]>()
      allProgress?.forEach(p => {
        if (!byStudent.has(p.student_id)) byStudent.set(p.student_id, [])
        byStudent.get(p.student_id)!.push({
          weekStart: p.week_start, hifzType: p.hifz_type,
          totalSafhas: p.end_safha && p.start_safha ? Math.max(0, p.end_safha - p.start_safha + 1) : 0,
          dangerLevel: p.danger_level || 'safe', startSurah: p.start_surah || '-',
          startAyah: p.start_ayah, endSurah: p.end_surah || '-', endAyah: p.end_ayah,
          headOfSafha: p.head_of_safha, tailOfSafha: p.tail_of_safha,
          comments: p.comments,
        })
      })
      const payload = students.map(s => ({
        studentId: s.id, studentName: s.name, className: classNameEn,
        teacherName, weeklyProgress: byStudent.get(s.id) || [],
      }))
      const blob = await pdf(
        <ClassReportsPDF studentReportsData={payload} termName={termName}
          currentWeek={currentWeek} targetSafhas={targetSafhas} isEndOfTerm={isEndOfTerm} />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `Class_${classNameEn.replace(/\s+/g, '_')}_W${currentWeek}.pdf`
      link.click(); URL.revokeObjectURL(url)
      toast('success', 'Class reports downloaded')
    } catch { toast('error', 'Failed to compile') }
    finally { setDownloadingClass(false) }
  }

  async function handleLogout() {
    try { await supabase.auth.signOut() } catch {}
    router.push('/login')
  }

  const activeStartPage = logTab === 'hifz' ? hifzStartPage : murStartPage
  const activeEndPage = logTab === 'hifz' ? hifzEndPage : murEndPage
  const totalSafhasPreview = Math.max(0, activeEndPage - activeStartPage + 1)
  const isInvalid = activeEndPage < activeStartPage

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/30 text-white">

      {/* ✅ Premium Loading Overlay */}
      <LoadingOverlay isLoading={loading} text="جاري التحميل | Loading..." />

      {/* HEADER */}
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-30">
        <div className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start gap-4 max-w-5xl mx-auto">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-900/30 rounded-xl flex items-center justify-center border border-indigo-800/30 shrink-0">
                <img src="/logo/logo.png" className="w-9 h-9 object-contain" alt="Logo"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold">El-Kanemi College</h1>
                <p className="text-xs sm:text-sm font-medium text-indigo-400 flex items-center gap-1.5">
                  <span>{greeting},</span>
                  <span className="font-semibold text-white truncate max-w-[160px] sm:max-w-none">{teacherName}</span>
                  <span>👋</span>
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-indigo-300">{classNameEn}</h2>
              <button onClick={() => { setTempTarget(targetSafhas); setShowTargetModal(true) }}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                <Settings className="w-4 h-4 text-slate-400" />
              </button>
              <span className="text-xs text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full">🎯 {targetSafhas} / أسبوع</span>
            </div>

            {termName && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs bg-purple-900/30 text-purple-300 px-3 py-1 rounded-full border border-purple-800/50">
                📅 {termName} — Week {currentWeek}
              </div>
            )}
          </div>
          <div className="flex gap-2 self-end sm:self-start w-full sm:w-auto">
            {students.length > 0 && (
              <button onClick={handleBulkClassDownload} disabled={downloadingClass}
                className="flex-1 sm:flex-none px-3 py-2 bg-indigo-800 hover:bg-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                {downloadingClass ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderDown className="w-4 h-4" />}
                <span>Class PDF</span>
              </button>
            )}
            <button onClick={() => setShowPasswordModal(true)} id="tour-password" className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors" title="Change Password">
              <KeyRound className="w-4 h-4 text-amber-400" />
            </button>
            <button onClick={handleRefresh} disabled={refreshing} className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleLogout} className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
              <LogOut className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="p-4 sm:p-6 space-y-5 pb-24 max-w-5xl mx-auto">
        {error && (
          <div className="bg-red-950/50 border border-red-800/50 p-4 rounded-xl text-red-300 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <StatCard icon={<Users className="w-4 h-4" />} value={stats.total} label="الطلاب | Students" color="blue" />
          <StatCard icon={<TrendingUp className="w-4 h-4" />} value={stats.onTrack} label="على المسار | On Track" color="indigo"
            subtext={stats.total > 0 ? `${Math.round((stats.onTrack / stats.total) * 100)}%` : '—'} />
          <StatCard icon={<AlertTriangle className="w-4 h-4" />} value={stats.needAttention} label="يحتاج انتباه | Attention" color="red"
            subtext={stats.total > 0 ? `${Math.round((stats.needAttention / stats.total) * 100)}%` : '—'} />
        </div>

        {students.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Search students / بحث عن طالب..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/40 outline-none" />
            </div>
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500/40 outline-none">
              <option value="danger">⚠️ يحتاج انتباه (Attention first)</option>
              <option value="name">🔤 الاسم (Name A-Z)</option>
              <option value="progress">📈 التقدم (Most progress)</option>
            </select>
            <button onClick={() => setShowAddStudent(true)}
              className="bg-indigo-700 hover:bg-indigo-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 justify-center font-semibold text-sm transition-colors shrink-0">
              <Plus className="w-4 h-4" /> إضافة | Add
            </button>
          </div>
        )}

        {students.length === 0 ? <EmptyState onAdd={() => setShowAddStudent(true)} />
        : displayedStudents.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">No match for "{searchQuery}"</div>
        ) : (
          <div className="space-y-2">
            {displayedStudents.map((s, idx) => (
              <StudentCard key={s.id} student={s} target={targetSafhas} index={idx}
                menuOpen={openMenuId === s.id}
                onToggleMenu={(e: React.MouseEvent) => { e.stopPropagation(); setOpenMenuId(openMenuId === s.id ? null : s.id) }}
                onLog={() => openProgressModal(s)}
                onHistory={() => openHistoryModal(s)}
                onShare={() => openWhatsAppModal(s)}
                onReport={() => { setOpenMenuId(null); setReportStudent(s); setShowReportModal(true) }}
                onEdit={() => { setOpenMenuId(null); setEditStudent(s); setEditName(s.name); setShowEditModal(true) }}
                onDelete={() => { setOpenMenuId(null); setDeleteStudent(s); setShowDeleteConfirm(true) }} />
            ))}
          </div>
        )}
      </main>

      {/* WHATSAPP SHARE PREVIEW MODAL */}
      {whatsappModal.show && (
        <Modal onClose={() => setWhatsappModal(prev => ({ ...prev, show: false }))} title="Share Progress via WhatsApp">
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-400">Student</p>
              <p className="text-base font-bold text-white">{whatsappModal.studentName}</p>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Parent Phone Number (Optional)</label>
              <input type="tel" placeholder="e.g. 2348012345678" value={whatsappModal.phoneNumber}
                onChange={e => setWhatsappModal(prev => ({ ...prev, phoneNumber: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/40" />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Message Preview</label>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 max-h-40 overflow-y-auto whitespace-pre-wrap">
                {whatsappModal.message}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={copyWhatsAppText}
                className="flex-1 bg-slate-800 hover:bg-slate-700 p-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5">
                {copiedMessage ? <Check className="w-4 h-4 text-indigo-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                <span>{copiedMessage ? 'Copied!' : 'Copy Text'}</span>
              </button>
              <button type="button" onClick={launchWhatsApp}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5">
                <Send className="w-4 h-4" />
                <span>Open WhatsApp</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* LOG PROGRESS MODAL */}
      {showProgressModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowProgressModal(false)}>
          <form onSubmit={handleLogProgress}
            className="bg-slate-900 p-5 rounded-2xl w-full max-w-md space-y-4 border border-slate-800 animate-slide-up shadow-2xl"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center gap-3">
              <StudentAvatar name={selectedStudent.name} size="md" />
              <div className="flex-1">
                <h3 className="font-bold text-lg">{selectedStudent.name}</h3>
                <p className="text-xs text-slate-400">الصفحة الحالية | Page {selectedStudent.currentPage}</p>
              </div>
              <button type="button" onClick={() => setShowProgressModal(false)} className="p-1 hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setLogTab('hifz')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all relative ${logTab === 'hifz' ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                📖 الحفظ | Hifz
                {selectedStudent.hifzLoggedThisWeek && (
                  <span className="absolute -top-1.5 -right-1.5 bg-indigo-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold shadow-lg border border-slate-900">✓ Logged</span>
                )}
              </button>
              <button type="button" onClick={() => setLogTab('murajaah')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all relative ${logTab === 'murajaah' ? 'bg-purple-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                🔄 المراجعة | Muraja'ah
                {selectedStudent.murajaahLoggedThisWeek && (
                  <span className="absolute -top-1.5 -right-1.5 bg-purple-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold shadow-lg border border-slate-900">✓ Logged</span>
                )}
              </button>
            </div>

            {selectedStudent.hifzLoggedThisWeek && selectedStudent.murajaahLoggedThisWeek && (
              <div className="bg-indigo-950/40 border border-indigo-800/40 text-indigo-300 text-xs p-2.5 rounded-lg text-center">
                ✓ Both Hifz & Murajaah logged this week. Saving again will update the record.
              </div>
            )}

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
              <p className={`text-xs font-bold uppercase ${logTab === 'hifz' ? 'text-indigo-400' : 'text-purple-400'}`}>
                Pages {logTab === 'hifz' ? 'Memorised' : 'Reviewed'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">من صفحة | From Page</label>
                  <input type="number" min={1} max={604}
                    value={logTab === 'hifz' ? hifzStartPage : murStartPage}
                    onChange={e => logTab === 'hifz' ? setHifzStartPage(Number(e.target.value)) : setMurStartPage(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 p-3 rounded-xl text-lg font-bold text-center text-white focus:ring-2 focus:ring-indigo-500/40 outline-none" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">إلى صفحة | To Page</label>
                  <input type="number" min={1} max={604}
                    value={logTab === 'hifz' ? hifzEndPage : murEndPage}
                    onChange={e => logTab === 'hifz' ? setHifzEndPage(Number(e.target.value)) : setMurEndPage(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 p-3 rounded-xl text-lg font-bold text-center text-white focus:ring-2 focus:ring-indigo-500/40 outline-none" />
                </div>
              </div>

              {/* AUTO-DETECTED SURAH & JUZ SUMMARY */}
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">السورة | Surah:</span>
                  <span className="font-bold text-indigo-400">{logTab === 'hifz' ? hifzStartSurah : murStartSurah} → {logTab === 'hifz' ? hifzEndSurah : murEndSurah}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">الجزء | Juz:</span>
                  <span className="font-bold text-amber-400">Juz {logTab === 'hifz' ? hifzJuz : murJuz}</span>
                </div>
              </div>

              {/* AUTO-PREFILLED HEAD & TAIL */}
              <div className="space-y-2 pt-1">
                <div>
                  <label className="text-[10px] text-indigo-400 mb-1 flex items-center justify-between font-bold">
                    <span className="text-[9px] text-slate-500">✨ Pre-filled</span>
                    <span>بداية الصفحة | Start Words</span>
                  </label>
                  <input type="text" value={logTab === 'hifz' ? hifzHeadText : murHeadText}
                    onChange={e => logTab === 'hifz' ? setHifzHeadText(e.target.value) : setMurHeadText(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 p-2.5 rounded-xl text-sm text-white outline-none text-right" dir="rtl" />
                </div>
                <div>
                  <label className="text-[10px] text-red-400 mb-1 flex items-center justify-between font-bold">
                    <span className="text-[9px] text-slate-500">✨ Pre-filled</span>
                    <span>نهاية الصفحة | End Words</span>
                  </label>
                  <input type="text" value={logTab === 'hifz' ? hifzTailText : murTailText}
                    onChange={e => logTab === 'hifz' ? setHifzTailText(e.target.value) : setMurTailText(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 p-2.5 rounded-xl text-sm text-white outline-none text-right" dir="rtl" />
                </div>
              </div>
            </div>

            <div className={`p-3 rounded-xl border flex justify-between items-center ${
              isInvalid ? 'bg-red-950/40 border-red-800'
              : totalSafhasPreview >= targetSafhas ? 'bg-indigo-950/40 border-indigo-800'
              : 'bg-amber-950/40 border-amber-800'
            }`}>
              <span className="text-sm text-slate-300">{isInvalid ? 'Invalid range' : 'Total'}</span>
              <span className="text-2xl font-bold">{isInvalid ? '—' : totalSafhasPreview} <span className="text-sm font-normal text-slate-400">/ {targetSafhas}</span></span>
            </div>

            <textarea value={logTab === 'hifz' ? hifzComments : murComments}
              onChange={e => logTab === 'hifz' ? setHifzComments(e.target.value) : setMurComments(e.target.value)}
              placeholder="الملاحظات | Notes: tajweed, retention, quality..."
              className="w-full bg-slate-800 border border-slate-700 p-3 rounded-xl text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/40 outline-none resize-none"
              rows={2} />

            <button type="submit" disabled={isSubmitting || isInvalid}
              className={`w-full p-3.5 rounded-xl font-bold text-base transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                logTab === 'hifz' ? 'bg-indigo-700 hover:bg-indigo-600' : 'bg-purple-700 hover:bg-purple-600'
              }`}>
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              : `✓ حفظ ${logTab === 'hifz' ? 'الحفظ' : 'المراجعة'} | Save`}
            </button>
          </form>
        </div>
      )}

      {/* PASSWORD MODAL */}
      {showPasswordModal && (
        <Modal onClose={() => !updatingPassword && setShowPasswordModal(false)} title="تغيير كلمة المرور | Change Password">
          <form onSubmit={handleChangePassword} className="space-y-3">
            <input type="password" required minLength={6} value={newPassword} onChange={e => setNewPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none text-sm" placeholder="New password / كلمة المرور الجديدة" disabled={updatingPassword} autoFocus />
            <input type="password" required minLength={6} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none text-sm" placeholder="Confirm / تأكيد" disabled={updatingPassword} />
            <ModalActions onCancel={() => setShowPasswordModal(false)} confirmLabel="Update / تحديث" isSubmit loading={updatingPassword} />
          </form>
        </Modal>
      )}

      {/* TARGET MODAL */}
      {showTargetModal && (
        <Modal onClose={() => setShowTargetModal(false)} title="الهدف الأسبوعي | Weekly Target">
          <input type="number" min={1} max={30} value={tempTarget} onChange={e => setTempTarget(Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-lg font-bold text-center outline-none" />
          <ModalActions onCancel={() => setShowTargetModal(false)} onConfirm={saveTarget} confirmLabel="حفظ | Save" />
        </Modal>
      )}

      {/* ADD STUDENT */}
      {showAddStudent && (
        <Modal onClose={() => setShowAddStudent(false)} title="إضافة طالب جديد | Add New Student">
          <form onSubmit={handleAddStudent}>
            <input value={newStudentName} onChange={e => setNewStudentName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" placeholder="اسم الطالب الكامل | Full name" autoFocus required />
            <ModalActions onCancel={() => setShowAddStudent(false)} confirmLabel="إضافة | Add" isSubmit loading={isSubmitting} />
          </form>
        </Modal>
      )}

      {/* EDIT STUDENT */}
      {showEditModal && editStudent && (
        <Modal onClose={() => setShowEditModal(false)} title="تعديل الاسم | Edit Name">
          <form onSubmit={handleEditStudent}>
            <input value={editName} onChange={e => setEditName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none" autoFocus required />
            <ModalActions onCancel={() => setShowEditModal(false)} confirmLabel="حفظ | Save" isSubmit loading={isSubmitting} />
          </form>
        </Modal>
      )}

      {/* DELETE */}
      {showDeleteConfirm && deleteStudent && (
        <Modal onClose={() => setShowDeleteConfirm(false)} title="حذف الطالب | Remove Student" danger>
          <p className="text-sm text-slate-300">Remove <strong className="text-white">{deleteStudent.name}</strong>? Data will be preserved.</p>
          <ModalActions onCancel={() => setShowDeleteConfirm(false)} onConfirm={handleDeleteStudent} confirmLabel="حذف | Remove" danger loading={isSubmitting} />
        </Modal>
      )}

      {/* HISTORY */}
      {showHistoryModal && historyStudent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4" onClick={() => setShowHistoryModal(false)}>
          <div className="bg-slate-900 rounded-2xl w-full max-w-2xl border border-slate-800 flex flex-col max-h-[90vh] animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <StudentAvatar name={historyStudent.name} size="md" />
                <div><h3 className="font-bold">{historyStudent.name}</h3><p className="text-xs text-slate-400">Full history / السجل الكامل</p></div>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-3 space-y-2">
              {historyLoading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500" /></div>
              : historyLogs.length === 0 ? <p className="text-slate-400 text-sm text-center py-10">No logs yet</p>
              : historyLogs.map(log => {
                const safhas = log.end_safha && log.start_safha ? Math.max(0, log.end_safha - log.start_safha + 1) : 0
                const isM = log.hifz_type === 'murajaah'
                return (
                  <div key={log.id} className={`p-3 rounded-xl border ${isM ? 'bg-purple-950/20 border-purple-800/40' : 'bg-slate-950/60 border-slate-800'}`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-xs font-bold ${isM ? 'text-purple-400' : 'text-blue-400'}`}>{isM ? '🔄 Murajaah' : '📖 Hifz'}</span>
                      <span className="text-lg font-bold">{safhas || '-'}</span>
                    </div>
                    <p className="text-xs text-slate-500">{log.week_start}</p>
                    {log.start_surah && <p className="text-xs text-slate-400 mt-1">{log.start_surah} → {log.end_surah}</p>}
                    {log.head_of_safha && <p className="text-xs text-indigo-400 mt-1 text-right" dir="rtl">📗 {log.head_of_safha}</p>}
                    {log.tail_of_safha && <p className="text-xs text-red-400 text-right" dir="rtl">📕 {log.tail_of_safha}</p>}
                    {log.comments && <p className="text-xs text-slate-400 italic mt-1 border-l-2 border-slate-700 pl-2">{log.comments}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* REPORT */}
      {showReportModal && reportStudent && (
        <Modal onClose={() => setShowReportModal(false)} title="Generate Report">
          <div className="space-y-3">
            <p className="font-semibold">{reportStudent.name}</p>
            <input value={teacherInputName} onChange={e => setTeacherInputName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none text-sm" placeholder="Mu'allim name" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setIsEndOfTerm(false)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold border ${!isEndOfTerm ? 'bg-indigo-700 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>Weekly</button>
              <button type="button" onClick={() => setIsEndOfTerm(true)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold border ${isEndOfTerm ? 'bg-amber-700 border-amber-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>End of Term</button>
            </div>
            <ModalActions onCancel={() => setShowReportModal(false)} onConfirm={generateStudentReport} confirmLabel="Generate PDF" />
          </div>
        </Modal>
      )}

      <footer className="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950/80 backdrop-blur-md py-2.5 text-center z-30">
        <p className="text-[10px] text-slate-600 tracking-widest uppercase">Alfirdaus Technologies Ltd</p>
      </footer>
    </div>
  )
}

/* ─── Sub-components ─── */

type StatCardProps = {
  icon: React.ReactNode
  value: number
  label: string
  color: 'blue' | 'indigo' | 'red'
  subtext?: string
}

function StatCard({ icon, value, label, color, subtext }: StatCardProps) {
  const c: Record<'blue' | 'indigo' | 'red', string> = {
    blue: 'text-blue-400 bg-blue-900/30',
    indigo: 'text-indigo-400 bg-indigo-900/30',
    red: 'text-red-400 bg-red-900/30'
  }
  return (
    <div className="bg-slate-900/60 backdrop-blur border border-slate-800 p-3 sm:p-4 rounded-xl">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${c[color] || c.indigo}`}>{icon}</div>
      <p className="text-xl sm:text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-400">{label}{subtext && <span className="text-slate-500"> · {subtext}</span>}</p>
    </div>
  )
}

type StudentCardProps = {
  student: DisplayStudent
  target: number
  index: number
  menuOpen: boolean
  onToggleMenu: (e: React.MouseEvent) => void
  onLog: () => void
  onHistory: () => void
  onShare: () => void
  onReport: () => void
  onEdit: () => void
  onDelete: () => void
}

function StudentCard({ student, target, index, menuOpen, onToggleMenu, onLog, onHistory, onShare, onReport, onEdit, onDelete }: StudentCardProps) {
  const s = student
  const isFirst = index === 0
  const bc: Record<'danger' | 'warning' | 'safe', string> = {
    danger: 'border-l-red-500',
    warning: 'border-l-amber-500',
    safe: 'border-l-indigo-500'
  }
  const borderColor = bc[s.status] || 'border-l-indigo-500'

  return (
    <div className={`relative ${menuOpen ? 'z-30' : 'z-0'} bg-slate-900/60 backdrop-blur border border-slate-800 border-l-4 ${borderColor} p-3 sm:p-4 rounded-xl transition-all hover:bg-slate-800/60 animate-slide-up`}
      style={{ animationDelay: `${index * 30}ms` }}>
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/teacher/student/${s.id}`}>
          <StudentAvatar name={s.name} size="md" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/dashboard/teacher/student/${s.id}`}
              id={isFirst ? 'tour-profile' : undefined}
              className="font-semibold text-white hover:text-indigo-300 transition-colors truncate">
              {s.name}
            </Link>
            {s.hifzLoggedThisWeek && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-950/60 text-indigo-400 border border-indigo-800/40 uppercase tracking-wide">
                <BookOpen className="w-2.5 h-2.5" /> Hifz
              </span>
            )}
            {s.murajaahLoggedThisWeek && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-950/60 text-purple-400 border border-purple-800/40 uppercase tracking-wide">
                <Repeat className="w-2.5 h-2.5" /> Muraj
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Juz {s.currentHizb} · Page {s.currentPage}</p>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={onShare}
            id={isFirst ? 'tour-whatsapp' : undefined}
            className="p-2 bg-indigo-950/60 hover:bg-indigo-900 text-indigo-400 border border-indigo-800/40 rounded-lg transition-all" title="Share to WhatsApp">
            <Share2 className="w-4 h-4" />
          </button>

          <div className="relative">
            <button onClick={onToggleMenu}
              id={isFirst ? 'tour-log' : undefined}
              className="p-2 hover:bg-slate-700 rounded-lg">
              <MoreVertical className="w-4 h-4 text-slate-400" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 w-48 py-1 animate-slide-up">
                <Link href={`/dashboard/teacher/student/${s.id}`} className="w-full px-3 py-2 flex items-center gap-2 text-sm text-indigo-300 hover:bg-slate-700 transition-colors">
                  <User className="w-4 h-4 text-indigo-400" />
                  <span>View Profile | ملف</span>
                </Link>
                <div className="border-t border-slate-700 my-1" />
                <MenuItem icon={<Calendar className="w-4 h-4" />} label="Log Progress | تسجيل" onClick={onLog} />
                <MenuItem icon={<Share2 className="w-4 h-4 text-indigo-400" />} label="WhatsApp Share" onClick={onShare} />
                <MenuItem icon={<FileText className="w-4 h-4" />} label="PDF Report" onClick={onReport} />
                <MenuItem icon={<History className="w-4 h-4" />} label="History | السجل" onClick={onHistory} />
                <MenuItem icon={<Pencil className="w-4 h-4" />} label="Edit Name | تعديل" onClick={onEdit} />
                <div className="border-t border-slate-700 my-1" />
                <MenuItem icon={<Trash2 className="w-4 h-4" />} label="Remove | حذف" onClick={onDelete} danger />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Last logged</span>
          <span className={`font-semibold ${s.status === 'danger' ? 'text-red-400' : s.status === 'warning' ? 'text-amber-400' : 'text-indigo-400'}`}>
            {s.lastWeekSafhas} / {target}
          </span>
        </div>
        <ProgressBar value={s.lastWeekSafhas} max={target} status={s.status} />
      </div>
    </div>
  )
}

type MenuItemProps = {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}

function MenuItem({ icon, label, onClick, danger }: MenuItemProps) {
  return (
    <button onClick={onClick} className={`w-full px-3 py-2 flex items-center gap-2 text-sm ${danger ? 'text-red-400 hover:bg-red-900/30' : 'text-slate-200 hover:bg-slate-700'}`}>
      {icon}<span>{label}</span>
    </button>
  )
}

type ModalProps = {
  children: React.ReactNode
  onClose: () => void
  title: string
  danger?: boolean
}

function Modal({ children, onClose, title, danger }: ModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`bg-slate-900 border ${danger ? 'border-red-800/50' : 'border-slate-800'} p-5 rounded-2xl w-full max-w-md space-y-3 animate-slide-up shadow-2xl`} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className={`font-bold text-lg ${danger ? 'text-red-400' : 'text-white'}`}>{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

type ModalActionsProps = {
  onCancel: () => void
  onConfirm?: () => void
  confirmLabel: string
  danger?: boolean
  isSubmit?: boolean
  loading?: boolean
}

function ModalActions({ onCancel, onConfirm, confirmLabel, danger, isSubmit, loading }: ModalActionsProps) {
  return (
    <div className="flex gap-2 mt-4">
      <button type="button" onClick={onCancel} disabled={loading} className="flex-1 bg-slate-700 hover:bg-slate-600 p-2.5 rounded-xl font-medium text-sm">Cancel | إلغاء</button>
      <button type={isSubmit ? 'submit' : 'button'} onClick={isSubmit ? undefined : onConfirm} disabled={loading}
        className={`flex-1 p-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 ${danger ? 'bg-red-700' : 'bg-indigo-700'}`}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
      </button>
    </div>
  )
}