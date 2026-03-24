import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom' // 👈 Production routing
import { auth } from '@/lib/api'

export default function AuthPage() {
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate() // 👈 SPA Navigation Hook

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Signup state
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')

  // Cleanup timeouts to prevent memory leaks (Production Best Practice)
  useEffect(() => {
    return () => {
      setLoading(false)
      setError('')
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      const { error } = await auth.signIn(loginEmail, loginPassword)
      if (error) {
        setError(error.message)
      } else {
        navigate('/dashboard') 
      }
    } catch (err: any) {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    // Strict Password Validation
    // Kam se kam 8 chars, 1 Capital letter, aur 1 Special Character
    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*.,_+=|<>?{}~-])(?=.{8,})/
    
    if (!passwordRegex.test(signupPassword)) {
      setError('Password me kam se kam 8 characters, 1 Capital Letter, aur 1 Special Character hona chahiye')
      return
    }

    setLoading(true)
    
    try {
      const { error } = await auth.signUp(signupEmail, signupPassword, signupName)
      
      if (error) {
        setError(error.message)
      } else {
        // Email confirm hat gaya hai, toh direct success message
        setError('✅ Account created successfully! Logging you in...')
        
        // 👈 Proper SPA Redirect (No page refresh)
        setTimeout(() => {
          navigate('/') // Yahan apna dashboard path daal dena agar seedha andar bhejna hai
        }, 1000) 
      }
    } catch (err: any) {
      setError('Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      await auth.signInWithGoogle()
    } catch (err: any) {
      setError('Google Sign-In failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      {/* Background grid */}
      <div className="auth-bg-grid" />

      <div className="auth-container">
        {/* Logo */}
        <div className="auth-logo">
          <span className="auth-logo-icon">⚡</span>
          <span className="auth-logo-text">SkillCamp</span>
        </div>

        <div className="auth-headline">
          <h1>Build. Learn. Grow.</h1>
          <p>Your 4-week coding journey starts here</p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setError(''); setLoading(false); }}
            disabled={loading}
          >
            Login
          </button>
          <button
            className={`auth-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => { setTab('signup'); setError(''); setLoading(false); }}
            disabled={loading}
          >
            Sign Up
          </button>
        </div>

        <div className="auth-card">
          {/* Google button */}
          {/* <button className="btn-google" onClick={handleGoogle} disabled={loading}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button> */}

          {/* <div className="auth-divider"><span>or</span></div> */}

          {/* Error */}
          {error && (
            <div className={`auth-message ${error.startsWith('✅') ? 'success' : 'error'}`}>
              {error}
            </div>
          )}

          {/* Login form */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="auth-form">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email" required placeholder="your@email.com"
                  value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password" required placeholder="••••••••"
                  value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-lg" style={{width:'100%'}} disabled={loading}>
                {loading ? 'Logging in...' : 'Login →'}
              </button>
            </form>
          )}

          {/* Signup form */}
          {tab === 'signup' && (
            <form onSubmit={handleSignup} className="auth-form">
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text" required placeholder="Your full name"
                  value={signupName} onChange={e => setSignupName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email" required placeholder="your@email.com"
                  value={signupEmail} onChange={e => setSignupEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password" required placeholder="Min 8 chars, 1 Capital, 1 Special (!@#$)"
                  value={signupPassword} onChange={e => setSignupPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-lg" style={{width:'100%'}} disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account →'}
              </button>
            </form>
          )}
        </div>

        {/* Week pills */}
        <div className="auth-weeks">
          {['Week 1: AI Tools', 'Week 2: Power BI + GitHub', 'Week 3: Python', 'Week 4: Django'].map((w, i) => (
            <div key={i} className="auth-week-pill">
              <span className="auth-week-num">{i + 1}</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          position: relative;
          overflow: hidden;
        }
        .auth-bg-grid {
          position: fixed; inset: 0; z-index: 0;
          background-image:
            linear-gradient(rgba(0,212,168,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,168,0.04) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .auth-container {
          position: relative; z-index: 1;
          width: 100%; max-width: 420px;
          animation: fadeIn 0.4s ease;
        }
        .auth-logo {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 32px; justify-content: center;
        }
        .auth-logo-icon { font-size: 32px; }
        .auth-logo-text {
          font-family: var(--font-head);
          font-size: 26px; font-weight: 800;
          background: linear-gradient(135deg, var(--teal), var(--amber));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .auth-headline { text-align: center; margin-bottom: 28px; }
        .auth-headline h1 {
          font-family: var(--font-head);
          font-size: 28px; font-weight: 800;
          margin-bottom: 6px;
        }
        .auth-headline p { color: var(--text2); font-size: 15px; }
        .auth-tabs {
          display: flex; background: var(--bg3);
          border-radius: var(--radius-sm); padding: 4px;
          margin-bottom: 20px; border: 1px solid var(--border);
        }
        .auth-tab {
          flex: 1; padding: 9px; border-radius: 6px;
          font-size: 14px; font-weight: 600;
          color: var(--text2); transition: all 0.2s;
          cursor: pointer;
        }
        .auth-tab:disabled { opacity: 0.5; cursor: not-allowed; }
        .auth-tab.active { background: var(--surface); color: var(--teal); }
        .auth-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 28px;
        }
        .btn-google {
          width: 100%; padding: 11px;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          background: var(--bg3); border: 1px solid var(--border2);
          color: var(--text); border-radius: var(--radius-sm);
          font-size: 14px; font-weight: 600; font-family: var(--font-body);
          transition: all 0.2s;
          cursor: pointer;
        }
        .btn-google:hover:not(:disabled) { border-color: #4285F4; background: rgba(66,133,244,0.05); }
        .btn-google:disabled { opacity: 0.7; cursor: not-allowed; }
        .auth-divider {
          text-align: center; position: relative; margin: 20px 0;
          color: var(--text3); font-size: 12px;
        }
        .auth-divider::before {
          content:''; position: absolute; top:50%; left:0; right:0;
          height: 1px; background: var(--border);
        }
        .auth-divider span { background: var(--surface); padding: 0 12px; position: relative; }
        .auth-form { display: flex; flex-direction: column; gap: 16px; }
        .auth-message {
          padding: 10px 14px; border-radius: var(--radius-sm);
          font-size: 13px; margin-bottom: 4px;
        }
        .auth-message.error { background: rgba(255,71,87,0.1); color: var(--red); border: 1px solid rgba(255,71,87,0.2); }
        .auth-message.success { background: rgba(0,212,168,0.1); color: var(--teal); border: 1px solid rgba(0,212,168,0.2); }
        .auth-weeks {
          display: flex; flex-direction: column; gap: 8px; margin-top: 20px;
        }
        .auth-week-pill {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px; border-radius: var(--radius-sm);
          background: var(--bg2); border: 1px solid var(--border);
          font-size: 13px; color: var(--text2);
          animation: fadeIn 0.4s ease both;
        }
        .auth-week-pill:nth-child(1){animation-delay:0.1s}
        .auth-week-pill:nth-child(2){animation-delay:0.15s}
        .auth-week-pill:nth-child(3){animation-delay:0.2s}
        .auth-week-pill:nth-child(4){animation-delay:0.25s}
        .auth-week-num {
          width: 22px; height: 22px; border-radius: 6px;
          background: rgba(0,212,168,0.1); border: 1px solid rgba(0,212,168,0.2);
          color: var(--teal); font-size: 11px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-mono); flex-shrink: 0;
        }
      `}</style>
    </div>
  )
}