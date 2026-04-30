export interface User {
  id: string
  email: string
  role: UserRole
  createdAt: string
}

export type UserRole = 'admin' | 'recruiter' | 'viewer'
