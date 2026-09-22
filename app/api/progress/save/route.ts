import { NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const admin = getServiceRoleClient()
    const payload = await request.json()
    const {
      studentId, weekStart, hifzType, startSafha, endSafha,
      startSurah, endSurah, startAyah, endAyah, juzNumber,
      comments, headText, tailText
    } = payload

    if (!studentId || startSafha === undefined || endSafha === undefined) {
      return NextResponse.json({ error: 'Missing required student or page numbers' }, { status: 400 })
    }

    const progressData: Record<string, any> = {
      student_id: studentId,
      week_start: weekStart || new Date().toISOString().split('T')[0],
      hifz_type: hifzType || 'hifz',
      start_safha: Number(startSafha),
      end_safha: Number(endSafha),
      start_surah: startSurah || 'Al-Fatihah',
      start_ayah: Number(startAyah) || 1,
      end_surah: endSurah || 'Al-Fatihah',
      end_ayah: Number(endAyah) || 1,
      juz_number: Number(juzNumber) || 1,
      comments: comments ? String(comments).trim() : null,
      head_of_safha: headText ? String(headText).trim() : null,
      tail_of_safha: tailText ? String(tailText).trim() : null,
    }

    const { data: existing } = await admin
      .from('weekly_progress')
      .select('id')
      .eq('student_id', studentId)
      .eq('week_start', progressData.week_start)
      .eq('hifz_type', progressData.hifz_type)
      .maybeSingle()

    let saveError = null

    if (existing) {
      const { error: updateErr } = await admin.from('weekly_progress').update(progressData).eq('id', existing.id)
      saveError = updateErr
    } else {
      const { error: insertErr } = await admin.from('weekly_progress').insert([progressData])
      saveError = insertErr
    }

    if (saveError) throw saveError

    await admin.from('students').update({
      current_hizb: Number(juzNumber) || 1,
      current_page: Number(endSafha),
    }).eq('id', studentId)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Server error in /api/progress/save:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}