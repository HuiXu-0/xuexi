<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from './AppIcon.vue'
import { getRelatedByTitle } from '../composables/useRelated.js'

/**
 * 相关内容推荐（设计书 §9.3）。
 *
 * 关联只提供导航，不改变被关联对象的可见性和使用许可 ——
 * 点击时仍按普通条目的权限规则处理。
 *
 * 关联结果由真实数据的标签交集与关键词重叠算出，不是静态列表。
 */
const props = defineProps({
  /** 当前内容的标题，用它定位关联对象 */
  title: { type: String, required: true },
  /** 最多显示几条 */
  limit: { type: Number, default: 4 },
  /** 区块标题 */
  heading: { type: String, default: '相关内容' },
})

const router = useRouter()
const related = computed(() => getRelatedByTitle(props.title, props.limit))

function open(item) {
  router.push({ name: item.route })
}
</script>

<template>
  <div v-if="related.length" class="related-block">
    <div class="related-head">
      <h3>{{ heading }}</h3>
      <span class="related-note">按标签与主题匹配，仅提供导航</span>
    </div>
    <div class="related-grid">
      <button
        v-for="r in related"
        :key="r.id"
        class="related-item"
        type="button"
        @click="open(r)"
      >
        <span class="related-type">{{ r.typeLabel }}</span>
        <strong>{{ r.title }}</strong>
        <small>{{ r.reason }}</small>
        <span class="related-tags">
          <span v-for="t in r.tags" :key="t" class="search-meta-tag">{{ t }}</span>
        </span>
      </button>
    </div>
  </div>
</template>
