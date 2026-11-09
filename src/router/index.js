import { createRouter, createWebHistory } from 'vue-router'
import PlatformLayout from '../layouts/PlatformLayout.vue'
import WelcomeLayout from '../layouts/WelcomeLayout.vue'
import { restoreAuth, canAccess, denyReason } from '../stores/auth.js'
import { showToast } from '../composables/useToast.js'

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
      { path: 'teacher', name: 'teacher', component: () => import('../views/teacher/TeacherView.vue') },
      {
        path: 'teacher/groups',
        name: 'teacherGroups',
        component: () => import('../views/teacher/TeacherGroupsView.vue'),
      },
      {
        path: 'teacher/reviews',
        name: 'teacherReviews',
        component: () => import('../views/teacher/TeacherReviewsView.vue'),
      },
      {
        path: 'teacher/tasks',
        name: 'teacherTasks',
        component: () => import('../views/teacher/TeacherTasksView.vue'),
      },
      {
        path: 'teacher/content',
        name: 'teacherContent',
        component: () => import('../views/teacher/TeacherContentView.vue'),
      },
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

/*
 * 权限守卫。
 * 设计书 §4 定义了学生端 / 教师端 / 管理员端三套导航与权限，
 * 教师端和管理员端不应被其他角色直接访问。
 * 需要先恢复登录态才能判断角色。
 */
restoreAuth()

router.beforeEach((to) => {
  /* 登录页与宣传页始终可访问 */
  if (to.name === 'login' || to.name === 'welcome') return true

  if (!canAccess(to.name)) {
    showToast(denyReason(to.name))
    return { name: 'home' }
  }
  return true
})

export default router