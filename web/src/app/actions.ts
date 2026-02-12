"use server"

import { createClient } from "@/lib/supabase/server"
import { ProjectData } from "@/lib/types"

export async function saveProjectState(projectId: string, data: ProjectData) {
    const supabase = await createClient()

    // Check auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    // Upsert project data
    const { error } = await supabase
        .from('projects')
        .update({
            data: data,
            updated_at: new Date().toISOString()
        })
        .eq('id', projectId)

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
