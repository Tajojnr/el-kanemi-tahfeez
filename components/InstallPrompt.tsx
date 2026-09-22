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
      // Show prompt after 3 seconds so it's not intrusive
      setTimeout(() => setShowPrompt(true), 3000)
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
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-2xl shadow-black/50 animate-slide-up max-w-md mx-auto">
      <button
        onClick={() => setShowPrompt(false)}
        className="absolute top-2 right-2 text-slate-500 hover:text-slate-300"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-900/50 rounded-xl flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Install El-Kanemi Tahfeez</p>
          <p className="text-xs text-slate-400">Access quickly from your home screen</p>
        </div>
        <button
          onClick={handleInstall}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
        >
          Install
        </button>
      </div>
    </div>
  )
}