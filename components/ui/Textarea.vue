<script setup lang="ts">
import type { ClassValue } from 'clsx'
import { cn } from '~/utils/cn'

const model = defineModel<string>()

const props = withDefaults(defineProps<{
  placeholder?: string
  disabled?: boolean
  rows?: number
  class?: ClassValue
}>(), {
  rows: 4,
})
</script>

<template>
  <textarea
    :value="model"
    :rows="rows"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="cn(
      'flex min-h-24 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
      props.class,
    )"
    @input="model = ($event.target as HTMLTextAreaElement).value"
  />
</template>
