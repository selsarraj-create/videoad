"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Building2, LogOut, LayoutDashboard, Megaphone, Settings } from "lucide-react"
import Link from "next/link"

const NAV_ITEMS = [
    { label: "Dashboard", href: "/brand/dashboard", icon: LayoutDashboard },
    { label: "Campaigns", href: "/brand/dashboard?tab=campaigns", icon: Megaphone },
    { label: "Settings", href: "/brand/dashboard?tab=settings", icon: Settings },
]

export default function BrandDashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [companyName, setCompanyName] = useState("")
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        async function loadBrand() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data } = await supabase
                .from('brands')
                .select('company_name')
                .eq('profile_id', user.id)
                .single()

            if (data) setCompanyName(data.company_name)
        }
        loadBrand()
    }, [])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push("/login")
    }

    return (
        <div className="min-h-screen bg-paper flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-nimbus/30 flex flex-col">
                {/* Brand logo area */}
                <div className="p-6 border-b border-nimbus/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Brand Portal</p>
                            <p className="text-sm font-bold truncate">{companyName || "Loading..."}</p>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 p-4 space-y-1">
                    {NAV_ITEMS.map((item) => (
                        <Link
                            key={item.label}
                            href={item.href}
                            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-nimbus/10 transition-colors"
                        >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                        </Link>
                    ))}
                </nav>

                {/* Logout */}
                <div className="p-4 border-t border-nimbus/20">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 w-full text-sm font-medium text-muted-foreground hover:text-red-600 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    )
}
