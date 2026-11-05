import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initTheme } from './composables/useTheme.js'
import { initDevice } from './composables/useDevice.js'
import './styles/main.css'
import './styles/welcome.css'

/* index.html 的内联脚本已先做过一次判定（避免首屏闪动），这里再同步一次运行时状态 */
initDevice()
initTheme()

createApp(App).use(router).mount('#app')
