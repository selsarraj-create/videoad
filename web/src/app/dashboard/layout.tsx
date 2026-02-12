import { WorkspaceSelector } from "@/components/workspace-selector"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // In a real app, strict auth check:
    // if (!user) redirect("/login")

    // Mock workspaces for now since we haven't seeded DB
    const workspaces = [
        { id: "1", name: "Agency Scout", created_at: new Date().toISOString() },
        { id: "2", name: "Ecommerce", created_at: new Date().toISOString() },
        { id: "3", name: "Real Estate", created_at: new Date().toISOString() },
    ]

    return (
        <div className="flex min-h-screen flex-col bg-[#121212]">
            {/* 
                Removed Default Header "VideoAd SaaS" to allow StudioPage to control the full immersive experience.
                If navigation is needed, it should be integrated into the StudioPage header or a Sidebar.
             */}
            <main className="flex-1 flex flex-col h-screen">
                {children}
            </main>
        </div>
    )
}
