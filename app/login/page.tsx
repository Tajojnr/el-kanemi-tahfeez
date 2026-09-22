'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Lock, Mail, Eye, EyeOff, BookOpen, WifiOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  const [termInfo, setTermInfo] = useState<{ name: string; current_week: number } | null>(null)
  const [rememberMe, setRememberMe] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const emailRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Staggered mount animation
  useEffect(() => {
    setMounted(true)
    emailRef.current?.focus()
  }, [])

  // Online/offline detection
  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    setIsOnline(navigator.onLine)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Fetch active term
  useEffect(() => {
    async function fetchTerm() {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (!url || !key) return
        const res = await fetch(
          `${url}/rest/v1/academic_terms?is_active=eq.true&select=name,current_week&limit=1`,
          {
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
            },
          }
        )
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) setTermInfo(data[0])
      } catch {
        // silent
      }
    }
    fetchTerm()
  }, [])

  function friendlyError(msg: string) {
    const m = msg.toLowerCase()
    if (m.includes('invalid')) return 'Incorrect email or password. Please try again.'
    if (m.includes('email')) return 'Please enter a valid email address.'
    if (m.includes('network') || m.includes('fetch')) return 'Connection error. Check your internet.'
    if (m.includes('too many')) return 'Too many attempts. Please wait a moment.'
    return 'Something went wrong. Please try again.'
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.')
      return
    }

    if (!isOnline) {
      setError('You are offline. Please check your connection.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setError(friendlyError(error.message))
      setLoading(false)
      return
    }

    // Route based on user role from Supabase (safer than hardcoded email)
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email === 'admin@elkanemi.school') {
      router.push('/dashboard/admin')
    } else {
      router.push('/dashboard/teacher')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-4 pb-24">
      {/* Background decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-md w-full relative z-10">
        {/* Offline banner */}
        {!isOnline && (
          <div
            className="mb-3 bg-red-950/80 border border-red-800 rounded-lg px-4 py-2 flex items-center gap-2 transition-all duration-500"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(-8px)',
            }}
          >
            <WifiOff className="w-4 h-4 text-red-400" />
            <p className="text-xs text-red-300">You are offline. Some features may not work.</p>
          </div>
        )}

        {/* Term banner */}
        {termInfo && (
          <div
            className="mb-4 bg-blue-950/60 backdrop-blur border border-blue-800/50 rounded-xl px-4 py-2.5 flex justify-between items-center transition-all duration-500 delay-100"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(8px)',
            }}
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-blue-400" />
              <p className="text-xs text-blue-300 font-medium">{termInfo.name}</p>
            </div>
            <span className="text-[10px] font-bold text-blue-400 bg-blue-900/50 px-2 py-0.5 rounded-full">
              Week {termInfo.current_week}
            </span>
          </div>
        )}

        {/* Login card */}
        <form
          onSubmit={handleLogin}
          className="w-full bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 p-6 sm:p-8 rounded-2xl shadow-2xl shadow-black/40 space-y-5 transition-all duration-700 delay-200"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          }}
        >
          {/* Logo + title */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto bg-blue-900/30 rounded-2xl flex items-center justify-center border border-blue-800/30">
              <img
                src="/logo/logo.png"
                alt="El-Kanemi Tahfeez"
                className="w-12 h-12 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">El-Kanemi College of Islamic Theology</h1>
            <p className="text-blue-400/80 text-sm">Tahfeez Management Portal</p>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-sm text-slate-300 flex items-center gap-2 font-medium">
              <Mail className="w-4 h-4 text-blue-400" />
              Email Address
            </label>
            <input
              ref={emailRef}
              type="email"
              required
              disabled={loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@elkanemi.school"
              className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all disabled:opacity-50 text-sm"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-sm text-slate-300 flex items-center gap-2 font-medium">
              <Lock className="w-4 h-4 text-blue-400" />
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all disabled:opacity-50 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember me + Forgot */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/30 cursor-pointer"
              />
              <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                Remember me
              </span>
            </label>
            <button
              type="button"
              className="text-xs text-blue-400/70 hover:text-blue-400 transition-colors"
              onClick={() => alert('Forgot password feature coming soon!')}
            >
              Forgot password?
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-950/50 border border-red-800/50 text-red-300 px-4 py-3 rounded-xl text-sm flex items-start gap-2 animate-pulse">
              <span className="mt-0.5">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-900/30"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-600 mt-6 tracking-wide">
          Powered by Alfirdaus Technologies Ltd
        </p>
      </div>
    </div>
  )
}