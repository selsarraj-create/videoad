"use client"

import { useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, useScroll, useTransform } from "framer-motion"
import { ArrowRight, Sparkles, Camera, Play, Upload, ScanLine, Layers } from "lucide-react"

export default function Home() {
  const containerRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  })

  const y1 = useTransform(scrollYProgress, [0, 1], [0, 200])
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -150])

  return (
    <div ref={containerRef} className="min-h-screen bg-background text-foreground selection:bg-primary/20 overflow-hidden font-sans">

      {/* ===== NAVBAR ===== */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 px-6 py-6"
      >
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-none bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-serif text-2xl tracking-tighter mix-blend-difference text-foreground">
              FASHION<span className="font-sans text-xs tracking-widest ml-1 opacity-60">STUDIO</span>
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/dashboard"
              className="hidden md:block text-xs uppercase tracking-[0.2em] hover:text-primary transition-colors"
            >
              Sign In
            </Link>
            <Link href="/dashboard"
              className="glass-button px-8 py-3 text-xs font-bold uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all duration-500"
            >
              Start Creating
            </Link>
          </div>
        </div>
      </motion.header>

      {/* ===== HERO SECTION ===== */}
      <section className="relative min-h-screen flex flex-col justify-center px-6 pt-24 pb-12 lg:pt-32 lg:pb-20">
        <div className="max-w-[1800px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 items-center">

          {/* Typography Column */}
          <div className="lg:col-span-7 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-8 flex items-center gap-3"
            >
              <div className="flex -space-x-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-zinc-200" />
                ))}
              </div>
              <span className="text-sm font-medium text-muted-foreground">Trusted by 5,000+ Creators</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
            >
              <h1 className="font-serif text-7xl lg:text-9xl text-primary leading-[0.9] tracking-tight mix-blend-darken">
                High-Fashion Content, <br />
                <span className="italic font-light">Generated in 3 Clicks</span>
              </h1>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="mt-12 max-w-lg lg:mr-24"
            >
              <p className="text-lg font-light text-muted-foreground leading-relaxed">
                Step into the future of digital expression. Upload your essence,
                drape yourself in virtual silk, and craft cinematic moments
                that blur the line between reality and dream.
              </p>

              <div className="mt-10 flex items-center gap-6">
                <Link href="/dashboard"
                  className="frosted-touch text-foreground px-10 py-5 text-sm uppercase tracking-widest font-bold hover:shadow-[0_8px_32px_0_rgba(31,38,135,0.1)] hover:scale-105 hover:bg-white/40 transition-all duration-300 rounded-sm"
                >
                  Start Creating Now
                </Link>
                <span className="text-xs text-muted-foreground uppercase tracking-widest">No credit card required</span>
              </div>
            </motion.div>
          </div>

          {/* Visual Column - Product Preview Animation */}
          <div className="lg:col-span-5 relative h-[50vh] lg:h-[70vh] w-full">
            <motion.div style={{ y: y1 }} className="absolute inset-0 z-0">
              <div className="relative w-full h-full overflow-hidden bg-[#e5e0dc]">
                {/* Layer 1: Base Image (Upload/Raw) */}
                <Image
                  src="/step-upload.png"
                  alt="Raw Upload"
                  fill
                  className="object-cover opacity-100"
                  priority
                />

                {/* Layer 2: Transformation (Hero/Final) - Looping Opacity */}
                <motion.div
                  animate={{ opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 4, repeat: Infinity, times: [0, 0.4, 0.8, 1], repeatDelay: 1 }}
                  className="absolute inset-0"
                >
                  <Image
                    src="/hero-fashion.png"
                    alt="Transformed Fashion"
                    fill
                    className="object-cover"
                    priority
                  />
                </motion.div>

                {/* UI Overlay for "Scanning/Processing" Effect */}
                <motion.div
                  animate={{ top: ["0%", "100%", "0%"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="absolute left-0 right-0 h-1 bg-white/50 backdrop-blur-md shadow-[0_0_20px_rgba(255,255,255,0.5)] z-20"
                />

                {/* Grain Overlay */}
                <div className="absolute inset-0 bg-noise opacity-30 mix-blend-overlay pointer-events-none z-30" />
              </div>
            </motion.div>

            {/* Floating Elements */}
            <motion.div
              style={{ y: y2 }}
              className="absolute -bottom-8 -left-8 w-56 h-72 bg-white p-3 shadow-2xl hidden lg:block z-40"
            >
              <div className="w-full h-full border border-black/5 relative overflow-hidden">
                <Image
                  src="/step-video.png"
                  alt="Motion Detail"
                  fill
                  className="object-cover"
                />
                <div className="absolute bottom-4 left-4 bg-white/90 px-3 py-1 text-[10px] uppercase tracking-widest">
                  Collection '26
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== EDITORIAL FLOW ===== */}
      <section className="py-32 px-6 bg-paper relative">
        <div className="max-w-[1800px] mx-auto space-y-32">

          {/* Step 01 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="order-2 md:order-1 relative aspect-[4/5] bg-white p-2 shadow-lg rotate-1"
            >
              <Image
                src="/step-upload.png"
                alt="Upload Interface"
                fill
                className="object-cover"
              />
              <div className="absolute top-6 right-6">
                <div className="w-12 h-12 flex items-center justify-center bg-white rounded-full text-primary border border-primary/10">
                  <ScanLine className="w-5 h-5" />
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="order-1 md:order-2 space-y-8 pl-0 md:pl-12"
            >
              <span className="text-xs uppercase tracking-[0.3em] text-secondary-foreground/60 border-l mb-4 pl-3 border-primary/30">
                Phase One
              </span>
              <h2 className="font-serif text-6xl md:text-7xl text-primary leading-none">
                Digital <br /> <span className="italic text-foreground/80">Transformation</span>
              </h2>
              <p className="text-muted-foreground max-w-md leading-loose">
                Upload your image. Our neural engine maps your geometry, preserving lighting and texture to prepare your digital twin for high-fashion draping.
              </p>
            </motion.div>
          </div>

          {/* Step 02 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="space-y-8 text-right pr-0 md:pr-12"
            >
              <div className="flex flex-col items-end">
                <span className="text-xs uppercase tracking-[0.3em] text-secondary-foreground/60 border-r mb-4 pr-3 border-primary/30">
                  Phase Two
                </span>
                <h2 className="font-serif text-6xl md:text-7xl text-primary leading-none">
                  Curated <br /> <span className="italic text-foreground/80">Lookbook</span>
                </h2>
                <p className="text-muted-foreground max-w-md ml-auto leading-loose pt-4">
                  Select from our archive of cinematic presets. From "Golden Hour" to "Urban Noir", apply professional color grading and atmosphere with a single touch.
                </p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative aspect-video bg-white p-2 shadow-lg -rotate-1"
            >
              <div className="w-full h-full bg-[#f0eee9] flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                  <div className="bg-[#5D4037]/10" />
                  <div className="bg-[#A8A8A8]/10" />
                  <div className="bg-[#A8A8A8]/10" />
                  <div className="bg-[#5D4037]/10" />
                </div>
                <Layers className="w-16 h-16 text-primary/20 relative z-10" />
              </div>
            </motion.div>
          </div>

          {/* Step 03 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="order-2 md:order-1 relative aspect-[4/3] bg-white p-2 shadow-2xl skew-y-1 block"
            >
              <Image
                src="/step-video.png"
                alt="Video Output"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/40 cursor-pointer hover:bg-white/20 transition-all">
                  <Play className="w-8 h-8 text-white fill-current ml-1" />
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="order-1 md:order-2 space-y-8 pl-0 md:pl-12"
            >
              <span className="text-xs uppercase tracking-[0.3em] text-secondary-foreground/60 border-l mb-4 pl-3 border-primary/30">
                Phase Three
              </span>
              <h2 className="font-serif text-6xl md:text-7xl text-primary leading-none">
                Motion <br /> <span className="italic text-foreground/80">Architecture</span>
              </h2>
              <p className="text-muted-foreground max-w-md leading-loose">
                Static becomes kinetic. Powered by Veo 3.1, generate 8-second cinematic videos ready for high-resolution broadcast.
              </p>
            </motion.div>
          </div>

        </div>
      </section>

      {/* ===== CALL TO ACTION ===== */}
      <section className="py-40 px-6 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[#e5e0dc] opacity-50" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-12">
          <motion.h2
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="font-serif text-5xl md:text-8xl text-primary"
          >
            Begin Your <br /> <span className="italic font-light">Exhibition</span>
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <Link href="/dashboard"
              className="inline-block glass-button px-12 py-5 text-sm uppercase tracking-widest font-bold text-primary hover:bg-primary hover:text-white transition-all duration-500"
            >
              Enter Studio
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-primary/10 py-8 px-6 bg-[#FAFAFA]">
        <div className="max-w-[1800px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 opacity-60">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-serif text-lg tracking-tight">FASHION<span className="font-sans text-[10px] ml-1 opacity-60">STUDIO</span></span>
          </div>
          <div className="flex gap-6 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
          </div>
          <p className="text-[10px] text-muted-foreground opacity-60">
            LookMaison.com All Rights Reserved. Copyright &copy; 2026
          </p>
        </div>
      </footer>
    </div>
  )
}
