import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Video } from "lucide-react"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-white selection:bg-white selection:text-black">
      <header className="container mx-auto flex h-20 items-center justify-between px-6">
        <div className="flex items-center gap-2 text-xl font-bold tracking-tighter">
          <Video className="h-6 w-6" />
          <span>VideoAd SaaS</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            {/* Retaining buttons, just removing nav links as requested */}
            <Button variant="outline" className="text-black border-white hover:bg-zinc-200">
              Log in
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button className="bg-white text-black hover:bg-zinc-200">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-sm text-zinc-400 backdrop-blur">
            <span className="mr-2 flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            AI Powered Video Creation
          </div>

          <h1 className="text-5xl font-bold tracking-tight sm:text-7xl bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
            Create Viral Video Ads <br />
            <span className="text-white">in Seconds</span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-zinc-400 sm:text-xl">
            Turn simple product images and prompts into high-converting video commercials.
            No filming crews, no expensive editors—just pure AI magic.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/login">
              <Button size="lg" className="h-12 bg-white px-8 text-base text-black hover:bg-zinc-200">
                LOGIN
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="pt-12">
            <div className="relative mx-auto max-w-5xl rounded-xl border border-zinc-800 bg-zinc-900/50 p-2 shadow-2xl backdrop-blur">
              <div className="aspect-video w-full rounded-lg bg-zinc-950 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/10 via-transparent to-blue-500/10" />
                <p className="text-zinc-500">Demo Video Placeholder</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-900 bg-black py-12">
        <div className="container mx-auto px-6 text-center text-zinc-500">
          <p>&copy; 2026 VideoAd SaaS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
