import Link from "next/link"
import { ArrowRight, Sparkles, Camera, Video, Layers, Zap, Upload, Eye } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-purple-500/30 overflow-hidden">

      {/* ===== NAVBAR ===== */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tighter">
              FASHION<span className="font-light text-zinc-600">STUDIO</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard"
              className="text-sm text-zinc-400 hover:text-white transition-colors px-4 py-2"
            >
              Dashboard
            </Link>
            <Link href="/dashboard"
              className="text-sm font-bold px-5 py-2 rounded-full bg-white text-black hover:bg-zinc-200 transition-all"
            >
              Get Started
              <ArrowRight className="w-3.5 h-3.5 inline ml-1.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className="relative pt-32 pb-20 px-6">
        {/* Background effects */}
        <div className="absolute top-20 left-1/4 w-[600px] h-[600px] bg-purple-600/8 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-[500px] h-[500px] bg-pink-600/8 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_#050505_70%)] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-800/40 bg-purple-900/10 px-4 py-1.5 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
            </span>
            <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">AI-Powered Fashion Content</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9]">
            <span className="bg-gradient-to-b from-white via-white to-zinc-500 bg-clip-text text-transparent">
              Try On. Create.
            </span>
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              Go Viral.
            </span>
          </h1>

          {/* Subheading */}
          <p className="mx-auto max-w-2xl text-lg sm:text-xl text-zinc-500 leading-relaxed">
            Upload a selfie, try on any clothing with AI, and generate
            <span className="text-zinc-300 font-medium"> cinematic fashion videos </span>
            ready for Reels, TikTok, and beyond.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/dashboard"
              className="group flex items-center gap-2 h-14 px-10 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-base shadow-[0_0_40px_rgba(168,85,247,0.3)] hover:shadow-[0_0_60px_rgba(168,85,247,0.5)] transition-all"
            >
              Start Creating
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <span className="text-xs text-zinc-600 font-medium">No account required • Free to try</span>
          </div>
        </div>
      </section>

      {/* ===== FLOW VISUAL ===== */}
      <section className="relative py-20 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Pipeline Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="group relative rounded-3xl border border-zinc-800/60 bg-zinc-900/30 p-8 hover:border-purple-800/40 hover:bg-zinc-900/50 transition-all duration-500">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-purple-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-900/30 border border-purple-800/40 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-[10px] font-black text-purple-400/60 uppercase tracking-[0.2em]">Step 01</span>
                </div>
                <h3 className="text-xl font-bold text-white">Upload & Try On</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Upload a selfie and a clothing item. Our AI places the garment on you with photorealistic accuracy.
                </p>
                <div className="h-48 rounded-2xl bg-zinc-950 border border-zinc-800/50 flex items-center justify-center overflow-hidden">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-24 rounded-xl bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-zinc-600" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-8 h-[2px] bg-gradient-to-r from-purple-600 to-pink-600" />
                      <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
                      <div className="w-8 h-[2px] bg-gradient-to-r from-purple-600 to-pink-600" />
                    </div>
                    <div className="w-20 h-24 rounded-xl bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-800/30 flex items-center justify-center">
                      <Eye className="w-6 h-6 text-purple-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="group relative rounded-3xl border border-zinc-800/60 bg-zinc-900/30 p-8 hover:border-pink-800/40 hover:bg-zinc-900/50 transition-all duration-500">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-pink-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-pink-900/30 border border-pink-800/40 flex items-center justify-center">
                    <Layers className="w-5 h-5 text-pink-400" />
                  </div>
                  <span className="text-[10px] font-black text-pink-400/60 uppercase tracking-[0.2em]">Step 02</span>
                </div>
                <h3 className="text-xl font-bold text-white">Choose a Vibe</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Pick from curated cinematic presets — editorial runway, golden hour, urban street, and more. One click, perfect style.
                </p>
                <div className="h-48 rounded-2xl bg-zinc-950 border border-zinc-800/50 p-4 grid grid-cols-3 gap-2">
                  {['🌆', '✨', '🌊', '🔥', '🌙', '💎'].map((emoji, i) => (
                    <div key={i} className={`rounded-xl border flex items-center justify-center text-lg transition-all ${i === 1
                      ? 'border-pink-600/50 bg-pink-900/20 shadow-[0_0_10px_rgba(236,72,153,0.2)] scale-105'
                      : 'border-zinc-800/50 bg-zinc-900/30 hover:border-zinc-700'
                      }`}>
                      {emoji}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="group relative rounded-3xl border border-zinc-800/60 bg-zinc-900/30 p-8 hover:border-rose-800/40 hover:bg-zinc-900/50 transition-all duration-500">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-rose-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-900/30 border border-rose-800/40 flex items-center justify-center">
                    <Video className="w-5 h-5 text-rose-400" />
                  </div>
                  <span className="text-[10px] font-black text-rose-400/60 uppercase tracking-[0.2em]">Step 03</span>
                </div>
                <h3 className="text-xl font-bold text-white">Generate Video</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Powered by Veo 3.1, your on-model image becomes a cinematic 8-second fashion clip — ready for social media.
                </p>
                <div className="h-48 rounded-2xl bg-zinc-950 border border-zinc-800/50 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-rose-900/10 to-transparent animate-pulse" />
                  <div className="text-center space-y-3 relative z-10">
                    <div className="w-12 h-12 rounded-full border-2 border-zinc-800 border-t-rose-500 mx-auto animate-[spin_3s_linear_infinite]" />
                    <p className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-bold">8s cinematic video</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <div className="space-y-4">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Everything you need for fashion content
            </h2>
            <p className="text-zinc-500 max-w-xl mx-auto">
              From virtual try-on to video generation — one platform, zero hassle.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Camera, label: 'Virtual Try-On', desc: 'AI dressing' },
              { icon: Sparkles, label: 'Smart Presets', desc: 'One-click vibes' },
              { icon: Video, label: 'Veo 3.1 Video', desc: '8s cinematic' },
              { icon: Zap, label: 'Media Library', desc: 'Store & reuse' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-2xl border border-zinc-800/50 bg-zinc-900/20 p-6 space-y-3 hover:border-zinc-700 transition-all">
                <div className="w-10 h-10 rounded-xl bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center mx-auto">
                  <Icon className="w-5 h-5 text-zinc-400" />
                </div>
                <h4 className="text-sm font-bold text-white">{label}</h4>
                <p className="text-[11px] text-zinc-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="py-24 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-purple-900/5 to-transparent pointer-events-none" />
        <div className="relative max-w-2xl mx-auto text-center space-y-8">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Ready to create?
            </span>
          </h2>
          <p className="text-zinc-500">
            Join the next generation of AI fashion content creation.
          </p>
          <Link href="/dashboard"
            className="inline-flex items-center gap-2 h-14 px-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-base shadow-[0_0_40px_rgba(168,85,247,0.3)] hover:shadow-[0_0_60px_rgba(168,85,247,0.5)] transition-all"
          >
            Open Fashion Studio
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-zinc-900 py-10">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-bold tracking-tighter text-zinc-600">
              FASHION<span className="font-light">STUDIO</span>
            </span>
          </div>
          <p className="text-[11px] text-zinc-700">&copy; 2026 Fashion Studio. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
