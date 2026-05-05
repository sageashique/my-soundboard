'use client'
import Link from 'next/link'
import { useState, useRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthPage() {
  const router = useRouter()
  const formRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [googleLoading, setGoogleLoading] = useState(false)

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
          <div className="auth-split-logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="4"/>
              <path d="M8 12h8M12 8v8"/>
            </svg>
          </div>
          <span className="auth-split-brandname">[sage]SOUNDS</span>
          <button className="auth-mobile-signin" onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}>Sign in →</button>
        </div>

        <div className="auth-split-hero">
          <h1 className="auth-split-headline">
            Your sounds,<br />
            <span>one <kbd className="auth-tap-badge">tap</kbd> away.</span>
          </h1>
          <p className="auth-split-sub">
            Built for live meetings, streams, and content creation.<span className="auth-sub-extra"> Tap a pad or press a key to drop any sound at exactly the right moment.</span>
          </p>

          <div className="auth-split-pills">
            <div className="auth-split-pills-track">
              <span className="auth-split-pill">🎵 Upload your own audio</span>
              <span className="auth-split-pill">🎙️ Works on any device</span>
              <span className="auth-split-pill">🎛️ Up to 5 soundboards</span>
              <span className="auth-split-pill">🔒 Free to get started</span>
              <span className="auth-split-pill">☁️ Cross-device sync</span>
              <span className="auth-split-pill">⌨️ Keyboard shortcuts</span>
              <span className="auth-split-pill">🎵 Upload your own audio</span>
              <span className="auth-split-pill">🎙️ Works on any device</span>
              <span className="auth-split-pill">🎛️ Up to 5 soundboards</span>
              <span className="auth-split-pill">🔒 Free to get started</span>
              <span className="auth-split-pill">☁️ Cross-device sync</span>
              <span className="auth-split-pill">⌨️ Keyboard shortcuts</span>
            </div>
          </div>

          <div className="auth-split-padgrid">
            {/* Row 1 */}
            <div className="auth-mini-pad mp-red">🥁<span>Kick</span></div>
            <div className="auth-mini-pad mp-green">🪘<span>Snare</span></div>
            <div className="auth-mini-pad mp-blue">🎵<span>Hi-Hat</span></div>
            <div className="auth-mini-pad mp-yellow">📯<span>Horn</span></div>
            {/* Row 2 */}
            <div className="auth-mini-pad mp-purple">🎯<span>Rimshot</span></div>
            <div className="auth-mini-pad mp-pink">🎸<span>808</span></div>
            <div className="auth-mini-pad mp-red">⬆️<span>Riser</span></div>
            <div className="auth-mini-pad mp-green">👏<span>Clap</span></div>
            {/* Row 3 */}
            <div className="auth-mini-pad mp-blue">🚨<span>Siren</span></div>
            <div className="auth-mini-pad mp-yellow">💿<span>Scratch</span></div>
            <div className="auth-mini-pad mp-purple">💨<span>Swoosh</span></div>
            <div className="auth-mini-pad mp-pink auth-mini-enter">🔔<span>Notif</span></div>
            {/* Row 4 */}
            <div className="auth-mini-pad mp-green auth-mini-0">😂<span>Laugh</span></div>
            <div className="auth-mini-pad mp-blue">🎹<span>Synth</span></div>
            {/* Stop bar */}
            <div className="auth-mini-stop">⏹ STOP ALL</div>
          </div>

          <Link href="/demo" className="auth-split-demo-cta">
            🎛️ Try the demo — no account needed
            <span>→</span>
          </Link>
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

          <Link href="/demo" className="auth-split-demo-btn">
            🎛️ Try the demo without an account
          </Link>

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
