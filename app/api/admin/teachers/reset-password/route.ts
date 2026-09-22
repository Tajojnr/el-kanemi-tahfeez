import { NextResponse } from 'next/server'
import { getServiceRoleClient, generateTeacherPassword } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const admin = getServiceRoleClient()
    const { authUserId, teacherName } = await request.json()

    if (!authUserId) {
      return NextResponse.json({ error: 'Auth User ID is required' }, { status: 400 })
    }

    const newPassword = generateTeacherPassword(teacherName || 'Teacher')

    const { error } = await admin.auth.admin.updateUserById(authUserId, {
      password: newPassword,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      newPassword,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
