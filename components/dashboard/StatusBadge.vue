<script setup lang="ts">
import Badge from '~/components/ui/Badge.vue'

defineProps<{
  status: 'ok' | 'med' | 'high' | 'warn' | 'bad' | 'no-data'
  label?: string
}>()
</script>

<template>
  <Badge
    :class="{
      'bg-emerald-100 text-emerald-700': status === 'ok',
      'bg-amber-100 text-amber-700': status === 'med' || status === 'warn',
      'bg-red-100 text-red-700': status === 'high' || status === 'bad',
      'bg-slate-100 text-slate-500': status === 'no-data',
    }"
  >
    {{ label || status }}
  </Badge>
</template>
