import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useAuthStore } from '@/modules/auth/store/auth.store'
import './assets/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Restaura la sesión al arrancar (refresco de página)
// La reactividad de currentUser actualiza la UI automáticamente
useAuthStore().init()

app.mount('#app')
