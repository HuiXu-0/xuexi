import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/forum', name: 'forum', component: () => import('../views/ForumView.vue') },
  { path: '/notes', name: 'notes', component: () => import('../views/NotesView.vue') },
  { path: '/competitions', name: 'competitions', component: () => import('../views/CompetitionsView.vue') },
  { path: '/resources', name: 'resources', component: () => import('../views/ResourcesView.vue') },
  { path: '/cases', name: 'cases', component: () => import('../views/CasesView.vue') },
  { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue') },
  { path: '/planner', name: 'planner', component: () => import('../views/PlannerView.vue') },
  { path: '/teacher', name: 'teacher', component: () => import('../views/TeacherView.vue') },
  { path: '/admin', name: 'admin', component: () => import('../views/AdminView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0, behavior: 'smooth' }
  },
})

export default router
