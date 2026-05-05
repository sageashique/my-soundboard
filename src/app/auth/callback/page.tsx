'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    // Supabase auto-detects the code in the URL — we just wait for session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.replace('/soundboard')
      }
    })

    // In case auto-detection already fired before the listener was attached
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/soundboard')
    })

    return () => subscription.unsubscribe()
  }, [router])

  return <div style={{ background: '#0f172a', minHeight: '100vh' }} />
}
