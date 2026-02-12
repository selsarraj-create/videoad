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

export type KieModel = 'veo-3.1-fast' | 'sora-2' | 'kling-2.6-quality' | 'hailuo-2.3'

export interface VideoJob {
    id: string
    project_id: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    input_params: {
        prompt: string
        image_refs?: string[]
        duration?: number
    }
    model?: KieModel
    tier?: 'draft' | 'production'
    provider_metadata?: Record<string, any>
    provider_task_id?: string
    output_url?: string
    error_message?: string
    created_at: string
}
