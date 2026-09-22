import { NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const admin = getServiceRoleClient()
    const { classId, name, target } = await request.json()

    if (!classId) {
      return NextResponse.json({ error: 'Class ID is required' }, { status: 400 })
    }

    if (name?.trim()) {
      await admin
        .from('classes')
        .update({ display_name_en: name.trim() })
        .eq('id', classId)
    }

    if (target) {
      await admin
        .from('class_settings')
        .update({ target_safhas_per_week: Number(target) })
        .eq('class_id', classId)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
