'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(() => router.replace('/soundboard'))
        .catch(() => router.replace('/auth'))
    } else {
      router.replace('/auth')
    }
  }, [router])

  return <div style={{ background: '#0f172a', minHeight: '100vh' }} />
}
