'use client'

import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Show prompt after 2.5 seconds so it feels natural
      setTimeout(() => setShowPrompt(true), 2500)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-indigo-950/90 backdrop-blur-xl border border-indigo-700/60 rounded-2xl p-4 shadow-2xl shadow-black/80 animate-slide-up max-w-md mx-auto">
      <button
        onClick={() => setShowPrompt(false)}
        className="absolute top-2.5 right-2.5 text-slate-400 hover:text-white p-1"
        aria-label="Close install prompt"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 bg-indigo-900/50 border border-indigo-700/50 rounded-xl flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0 pr-4">
          <p className="text-sm font-bold text-white truncate">Install El-Kanemi App</p>
          <p className="text-xs text-slate-300 truncate">Add to home screen for 1-click access</p>
        </div>
        <button
          onClick={handleInstall}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shrink-0 shadow-md shadow-indigo-950/40"
        >
          Install
        </button>
      </div>
    </div>
  )
}