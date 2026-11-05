import { createRouter, createWebHistory } from 'vue-router'
import PlatformLayout from '../layouts/PlatformLayout.vue'
import WelcomeLayout from '../layouts/WelcomeLayout.vue'

const routes = [
  /* 宣传页 / 登录页：自带外壳，不套平台顶栏页脚 */
  {
    path: '/welcome',
    component: WelcomeLayout,
    children: [{ path: '', name: 'welcome', component: () => import('../views/WelcomeView.vue') }],
  },
  {
    path: '/login',
    component: WelcomeLayout,
    children: [{ path: '', name: 'login', component: () => import('../views/LoginView.vue') }],
  },

  /* 主平台 */
  {
    path: '/',
    component: PlatformLayout,
    children: [
      { path: '', name: 'home', component: () => import('../views/HomeView.vue') },
      { path: 'forum', name: 'forum', component: () => import('../views/ForumView.vue') },
      { path: 'notes', name: 'notes', component: () => import('../views/NotesView.vue') },
      { path: 'competitions', name: 'competitions', component: () => import('../views/CompetitionsView.vue') },
      { path: 'resources', name: 'resources', component: () => import('../views/ResourcesView.vue') },
      { path: 'cases', name: 'cases', component: () => import('../views/CasesView.vue') },
      { path: 'profile', name: 'profile', component: () => import('../views/ProfileView.vue') },
      { path: 'planner', name: 'planner', component: () => import('../views/PlannerView.vue') },
      { path: 'teacher', name: 'teacher', component: () => import('../views/TeacherView.vue') },
      { path: 'admin', name: 'admin', component: () => import('../views/AdminView.vue') },
    ],
  },

  { path: '/:pathMatch(.*)*', redirect: '/welcome' },
]

const router = createRouter({
  /*
   * base 取自 Vite 的 base 配置（import.meta.env.BASE_URL）。
   * 部署到 GitHub Pages 子路径时它会是 '/xuexi/'，
   * 开发时为 '/'。这样路由前缀始终与资源路径保持一致。
   */
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    return { top: 0, behavior: 'smooth' }
  },
})

export default router
