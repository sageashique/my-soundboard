'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import Soundboard from '@/components/Soundboard'

export default function SoundboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/auth'); return }
      setUser(session.user)
      setChecking(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      if (!session) { router.replace('/auth') }
    })
    return () => subscription.unsubscribe()
  }, [router])

  if (checking) return <div className="loading-screen">Loading…</div>
  if (!user) return null
  return <Soundboard user={user} />
}
