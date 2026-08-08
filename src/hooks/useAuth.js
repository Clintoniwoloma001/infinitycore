import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// Auth hook backed by Supabase Auth (JWT sessions).
// The authenticated user's role is read from the `profiles` table (joined to auth.users).
export function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)

  const fetchProfile = async (sessionUser) => {
    if (!sessionUser) {
      setProfile(null)
      return null
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', sessionUser.id).single()
    setProfile(data)
    return data
  }

  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        if (session?.user) {
          setUser(session.user)
          await fetchProfile(session.user)
        }
      } catch (e) {
        if (mounted) setAuthError(true)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    init()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null)
      if (session?.user) await fetchProfile(session.user)
      else setProfile(null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const role = profile?.role || 'staff'
  return {
    user,
    profile,
    role,
    isAdmin: role === 'admin',
    isManager: role === 'manager',
    canApprove: role === 'admin' || role === 'manager',
    name: profile?.full_name || user?.email || 'User',
    loading,
    authError,
    signIn,
    signUp,
    signOut,
  }
}