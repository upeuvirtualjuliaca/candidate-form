export interface Candidate {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  createdAt: string
}

export type CandidateStatus = 'pending' | 'active' | 'rejected'
