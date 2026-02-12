export interface Workspace {
    id: string
    name: string
    created_at: string
}

export interface Project {
    id: string
    workspace_id: string
    name: string
    description?: string
    status: 'active' | 'archived'
    created_at: string
}

export interface VideoJob {
    id: string
    project_id: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    input_params: {
        prompt: string
        image_refs?: string[]
        duration?: number
    }
    output_url?: string
    error_message?: string
    created_at: string
}
