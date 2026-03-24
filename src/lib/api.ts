import { createClient } from '@supabase/supabase-js'

// ─── CONFIGURATION ────────────────────────────────────────────────────────
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Ye rahi woh missing link! Render ki URL yahan se pick hogi
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── API helper ───────────────────────────────────────────────────────────
async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken()
  
  // AB YEH RENDER WALI URL PE JAYEGA (Vercel pe nahi)
  const res = await fetch(`${API_BASE_URL}/api${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`,
      ...(!options.body || options.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

// ─── Auth helpers ─────────────────────────────────────────────────────────
export const auth = {
  signUp: (email: string, password: string, name: string) =>
    supabase.auth.signUp({ email, password, options: { data: { name } } }),

  signIn: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),

  signInWithGoogle: () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    }),

  signOut: () => supabase.auth.signOut(),

  getSession: () => supabase.auth.getSession(),

  onAuthChange: (cb: Parameters<typeof supabase.auth.onAuthStateChange>[0]) =>
    supabase.auth.onAuthStateChange(cb),
}
