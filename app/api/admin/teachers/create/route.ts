import { NextResponse } from 'next/server'
import { getServiceRoleClient, generateTeacherPassword } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const admin = getServiceRoleClient()
    const { fullName, email, classId } = await request.json()

    if (!fullName || !email) {
      return NextResponse.json({ error: 'Full name and email are required' }, { status: 400 })
    }

    const cleanEmail = email.trim().toLowerCase()
    const cleanName = fullName.trim()
    const password = generateTeacherPassword(cleanName)

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        role: 'teacher',
      },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const authUserId = authData.user.id

    // 2. Insert into teachers table
    const { data: teacherRecord, error: teacherError } = await admin
      .from('teachers')
      .insert([{
        auth_user_id: authUserId,
        full_name: cleanName,
        email: cleanEmail,
        is_active: true,
      }])
      .select()
      .single()

    if (teacherError) {
      await admin.auth.admin.deleteUser(authUserId)
      return NextResponse.json({ error: teacherError.message }, { status: 500 })
    }

    // 3. If a class was assigned, link it & record history
    if (classId) {
      const { data: existingClass } = await admin
        .from('classes')
        .select('auth_user_id, teacher_name, teacher_email')
        .eq('id', classId)
        .single()

      if (existingClass?.auth_user_id && existingClass.auth_user_id !== authUserId) {
        await admin.from('teacher_history').insert([{
          class_id: classId,
          teacher_auth_id: existingClass.auth_user_id,
          teacher_name: existingClass.teacher_name,
          teacher_email: existingClass.teacher_email,
          removed_at: new Date().toISOString(),
          reason: `Replaced by ${cleanName}`,
        }])

        await admin
          .from('teachers')
          .update({ is_active: false, deactivated_at: new Date().toISOString() })
          .eq('auth_user_id', existingClass.auth_user_id)
      }

      await admin
        .from('classes')
        .update({
          auth_user_id: authUserId,
          teacher_name: cleanName,
          teacher_email: cleanEmail,
          teacher_assigned_at: new Date().toISOString(),
        })
        .eq('id', classId)

      await admin.from('teacher_history').insert([{
        class_id: classId,
        teacher_auth_id: authUserId,
        teacher_name: cleanName,
        teacher_email: cleanEmail,
        assigned_at: new Date().toISOString(),
      }])
    }

    return NextResponse.json({
      success: true,
      teacher: teacherRecord,
      generatedPassword: password,
    })
  } catch (err: any) {
    console.error('Error creating teacher:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
