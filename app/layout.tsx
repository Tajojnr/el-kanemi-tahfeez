import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { ToastProvider } from '@/components/Toast'
import InstallPrompt from '@/components/InstallPrompt'
import { cn } from "@/lib/utils"

// Fonts config
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-sans'
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

// PWA and Web App configuration
export const metadata: Metadata = {
  title: 'El-Kanemi Tahfeez Tahfeez',
  description: 'Hifz Management System for El-Kanemi College of Islamic Theology',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'El-Kanemi Tahfeez',
  },
}

// Controls safe-area layouts and screen zoom on mobile devices
export const viewport: Viewport = {
  themeColor: '#020617', // Dark slate/emerald theme matching your css
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}
    >
      <body>
        <ThemeProvider>
          {/* ToastProvider lets any page/component in the app throw non-blocking notifications */}
          <ToastProvider>
            {children}
            
            {/* Renders the "Install App" popup natively for teachers on mobile/desktop browsers */}
            <InstallPrompt />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}