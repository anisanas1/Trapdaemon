import type React from "react"
import type { Metadata } from "next"
import type { Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "TrapDaemon - Advanced Honeypot System",
  description: "Real-time threat detection and network security research tool",
  keywords: ["honeypot", "security", "pentesting", "cybersecurity", "trapdaemon"],
  authors: [{ name: "AnisAnas" }],
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      notranslate: true,
    },
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-green-500 font-mono min-h-screen antialiased">{children}</body>
    </html>
  )
}
