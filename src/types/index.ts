export interface User {
  id: string
  name: string
  email: string
  role: 'student' | 'admin'
  current_week: number
  completed_weeks: number
  timer_start_time: number | null
  created_at: string
}

export interface Task {
  id: string
  week_id: number
  title: string
  description: string | null
  task_type: 'google_form' | 'github_link' | 'deployed_url' | 'file_upload' | 'auto_pass' |  'google_form' | 'auto_pass' | 'drive_link';
  form_url: string | null
  required_for_cert: boolean
  sort_order: number
  submission: TaskSubmission | null
}

export interface Week {
  id: number
  week_number: number
  title: string
  description: string | null
  is_open: boolean 
  tasks: Task[]
}

export interface TaskSubmission {
  id: string
  user_id: string
  task_id: string
  github_link: string | null
  deployed_url: string | null
  file_url: string | null
  file_name: string | null
  notes: string | null
  submitted_at: string
  verified: boolean
}

export interface Project {
  id: string
  user_id: string
  project_type: 'mini' | 'major'
  project_category: string
  title: string
  description: string | null
  github_link: string | null
  deployed_url: string | null
  file_url: string | null
  submitted_at: string
}

export interface Certification {
  id: string
  user_id: string
  issued_at: string
  pdf_url: string | null
  cert_number: string
}

export interface AdminStudent extends User {
  submissions_count: number
  mini_project: boolean
  major_project: boolean
  certification: Certification | null
}
