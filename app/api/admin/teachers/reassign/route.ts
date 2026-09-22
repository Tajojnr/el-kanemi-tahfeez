import { NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const admin = getServiceRoleClient()
    const { classId, newTeacherId } = await request.json()

    if (!classId || !newTeacherId) {
      return NextResponse.json({ error: 'classId and newTeacherId are required' }, { status: 400 })
    }

    const { data: newTeacher, error: teacherErr } = await admin
      .from('teachers')
      .select('*')
      .eq('id', newTeacherId)
      .single()

    if (teacherErr || !newTeacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 })
    }

    const { data: currentClass } = await admin
      .from('classes')
      .select('*')
      .eq('id', classId)
      .single()

    if (currentClass?.auth_user_id && currentClass.auth_user_id !== newTeacher.auth_user_id) {
      await admin.from('teacher_history').insert([{
        class_id: classId,
        teacher_auth_id: currentClass.auth_user_id,
        teacher_name: currentClass.teacher_name,
        teacher_email: currentClass.teacher_email,
        removed_at: new Date().toISOString(),
        reason: `Reassigned to ${newTeacher.full_name}`,
      }])
    }

    await admin
      .from('classes')
      .update({
        auth_user_id: newTeacher.auth_user_id,
        teacher_name: newTeacher.full_name,
        teacher_email: newTeacher.email,
        teacher_assigned_at: new Date().toISOString(),
      })
      .eq('id', classId)

    await admin.from('teacher_history').insert([{
      class_id: classId,
      teacher_auth_id: newTeacher.auth_user_id,
      teacher_name: newTeacher.full_name,
      teacher_email: newTeacher.email,
      assigned_at: new Date().toISOString(),
    }])

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
