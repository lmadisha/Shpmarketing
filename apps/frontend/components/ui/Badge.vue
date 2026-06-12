<script setup lang="ts">
import type { ClassValue } from 'clsx'
import { computed } from 'vue'
import { cn } from '~/utils/cn'

const props = withDefaults(defineProps<{
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success'
  class?: ClassValue
}>(), {
  variant: 'default',
})

const variantClass = computed(() => ({
  default: 'bg-slate-900 text-white',
  secondary: 'bg-slate-100 text-slate-700',
  outline: 'border border-slate-200 bg-white text-slate-700',
  destructive: 'bg-red-100 text-red-700',
  success: 'bg-emerald-100 text-emerald-700',
}[props.variant]))
</script>

<template>
  <span
    :class="cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
      variantClass,
      props.class,
    )"
  >
    <slot />
  </span>
</template>
