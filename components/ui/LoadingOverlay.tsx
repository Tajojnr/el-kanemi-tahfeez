'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

export function LoadingOverlay({ isLoading, text }: { isLoading: boolean; text?: string }) {
  const [shouldRender, setShouldRender] = useState(isLoading)

  // This enables smooth fade out before removing from the DOM
  useEffect(() => {
    if (isLoading) {
      setShouldRender(true)
    } else {
      const timeout = setTimeout(() => setShouldRender(false), 300) // matches fade out
      return () => clearTimeout(timeout)
    }
  }, [isLoading])

  if (!shouldRender) return null

  return (
    <div 
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-all duration-300 ${
        isLoading 
          ? 'opacity-100 bg-slate-950/60 backdrop-blur-md animate-fade-in-blur' 
          : 'opacity-0 bg-transparent backdrop-blur-none'
      }`}
      style={{ pointerEvents: 'auto' }} // Blocks all clicks underneath
    >
      <div className="relative flex flex-col items-center justify-center">
        {/* Breathing Logo */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 relative animate-breathe drop-shadow-2xl">
          <img 
            src="/logo/logo.png" 
            alt="Loading..." 
            className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          />
        </div>
        
        {/* Optional Subtext */}
        {text && (
          <p className="mt-6 text-sm font-medium text-emerald-400 tracking-widest uppercase animate-pulse">
            {text}
          </p>
        )}
      </div>
    </div>
  )
}