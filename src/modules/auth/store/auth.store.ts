import { ref } from 'vue'
import { supabase } from '@/core/supabase'
import type { User } from '@supabase/supabase-js'

const currentUser = ref<User | null>(null)
const initialized = ref(false)

export function useAuthStore() {
  async function init() {
    const { data } = await supabase.auth.getSession()
    currentUser.value = data.session?.user ?? null
    initialized.value = true

    supabase.auth.onAuthStateChange((_, session) => {
      currentUser.value = session?.user ?? null
    })
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    currentUser.value = data.user
  }

  async function signOut() {
    await supabase.auth.signOut()
    currentUser.value = null
  }

  return { currentUser, initialized, init, signIn, signOut }
}
