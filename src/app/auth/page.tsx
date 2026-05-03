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
        setSuccess('Account created — check your email to confirm, then log in.')
        setTab('login')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-wordmark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="auth-logo-icon" />
          SageSound
        </div>
        <p className="auth-tagline">Your personal soundboard — in any browser, on any device.<br />Sign in to save your sounds, labels, and colors across all your devices.</p>
        <div className="auth-tabs">
          <button
            className={`auth-tab${tab === 'login' ? ' active' : ''}`}
            onClick={() => { setTab('login'); setError(''); setSuccess('') }}
          >
            Log in
          </button>
          <button
            className={`auth-tab${tab === 'signup' ? ' active' : ''}`}
            onClick={() => { setTab('signup'); setError(''); setSuccess('') }}
          >
            Sign up
          </button>
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
              placeholder={tab === 'signup' ? 'Min. 6 characters' : ''}
              required
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          <div className="auth-error">
            {error || (success && <span className="auth-success">{success}</span>)}
          </div>
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : tab === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
        <div className="auth-footer">
          <Link href="/about" className="auth-footer-link">About this project</Link>
          <span className="auth-footer-sep">·</span>
          <a
            href="https://www.linkedin.com/in/sageashique"
            target="_blank"
            rel="noopener noreferrer"
            className="auth-footer-link"
          >
            Built by Sage Ashique
          </a>
        </div>
      </div>
    </div>
  )
}
