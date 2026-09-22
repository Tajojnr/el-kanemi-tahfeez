'use client'

import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { FileText, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { StudentReportPDF } from './StudentReport'

type Props = {
  studentId: string
  studentName: string
  className: string
  classNameAr: string
  teacherName: string
  academicYear: string
  targetSafhas: number
}

export default function DownloadReportButton({
  studentId,
  studentName,
  className,
  classNameAr,
  teacherName,
  academicYear,
  targetSafhas
}: Props) {

  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)

    try {
      const { data: progress } = await supabase
        .from('weekly_progress')
        .select('*')
        .eq('student_id', studentId)
        .order('week_start')

      const formatted = (progress || []).map(p => ({
        weekStart: p.week_start,
        hifzType: p.hifz_type,
        totalSafhas: p.end_safha - p.start_safha + 1,
        dangerLevel: p.danger_level
      }))

      const blob = await pdf(
        <StudentReportPDF
          studentName={studentName}
          className={className}
          classNameAr={classNameAr}
          teacherName={teacherName}
          academicYear={academicYear}
          weeklyProgress={formatted}
          targetSafhas={targetSafhas}
        />
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${studentName.replace(/ /g, '_')}_Report.pdf`
      link.click()
      URL.revokeObjectURL(url)

    } catch (err) {
      console.error(err)
      alert('PDF generation failed.')
    }

    setLoading(false)
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="bg-blue-800 hover:bg-blue-700 text-white px-3 py-2 rounded text-xs flex items-center gap-2"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
      Report
    </button>
  )
}