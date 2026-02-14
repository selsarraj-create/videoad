import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google"; // RedHat is also good, but Inter is standard tech
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" });

export const metadata: Metadata = {
  title: "Fashion Studio — AI Virtual Try-On & Video",
  description: "Upload a selfie, try on any clothing with AI, and generate stunning fashion videos in seconds.",
};

import { TooltipProvider } from "@/components/ui/tooltip"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${playfair.variable} font-sans antialiased bg-background text-foreground`}
      >
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
