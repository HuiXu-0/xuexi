import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// assetsDir 设为 static：public/assets 是站点静态图片目录，
// 避免与 Vite 打包产物目录重名。
export default defineConfig({
  plugins: [vue()],
  build: {
    assetsDir: 'static',
  },
})
