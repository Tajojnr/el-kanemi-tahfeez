import { NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const admin = getServiceRoleClient()
    const { classId, studentNames } = await request.json()

    if (!classId || !Array.isArray(studentNames) || studentNames.length === 0) {
      return NextResponse.json({ error: 'classId and array of studentNames are required' }, { status: 400 })
    }

    // Prepare batch payloads
    const payload = studentNames.map(name => ({
      full_name: name.trim(),
      class_id: classId,
      current_hizb: 1,
      current_page: 1,
      status: 'active'
    }))

    const { error } = await admin.from('students').insert(payload)
    if (error) throw error

    return NextResponse.json({ success: true, count: payload.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
