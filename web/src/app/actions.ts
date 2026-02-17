"use server"

import { createClient } from "@/lib/supabase/server"
import { ProjectData } from "@/lib/types"

/**
 * Ensures the user has a default workspace and project.
 * Returns the project ID to use for jobs and state persistence.
 */
export async function getOrCreateDefaultProject(): Promise<{ projectId: string | null, error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { projectId: null, error: "Unauthorized" }

    // 1. Check for existing workspace
    const { data: existingWorkspaces } = await supabase
        .from('workspaces')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)

    let workspaceId: string

    if (existingWorkspaces && existingWorkspaces.length > 0) {
        workspaceId = existingWorkspaces[0].id
    } else {
        // Create a default workspace
        const { data: newWorkspace, error: wsError } = await supabase
            .from('workspaces')
            .insert({ name: 'My Studio', user_id: user.id })
            .select('id')
            .single()

        if (wsError || !newWorkspace) {
            console.error("Workspace creation error:", wsError)
            return { projectId: null, error: wsError?.message || "Failed to create workspace" }
        }
        workspaceId = newWorkspace.id
    }

    // 2. Check for existing project in workspace
    const { data: existingProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('workspace_id', workspaceId)
        .limit(1)

    if (existingProjects && existingProjects.length > 0) {
        return { projectId: existingProjects[0].id }
    }

    // Create a default project
    const { data: newProject, error: projError } = await supabase
        .from('projects')
        .insert({ workspace_id: workspaceId, name: 'Default Project' })
        .select('id')
        .single()

    if (projError || !newProject) {
        console.error("Project creation error:", projError)
        return { projectId: null, error: projError?.message || "Failed to create project" }
    }

    return { projectId: newProject.id }
}

export async function saveProjectState(projectId: string, data: ProjectData) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Unauthorized" }

    const { error } = await supabase
        .from('projects')
        .update({
            data: data as any,
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
    return { data: data.data as unknown as ProjectData }
}
