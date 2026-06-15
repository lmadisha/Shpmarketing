<script setup lang="ts">
import type { ClassValue } from 'clsx'
import { computed } from 'vue'
import { cn } from '~/utils/cn'

const props = withDefaults(defineProps<{
  // Display name used to derive initials and the accessible label.
  name?: string | null
  // Optional image source. When set (e.g. an external initials/avatar API),
  // the image is rendered instead of the locally-generated initials.
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
  class?: ClassValue
}>(), {
  name: '',
  src: null,
  size: 'md',
})

const sizeClass = computed(() => ({
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-11 w-11 text-base',
}[props.size]))

const initials = computed(() => {
  const raw = String(props.name ?? '').trim()
  if (!raw) return '?'
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase()
  }
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
})
</script>

<template>
  <span
    :class="cn(
      // Curved square (not a circle), brand-tinted initials.
      'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#006aea] font-semibold text-white select-none',
      sizeClass,
      props.class,
    )"
    :aria-label="name || 'User'"
    :title="name || undefined"
    role="img"
  >
    <img
      v-if="src"
      :src="src"
      :alt="name || 'User avatar'"
      class="h-full w-full object-cover"
    >
    <span v-else aria-hidden="true">{{ initials }}</span>
  </span>
</template>
