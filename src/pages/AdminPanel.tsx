import { useState, useEffect, useCallback } from 'react'
import { apiFetch, auth } from '@/lib/api'
import { User, AdminStudent } from '@/types'

interface Props { user: User }

interface WeekAdmin {
  id: number
  week_number: number
  title: string
  description?: string
  is_open: boolean
}

export default function AdminPanel({ user }: Props) {
  const [students, setStudents] = useState<AdminStudent[]>([])
  const [eligible, setEligible] = useState<AdminStudent[]>([])
  const [weeks, setWeeks] = useState<WeekAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'students' | 'certs' | 'weeks'>('students')
  const [search, setSearch] = useState('')
  const [filterWeek, setFilterWeek] = useState<string>('all')
  const [selectedStudent, setSelectedStudent] = useState<AdminStudent | null>(null)
  const [issuingCert, setIssuingCert] = useState<string | null>(null)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [togglingWeek, setTogglingWeek] = useState<number | null>(null)
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'success' | 'error' }[]>([])

  const toast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  const loadData = useCallback(async () => {
    try {
      const [studentsData, eligibleData, weeksData] = await Promise.all([
        apiFetch<AdminStudent[]>('/admin/students'),
        apiFetch<AdminStudent[]>('/admin/cert-eligible'),
        apiFetch<WeekAdmin[]>('/admin/weeks'),
      ])
      setStudents(studentsData || [])
      setEligible(eligibleData || [])
      setWeeks(weeksData || [])
    } catch {
      toast('Failed to load data', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  const handleExportCSV = async () => {
    const token = (await import('@/lib/api').then(m => m.supabase.auth.getSession())).data.session?.access_token
    const res = await fetch('/api/admin/export-csv', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `students-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast('CSV exported!')
  }

  const handleIssueCert = async (userId: string) => {
    setIssuingCert(userId)
    try {
      await apiFetch(`/admin/issue-cert/${userId}`, { method: 'POST' })
      toast('Certificate issued and emailed! 🎉')
      loadData()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to issue cert', 'error')
    } finally {
      setIssuingCert(null)
    }
  }

  const handleBulkCerts = async () => {
    if (!bulkSelected.size) return
    try {
      const userIds = [...bulkSelected]
      await apiFetch('/admin/bulk-issue-certs', {
        method: 'POST',
        body: JSON.stringify({ userIds }),
        headers: { 'Content-Type': 'application/json' },
      })
      toast(`Certificates issued to ${userIds.length} students! 🎉`)
      setBulkSelected(new Set())
      loadData()
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Bulk issue failed', 'error')
    }
  }

  const handleToggleWeek = async (weekId: number, currentOpen: boolean) => {
    setTogglingWeek(weekId)
    try {
      await apiFetch(`/admin/weeks/${weekId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_open: !currentOpen }),
      })
      toast(`Week ${currentOpen ? 'closed' : 'opened'} successfully! ✅`)
      setWeeks(ws => ws.map(w => w.id === weekId ? { ...w, is_open: !currentOpen } : w))
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to toggle week', 'error')
    } finally {
      setTogglingWeek(null)
    }
  }

  const handlePromoteAdmin = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'student' : 'admin'
    try {
      await apiFetch(`/admin/set-role/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      toast(`User role updated to ${newRole}! ✅`)
      loadData()
      setSelectedStudent(null)
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed', 'error')
    }
  }

  const handleSignOut = async () => {
    try {
      await auth.signOut()
      window.location.href = '/'
    } catch {
      toast('Sign out failed', 'error')
    }
  }

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
    const matchWeek = filterWeek === 'all' || s.completed_weeks.toString() === filterWeek
    return matchSearch && matchWeek
  })

  const stats = {
    total: students.length,
    week1: students.filter(s => s.completed_weeks >= 1).length,
    week2: students.filter(s => s.completed_weeks >= 2).length,
    week3: students.filter(s => s.completed_weeks >= 3).length,
    week4: students.filter(s => s.completed_weeks >= 4).length,
    certified: students.filter(s => s.certification).length,
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p>Initializing Admin Portal...</p>
    </div>
  )

  return (
    <div className="admin-page">
      {/* ── Sidebar ── */}
      <aside className="dash-sidebar">
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">⚡</span>
          <span className="sidebar-logo-text">SkillCamp</span>
        </div>

        <div className="sidebar-profile">
          <div className="profile-avatar admin-avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="profile-info">
            <div className="profile-name">{user.name}</div>
            <div className="profile-role">🛡️ Administrator</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}>
            <span className="nav-icon">👥</span>
            <span>Students Directory</span>
          </button>
          <button className={`nav-item ${activeTab === 'certs' ? 'active' : ''}`}
            onClick={() => setActiveTab('certs')}>
            <span className="nav-icon">🏆</span>
            <span>Certifications</span>
            {eligible.filter(s => !s.certification).length > 0 && (
              <span className="nav-badge">{eligible.filter(s => !s.certification).length} pending</span>
            )}
          </button>
          <button className={`nav-item ${activeTab === 'weeks' ? 'active' : ''}`}
            onClick={() => setActiveTab('weeks')}>
            <span className="nav-icon">📅</span>
            <span>Week Management</span>
          </button>
        </nav>

        {/* Stats Summary */}
        <div className="admin-stats-summary">
          <h4 className="stats-heading">OVERVIEW</h4>
          <div className="stat-row">
            <span className="stat-label">Total Students</span>
            <span className="stat-val highlight">{stats.total}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Week 1 Done</span>
            <span className="stat-val">{stats.week1}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Week 2 Done</span>
            <span className="stat-val">{stats.week2}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Week 3 Done</span>
            <span className="stat-val">{stats.week3}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Fully Completed</span>
            <span className="stat-val">{stats.week4}</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-row">
            <span className="stat-label">Certified</span>
            <span className="stat-val success">{stats.certified}</span>
          </div>
        </div>

        <button className="btn btn-ghost signout-btn" onClick={handleSignOut}>
          Sign Out
        </button>
      </aside>

      {/* ── Main Content ── */}
      <main className="dash-main">

        {/* ── STUDENTS TAB ── */}
        {activeTab === 'students' && (
          <div className="tab-content fade-in">
            <div className="dash-header">
              <div className="header-text">
                <h1 className="dash-title">Student Directory</h1>
                <p className="dash-subtitle">Manage and track progress for {students.length} enrolled students.</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-secondary btn-sm" onClick={loadData}>
                  <span>↻</span> Refresh
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleExportCSV}>
                  <span>📥</span> Export CSV
                </button>
              </div>
            </div>

            <div className="filter-bar card">
              <div className="search-wrapper">
                <span className="search-icon">🔍</span>
                <input type="text" placeholder="Search by name or email..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="search-input" />
              </div>
              <div className="select-wrapper">
                <select value={filterWeek} onChange={e => setFilterWeek(e.target.value)} className="filter-select">
                  <option value="all">All Progress Levels</option>
                  <option value="0">Not Started</option>
                  <option value="1">Completed Week 1</option>
                  <option value="2">Completed Week 2</option>
                  <option value="3">Completed Week 3</option>
                  <option value="4">Fully Completed</option>
                </select>
              </div>
            </div>

            <div className="table-container card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student Profile</th>
                    <th>Progress Timeline</th>
                    <th className="text-center">Tasks Done</th>
                    <th className="text-center">Projects</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length > 0 ? (
                    filtered.map(s => (
                      <tr key={s.id} onClick={() => setSelectedStudent(s)} className="table-row">
                        <td>
                          <div className="user-cell">
                            <div className="user-avatar">{s.name.charAt(0).toUpperCase()}</div>
                            <div className="user-details">
                              <span className="user-name">{s.name}</span>
                              <span className="user-email">{s.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="progress-pills">
                            {[1, 2, 3, 4].map(w => (
                              <div key={w} className={`pill ${s.completed_weeks >= w ? 'active' : ''}`} title={`Week ${w}`}></div>
                            ))}
                            <span className="progress-text">{s.completed_weeks}/4</span>
                          </div>
                        </td>
                        <td className="text-center">
                          <span className="count-badge">{s.submissions_count}</span>
                        </td>
                        <td className="text-center">
                          <div className="project-indicators">
                            <span className={`indicator ${s.mini_project ? 'done' : ''}`} title="Mini Project">M</span>
                            <span className={`indicator ${s.major_project ? 'done' : ''}`} title="Major Project">★</span>
                          </div>
                        </td>
                        <td>
                          {s.certification
                            ? <span className="status-badge success">Certified</span>
                            : s.completed_weeks >= 4 ? <span className="status-badge warning">Pending Cert</span>
                            : <span className="status-badge neutral">In Progress</span>}
                        </td>
                        <td className="text-sm text-muted">
                          {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </td>
                        <td className="text-right">
                          <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedStudent(s); }}>
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state">
                          <span className="empty-icon">📭</span>
                          <h4>No Students Found</h4>
                          <p>Try adjusting your search or filters.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CERTS TAB ── */}
        {activeTab === 'certs' && (
          <div className="tab-content fade-in">
            <div className="dash-header">
              <div className="header-text">
                <h1 className="dash-title">Certifications</h1>
                <p className="dash-subtitle">Manage and issue certificates for eligible students.</p>
              </div>
              {bulkSelected.size > 0 && (
                <button className="btn btn-primary" onClick={handleBulkCerts}>
                  🏆 Issue {bulkSelected.size} Certificates
                </button>
              )}
            </div>

            <div className="info-banner card">
              <div className="banner-icon">ℹ️</div>
              <div className="banner-content">
                <h4>Eligibility Rules</h4>
                <p>Students must complete <strong>all 4 weeks</strong>, including <strong>1 Mini Project</strong> and <strong>1 Major Project</strong> to appear here.</p>
              </div>
            </div>

            <div className="list-grid">
              {eligible.length === 0 ? (
                <div className="empty-state card">
                  <span className="empty-icon">🎓</span>
                  <h4>No Eligible Students Yet</h4>
                  <p>Students will appear here once they complete all requirements.</p>
                </div>
              ) : (
                eligible.map(s => (
                  <div key={s.id} className={`list-card card ${bulkSelected.has(s.id) ? 'selected' : ''}`} onClick={() => {
                    const next = new Set(bulkSelected)
                    next.has(s.id) ? next.delete(s.id) : next.add(s.id)
                    setBulkSelected(next)
                  }}>
                    <div className="card-top">
                      <div className="checkbox-wrapper">
                        <input type="checkbox" checked={bulkSelected.has(s.id)} readOnly />
                        <span className="custom-checkbox"></span>
                      </div>
                      <div className="user-cell">
                        <div className="user-avatar">{s.name.charAt(0).toUpperCase()}</div>
                        <div className="user-details">
                          <span className="user-name">{s.name}</span>
                          <span className="user-email">{s.email}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="card-bottom">
                      {s.certification ? (
                        <div className="cert-status">
                          <span className="status-badge success">Issued</span>
                          <span className="cert-id">{s.certification.cert_number}</span>
                        </div>
                      ) : (
                        <button className="btn btn-primary btn-full"
                          onClick={(e) => { e.stopPropagation(); handleIssueCert(s.id); }}
                          disabled={issuingCert === s.id}>
                          {issuingCert === s.id ? 'Processing...' : 'Issue Certificate'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── WEEK MANAGEMENT TAB ── */}
        {activeTab === 'weeks' && (
          <div className="tab-content fade-in">
            <div className="dash-header">
              <div className="header-text">
                <h1 className="dash-title">Week Management</h1>
                <p className="dash-subtitle">Control submission access for specific weeks.</p>
              </div>
            </div>

            <div className="weeks-grid">
              {weeks.map(week => (
                <div key={week.id} className={`week-admin-card card ${week.is_open ? 'is-open' : 'is-closed'}`}>
                  <div className="week-status-indicator"></div>
                  <div className="week-card-content">
                    <div className="week-meta">
                      <span className="week-num">Week {week.week_number}</span>
                      <span className={`status-badge ${week.is_open ? 'success' : 'error'}`}>
                        {week.is_open ? 'Accepting Submissions' : 'Submissions Closed'}
                      </span>
                    </div>
                    <h3 className="week-heading">{week.title}</h3>
                    <p className="week-desc">{week.description}</p>
                    
                    <div className="week-actions">
                      <button
                        className={`btn btn-full ${week.is_open ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => handleToggleWeek(week.id, week.is_open)}
                        disabled={togglingWeek === week.id}>
                        {togglingWeek === week.id ? 'Updating...' : week.is_open ? 'Close Submissions' : 'Open Submissions'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Student Detail Modal ── */}
      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onIssueCert={handleIssueCert}
          onPromoteAdmin={handlePromoteAdmin}
          issuingCert={issuingCert}
        />
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
        :root {
          --sidebar-width: 280px;
          --header-height: 80px;
          --primary-glow: rgba(0, 212, 168, 0.15);
        }

        /* ── Layout ── */
        .admin-page { display: flex; min-height: 100vh; background: var(--bg); font-family: var(--font-body); }
        .fade-in { animation: fadeIn 0.3s ease forwards; }

        /* ── Sidebar Modern ── */
        .dash-sidebar {
          width: var(--sidebar-width); flex-shrink: 0;
          background: var(--surface); border-right: 1px solid var(--border);
          display: flex; flex-direction: column; padding: 24px 20px; gap: 24px;
          position: sticky; top: 0; height: 100vh; overflow-y: auto;
          z-index: 10;
        }
        .sidebar-logo { display: flex; align-items: center; gap: 10px; padding: 0 8px; }
        .sidebar-logo-icon { font-size: 24px; }
        .sidebar-logo-text {
          font-family: var(--font-head); font-size: 22px; font-weight: 800; letter-spacing: -0.5px;
          background: linear-gradient(135deg, #fff, var(--text2));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        
        .sidebar-profile {
          display: flex; align-items: center; gap: 14px; padding: 16px;
          background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius);
        }
        .admin-avatar { background: linear-gradient(135deg, #6366F1, #8B5CF6); box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2); }
        .profile-role { font-size: 11.5px; color: #8B5CF6; font-weight: 600; margin-top: 2px; letter-spacing: 0.3px; text-transform: uppercase; }

        .sidebar-nav { display: flex; flex-direction: column; gap: 6px; }
        .nav-item {
          display: flex; align-items: center; gap: 12px; padding: 12px 14px;
          border-radius: var(--radius-sm); font-size: 14px; font-weight: 500;
          color: var(--text2); background: transparent; border: 1px solid transparent;
          transition: all 0.2s ease; cursor: pointer; text-align: left;
        }
        .nav-item:hover { background: var(--bg2); color: var(--text); }
        .nav-item.active {
          background: var(--primary-glow); color: var(--teal);
          border-color: rgba(0,212,168,0.2); font-weight: 600;
        }
        .nav-badge { margin-left: auto; background: var(--amber); color: #000; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 20px; }

        .admin-stats-summary {
          background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius);
          padding: 20px 16px; display: flex; flex-direction: column; gap: 12px; margin-top: auto;
        }
        .stats-heading { font-size: 11px; font-weight: 700; color: var(--text3); letter-spacing: 1px; margin-bottom: 4px; }
        .stat-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
        .stat-label { color: var(--text2); }
        .stat-val { font-family: var(--font-mono); font-weight: 600; color: var(--text); }
        .stat-val.highlight { color: #fff; font-size: 16px; }
        .stat-val.success { color: var(--teal); }
        .stat-divider { height: 1px; background: var(--border); margin: 4px 0; }

        .signout-btn { width: 100%; justify-content: center; font-weight: 500; color: var(--text2); border: 1px solid var(--border); }
        .signout-btn:hover { background: rgba(255,71,87,0.1); color: var(--red); border-color: rgba(255,71,87,0.2); }

        /* ── Main Area ── */
        .dash-main { flex: 1; padding: 40px; max-width: calc(100vw - var(--sidebar-width)); overflow-x: hidden; }
        .dash-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; }
        .dash-title { font-family: var(--font-head); font-size: 28px; font-weight: 700; letter-spacing: -0.5px; color: #fff; }
        .dash-subtitle { color: var(--text3); font-size: 14.5px; margin-top: 6px; }
        .header-actions { display: flex; gap: 12px; }

        /* ── Cards & Tables ── */
        .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
        
        .filter-bar { display: flex; gap: 16px; padding: 16px; margin-bottom: 24px; align-items: center; flex-wrap: wrap; }
        .search-wrapper { flex: 1; min-width: 250px; position: relative; display: flex; align-items: center; }
        .search-icon { position: absolute; left: 14px; color: var(--text3); font-size: 14px; }
        .search-input { width: 100%; padding: 10px 14px 10px 38px; background: var(--bg2); border: 1px solid var(--border2); border-radius: var(--radius-sm); color: #fff; font-size: 14px; transition: border 0.2s; }
        .search-input:focus { border-color: var(--teal); outline: none; }
        .filter-select { padding: 10px 14px; background: var(--bg2); border: 1px solid var(--border2); border-radius: var(--radius-sm); color: #fff; font-size: 14px; min-width: 180px; cursor: pointer; }

        .table-container { overflow-x: auto; border-radius: var(--radius); }
        .data-table { width: 100%; border-collapse: collapse; text-align: left; }
        .data-table th { padding: 16px 20px; font-size: 11px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border); background: var(--bg2); white-space: nowrap; }
        .data-table td { padding: 16px 20px; border-bottom: 1px solid var(--border2); vertical-align: middle; font-size: 14px; }
        .table-row { cursor: pointer; transition: background 0.15s; }
        .table-row:hover { background: rgba(255,255,255,0.02); }
        .table-row:last-child td { border-bottom: none; }
        
        /* ── Table Cells ── */
        .user-cell { display: flex; align-items: center; gap: 12px; }
        .user-avatar { width: 34px; height: 34px; border-radius: 8px; background: var(--bg3); border: 1px solid var(--border2); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; color: var(--text2); }
        .user-details { display: flex; flex-direction: column; }
        .user-name { font-weight: 600; color: #fff; }
        .user-email { font-size: 12px; color: var(--text3); }

        .progress-pills { display: flex; align-items: center; gap: 4px; }
        .pill { width: 12px; height: 4px; border-radius: 2px; background: var(--bg3); }
        .pill.active { background: var(--teal); box-shadow: 0 0 8px rgba(0,212,168,0.4); }
        .progress-text { font-family: var(--font-mono); font-size: 12px; color: var(--text2); margin-left: 8px; }

        .count-badge { background: var(--bg2); border: 1px solid var(--border2); padding: 4px 10px; border-radius: 12px; font-family: var(--font-mono); font-size: 13px; font-weight: 600; }
        
        .project-indicators { display: flex; gap: 6px; justify-content: center; }
        .indicator { width: 24px; height: 24px; border-radius: 6px; background: var(--bg2); border: 1px solid var(--border2); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--text3); }
        .indicator.done { background: rgba(245,166,35,0.15); border-color: rgba(245,166,35,0.3); color: var(--amber); }

        .status-badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .status-badge.success { background: rgba(0,212,168,0.1); color: var(--teal); border: 1px solid rgba(0,212,168,0.2); }
        .status-badge.warning { background: rgba(245,166,35,0.1); color: var(--amber); border: 1px solid rgba(245,166,35,0.2); }
        .status-badge.error { background: rgba(255,71,87,0.1); color: var(--red); border: 1px solid rgba(255,71,87,0.2); }
        .status-badge.neutral { background: var(--bg2); color: var(--text3); border: 1px solid var(--border2); }

        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-muted { color: var(--text3); }
        .text-sm { font-size: 13px; }

        .empty-state { padding: 60px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .empty-icon { font-size: 48px; opacity: 0.8; }
        .empty-state h4 { font-family: var(--font-head); font-size: 18px; color: #fff; }
        .empty-state p { color: var(--text3); font-size: 14px; }

        /* ── Certs & Grid Cards ── */
        .info-banner { display: flex; gap: 16px; padding: 16px 20px; background: rgba(66,133,244,0.05); border-color: rgba(66,133,244,0.2); margin-bottom: 24px; align-items: flex-start; }
        .banner-icon { font-size: 20px; }
        .banner-content h4 { font-size: 14px; font-weight: 600; color: #fff; margin-bottom: 4px; }
        .banner-content p { font-size: 13.5px; color: var(--text2); line-height: 1.5; }

        .list-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
        .list-card { padding: 0; display: flex; flex-direction: column; cursor: pointer; transition: all 0.2s; overflow: hidden; }
        .list-card:hover { transform: translateY(-2px); border-color: var(--teal); box-shadow: 0 8px 24px rgba(0,212,168,0.1); }
        .list-card.selected { border-color: var(--teal); box-shadow: 0 0 0 1px var(--teal); }
        .card-top { padding: 20px; display: flex; align-items: flex-start; gap: 16px; border-bottom: 1px solid var(--border2); }
        .card-bottom { padding: 16px 20px; background: var(--bg2); }
        
        .checkbox-wrapper { position: relative; width: 20px; height: 20px; flex-shrink: 0; margin-top: 6px; }
        .checkbox-wrapper input { position: absolute; opacity: 0; cursor: pointer; height: 0; width: 0; }
        .custom-checkbox { position: absolute; top: 0; left: 0; height: 20px; width: 20px; background-color: var(--bg3); border: 2px solid var(--border2); border-radius: 4px; transition: all 0.2s; }
        .list-card:hover .custom-checkbox { border-color: var(--teal); }
        .list-card.selected .custom-checkbox { background-color: var(--teal); border-color: var(--teal); }
        .custom-checkbox:after { content: ""; position: absolute; display: none; left: 6px; top: 2px; width: 4px; height: 10px; border: solid #000; border-width: 0 2px 2px 0; transform: rotate(45deg); }
        .list-card.selected .custom-checkbox:after { display: block; }

        .cert-status { display: flex; justify-content: space-between; align-items: center; }
        .cert-id { font-family: var(--font-mono); font-size: 12px; color: var(--text3); }

        /* ── Week Cards ── */
        .weeks-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 24px; }
        .week-admin-card { padding: 0; position: relative; overflow: hidden; display: flex; }
        .week-status-indicator { width: 4px; flex-shrink: 0; }
        .week-admin-card.is-open .week-status-indicator { background: var(--teal); box-shadow: 0 0 12px rgba(0,212,168,0.5); }
        .week-admin-card.is-closed .week-status-indicator { background: var(--border2); }
        .week-card-content { padding: 24px; flex: 1; display: flex; flex-direction: column; }
        .week-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .week-num { font-size: 13px; font-weight: 700; color: var(--text2); letter-spacing: 0.5px; text-transform: uppercase; }
        .week-heading { font-family: var(--font-head); font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 8px; }
        .week-desc { font-size: 14px; color: var(--text3); line-height: 1.5; margin-bottom: 24px; flex: 1; }
        .btn-full { width: 100%; }

        /* ── Responsive ── */
        @media (max-width: 1024px) {
          .dash-sidebar { width: 240px; }
          .dash-main { max-width: calc(100vw - 240px); }
        }
        @media (max-width: 768px) {
          .dash-sidebar { display: none; }
          .dash-main { max-width: 100%; padding: 24px; }
          .filter-bar { flex-direction: column; align-items: stretch; }
          .search-wrapper, .select-wrapper, .filter-select { width: 100%; }
        }
      `}</style>
    </div>
  )
}

// ── Student Detail Modal (Redesigned) ──────────────────────────────────────
function StudentDetailModal({
  student, onClose, onIssueCert, onPromoteAdmin, issuingCert
}: {
  student: AdminStudent
  onClose: () => void
  onIssueCert: (id: string) => void
  onPromoteAdmin: (id: string, currentRole: string) => void
  issuingCert: string | null
}) {
  const [detail, setDetail] = useState<{
    role?: string
    submissions: { task_id: string; submitted_at: string; github_link?: string; deployed_url?: string; file_url?: string; tasks?: { title: string } }[]
    projects: { project_type: string; project_category: string; title: string; github_link?: string; deployed_url?: string; file_url?: string }[]
    activity: { action: string; details: string; created_at: string }[]
  } | null>(null)
  const [promoting, setPromoting] = useState(false)

  useEffect(() => {
    apiFetch<typeof detail>(`/admin/students/${student.id}`).then(d => setDetail(d))
  }, [student.id])

  const isAdmin = detail?.role === 'admin'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-user-info">
            <div className="modal-avatar">{student.name.charAt(0).toUpperCase()}</div>
            <div>
              <h3 className="modal-name">{student.name}</h3>
              <p className="modal-email">{student.email}</p>
            </div>
            {isAdmin && <span className="status-badge warning" style={{marginLeft: '12px'}}>Admin</span>}
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          
          {/* Progress Section */}
          <div className="modal-section">
            <h4 className="section-title">Requirements Tracker</h4>
            <div className="req-tracker">
              {[1, 2, 3, 4].map(w => (
                <div key={w} className={`req-item ${student.completed_weeks >= w ? 'done' : ''}`}>
                  <span className="req-icon">{student.completed_weeks >= w ? '✓' : '○'}</span>
                  <span>Week {w}</span>
                </div>
              ))}
              <div className="req-divider"></div>
              <div className={`req-item ${student.mini_project ? 'done-amber' : ''}`}>
                <span className="req-icon">{student.mini_project ? '★' : '○'}</span>
                <span>Mini</span>
              </div>
              <div className={`req-item ${student.major_project ? 'done-amber' : ''}`}>
                <span className="req-icon">{student.major_project ? '★' : '○'}</span>
                <span>Major</span>
              </div>
            </div>
          </div>

          {!detail ? (
            <div className="modal-loading"><div className="loading-spinner"></div></div>
          ) : (
            <>
              {/* Task Submissions */}
              <div className="modal-section">
                <div className="section-header">
                  <h4 className="section-title">Task Submissions</h4>
                  <span className="count-badge">{detail.submissions.length}</span>
                </div>
                {detail.submissions.length === 0 ? (
                  <p className="text-muted text-sm">No tasks submitted yet.</p>
                ) : (
                  <div className="submission-list">
                    {detail.submissions.map((s, i) => (
                      <div key={i} className="submission-item">
                        <div className="sub-info">
                          <span className="sub-title">{s.tasks?.title || s.task_id}</span>
                          <span className="sub-date">{new Date(s.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                        </div>
                        <div className="sub-links">
                          {s.github_link && <a href={s.github_link} target="_blank" rel="noreferrer" className="link-pill gh">GitHub</a>}
                          {s.deployed_url && <a href={s.deployed_url} target="_blank" rel="noreferrer" className="link-pill web">Link</a>}
                          {s.file_url && <a href={s.file_url} target="_blank" rel="noreferrer" className="link-pill file">File</a>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Projects */}
              {detail.projects.length > 0 && (
                <div className="modal-section">
                  <div className="section-header">
                    <h4 className="section-title">Final Projects</h4>
                    <span className="count-badge">{detail.projects.length}</span>
                  </div>
                  <div className="submission-list">
                    {detail.projects.map((p, i) => (
                      <div key={i} className="submission-item project">
                        <div className="sub-info">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className={`status-badge ${p.project_type === 'mini' ? 'warning' : 'success'}`}>{p.project_type}</span>
                            <span className="sub-title">{p.title}</span>
                          </div>
                          <span className="sub-date">{p.project_category}</span>
                        </div>
                        <div className="sub-links">
                          {p.github_link && <a href={p.github_link} target="_blank" rel="noreferrer" className="link-pill gh">GitHub</a>}
                          {p.deployed_url && <a href={p.deployed_url} target="_blank" rel="noreferrer" className="link-pill web">Link</a>}
                          {p.file_url && <a href={p.file_url} target="_blank" rel="noreferrer" className="link-pill file">File</a>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              {detail.activity.length > 0 && (
                <div className="modal-section">
                  <h4 className="section-title">Recent Activity</h4>
                  <div className="activity-list">
                    {detail.activity.slice(0, 4).map((a, i) => (
                      <div key={i} className="activity-item">
                        <div className="act-dot"></div>
                        <div className="act-content">
                          <p className="act-text">{a.details}</p>
                          <span className="act-time">{new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Actions Footer */}
          <div className="modal-footer">
            {/* Cert actions */}
            {!student.certification && student.completed_weeks >= 3 && student.mini_project && student.major_project ? (
              <button className="btn btn-primary btn-full"
                onClick={() => onIssueCert(student.id)}
                disabled={issuingCert === student.id}>
                {issuingCert === student.id ? 'Processing...' : '🏆 Issue Certificate'}
              </button>
            ) : student.certification ? (
              <div className="cert-success-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>✅</span>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--teal)', fontSize: '14px' }}>Certificate Issued</div>
                    <div style={{ fontSize: '12px', color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>{student.certification.cert_number}</div>
                  </div>
                </div>
                {student.certification.pdf_url && (
                  <a href={student.certification.pdf_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">View PDF ↗</a>
                )}
              </div>
            ) : null}

            {/* Admin Toggle */}
            <div className="admin-toggle-zone">
              <div className="admin-toggle-info">
                <span className="text-sm text-muted">System Role:</span>
                <strong className={`text-sm ${isAdmin ? 'text-amber' : 'text-default'}`}>{isAdmin ? 'Administrator' : 'Student'}</strong>
              </div>
              <button
                className={`btn btn-sm ${isAdmin ? 'btn-secondary' : 'btn-ghost'}`}
                disabled={promoting}
                onClick={async () => {
                  setPromoting(true)
                  await onPromoteAdmin(student.id, isAdmin ? 'admin' : 'student')
                  setPromoting(false)
                }}>
                {promoting ? 'Updating...' : isAdmin ? 'Remove Admin Rights' : 'Promote to Admin'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; backdrop-filter: blur(8px); }
        .modal-card { background: var(--surface); border: 1px solid var(--border2); border-radius: 16px; width: 100%; max-width: 600px; max-height: 90vh; display: flex; flex-direction: column; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 24px 60px rgba(0,0,0,0.5); overflow: hidden; }
        
        .modal-header { padding: 24px 30px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: flex-start; background: rgba(255,255,255,0.02); }
        .modal-user-info { display: flex; align-items: center; gap: 16px; }
        .modal-avatar { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, var(--teal), var(--amber)); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; color: #000; }
        .modal-name { font-family: var(--font-head); font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 4px; }
        .modal-email { font-size: 13.5px; color: var(--text3); }
        .modal-close-btn { background: var(--bg2); border: 1px solid var(--border2); width: 32px; height: 32px; border-radius: 8px; color: var(--text2); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .modal-close-btn:hover { background: var(--bg3); color: #fff; transform: scale(1.05); }

        .modal-body { padding: 30px; overflow-y: auto; display: flex; flex-direction: column; gap: 32px; }
        .modal-loading { padding: 40px; display: flex; justify-content: center; }
        
        .modal-section { display: flex; flex-direction: column; gap: 12px; }
        .section-header { display: flex; align-items: center; gap: 10px; }
        .section-title { font-size: 12px; font-weight: 700; color: var(--text3); text-transform: uppercase; letter-spacing: 0.8px; }
        
        /* Progress Tracker */
        .req-tracker { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; background: var(--bg2); padding: 14px 18px; border-radius: var(--radius-sm); border: 1px solid var(--border); }
        .req-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text3); font-weight: 500; }
        .req-icon { font-size: 14px; }
        .req-item.done { color: var(--teal); }
        .req-item.done-amber { color: var(--amber); }
        .req-divider { width: 1px; height: 16px; background: var(--border2); margin: 0 4px; }

        /* Lists */
        .submission-list { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
        .submission-item { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: var(--bg2); border-bottom: 1px solid var(--border); gap: 16px; }
        .submission-item:last-child { border-bottom: none; }
        .submission-item:nth-child(even) { background: var(--surface); }
        .sub-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .sub-title { font-size: 14px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sub-date { font-size: 12px; color: var(--text3); }
        
        .sub-links { display: flex; gap: 6px; flex-shrink: 0; }
        .link-pill { padding: 4px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 600; text-decoration: none; transition: opacity 0.2s; }
        .link-pill:hover { opacity: 0.8; }
        .link-pill.gh { background: rgba(255,255,255,0.1); color: #fff; }
        .link-pill.web { background: rgba(0,212,168,0.15); color: var(--teal); }
        .link-pill.file { background: rgba(66,133,244,0.15); color: #4285F4; }

        /* Activity */
        .activity-list { display: flex; flex-direction: column; gap: 16px; padding-left: 6px; }
        .activity-item { display: flex; gap: 16px; position: relative; }
        .activity-item:not(:last-child)::before { content: ''; position: absolute; left: 3.5px; top: 20px; bottom: -16px; width: 1px; background: var(--border2); }
        .act-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--border2); margin-top: 6px; flex-shrink: 0; position: relative; z-index: 2; box-shadow: 0 0 0 4px var(--surface); }
        .activity-item:first-child .act-dot { background: var(--teal); }
        .act-content { display: flex; flex-direction: column; gap: 4px; }
        .act-text { font-size: 13.5px; color: var(--text2); line-height: 1.4; }
        .act-time { font-size: 11.5px; color: var(--text3); }

        /* Footer */
        .modal-footer { margin-top: 8px; display: flex; flex-direction: column; gap: 16px; }
        .cert-success-box { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: rgba(0,212,168,0.08); border: 1px solid rgba(0,212,168,0.2); border-radius: var(--radius-sm); }
        
        .admin-toggle-zone { display: flex; justify-content: space-between; align-items: center; padding-top: 20px; border-top: 1px solid var(--border); }
        .admin-toggle-info { display: flex; align-items: center; gap: 8px; }
        .text-amber { color: var(--amber); }
        .text-default { color: var(--text); }
      `}</style>
    </div>
  )
}