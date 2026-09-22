import { NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const admin = getServiceRoleClient()
    const { name, target } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Class name is required' }, { status: 400 })
    }

    // Insert into classes
    const { data: newClass, error: classErr } = await admin
      .from('classes')
      .insert([{ display_name_en: name.trim(), status: 'active' }])
      .select()
      .single()

    if (classErr) throw classErr

    // Insert target settings
    const targetVal = Number(target) || 6
    await admin.from('class_settings').insert([{
      class_id: newClass.id,
      target_safhas_per_week: targetVal,
    }])

    return NextResponse.json({ success: true, class: newClass })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
