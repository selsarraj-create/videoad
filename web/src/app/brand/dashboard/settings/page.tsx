"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { motion } from "framer-motion"
import {
    Building2, Mail, Phone, Globe, Save, Loader2,
    AlertCircle, CheckCircle, KeyRound, Trash2, Upload, X
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface BrandProfile {
    company_name: string
    invoice_email: string | null
    website: string | null
    logo_url: string | null
    phone: string | null
    bio: string | null
}

export default function BrandSettingsPage() {
    const supabase = createClient()
    const router = useRouter()

    const [email, setEmail] = useState("")
    const [profile, setProfile] = useState<BrandProfile>({
        company_name: "", invoice_email: null, website: null,
        logo_url: null, phone: null, bio: null,
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState("")
    const [error, setError] = useState("")

    // Password change
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [changingPassword, setChangingPassword] = useState(false)

    // Delete account
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deleteConfirmText, setDeleteConfirmText] = useState("")
    const [deleting, setDeleting] = useState(false)

    // Logo upload
    const [logoPreview, setLogoPreview] = useState<string | null>(null)
    const [uploadingLogo, setUploadingLogo] = useState(false)

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            setEmail(user.email || "")

            const { data } = await supabase
                .from('brands')
                .select('company_name, invoice_email, website, logo_url, phone, bio' as any)
                .eq('profile_id', user.id)
                .single()

            if (data) {
                const d = data as any
                setProfile({
                    company_name: d.company_name || "",
                    invoice_email: d.invoice_email || null,
                    website: d.website || null,
                    logo_url: d.logo_url || null,
                    phone: d.phone || null,
                    bio: d.bio || null,
                })
                if (d.logo_url) setLogoPreview(d.logo_url)
            }
            setLoading(false)
        }
        load()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        setError("")
        setSuccess("")

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error: err } = await supabase
            .from('brands')
            .update({
                company_name: profile.company_name,
                invoice_email: profile.invoice_email,
                website: profile.website,
                logo_url: profile.logo_url,
                phone: profile.phone,
                bio: profile.bio,
            } as any)
            .eq('profile_id', user.id)

        if (err) {
            setError(err.message)
        } else {
            setSuccess("Settings saved successfully")
            setTimeout(() => setSuccess(""), 3000)
        }
        setSaving(false)
    }

    const handleLogoUpload = async (file: File) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp']
        if (!allowed.includes(file.type)) {
            setError('Invalid image type')
            return
        }
        if (file.size > 2 * 1024 * 1024) {
            setError('Logo too large. Max 2MB')
            return
        }

        setUploadingLogo(true)
        setError("")

        try {
            const formData = new FormData()
            formData.append('file', file)

            const res = await fetch('/api/upload/product-image', {
                method: 'POST',
                body: formData,
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Upload failed')
            }

            const { url } = await res.json()
            setProfile(prev => ({ ...prev, logo_url: url }))
            setLogoPreview(url)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setUploadingLogo(false)
        }
    }

    const handlePasswordChange = async () => {
        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters')
            return
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        setChangingPassword(true)
        setError("")

        const { error: err } = await supabase.auth.updateUser({
            password: newPassword,
        })

        if (err) {
            setError(err.message)
        } else {
            setSuccess("Password changed successfully")
            setNewPassword("")
            setConfirmPassword("")
            setTimeout(() => setSuccess(""), 3000)
        }
        setChangingPassword(false)
    }

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== 'DELETE') return

        setDeleting(true)
        setError("")

        try {
            const res = await fetch('/api/admin/delete-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm: true }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to delete account')
            }

            await supabase.auth.signOut()
            router.push('/')
        } catch (err: any) {
            setError(err.message)
            setDeleting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full py-32">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="p-8 max-w-3xl mx-auto space-y-8">
            <div>
                <h1 className="font-serif text-3xl tracking-tight">Settings</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your brand profile and account.</p>
            </div>

            {/* Status Messages */}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                    <button onClick={() => setError("")} className="ml-auto"><X className="w-3 h-3" /></button>
                </div>
            )}
            {success && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    {success}
                </div>
            )}

            {/* Company Profile */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-nimbus/40 p-6 space-y-5"
            >
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Company Profile</h2>

                {/* Logo */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Company Logo</label>
                    <div className="flex items-center gap-4">
                        {logoPreview ? (
                            <div className="relative group">
                                <img src={logoPreview} alt="Logo" className="w-16 h-16 object-cover border border-nimbus/30 rounded" />
                                <button
                                    type="button"
                                    onClick={() => { setLogoPreview(null); setProfile(prev => ({ ...prev, logo_url: null })) }}
                                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ) : (
                            <div className="w-16 h-16 bg-nimbus/10 border border-dashed border-nimbus/40 flex items-center justify-center rounded">
                                <Building2 className="w-6 h-6 text-muted-foreground/30" />
                            </div>
                        )}
                        <div>
                            <button
                                type="button"
                                onClick={() => document.getElementById('logo-upload')?.click()}
                                disabled={uploadingLogo}
                                className="text-xs font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
                            >
                                {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                            </button>
                            <p className="text-[9px] text-muted-foreground/50 mt-0.5">JPEG, PNG, WebP · Max 2MB</p>
                        </div>
                        <input
                            id="logo-upload"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleLogoUpload(file)
                            }}
                        />
                    </div>
                </div>

                {/* Company Name */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Company Name</label>
                    <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                        <input
                            value={profile.company_name}
                            onChange={(e) => setProfile(prev => ({ ...prev, company_name: e.target.value }))}
                            className="w-full h-11 pl-10 pr-4 border border-nimbus/30 bg-white text-sm focus:outline-none focus:border-primary/50 transition-colors"
                        />
                    </div>
                </div>

                {/* Company Bio */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Company Bio</label>
                    <textarea
                        value={profile.bio || ""}
                        onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
                        placeholder="Brief description of your company..."
                        rows={3}
                        className="w-full px-4 py-3 border border-nimbus/30 bg-white text-sm focus:outline-none focus:border-primary/50 transition-colors resize-none"
                    />
                </div>

                {/* Email (read-only) */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Account Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                        <input
                            value={email}
                            disabled
                            className="w-full h-11 pl-10 pr-4 border border-nimbus/30 bg-nimbus/10 text-sm text-muted-foreground cursor-not-allowed"
                        />
                    </div>
                </div>

                {/* Invoice Email */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Invoice Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                        <input
                            value={profile.invoice_email || ""}
                            onChange={(e) => setProfile(prev => ({ ...prev, invoice_email: e.target.value }))}
                            placeholder="billing@yourcompany.com"
                            className="w-full h-11 pl-10 pr-4 border border-nimbus/30 bg-white text-sm focus:outline-none focus:border-primary/50 transition-colors"
                        />
                    </div>
                </div>

                {/* Phone */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Phone</label>
                    <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                        <input
                            value={profile.phone || ""}
                            onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="+44 7700 900000"
                            className="w-full h-11 pl-10 pr-4 border border-nimbus/30 bg-white text-sm focus:outline-none focus:border-primary/50 transition-colors"
                        />
                    </div>
                </div>

                {/* Website */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Website</label>
                    <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                        <input
                            value={profile.website || ""}
                            onChange={(e) => setProfile(prev => ({ ...prev, website: e.target.value }))}
                            placeholder="https://yourcompany.com"
                            className="w-full h-11 pl-10 pr-4 border border-nimbus/30 bg-white text-sm focus:outline-none focus:border-primary/50 transition-colors"
                        />
                    </div>
                </div>

                {/* Save */}
                <Button
                    onClick={handleSave}
                    disabled={saving || !profile.company_name.trim()}
                    className="h-11 bg-foreground text-white hover:bg-foreground/90 rounded-none text-xs uppercase tracking-[0.15em] font-bold px-8"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                </Button>
            </motion.div>

            {/* Password Change */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white border border-nimbus/40 p-6 space-y-5"
            >
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <KeyRound className="w-3.5 h-3.5" /> Change Password
                </h2>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">New Password</label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full h-11 px-4 border border-nimbus/30 bg-white text-sm focus:outline-none focus:border-primary/50 transition-colors"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Confirm Password</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat password"
                        className="w-full h-11 px-4 border border-nimbus/30 bg-white text-sm focus:outline-none focus:border-primary/50 transition-colors"
                    />
                </div>

                <Button
                    onClick={handlePasswordChange}
                    disabled={changingPassword || !newPassword || !confirmPassword}
                    className="h-11 bg-foreground text-white hover:bg-foreground/90 rounded-none text-xs uppercase tracking-[0.15em] font-bold px-8"
                >
                    {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
                </Button>
            </motion.div>

            {/* Danger Zone */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white border border-red-200 p-6 space-y-4"
            >
                <h2 className="text-xs font-bold uppercase tracking-widest text-red-600 flex items-center gap-2">
                    <Trash2 className="w-3.5 h-3.5" /> Danger Zone
                </h2>
                <p className="text-xs text-muted-foreground">
                    Permanently delete your account and all associated data. This action cannot be undone.
                </p>

                {!showDeleteConfirm ? (
                    <Button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="h-10 bg-white border border-red-300 text-red-600 hover:bg-red-50 rounded-none text-xs uppercase tracking-[0.15em] font-bold px-6"
                    >
                        Delete Account
                    </Button>
                ) : (
                    <div className="space-y-3 p-4 bg-red-50 border border-red-200">
                        <p className="text-xs text-red-700 font-bold">
                            Type DELETE to confirm account deletion:
                        </p>
                        <input
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder="Type DELETE"
                            className="w-full h-10 px-4 border border-red-300 bg-white text-sm focus:outline-none focus:border-red-500 transition-colors"
                        />
                        <div className="flex gap-3">
                            <Button
                                onClick={handleDeleteAccount}
                                disabled={deleteConfirmText !== 'DELETE' || deleting}
                                className="h-10 bg-red-600 text-white hover:bg-red-700 rounded-none text-xs uppercase tracking-[0.15em] font-bold px-6 disabled:opacity-50"
                            >
                                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Permanently Delete"}
                            </Button>
                            <Button
                                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText("") }}
                                className="h-10 bg-white border border-nimbus/40 text-foreground hover:bg-nimbus/10 rounded-none text-xs uppercase tracking-[0.15em] font-bold px-6"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    )
}
