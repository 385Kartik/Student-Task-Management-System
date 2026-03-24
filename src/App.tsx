import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/api'
import { User as AppUser } from '@/types'
import AuthPage from '@/pages/AuthPage'
import StudentDashboard from '@/pages/StudentDashboard'
import AdminPanel from '@/pages/AdminPanel'
import './styles.css'

export default function App() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<AppUser | null>(null)

  useEffect(() => {
    // 1. Reusable function to fetch user profile smoothly
    const fetchUser = async (session: any) => {
      if (!session?.user) {
        setUser(null)
        setLoading(false)
        return
      }

      try {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (profile) {
          setUser(profile)
        } else {
          // Fallback trigger if DB profile isn't generated yet
          setUser({
            id: session.user.id,
            email: session.user.email ?? '',
            name: session.user.email?.split('@')[0] ?? 'Student',
            role: 'student',
            current_week: 1,
            completed_weeks: 0,
            timer_start_time: null,
            created_at: new Date().toISOString(),
          })
        }
      } catch (e) {
        console.error('Fetch user error:', e)
      } finally {
        setLoading(false)
      }
    }

    // 2. Initial load check
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchUser(session)
    })

    // 3. Listen for Login/Logout smoothly (NO RELOADS ALLOWED)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setLoading(false)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchUser(session) // 👈 Reload hatake hum directly state update kar rahe hain
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-logo">⚡</div>
      <div className="loading-spinner" />
      <p>Loading SkillCamp...</p>
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        {/* Agar user nahi hai toh Auth dikhao, warna home (/) pe bhej do */}
        <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/" />} />
        
        {/* Admin routes */}
        <Route path="/admin" element={
          !user ? <Navigate to="/auth" /> :
          user.role === 'admin' ? <AdminPanel user={user} /> :
          <Navigate to="/" />
        } />

        {/* Dashboard routes */}
        <Route path="/" element={
          !user ? <Navigate to="/auth" /> :
          user.role === 'admin' ? <Navigate to="/admin" /> :
          <StudentDashboard user={user} />
        } />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}