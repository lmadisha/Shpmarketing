<script setup lang="ts">
import type { ClassValue } from 'clsx'
import { cn } from '~/utils/cn'

const props = defineProps<{
  for?: string
  class?: ClassValue
}>()
</script>

<template>
  <label :for="props.for" :class="cn('text-sm font-medium text-slate-800', props.class)">
    <slot />
  </label>
</template>
