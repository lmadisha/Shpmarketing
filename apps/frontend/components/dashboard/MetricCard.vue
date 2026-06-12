<script setup lang="ts">
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-vue-next'
import Card from '~/components/ui/Card.vue'

defineProps<{
  title: string
  value: string | number
  subtitle?: string
  change?: number
}>()
</script>

<template>
  <Card>
    <div class="p-5">
      <p class="text-sm text-slate-500">{{ title }}</p>
      <div class="mt-2 flex items-start justify-between gap-3">
        <div>
          <p class="text-3xl font-semibold text-slate-900">{{ value }}</p>
          <p v-if="subtitle" class="mt-1 text-xs text-slate-500">{{ subtitle }}</p>
        </div>
        <div
          v-if="change !== undefined"
          :class="[
            'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
            change > 0 ? 'bg-emerald-50 text-emerald-700' : change < 0 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600',
          ]"
        >
          <ArrowUpRight v-if="change > 0" class="h-3.5 w-3.5" />
          <ArrowDownRight v-else-if="change < 0" class="h-3.5 w-3.5" />
          <Minus v-else class="h-3.5 w-3.5" />
          {{ change > 0 ? '+' : '' }}{{ change }}%
        </div>
      </div>
    </div>
  </Card>
</template>
