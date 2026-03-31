<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { cn } from '~/utils/cn'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  description?: string
  maxWidthClass?: string
}>(), {
  maxWidthClass: 'max-w-lg',
})

const emit = defineEmits<{
  close: []
}>()

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) {
    emit('close')
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      window.addEventListener('keydown', handleKeydown)
      document.body.style.overflow = 'hidden'
    } else {
      window.removeEventListener('keydown', handleKeydown)
      document.body.style.overflow = ''
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-950/45" @click="emit('close')" />
      <div :class="cn('relative z-[71] w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl', props.maxWidthClass)">
        <button
          type="button"
          class="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          @click="emit('close')"
        >
          <X class="h-4 w-4" />
        </button>
        <div v-if="title || description" class="mb-4 pr-8">
          <h3 v-if="title" class="text-lg font-semibold text-slate-900">{{ title }}</h3>
          <p v-if="description" class="mt-1 text-sm text-slate-500">{{ description }}</p>
        </div>
        <div class="space-y-4">
          <slot />
        </div>
        <div v-if="$slots.footer" class="mt-6 flex flex-wrap justify-end gap-2">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
