<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth.store'
import { supabase } from '@/core/supabase'
import siloeLogo from '@/modules/admin/assets/siloe.png'
import iglesiaLogo from '@/modules/admin/assets/iglesia_blanco.png'

const router = useRouter()
const { signIn, currentUser } = useAuthStore()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const showPass = ref(false)
const showSplash = ref(false)
const splashName = ref('')

async function handleLogin() {
  error.value = ''
  if (!email.value.trim() || !password.value.trim()) {
    error.value = 'Completa todos los campos.'
    return
  }
  loading.value = true
  try {
    await signIn(email.value.trim(), password.value.trim())
    // Fetch profile name for splash
    if (currentUser.value) {
      const { data } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', currentUser.value.id)
        .single()
      splashName.value = data?.full_name ?? ''
    }
    showSplash.value = true
    await new Promise(r => setTimeout(r, 2200))
    router.push('/')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Credenciales incorrectas.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div
    class="min-h-screen bg-gradient-to-br from-[#04395a] via-[#05527f] to-[#068ab8] flex items-center justify-center p-4"
  >
    <div class="w-full max-w-sm">
      <div>
        <!-- Logo -->
        <div class="flex flex-col items-center mb-8 select-none">
          <div class="logo-wrap mb-5">
            <img :src="siloeLogo" alt="Baptos" class="logo-img" />
            <!-- Gotas que gotean desde el borde inferior del logo -->
            <span class="drop drop-1" />
            <span class="drop drop-2" />
            <span class="drop drop-3" />
            <span class="drop drop-4" />
          </div>
          <!-- <h1 class="text-2xl font-bold text-white tracking-tight">BAPTOS</h1> -->
        </div>

        <!-- Card -->
        <div class="bg-white rounded-2xl shadow-2xl p-8 space-y-5">
          <div class="mb-1">
            <h2 class="text-lg font-bold text-[#04395a]">Iniciar sesión</h2>
            <p class="text-xs text-gray-400 mt-0.5">Ingresa tus credenciales de acceso.</p>
          </div>

          <!-- Email -->
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5">Correo electrónico</label>
            <div class="relative">
              <input
                v-model="email"
                type="email"
                placeholder="usuario@ejemplo.com"
                autocomplete="email"
                @keyup.enter="handleLogin"
                class="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition-colors"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="#9ca3af"
                class="w-4 h-4 absolute left-3 top-3"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
                />
              </svg>
            </div>
          </div>

          <!-- Password -->
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1.5">Contraseña</label>
            <div class="relative">
              <input
                v-model="password"
                :type="showPass ? 'text' : 'password'"
                placeholder="••••••••"
                autocomplete="current-password"
                @keyup.enter="handleLogin"
                class="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#04395a]/20 focus:border-[#04395a] transition-colors"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="#9ca3af"
                class="w-4 h-4 absolute left-3 top-3"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                />
              </svg>
              <button
                type="button"
                @click="showPass = !showPass"
                class="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  v-if="!showPass"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="w-4 h-4"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                </svg>
                <svg
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="w-4 h-4"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                  />
                </svg>
              </button>
            </div>
          </div>

          <!-- Error -->
          <div
            v-if="error"
            class="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.8"
              stroke="#ef4444"
              class="w-4 h-4 shrink-0"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
            <p class="text-xs text-red-600 font-medium">{{ error }}</p>
          </div>

          <!-- Submit -->
          <button
            type="button"
            :disabled="loading"
            @click="handleLogin"
            class="w-full py-3 rounded-xl bg-[#04395a] text-white text-sm font-semibold hover:bg-[#068ab8] disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <svg
              v-if="loading"
              class="animate-spin w-4 h-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            {{ loading ? 'Ingresando…' : 'Ingresar' }}
          </button>
        </div>
      </div>

      <!-- Logo iglesia alineado a la derecha, pegado al formulario -->
      <div class="flex justify-end" style="margin-top: -30px">
        <img
          :src="iglesiaLogo"
          alt="Iglesia Adventista"
          class="w-32 h-32 object-contain opacity-50"
        />
      </div>
    </div>
  </div>

  <!-- Splash screen post-login -->
  <Transition name="splash">
    <div
      v-if="showSplash"
      class="splash-overlay"
    >
      <div class="flex flex-col items-center select-none">
        <div class="logo-wrap mb-6">
          <img :src="siloeLogo" alt="Baptos" class="logo-img" />
          <span class="drop drop-1" />
          <span class="drop drop-2" />
          <span class="drop drop-3" />
          <span class="drop drop-4" />
        </div>
        <h1 class="splash-title">Baptos</h1>
        <p class="splash-subtitle">Bienvenido al sistema</p>
        <p v-if="splashName" class="splash-name">{{ splashName.split(' ')[0] }}</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ── Splash overlay ────────────────────────────────────────────── */
.splash-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: linear-gradient(135deg, #04395a 0%, #05527f 50%, #068ab8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.splash-title {
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.05em;
  margin-bottom: 0.35rem;
}

.splash-subtitle {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 0.08em;
}

.splash-name {
  margin-top: 0.5rem;
  font-size: 1.75rem;
  font-weight: 700;
  color: #068ab8;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-shadow: 0 2px 20px rgba(6, 138, 184, 0.5);
}

/* Fade-in on enter, fade-out on leave */
.splash-enter-active {
  transition: opacity 0.45s ease;
}
.splash-leave-active {
  transition: opacity 0.5s ease;
}
.splash-enter-from,
.splash-leave-to {
  opacity: 0;
}

/* ── Contenedor ────────────────────────────────────────────────── */
.logo-wrap {
  position: relative;
  width: 116px;
  height: 116px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

/* ── Logo ──────────────────────────────────────────────────────── */
.logo-img {
  width: 108px;
  height: 108px;
  object-fit: contain;
  border-radius: 22px;
  position: relative;
  z-index: 2;
  filter: drop-shadow(0 6px 20px rgba(4, 57, 90, 0.5));
  animation: logo-drip 4.8s ease-in-out infinite;
}

/* Logo cae muy ligeramente — simula el peso del agua */
@keyframes logo-drip {
  0% {
    transform: translateY(0px) scaleY(1);
  }
  40% {
    transform: translateY(4px) scaleY(0.985);
  }
  55% {
    transform: translateY(6px) scaleY(0.978);
  }
  70% {
    transform: translateY(3px) scaleY(0.992);
  }
  100% {
    transform: translateY(0px) scaleY(1);
  }
}

/* ── Gotas ─────────────────────────────────────────────────────── */
/*
 * Cada gota parte del borde inferior del logo, se forma lentamente
 * (crece hacia abajo como agua acumulándose), luego se desprende
 * y cae desvaneciéndose.
 *
 * Ciclo:  0–25%  → formación colgante (crece)
 *        25–40%  → punto de ruptura (alargamiento máximo)
 *        40–70%  → caída libre (translateY + fade)
 *        70–100% → invisible (espera)
 */
.drop {
  position: absolute;
  /* Al centro-inferior del logo (logo ocupa 108px centrado en 116px → margen 4px) */
  bottom: 4px;
  width: 5px;
  height: 5px;
  border-radius: 50% 50% 46% 46% / 44% 44% 56% 56%;
  background: rgba(255, 255, 255, 0.82);
  opacity: 0;
  z-index: 3;
  transform-origin: top center;
  animation: drip linear infinite;
}

/* Posición horizontal y tiempos distintos → goteo natural y asimétrico */
.drop-1 {
  left: 22%;
  animation-duration: 3.6s;
  animation-delay: 0s;
}
.drop-2 {
  left: 41%;
  animation-duration: 4.2s;
  animation-delay: 1.4s;
}
.drop-3 {
  left: 61%;
  animation-duration: 3.9s;
  animation-delay: 2.7s;
}
.drop-4 {
  left: 78%;
  animation-duration: 4.5s;
  animation-delay: 0.8s;
}

@keyframes drip {
  /* Aparece como punto pequeño */
  0% {
    opacity: 0;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    transform: translateY(0);
  }
  /* Crece colgando hacia abajo — fase de acumulación */
  5% {
    opacity: 0.9;
  }
  22% {
    opacity: 1;
    width: 5px;
    height: 10px;
    border-radius: 46% 46% 50% 50% / 30% 30% 62% 62%;
    transform: translateY(0);
  }
  /* Alargamiento máximo antes de desprenderse */
  34% {
    opacity: 1;
    width: 5px;
    height: 14px;
    border-radius: 44% 44% 50% 50% / 24% 24% 66% 66%;
    transform: translateY(2px);
  }
  /* Ruptura: la gota se redondea y empieza a caer */
  42% {
    opacity: 1;
    width: 7px;
    height: 9px;
    border-radius: 50%;
    transform: translateY(10px);
  }
  /* Caída libre */
  65% {
    opacity: 0.45;
    width: 6px;
    height: 7px;
    border-radius: 50%;
    transform: translateY(46px);
  }
  /* Desaparece */
  76% {
    opacity: 0;
    transform: translateY(62px);
  }
  /* Pausa invisible antes del siguiente ciclo */
  100% {
    opacity: 0;
    width: 3px;
    height: 3px;
    transform: translateY(62px);
  }
}
</style>
