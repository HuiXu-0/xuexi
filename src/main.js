import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initTheme } from './composables/useTheme.js'
import './styles/main.css'
import './styles/welcome.css'

initTheme()

createApp(App).use(router).mount('#app')
