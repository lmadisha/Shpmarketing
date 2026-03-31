<script setup lang="ts">
import type { ClassValue } from 'clsx'
import { cn } from '~/utils/cn'

const props = defineProps<{
  class?: ClassValue
}>()
</script>

<template>
  <div :class="cn('rounded-xl border border-gray-200 bg-white shadow-sm', props.class)">
    <slot />
  </div>
</template>
