'use client'
import Link from 'next/link'
import { useState, useRef, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const demoPads = [
  { emoji: '🥁', label: 'Kick',    color: 'red'    },
  { emoji: '🪘', label: 'Snare',   color: 'green'  },
  { emoji: '🎵', label: 'Hi-Hat',  color: 'blue'   },
  { emoji: '📯', label: 'Horn',    color: 'yellow' },
  { emoji: '🎯', label: 'Rimshot', color: 'purple' },
  { emoji: '🎸', label: '808',     color: 'pink'   },
  { emoji: '⬆️', label: 'Riser',   color: 'red'    },
  { emoji: '👏', label: 'Clap',    color: 'green'  },
  { emoji: '🎹', label: 'Synth',   color: 'blue'   },
]

export default function AuthPage() {
  const router = useRouter()
  const formRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [googleLoading, setGoogleLoading] = useState(false)
  const [activePad, setActivePad] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const recent: number[] = []

    function fire() {
      if (cancelled) return
      let next
      do { next = Math.floor(Math.random() * 9) }
      while (recent.includes(next))
      recent.push(next)
      if (recent.length > 3) recent.shift()
      setActivePad(next)
      setTimeout(() => {
        if (cancelled) return
        setActivePad(null)
        setTimeout(fire, 700 + Math.random() * 1300)
      }, 1400)
    }

    const t = setTimeout(fire, 900)
    return () => { cancelled = true; clearTimeout(t) }
  }, [])

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })
    setGoogleLoading(false)
  }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(''); setSuccess('')
    setLoading(true)
    try {
      if (tab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { setError(error.message); return }
        router.replace('/soundboard')
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) { setError(error.message); return }
        setSuccess('Account created — check your email to confirm, then sign in.')
        setTab('login')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-split-page">

      {/* ── LEFT PANEL ── */}
      <div className="auth-split-left">

        <div className="auth-split-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="auth-split-logo-img" />
          <div className="auth-split-brand-text">
            <span className="auth-split-brandname"><span className="logo-bracket">[</span><span className="logo-sage">sage</span><span className="logo-bracket">]</span><span className="logo-sounds">SOUNDS</span></span>
            <a
              href="https://www.linkedin.com/in/sageashique"
              target="_blank"
              rel="noopener noreferrer"
              className="auth-byline"
            >
              <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Built by Sage Ashique
            </a>
          </div>
          <button className="auth-mobile-signin" onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}>Sign in →</button>
        </div>

        <div className="auth-split-hero">
          <h1 className="auth-split-headline">
            Your sounds,<br />
            <span>one <kbd className="auth-tap-badge">tap</kbd> away.</span>
          </h1>

          {/* Subheading — breakpoint-specific copy */}
          <p className="auth-split-sub auth-sub-desktop">
            Upload your own sounds, map them to keyboard shortcuts, and fire them instantly — no plugins, no lag, no fumbling.
          </p>
          <p className="auth-split-sub auth-sub-tablet">
            Upload your own sounds, map them to shortcuts, and fire them instantly — no plugins, no fumbling.
          </p>
          <p className="auth-split-sub auth-sub-mobile">
            Upload your own sounds and fire them instantly — no plugins needed.
          </p>

          {/* 3×3 animated pad grid */}
          <div className="auth-demo-grid">
            {demoPads.map((pad, i) => (
              <div key={i} className={`auth-demo-pad adp-${pad.color}${activePad === i ? ' adp-active' : ''}`}>
                <span className="auth-demo-emoji">{pad.emoji}</span>
                <div className="auth-demo-bottom">
                  <span className="auth-demo-label">{pad.label}</span>
                  <div className="auth-demo-wave" aria-hidden="true">
                    <span/><span/><span/>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 2×2 feature grid — tablet+ */}
          <div className="auth-feature-grid">
            <div className="auth-feature-cell">
              <span className="auth-feature-icon">🎵</span>
              <div>
                <div className="auth-feature-title">Upload any audio</div>
                <div className="auth-feature-desc">MP3, WAV, or M4A — your sounds, your way</div>
              </div>
            </div>
            <div className="auth-feature-cell">
              <span className="auth-feature-icon">⚡</span>
              <div>
                <div className="auth-feature-title">Instant playback</div>
                <div className="auth-feature-desc">Fires the moment you tap or press a key</div>
              </div>
            </div>
            <div className="auth-feature-cell">
              <span className="auth-feature-icon">🎨</span>
              <div>
                <div className="auth-feature-title">Fully customizable</div>
                <div className="auth-feature-desc">Emoji or your own image on every pad</div>
              </div>
            </div>
            <div className="auth-feature-cell">
              <span className="auth-feature-icon">☁️</span>
              <div>
                <div className="auth-feature-title">Cloud synced</div>
                <div className="auth-feature-desc">Your setup on any device, always ready</div>
              </div>
            </div>
          </div>

          {/* Split CTA row */}
          <div className="auth-cta-row">
            <Link href="/demo" className="auth-cta-btn auth-cta-demo">Try the Demo</Link>
            <Link href="/about" className="auth-cta-btn auth-cta-about">About the App</Link>
          </div>

          {/* Trust chips — desktop only */}
          <div className="auth-trust-chips">
            {[
              'Free to start',
              'No credit card',
              'Works in any browser',
            ].map(label => (
              <span key={label} className="auth-trust-chip">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <polyline points="2,6 5,9 10,3" stroke="#818cf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="auth-split-right" ref={formRef}>
        <div className="auth-split-card">
          <div className="auth-split-card-title">
            {tab === 'login' ? 'Welcome back' : 'Create your account'}
          </div>
          <div className="auth-split-card-sub">
            {tab === 'login'
              ? 'Sign in to access your boards.'
              : 'Get started free — no credit card needed.'}
          </div>

          <button className="auth-google-btn" onClick={handleGoogleSignIn} disabled={googleLoading}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          <div className="auth-split-divider">
            <div className="auth-split-divider-line" />
            <span>OR</span>
            <div className="auth-split-divider-line" />
          </div>

          <div className="auth-tabs">
            <button
              className={`auth-tab${tab === 'login' ? ' active' : ''}`}
              onClick={() => { setTab('login'); setError(''); setSuccess('') }}
            >Sign in</button>
            <button
              className={`auth-tab${tab === 'signup' ? ' active' : ''}`}
              onClick={() => { setTab('signup'); setError(''); setSuccess('') }}
            >Sign up</button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="auth-field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={tab === 'signup' ? 'Min. 6 characters' : '••••••••'}
                required
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
            <div className="auth-error">
              {error || (success && <span className="auth-success">{success}</span>)}
            </div>
            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? 'Please wait…' : tab === 'login' ? 'Sign in →' : 'Create account →'}
            </button>
          </form>

          <div className="auth-split-footer">
            <Link href="/about" className="auth-split-footer-link">About the App</Link>
            <span className="auth-split-footer-sep">|</span>
            <a
              href="https://www.linkedin.com/in/sageashique"
              target="_blank"
              rel="noopener noreferrer"
              className="auth-split-footer-link"
            >
              <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Built by Sage Ashique
            </a>
          </div>
        </div>
      </div>

    </div>
  )
}
