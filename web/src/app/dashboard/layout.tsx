import { createClient } from "@/lib/supabase/server"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    return (
        <div className="flex min-h-screen flex-col bg-[#0a0a0a]">
            <main className="flex-1 flex flex-col h-screen">
                {children}
            </main>
        </div>
    )
}
