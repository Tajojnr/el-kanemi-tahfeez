import { NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const admin = getServiceRoleClient()
    const { studentId, targetClassId } = await request.json()

    if (!studentId || !targetClassId) {
      return NextResponse.json({ error: 'studentId and targetClassId are required' }, { status: 400 })
    }

    const { error } = await admin
      .from('students')
      .update({ class_id: targetClassId })
      .eq('id', studentId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
