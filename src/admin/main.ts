import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { setLanguage } from '@takoio/common'
import router from './router'
import App from './App.vue'
import 'virtual:uno.css'

// Initialize i18n: prefer saved language, else auto-detect from navigator.language
const savedLang = typeof localStorage !== 'undefined' ? localStorage.getItem('lang') : null
setLanguage(savedLang || undefined)

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')
