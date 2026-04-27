'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteSkill(roadmapId: string) {
  const supabase = await createClient()

  // 1. Verify Authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    // 2. Delete Associated Lessons (to avoid foreign key constraint errors if ON DELETE CASCADE is missing)
    await supabase
      .from('lessons')
      .delete()
      .eq('roadmap_id', roadmapId)
      .eq('user_id', user.id)

    // 3. Delete the Roadmap
    const { error: deleteError } = await supabase
      .from('roadmaps')
      .delete()
      .eq('id', roadmapId)
      .eq('user_id', user.id)

    if (deleteError) throw deleteError

    // 4. Revalidate pages to update the UI instantly
    revalidatePath('/skills')
    revalidatePath('/dashboard')
    revalidatePath('/roadmap')
    
    return { success: true }
  } catch (error: any) {
    console.error('Failed to delete skill:', error)
    return { success: false, error: error.message || 'Failed to delete skill' }
  }
}
