# 校园学习平台 · Vue 前端

原 `campus-homepage-preview.html` 单文件原型的 Vue 3 改造版。视觉、文案与交互行为与原页面保持一致。

## 快速开始

```bash
npm install
npm run dev      # 开发服务器 http://localhost:5173
npm run build    # 产物输出到 dist/
npm run preview  # 预览构建产物
```

## 技术栈

- Vue 3（`<script setup>` 组合式 API）
- Vite 6 构建
- Vue Router 4（history 模式）
- 无 UI 组件库、无状态库 —— 全局状态用模块级 `reactive` 即可满足

## 目录结构

```
src/
├── main.js                 应用入口
├── App.vue                 应用外壳：全局事件委托 + 路由转场
├── router/index.js         10 条路由，全部懒加载
├── styles/main.css         从原 HTML <style> 原样提取（575 行）
├── data/                   静态演示数据，模板通过 v-for 渲染
│   ├── content.js          首页内容、导航、页脚、通知
│   ├── pages.js            各子页内容（论坛/笔记/竞赛/资源/案例…）
│   ├── details.js          详情弹窗、规则弹窗、反馈表单定义
│   └── createSchemas.js    8 类「创建/提交」表单的字段定义
├── composables/
│   ├── useToast.js         Toast 状态
│   ├── useModal.js         弹窗状态 + FLIP 展开/收起动画
│   └── useSearch.js        全站搜索索引（聚合所有模块数据）
├── stores/
│   ├── demo.js             本地演示状态：Agent 开关、加入/收藏、新建内容
│   └── createActions.js    「新建」动作 → 写入 demoStore → 跳转 → 提示
└── components/
    ├── IconSprite.vue      SVG 图标精灵（原页面 22 个 symbol）
    ├── AppIcon.vue         <svg><use :href="#name"/></svg> 封装
    ├── SiteHeader.vue      顶栏 + 导航 + 通知浮层
    ├── SiteFooter.vue      页脚
    ├── ModalHost.vue       弹窗（详情/规则/表单/条目详情四种内容）
    ├── ToastHost.vue       提示条
    └── HeroCanvas.vue      首页粒子网络动画
└── views/                  10 个页面
    ├── HomeView.vue        通知 / Hero / 搜索结果 / 竞赛 / 学习发现 / 小组 / 反馈
    ├── ForumView.vue       学习论坛
    ├── NotesView.vue       学习笔记
    ├── CompetitionsView.vue 竞赛资源
    ├── ResourcesView.vue   资源导航
    ├── CasesView.vue       优秀案例
    ├── ProfileView.vue     个人中心
    ├── PlannerView.vue     个人学习规划
    ├── TeacherView.vue     教师工作台
    └── AdminView.vue       管理员控制台
```

## 相对原 HTML 的改动

| 原实现 | Vue 实现 |
| --- | --- |
| 1530 行单文件，`<style>` + DOM + 600 行内联脚本 | 拆分为组件、数据、组合式函数 |
| 手写 `goPage()` 切换 `hidden` + CSS class | Vue Router + `<transition>`（`page-enter` / `page-exit`） |
| 卡片、列表全部硬编码在 HTML | `data/*.js` 数据 + `v-for` 渲染 |
| 全局 `document` click 委托处理所有 `data-*` | 只保留跨页面动作的委托（`data-item` / `data-modal` / `data-route` / `data-create` / `data-page-item`）；带本地状态的交互下沉到各组件 `@click` |
| 搜索靠遍历 DOM 中的 `.searchable` | `useSearch.js` 聚合各模块数据建索引（含本地新建内容） |
| 筛选 / 加入 / 收藏 / 审核 直接改 `style.display` 或 DOM 文本 | 响应式 `ref` / `computed` 驱动 |
| 手动 `cancelAnimationFrame` / `ResizeObserver` / `IntersectionObserver` | `HeroCanvas.vue` 的 `onMounted` / `onBeforeUnmount` |
| 弹窗 FLIP 用 `innerHTML` 拼字符串 | `ModalHost.vue` 模板按 `kind` 分支渲染，无 `v-html` |

## 行为保持不变

- 弹窗从来源卡片位置放大展开、关闭时缩回（Web Animations API FLIP）
- 首页粒子网络动画，遵守 `prefers-reduced-motion`
- 全局搜索覆盖所有模块（含子页与本地新建内容）
- 本地演示数据只存内存，刷新即清空
- 页面转场沿用原 `pageEnter` / `pageLeave` 关键帧

## 关于资源文件

`assets/` 为原页面图片，未改动。Vite 会将其打包进 `dist/static/`（带内容哈希）。
原 `campus-homepage-preview.html` 仍保留在根目录，可直接用浏览器打开对照。
