import { ref } from 'vue'
import { supabase } from '@/core/supabase'
import type { User } from '@supabase/supabase-js'

export type UserRole = 'admin' | 'recruiter' | 'viewer'

const currentUser = ref<User | null>(null)
const currentRole = ref<UserRole | null>(null)
const initialized = ref(false)

async function loadRole(userId: string) {
  const { data } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single()
  currentRole.value = (data?.role as UserRole) ?? null
}

export function useAuthStore() {
  async function init() {
    const { data } = await supabase.auth.getSession()
    currentUser.value = data.session?.user ?? null
    if (currentUser.value) await loadRole(currentUser.value.id)
    initialized.value = true

    let _lastLoadedUserId: string | null = null

    supabase.auth.onAuthStateChange(async (_, session) => {
      currentUser.value = session?.user ?? null
      const uid = session?.user?.id ?? null
      if (uid && uid !== _lastLoadedUserId) {
        _lastLoadedUserId = uid
        try { await loadRole(uid) } catch { /* ignore */ }
      } else if (!uid) {
        _lastLoadedUserId = null
        currentRole.value = null
      }
    })
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    currentUser.value = data.user
    await loadRole(data.user.id)
  }

  async function signOut() {
    await supabase.auth.signOut()
    currentUser.value = null
    currentRole.value = null
  }

  return { currentUser, currentRole, initialized, init, signIn, signOut }
}
