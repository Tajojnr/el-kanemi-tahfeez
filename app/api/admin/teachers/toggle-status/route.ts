import { NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const admin = getServiceRoleClient()
    const { teacherId, authUserId, activate } = await request.json()

    if (!teacherId || !authUserId) {
      return NextResponse.json({ error: 'Missing required IDs' }, { status: 400 })
    }

    await admin
      .from('teachers')
      .update({
        is_active: activate,
        deactivated_at: activate ? null : new Date().toISOString(),
      })
      .eq('id', teacherId)

    await admin.auth.admin.updateUserById(authUserId, {
      ban_duration: activate ? 'none' : '876000h',
    })

    if (!activate) {
      await admin
        .from('classes')
        .update({
          auth_user_id: null,
          teacher_name: null,
          teacher_email: null,
        })
        .eq('auth_user_id', authUserId)
    }

    return NextResponse.json({ success: true, is_active: activate })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
