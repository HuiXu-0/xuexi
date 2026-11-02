import { reactive } from 'vue'

const state = reactive({
  message: '',
  visible: false,
})

let timer = 0

export function showToast(message) {
  state.message = message
  state.visible = true
  clearTimeout(timer)
  timer = setTimeout(() => {
    state.visible = false
  }, 2600)
}

export function useToast() {
  return state
}
