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

export interface Shot {
    id: string
    prompt: string
    action?: string // Specific action description
    duration: number
    cameraMove?: 'static' | 'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down' | 'zoom_in' | 'zoom_out'
    imageRef?: string // URL or File path
    motionSketch?: string // Data URL of canvas
}

export interface StoryboardProject {
    id: string
    name: string
    anchorShot?: {
        imageRef?: string
        stylePrompt?: string
    }
    shots: Shot[]
    status: 'draft' | 'rendering' | 'completed'
}

export interface ProjectData {
    mode: 'draft' | 'storyboard'
    shots: Shot[]
    anchorStyle: string
    selectedModelId: string
    is4k: boolean
    prompt?: string // For draft mode
}
