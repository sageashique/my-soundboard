'use client'
import Link from 'next/link'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'login' | 'signup'>('login')
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
      <div className="auth-split-right">
        <div className="auth-split-card">
          <div className="auth-split-card-title">
            {tab === 'login' ? 'Welcome back' : 'Create your account'}
          </div>
          <div className="auth-split-card-sub">
            {tab === 'login'
              ? 'Sign in to access your boards.'
              : 'Get started free — no credit card needed.'}
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

          <div className="auth-split-divider">
            <div className="auth-split-divider-line" />
            <span>OR</span>
            <div className="auth-split-divider-line" />
          </div>

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
