import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '@/lib/api'

const EyeIcon = ({ show }: { show: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', opacity: 0.7 }}>
    {show ? (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </>
    )}
  </svg>
)

export default function AuthPage() {
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)

  // Signup state (Updated with new fields)
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [schoolName, setSchoolName] = useState('')      // ✨ New
  const [contactNumber, setContactNumber] = useState('') // ✨ New

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
      const { error } = await auth.signIn(loginEmail.trim(), loginPassword)
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
    
    // Password Validation
    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*.,_+=|<>?{}~-])(?=.{8,})/
    if (!passwordRegex.test(signupPassword)) {
      setError('Password: Min 8 chars, 1 Capital, 1 Special character.')
      return
    }

    setLoading(true)
    
    try {
      // ✨ Passing data as an object to metadata
      const { error } = await auth.signUp(signupEmail.trim(), signupPassword, {
        name: signupName,
        school_name: schoolName,
        contact_number: contactNumber
      })
      
      if (error) {
        setError(error.message)
      } else {
        setError('✅ Account created successfully! Logging you in...')
        setTimeout(() => {
          navigate('/dashboard') 
        }, 1500) 
      }
    } catch (err: any) {
      setError('Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg-grid" />

      <div className="auth-container">
        <div className="auth-logo">
          <span className="auth-logo-icon">⚡</span>
          <span className="auth-logo-text">SkillCamp</span>
        </div>

        <div className="auth-headline">
          <h1>Build. Learn. Grow.</h1>
          <p>Your 4-week coding journey starts here</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setError(''); }}
            disabled={loading}
          >
            Login
          </button>
          <button
            className={`auth-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => { setTab('signup'); setError(''); }}
            disabled={loading}
          >
            Sign Up
          </button>
        </div>

        <div className="auth-card">
          {error && (
            <div className={`auth-message ${error.startsWith('✅') ? 'success' : 'error'}`}>
              {error}
            </div>
          )}

          {/* Login Form */}
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
                <div className="password-input-wrapper">
                  <input
                    type={showLoginPassword ? "text" : "password"} required placeholder="••••••••"
                    value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                    disabled={loading}
                  />
                  <button 
                    type="button" 
                    className="password-toggle"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    tabIndex={-1}
                  >
                    <EyeIcon show={showLoginPassword} />
                  </button>
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-lg" style={{width:'100%'}} disabled={loading}>
                {loading ? 'Logging in...' : 'Login →'}
              </button>
            </form>
          )}

          {/* Signup Form (Updated) */}
          {tab === 'signup' && (
            <form onSubmit={handleSignup} className="auth-form">
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text" required placeholder="Enter full name"
                  value={signupName} onChange={e => setSignupName(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* ✨ New School Input */}
              <div className="form-group">
                <label>School / College Name</label>
                <input
                  type="text" required placeholder="School/College Name"
                  value={schoolName} onChange={e => setSchoolName(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* ✨ New Contact Input */}
              <div className="form-group">
                <label>Contact Number</label>
                <input
                  type="tel" required placeholder="+91 XXXXX XXXXX"
                  value={contactNumber} onChange={e => setContactNumber(e.target.value)}
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
                <div className="password-input-wrapper">
                  <input
                    type={showSignupPassword ? "text" : "password"} required placeholder="Min 8 chars, 1 Capital, 1 Special"
                    value={signupPassword} onChange={e => setSignupPassword(e.target.value)}
                    disabled={loading}
                  />
                  <button 
                    type="button" 
                    className="password-toggle"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    tabIndex={-1}
                  >
                    <EyeIcon show={showSignupPassword} />
                  </button>
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-lg" style={{width:'100%'}} disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account →'}
              </button>
            </form>
          )}
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
        .password-input-wrapper { position: relative; display: flex; align-items: center; }
        .password-input-wrapper input { width: 100%; padding-right: 40px; box-sizing: border-box; }
        .password-toggle {
          position: absolute; right: 8px; background: transparent; border: none;
          color: var(--text2); cursor: pointer; padding: 4px; display: flex;
          align-items: center; justify-content: center; border-radius: 4px;
        }
        .password-toggle:hover { background: var(--bg3); color: var(--text); }
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
