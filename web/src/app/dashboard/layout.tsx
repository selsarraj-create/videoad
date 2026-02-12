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
        <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-14 items-center">
                    <div className="mr-4 hidden md:flex">
                        <a className="mr-6 flex items-center space-x-2" href="/">
                            <span className="hidden font-bold sm:inline-block">
                                VideoAd SaaS
                            </span>
                        </a>
                        <nav className="flex items-center space-x-6 text-sm font-medium">
                            <a className="transition-colors hover:text-foreground/80 text-foreground" href="/dashboard">
                                Studio
                            </a>
                            <a className="transition-colors hover:text-foreground/80 text-foreground/60" href="/dashboard/settings">
                                Settings
                            </a>
                        </nav>
                    </div>
                    <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                        <div className="w-full flex-1 md:w-auto md:flex-none">
                            <WorkspaceSelector workspaces={workspaces} />
                        </div>
                        <nav className="flex items-center">
                            {/* User Profile UserNav here if implemented */}
                        </nav>
                    </div>
                </div>
            </header>
            <main className="flex-1 container py-6">
                {children}
            </main>
        </div>
    )
}
