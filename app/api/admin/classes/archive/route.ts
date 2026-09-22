import { NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const admin = getServiceRoleClient()
    const { classId, archive } = await request.json()

    if (!classId) {
      return NextResponse.json({ error: 'Class ID is required' }, { status: 400 })
    }

    const { error } = await admin
      .from('classes')
      .update({ status: archive ? 'archived' : 'active' })
      .eq('id', classId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
