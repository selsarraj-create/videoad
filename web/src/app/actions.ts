"use server"

import { createClient } from "@/lib/supabase/server"
import { ProjectData } from "@/lib/types"

export async function saveProjectState(projectId: string, data: ProjectData) {
    const supabase = await createClient()

    // Check auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    // Upsert project data (creates row if it doesn't exist)
    const { error } = await supabase
        .from('projects')
        .upsert({
            id: projectId,
            data: data,
            user_id: user.id,
            updated_at: new Date().toISOString()
        }, { onConflict: 'id' })

    if (error) {
        console.error("Save error:", error)
        return { error: error.message }
    }

    return { success: true }
}

export async function loadProjectState(projectId: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('projects')
        .select('data')
        .eq('id', projectId)
        .single()

    if (error) return { error: error.message }
    return { data: data.data as ProjectData }
}
