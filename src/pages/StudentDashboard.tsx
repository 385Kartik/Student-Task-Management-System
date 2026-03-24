import { useState, useEffect, useCallback } from 'react'
import { apiFetch, auth } from '@/lib/api'
import { User, Week, Project } from '@/types'

interface Props { user: User }

const MINI_PROJECTS = [
  { value: 'calculator', label: '🔢 Calculator' },
  { value: 'number_game', label: '🎮 Number Guessing Game' },
  { value: 'quiz_game', label: '❓ Quiz Game' },
  { value: 'todo_list', label: '✅ To-Do List' },
  { value: 'password_gen', label: '🔐 Password Generator' },
  { value: 'chatbot', label: '🤖 AI Chatbot' },
]

const MAJOR_PROJECTS = [
  { value: 'ai_assistant', label: '🧠 AI Study Assistant' },
  { value: 'portfolio', label: '🌐 Portfolio Website' },
  { value: 'power_bi', label: '📊 Power BI Dashboard' },
  { value: 'django_app', label: '🐍 Django Web Application' },
  { value: 'ai_web_app', label: '🚀 AI + Web App' },
]

// Categories that require a Google Drive link instead of file upload
const DRIVE_LINK_CATEGORIES = ['power_bi']

export default function StudentDashboard({ user }: Props) {
  const [weeks, setWeeks] = useState<Week[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [currentUser, setCurrentUser] = useState(user)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<'tasks' | 'projects'>('tasks')
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'success' | 'error' }[]>([])
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [taskInputs, setTaskInputs] = useState<Record<string, { link: string; notes: string; file: File | null }>>({})
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [projectForm, setProjectForm] = useState({
    project_type: 'mini' as 'mini' | 'major',
    project_category: '',
    title: '',
    description: '',
    github_link: '',
    deployed_url: '',
    file: null as File | null,
  })

  const toast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500)
  }, [])

  const loadData = useCallback(async () => {
    try {
      const data = await apiFetch<{
        weeks: Week[]
        user: { current_week: number; completed_weeks: number }
        projects: Project[]
      }>('/student/tasks')
      setWeeks(data.weeks || [])
      setProjects(data.projects || [])
      if (data.user) setCurrentUser(u => ({ ...u, ...data.user }))
    } catch {
      toast('Failed to load data. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  // 🛠️ FIX: Bulletproof string matching (removes spaces/dashes before checking)
  const isPowerBiTask = (task: { title: string; task_type: string }) => {
    const cleanTitle = task.title.toLowerCase().replace(/[^a-z0-9]/g, '')
    return task.task_type === 'drive_link' || cleanTitle.includes('powerbi')
  }

  const submitTask = async (taskId: string, taskType: string, taskTitle: string) => {
    const input = taskInputs[taskId] || { link: '', notes: '', file: null }
    
    // 🛠️ FIX: Use the exact same unified logic here so UI and Validation never mismatch
    const isDrive = isPowerBiTask({ title: taskTitle, task_type: taskType })
    const effectiveType = (isDrive && taskType === 'file_upload') ? 'drive_link' : taskType

    // Validation
    if (effectiveType === 'github_link') {
      if (!input.link.trim()) return toast('GitHub link is required.', 'error')
      const githubRegex = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\/)?$/
      if (!githubRegex.test(input.link.trim())) {
        return toast('Please enter a valid GitHub URL — https://github.com/username/repo', 'error')
      }
    }
    if (effectiveType === 'deployed_url' && !input.link.trim()) {
      return toast('Deployed URL is required.', 'error')
    }
    if (effectiveType === 'drive_link') {
      if (!input.link.trim()) return toast('Google Drive link is required.', 'error')
      if (!input.link.trim().startsWith('https://drive.google.com') && !input.link.trim().startsWith('https://docs.google.com')) {
        return toast('Please enter a valid Google Drive URL — https://drive.google.com/...', 'error')
      }
    }
    if (effectiveType === 'file_upload' && !input.file) {
      return toast('Please select a file before submitting.', 'error')
    }

    setSubmitting(taskId)
    try {
      const res: { success: boolean; weekCompleted: boolean } = await apiFetch('/student/submit-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          github_link: effectiveType === 'github_link' ? input.link.trim() : undefined,
          deployed_url: (effectiveType === 'deployed_url' || effectiveType === 'drive_link') ? input.link.trim() : undefined,
          notes: input.notes || undefined,
        })
      })

      if (res.weekCompleted) {
        toast('🎉 Week complete! The next week has been unlocked.')
      } else {
        toast('Task submitted successfully! ✅')
      }
      loadData()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Submission failed. Please try again.', 'error')
    } finally {
      setSubmitting(null)
    }
  }

  const submitProject = async () => {
    if (!projectForm.project_category) return toast('Please select a category.', 'error')
    if (!projectForm.title.trim()) return toast('Please enter a project title.', 'error')

    if (!projectForm.github_link.trim()) return toast('GitHub link is required.', 'error')
    const githubRegex = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\/)?$/
    if (!githubRegex.test(projectForm.github_link.trim())) {
      return toast('Please enter a valid GitHub URL — https://github.com/username/repo', 'error')
    }

    if (DRIVE_LINK_CATEGORIES.includes(projectForm.project_category) && !projectForm.deployed_url.trim()) {
      return toast('A Google Drive screenshot link is required for Power BI projects.', 'error')
    }

    setSubmitting('project')
    try {
      const res = await apiFetch('/student/submit-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_type: projectForm.project_type,
          project_category: projectForm.project_category,
          title: projectForm.title,
          description: projectForm.description || undefined,
          github_link: projectForm.github_link || undefined,
          deployed_url: projectForm.deployed_url || undefined,
        })
      })

      toast(`${projectForm.project_type === 'mini' ? 'Mini' : 'Major'} project submitted successfully! 🚀`)
      setShowProjectForm(false)
      setProjectForm({ project_type: 'mini', project_category: '', title: '', description: '', github_link: '', deployed_url: '', file: null })
      loadData()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Submission failed. Please try again.', 'error')
    } finally {
      setSubmitting(null)
    }
  }

  const handleSignOut = async () => {
    try {
      await auth.signOut()
      window.location.href = '/'
    } catch {
      toast('Sign out failed. Please try again.', 'error')
    }
  }

  const miniProject = projects.find(p => p.project_type === 'mini')
  const majorProject = projects.find(p => p.project_type === 'major')
  const hasFullCert = currentUser.completed_weeks >= 3 && !!miniProject && !!majorProject

  const totalRequired = weeks.filter(w => w.week_number <= 3)
    .flatMap(w => w.tasks.filter(t => t.required_for_cert)).length
  const totalSubmitted = weeks.filter(w => w.week_number <= 3)
    .flatMap(w => w.tasks.filter(t => t.submission?.verified && t.required_for_cert)).length
  const progress = totalRequired > 0 ? Math.round((totalSubmitted / totalRequired) * 100) : 0

  const isPowerBiProject = DRIVE_LINK_CATEGORIES.includes(projectForm.project_category)

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p>Loading your dashboard…</p>
    </div>
  )

  return (
    <div className="dash-page">
      {/* ── Sidebar ── */}
      <aside className="dash-sidebar">
        <div className="sidebar-logo">
          <span>⚡</span>
          <span className="sidebar-logo-text">SkillCamp</span>
        </div>

        <div className="sidebar-profile">
          <div className="profile-avatar">{user.name.charAt(0).toUpperCase()}</div>
          <div className="profile-info">
            <div className="profile-name">{user.name}</div>
            <div className="profile-email">{user.email}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeSection === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveSection('tasks')}
          >
            <span className="nav-icon">📋</span>
            <span>Weekly Tasks</span>
          </button>
          <button
            className={`nav-item ${activeSection === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveSection('projects')}
          >
            <span className="nav-icon">🚀</span>
            <span>Projects</span>
            <span className="nav-tag">Week 4</span>
            {currentUser.completed_weeks >= 3 && (!miniProject || !majorProject) && (
              <span className="nav-dot" />
            )}
          </button>
        </nav>

        {/* Progress */}
        <div className="sidebar-section">
          <div className="section-label">Overall Progress</div>
          <div className="progress-header">
            <span className="progress-pct">{progress}%</span>
            <span className="progress-sub">{totalSubmitted}/{totalRequired} tasks</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-weeks">
            {[1, 2, 3].map(w => (
              <div key={w} className={`week-pip ${currentUser.completed_weeks >= w ? 'done' : ''}`}>
                W{w}
              </div>
            ))}
          </div>
        </div>

        {/* Certificate status */}
        <div className="cert-status-card">
          <div className="cert-status-title">🏆 Certificate Status</div>
          {hasFullCert ? (
            <div className="cert-badge full">Full Certificate Eligible</div>
          ) : currentUser.completed_weeks > 0 ? (
            <div className="cert-badge partial">Week {currentUser.completed_weeks} Certificate Eligible</div>
          ) : (
            <div className="cert-badge none">Complete tasks to earn your certificate</div>
          )}
          <div className="cert-checklist">
            {[1, 2, 3].map(w => (
              <div key={w} className={`cert-check ${currentUser.completed_weeks >= w ? 'done' : ''}`}>
                Week {w} tasks
              </div>
            ))}
            <div className={`cert-check ${!!miniProject ? 'done' : ''}`}>1 Mini Project</div>
            <div className={`cert-check ${!!majorProject ? 'done' : ''}`}>1 Major Project</div>
          </div>
        </div>

        <button
          className="btn btn-ghost signout-btn"
          onClick={handleSignOut}
        >
          Sign Out
        </button>
      </aside>

      {/* ── Main Content ── */}
      <main className="dash-main">
        <div className="dash-header">
          <div>
            <h1 className="dash-title">
              {activeSection === 'tasks' ? 'Weekly Tasks' : 'Week 4: Projects'}
            </h1>
            <p className="dash-subtitle">
              {activeSection === 'tasks'
                ? 'Complete each week to unlock the next one'
                : 'Submit 1 mini + 1 major project to earn your full certificate'}
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadData}>
            <span>↺</span> Refresh
          </button>
        </div>

        {/* ── TASKS ── */}
        {activeSection === 'tasks' && (
          <div className="weeks-list">
            {weeks.filter(w => w.week_number <= 3).map(week => {
              const isUnlocked = week.week_number <= currentUser.current_week
              const isComplete = week.tasks.length > 0 && week.tasks.every(t => t.submission?.verified)

              return (
                <div key={week.id} className={`week-card ${isUnlocked ? 'unlocked' : 'locked'}`}>
                  <div className="week-header">
                    <div className="week-header-left">
                      <div className={`week-badge ${isComplete ? 'complete' : isUnlocked ? 'active' : 'locked'}`}>
                        {isComplete ? '✓' : isUnlocked ? week.week_number : '🔒'}
                      </div>
                      <div>
                        <h3 className="week-title">{week.title}</h3>
                        {week.description && <p className="week-desc">{week.description}</p>}
                      </div>
                    </div>
                    <div className="week-badges">
                      {isComplete && <span className="badge badge-teal">✓ Complete</span>}
                      {!isUnlocked && <span className="badge badge-gray">🔒 Locked</span>}
                      {!week.is_open && isUnlocked && <span className="badge badge-red">Closed</span>}
                    </div>
                  </div>

                  {!isUnlocked && (
                    <div className="locked-msg">
                      🔒 Complete Week {week.week_number - 1} to unlock this week
                    </div>
                  )}

                  {isUnlocked && (
                    <div className="tasks-list">
                      {week.tasks.map(task => {
                        const isSubmitted = !!task.submission
                        const input = taskInputs[task.id] || { link: '', notes: '', file: null }
                        const isDriveTask = isPowerBiTask(task)

                        return (
                          <div key={task.id} className={`task-card ${isSubmitted ? 'submitted' : ''}`}>
                            <div className="task-header">
                              <div className="task-title-row">
                                <span className={`task-status-dot ${isSubmitted ? 'done' : ''}`} />
                                <h4 className="task-title">{task.title}</h4>
                              </div>
                              {isSubmitted && (
                                <div className="task-submitted-info">
                                  ✅ Submitted on {new Date(task.submission!.submitted_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  {task.submission?.github_link && (
                                    <a href={task.submission.github_link} target="_blank" rel="noreferrer" className="task-link">GitHub ↗</a>
                                  )}
                                  {task.submission?.deployed_url && (
                                    <a href={task.submission.deployed_url} target="_blank" rel="noreferrer" className="task-link">View Link ↗</a>
                                  )}
                                  {task.submission?.file_url && (
                                    <a href={task.submission.file_url} target="_blank" rel="noreferrer" className="task-link">File ↗</a>
                                  )}
                                </div>
                              )}
                            </div>

                            {!isSubmitted && (
                              <div className="task-body">
                                {!week.is_open ? (
                                  <div className="deadline-msg">
                                    🔴 Submissions for this week have been closed by your instructor.
                                  </div>
                                ) : (
                                  <>
                                    {task.task_type === 'google_form' && task.form_url && (
                                      <div className="google-form-section">
                                        <div className="form-note">
                                          ⚠️ Please use the same Gmail account you used to sign in.
                                        </div>
                                        <iframe
                                          src={`${task.form_url}?embedded=true`}
                                          className="google-form-iframe"
                                          title={task.title}
                                        />
                                      </div>
                                    )}

                                    {task.task_type === 'google_form' && !task.form_url && (
                                      <div className="auto-pass-banner">
                                        📝 Add any notes or reflections below and submit.
                                      </div>
                                    )}

                                    {/* GitHub / Deployed URL inputs */}
                                    {(task.task_type === 'github_link' || task.task_type === 'deployed_url') && (
                                      <div className="form-group">
                                        <label>
                                          {task.task_type === 'github_link' ? '🔗 GitHub Repository URL' : '🌐 Deployed Project URL'}
                                          {' '}<span className="required-star">*</span>
                                        </label>
                                        <input
                                          type="url"
                                          placeholder={
                                            task.task_type === 'github_link'
                                              ? 'https://github.com/username/repo'
                                              : 'https://your-project.vercel.app'
                                          }
                                          value={input.link}
                                          onChange={e => setTaskInputs(p => ({ ...p, [task.id]: { ...input, link: e.target.value } }))}
                                        />
                                      </div>
                                    )}

                                    {/* Google Drive link (Power BI or drive_link type) */}
                                    {isDriveTask && task.task_type !== 'github_link' && task.task_type !== 'deployed_url' && (
                                      <div className="form-group">
                                        <label>
                                          📁 Google Drive Link
                                          {' '}<span className="required-star">*</span>
                                        </label>
                                        <input
                                          type="url"
                                          placeholder="https://drive.google.com/file/d/..."
                                          value={input.link}
                                          onChange={e => setTaskInputs(p => ({ ...p, [task.id]: { ...input, link: e.target.value } }))}
                                        />
                                        <span className="form-hint">
                                          📌 Make sure the Drive file is set to "Anyone with the link can view" before submitting.
                                        </span>
                                      </div>
                                    )}

                                    {/* File Upload (non-Power BI only) */}
                                    {task.task_type === 'file_upload' && !isDriveTask && (
                                      <div className="form-group">
                                        <label>
                                          📁 File Upload <span className="form-hint-inline">(screenshot or PDF)</span>
                                          {' '}<span className="required-star">*</span>
                                        </label>
                                        <input
                                          type="file"
                                          accept=".pdf,.jpg,.jpeg,.png"
                                          onChange={e => setTaskInputs(p => ({ ...p, [task.id]: { ...input, file: e.target.files?.[0] || null } }))}
                                          className="file-input"
                                        />
                                        {input.file && (
                                          <span className="form-hint">Selected: {input.file.name}</span>
                                        )}
                                      </div>
                                    )}

                                    <div className="form-group">
                                      <label>Notes <span className="form-hint-inline">(optional)</span></label>
                                      <textarea
                                        rows={2}
                                        placeholder="Add any comments or notes here…"
                                        value={input.notes}
                                        onChange={e => setTaskInputs(p => ({ ...p, [task.id]: { ...input, notes: e.target.value } }))}
                                        style={{ resize: 'vertical' }}
                                      />
                                    </div>

                                    <button
                                      className="btn btn-primary"
                                      onClick={() => submitTask(task.id, task.task_type, task.title)}
                                      disabled={submitting === task.id}
                                    >
                                      {submitting === task.id ? 'Submitting…' : 'Submit Task →'}
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Week 4 teaser card */}
            <div className={`week-card ${currentUser.completed_weeks >= 3 ? 'unlocked' : 'locked'}`}>
              <div className="week-header">
                <div className="week-header-left">
                  <div className={`week-badge ${currentUser.completed_weeks >= 3 ? 'active' : 'locked'}`}>
                    {currentUser.completed_weeks >= 3 ? '4' : '🔒'}
                  </div>
                  <div>
                    <h3 className="week-title">Week 4: Final Projects</h3>
                    <p className="week-desc">Days 12–15 · 1 Mini + 1 Major Project</p>
                  </div>
                </div>
                {currentUser.completed_weeks < 3 && (
                  <span className="badge badge-gray">🔒 Locked</span>
                )}
              </div>
              {currentUser.completed_weeks >= 3 ? (
                <div className="week-cta">
                  <button className="btn btn-primary" onClick={() => setActiveSection('projects')}>
                    Go to Projects Tab →
                  </button>
                </div>
              ) : (
                <div className="locked-msg">
                  🔒 Complete all three weeks to unlock final projects
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PROJECTS ── */}
        {activeSection === 'projects' && (
          <div className="projects-section">
            {currentUser.completed_weeks < 3 ? (
              <div className="card card-center">
                <div className="lock-icon">🔒</div>
                <h3 className="card-heading">Complete 3 Weeks First</h3>
                <p className="card-sub">{currentUser.completed_weeks}/3 weeks completed.</p>
                <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setActiveSection('tasks')}>
                  Go to Tasks →
                </button>
              </div>
            ) : (
              <>
                <div className="card card-highlight">
                  <h3 className="card-heading">🏆 Full Certificate Requirements</h3>
                  <p className="card-sub" style={{ marginBottom: 12 }}>
                    Submit <strong>1 Mini</strong> and <strong>1 Major</strong> project to earn your full AI Workshop certificate.
                  </p>
                  <div className="req-badges">
                    <span className={`badge ${miniProject ? 'badge-teal' : 'badge-gray'}`}>
                      {miniProject ? `✓ Mini: ${miniProject.title}` : '○ Mini Project pending'}
                    </span>
                    <span className={`badge ${majorProject ? 'badge-teal' : 'badge-gray'}`}>
                      {majorProject ? `✓ Major: ${majorProject.title}` : '○ Major Project pending'}
                    </span>
                  </div>
                </div>

                {/* Mini Project */}
                <div className="card">
                  <div className="project-section-header">
                    <div>
                      <h3 className="project-section-title">
                        🎮 Mini Project
                        <span className="project-section-sub">choose any one</span>
                      </h3>
                      <p className="project-options">
                        Calculator · Number Game · Quiz · To-Do List · Password Generator · Chatbot
                      </p>
                    </div>
                    {!miniProject && (
                      <button
                        className="btn btn-amber btn-sm"
                        onClick={() => {
                          setProjectForm(p => ({ ...p, project_type: 'mini', project_category: '' }))
                          setShowProjectForm(true)
                        }}
                      >
                        + Submit
                      </button>
                    )}
                  </div>
                  {miniProject && (
                    <div className="submitted-project-card">
                      <div className="submitted-project-meta">
                        <span className="badge badge-amber">🎮 Mini</span>
                        <strong>{miniProject.title}</strong>
                        <span className="project-category">{miniProject.project_category}</span>
                      </div>
                      {miniProject.description && (
                        <p className="project-desc">{miniProject.description}</p>
                      )}
                      <div className="project-links">
                        {miniProject.github_link && (
                          <a href={miniProject.github_link} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">GitHub ↗</a>
                        )}
                        {miniProject.deployed_url && (
                          <a href={miniProject.deployed_url} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">Live Demo ↗</a>
                        )}
                        {miniProject.file_url && (
                          <a href={miniProject.file_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">File ↗</a>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Major Project */}
                <div className="card">
                  <div className="project-section-header">
                    <div>
                      <h3 className="project-section-title">
                        🌟 Major Project
                        <span className="project-section-sub">choose any one</span>
                      </h3>
                      <p className="project-options">
                        AI Assistant · Portfolio · Power BI Dashboard · Django App · AI + Web App
                      </p>
                    </div>
                    {!majorProject && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setProjectForm(p => ({ ...p, project_type: 'major', project_category: '' }))
                          setShowProjectForm(true)
                        }}
                      >
                        + Submit
                      </button>
                    )}
                  </div>
                  {majorProject && (
                    <div className="submitted-project-card">
                      <div className="submitted-project-meta">
                        <span className="badge badge-teal">🌟 Major</span>
                        <strong>{majorProject.title}</strong>
                        <span className="project-category">{majorProject.project_category}</span>
                      </div>
                      {majorProject.description && (
                        <p className="project-desc">{majorProject.description}</p>
                      )}
                      <div className="project-links">
                        {majorProject.github_link && (
                          <a href={majorProject.github_link} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">GitHub ↗</a>
                        )}
                        {majorProject.deployed_url && (
                          <a href={majorProject.deployed_url} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">Live / Drive ↗</a>
                        )}
                        {majorProject.file_url && (
                          <a href={majorProject.file_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">File ↗</a>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {hasFullCert && (
                  <div className="card card-success">
                    <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
                    <h3 style={{ fontFamily: 'var(--font-head)', color: 'var(--teal)', marginBottom: 8 }}>
                      You're Eligible for a Full Certificate!
                    </h3>
                    <p style={{ color: 'var(--text2)', fontSize: 14 }}>
                      Your instructor will issue the certificate shortly.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* ── Project Modal ── */}
      {showProjectForm && (
        <div className="modal-backdrop" onClick={() => setShowProjectForm(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{projectForm.project_type === 'mini' ? '🎮 Submit Mini Project' : '🌟 Submit Major Project'}</h3>
              <button className="btn btn-ghost btn-sm modal-close" onClick={() => setShowProjectForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Category <span className="required-star">*</span></label>
                <select
                  value={projectForm.project_category}
                  onChange={e => setProjectForm(p => ({ ...p, project_category: e.target.value, deployed_url: '' }))}
                >
                  <option value="">Select a category…</option>
                  {(projectForm.project_type === 'mini' ? MINI_PROJECTS : MAJOR_PROJECTS).map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Project Title <span className="required-star">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. My Quiz App"
                  value={projectForm.title}
                  onChange={e => setProjectForm(p => ({ ...p, title: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Description <span className="form-hint-inline">(optional)</span></label>
                <textarea
                  rows={3}
                  placeholder="Brief description of your project…"
                  value={projectForm.description}
                  onChange={e => setProjectForm(p => ({ ...p, description: e.target.value }))}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="form-group">
                <label>🔗 GitHub URL <span className="required-star">*</span></label>
                <input
                  type="url"
                  placeholder="https://github.com/username/repo"
                  value={projectForm.github_link}
                  onChange={e => setProjectForm(p => ({ ...p, github_link: e.target.value }))}
                />
              </div>

              {isPowerBiProject ? (
                <div className="form-group">
                  <label>📁 Google Drive Link <span className="required-star">*</span></label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/file/d/..."
                    value={projectForm.deployed_url}
                    onChange={e => setProjectForm(p => ({ ...p, deployed_url: e.target.value }))}
                  />
                  <span className="form-hint">
                    📌 Set file sharing to "Anyone with the link can view" before submitting.
                  </span>
                </div>
              ) : (
                <div className="form-group">
                  <label>🌐 Deployed URL <span className="form-hint-inline">(optional)</span></label>
                  <input
                    type="url"
                    placeholder="https://your-project.vercel.app"
                    value={projectForm.deployed_url}
                    onChange={e => setProjectForm(p => ({ ...p, deployed_url: e.target.value }))}
                  />
                </div>
              )}

              <button
                className="btn btn-primary btn-full"
                onClick={submitProject}
                disabled={
                  submitting === 'project' ||
                  !projectForm.title ||
                  !projectForm.project_category ||
                  !projectForm.github_link
                }
              >
                {submitting === 'project' ? 'Submitting…' : 'Submit Project 🚀'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toasts ── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' ? '✅' : '❌'} {t.msg}
          </div>
        ))}
      </div>

      <style>{`
        /* ── Layout ── */
        .dash-page { display: flex; min-height: 100vh; background: var(--bg); }

        /* ── Sidebar ── */
        .dash-sidebar {
          width: 272px; flex-shrink: 0;
          background: var(--bg2);
          border-right: 1px solid var(--border);
          display: flex; flex-direction: column;
          padding: 28px 18px; gap: 22px;
          position: sticky; top: 0; height: 100vh; overflow-y: auto;
        }
        .sidebar-logo {
          display: flex; align-items: center; gap: 8px;
          font-family: var(--font-head); font-size: 20px; font-weight: 800;
          padding: 0 6px; letter-spacing: -0.3px;
        }
        .sidebar-logo-text {
          background: linear-gradient(135deg, var(--teal), var(--amber));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .sidebar-profile {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px;
          background: var(--bg3);
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
        }
        .profile-avatar {
          width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
          background: linear-gradient(135deg, var(--teal), var(--amber));
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 16px; color: var(--bg);
        }
        .profile-info { min-width: 0; }
        .profile-name { font-weight: 600; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .profile-email { font-size: 11px; color: var(--text3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }

        /* ── Nav ── */
        .sidebar-nav { display: flex; flex-direction: column; gap: 3px; }
        .nav-item {
          display: flex; align-items: center; gap: 9px;
          padding: 9px 12px; border-radius: var(--radius-sm);
          font-size: 13.5px; font-weight: 500; color: var(--text2);
          transition: all 0.15s; text-align: left; width: 100%; cursor: pointer;
        }
        .nav-item:hover { background: var(--bg3); color: var(--text); }
        .nav-item.active {
          background: rgba(0,212,168,0.09); color: var(--teal);
          border: 1px solid rgba(0,212,168,0.18);
        }
        .nav-icon { font-size: 15px; }
        .nav-tag {
          margin-left: auto; font-size: 10px; font-weight: 600;
          padding: 2px 7px; border-radius: 20px;
          background: rgba(0,212,168,0.12); color: var(--teal);
        }
        .nav-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--amber); margin-left: 4px; flex-shrink: 0;
        }

        /* ── Sidebar Progress ── */
        .sidebar-section { display: flex; flex-direction: column; gap: 8px; }
        .section-label { font-size: 11px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.6px; }
        .progress-header { display: flex; justify-content: space-between; align-items: baseline; }
        .progress-pct { font-family: var(--font-mono); font-size: 20px; font-weight: 700; color: var(--teal); line-height: 1; }
        .progress-sub { font-size: 11px; color: var(--text3); }
        .progress-bar { height: 6px; background: var(--bg3); border-radius: 10px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, var(--teal), var(--amber)); border-radius: 10px; transition: width 0.5s ease; }
        .progress-weeks { display: flex; gap: 6px; margin-top: 4px; }
        .week-pip {
          flex: 1; text-align: center; font-size: 10px; font-weight: 600;
          padding: 3px 0; border-radius: 4px;
          background: var(--bg3); color: var(--text3); border: 1px solid var(--border);
          transition: all 0.2s;
        }
        .week-pip.done { background: rgba(0,212,168,0.12); color: var(--teal); border-color: rgba(0,212,168,0.25); }

        /* ── Cert Status ── */
        .cert-status-card {
          background: var(--bg3); border: 1px solid var(--border);
          border-radius: var(--radius-sm); padding: 14px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .cert-status-title { font-size: 12px; font-weight: 600; color: var(--text2); }
        .cert-badge {
          font-size: 11.5px; font-weight: 600; padding: 6px 10px;
          border-radius: var(--radius-sm); text-align: center; line-height: 1.4;
        }
        .cert-badge.full { background: rgba(0,212,168,0.13); color: var(--teal); border: 1px solid rgba(0,212,168,0.28); }
        .cert-badge.partial { background: rgba(245,166,35,0.1); color: var(--amber); border: 1px solid rgba(245,166,35,0.22); }
        .cert-badge.none { background: var(--bg2); color: var(--text3); border: 1px solid var(--border); }
        .cert-checklist { display: flex; flex-direction: column; gap: 4px; }
        .cert-check { font-size: 11px; color: var(--text3); padding: 3px 0 3px 18px; position: relative; }
        .cert-check::before { content: '○'; position: absolute; left: 0; color: var(--text3); }
        .cert-check.done { color: var(--teal); }
        .cert-check.done::before { content: '✓'; color: var(--teal); }

        .signout-btn { margin-top: auto; width: 100%; justify-content: center; opacity: 0.75; }
        .signout-btn:hover { opacity: 1; }

        /* ── Main ── */
        .dash-main { flex: 1; padding: 36px; max-width: calc(100vw - 272px); overflow-x: hidden; }
        .dash-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
        .dash-title { font-family: var(--font-head); font-size: 26px; font-weight: 700; letter-spacing: -0.4px; }
        .dash-subtitle { color: var(--text2); font-size: 14px; margin-top: 5px; }

        /* ── Week Cards ── */
        .weeks-list { display: flex; flex-direction: column; gap: 18px; }
        .week-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius); overflow: hidden;
          animation: fadeIn 0.3s ease;
        }
        .week-card.locked { opacity: 0.55; }
        .week-card.unlocked { border-color: var(--border2); }
        .week-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 24px; border-bottom: 1px solid var(--border);
        }
        .week-header-left { display: flex; align-items: center; gap: 14px; }
        .week-badges { display: flex; gap: 8px; }
        .week-badge {
          width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 700;
        }
        .week-badge.active { background: rgba(0,212,168,0.1); color: var(--teal); border: 1px solid rgba(0,212,168,0.22); }
        .week-badge.complete { background: rgba(0,212,168,0.18); color: var(--teal); }
        .week-badge.locked { background: var(--bg3); color: var(--text3); }
        .week-title { font-weight: 700; font-size: 15px; }
        .week-desc { font-size: 13px; color: var(--text2); margin-top: 2px; }
        .week-cta { padding: 16px 24px; }
        .locked-msg { padding: 18px 24px; color: var(--text3); font-size: 13.5px; background: var(--bg2); }

        /* ── Task Cards ── */
        .tasks-list { display: flex; flex-direction: column; }
        .task-card { padding: 20px 24px; border-bottom: 1px solid var(--border); transition: background 0.15s; }
        .task-card:last-child { border-bottom: none; }
        .task-card.submitted { background: rgba(0,212,168,0.025); }
        .task-header { margin-bottom: 14px; }
        .task-title-row { display: flex; align-items: center; gap: 9px; margin-bottom: 5px; }
        .task-status-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
          background: var(--border2); transition: all 0.2s;
        }
        .task-status-dot.done { background: var(--teal); box-shadow: 0 0 7px rgba(0,212,168,0.5); }
        .task-title { font-weight: 600; font-size: 15px; }
        .task-submitted-info {
          font-size: 12.5px; color: var(--text2);
          display: flex; align-items: center; gap: 12px;
          padding-left: 17px; flex-wrap: wrap; margin-top: 2px;
        }
        .task-link { color: var(--teal); font-size: 12px; font-weight: 500; }
        .task-link:hover { text-decoration: underline; }
        .task-body { display: flex; flex-direction: column; gap: 14px; }
        .google-form-section { display: flex; flex-direction: column; gap: 8px; }
        .google-form-iframe {
          width: 100%; height: 420px;
          border-radius: var(--radius-sm); border: 1px solid var(--border);
        }
        .form-note {
          font-size: 12px; color: var(--amber);
          background: rgba(245,166,35,0.07); padding: 9px 13px;
          border-radius: var(--radius-sm); border: 1px solid rgba(245,166,35,0.18);
        }
        .auto-pass-banner {
          padding: 13px 18px;
          background: rgba(0,212,168,0.06); border: 1px solid rgba(0,212,168,0.18);
          border-radius: var(--radius-sm); color: var(--teal); font-size: 14px;
        }
        .deadline-msg {
          font-size: 13px; color: var(--red);
          background: rgba(255,71,87,0.05); padding: 10px 14px;
          border-radius: var(--radius-sm); border: 1px solid rgba(255,71,87,0.14);
        }
        .file-input { padding: 8px; width: 100%; }

        /* ── Forms ── */
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group label { font-size: 13px; font-weight: 600; color: var(--text2); }
        .required-star { color: var(--red); font-size: 11px; }
        .form-hint { font-size: 11.5px; color: var(--text3); }
        .form-hint-inline { font-size: 12px; color: var(--text3); font-weight: 400; }

        /* ── Projects ── */
        .projects-section { display: flex; flex-direction: column; gap: 20px; }
        .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; }
        .card-center { text-align: center; padding: 48px 32px; }
        .card-highlight { background: rgba(0,212,168,0.04); border-color: rgba(0,212,168,0.2); }
        .card-success { background: rgba(0,212,168,0.07); border-color: var(--teal); text-align: center; padding: 36px 32px; }
        .card-heading { font-family: var(--font-head); font-size: 17px; font-weight: 700; margin-bottom: 6px; }
        .card-sub { color: var(--text2); font-size: 14px; }
        .lock-icon { font-size: 44px; margin-bottom: 14px; }
        .req-badges { display: flex; gap: 10px; flex-wrap: wrap; }
        .project-section-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
        .project-section-title { font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 8px; }
        .project-section-sub { font-size: 12px; color: var(--text3); font-weight: 400; }
        .project-options { font-size: 12.5px; color: var(--text3); margin-top: 5px; }
        .submitted-project-card {
          background: var(--bg2); border: 1px solid var(--border);
          border-radius: var(--radius-sm); padding: 16px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .submitted-project-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .project-category { color: var(--text3); font-size: 12px; }
        .project-desc { font-size: 13px; color: var(--text2); }
        .project-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }

        /* ── Modal ── */
        .modal-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.65);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 20px; backdrop-filter: blur(5px);
        }
        .modal-card {
          background: var(--surface); border: 1px solid var(--border2);
          border-radius: var(--radius); width: 100%; max-width: 520px;
          max-height: 88vh; overflow-y: auto;
          animation: slideUp 0.22s ease;
          box-shadow: 0 24px 60px rgba(0,0,0,0.4);
        }
        .modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 24px; border-bottom: 1px solid var(--border);
          position: sticky; top: 0; background: var(--surface); z-index: 1;
        }
        .modal-header h3 { font-family: var(--font-head); font-size: 17px; font-weight: 700; }
        .modal-close { font-size: 16px; opacity: 0.6; }
        .modal-close:hover { opacity: 1; }
        .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
        .btn-full { width: 100%; margin-top: 4px; }

        /* ── Toasts ── */
        .toast-container {
          position: fixed; bottom: 24px; right: 24px;
          display: flex; flex-direction: column; gap: 10px; z-index: 9999;
        }
        .toast {
          padding: 12px 18px; border-radius: var(--radius-sm);
          font-size: 13.5px; font-weight: 500;
          max-width: 340px; box-shadow: 0 8px 24px rgba(0,0,0,0.25);
          animation: slideUp 0.2s ease;
          border: 1px solid;
        }
        .toast-success { background: rgba(0,212,168,0.12); color: var(--teal); border-color: rgba(0,212,168,0.3); }
        .toast-error { background: rgba(255,71,87,0.1); color: var(--red); border-color: rgba(255,71,87,0.25); }

        /* ── Animations ── */
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .dash-sidebar { display: none; }
          .dash-main { padding: 20px; max-width: 100%; }
        }
      `}</style>
    </div>
  )
}