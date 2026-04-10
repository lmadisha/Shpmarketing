<script setup lang="ts">
type PieItem = {
  label: string
  value: number
  color?: string
}

const props = withDefaults(defineProps<{
  items: PieItem[]
  size?: number
}>(), {
  size: 180,
})

const fallbackPalette = ['#16a34a', '#f59e0b', '#dc2626', '#2563eb', '#8b5cf6', '#475569']

function resolveColor(item: PieItem, index: number) {
  if (item.color) return item.color
  const label = item.label.toLowerCase()
  if (label === 'ok') return '#16a34a'
  if (label === 'warn') return '#f59e0b'
  if (label === 'bad') return '#dc2626'
  return fallbackPalette[index % fallbackPalette.length]
}

const normalizedItems = computed(() => {
  return props.items
    .filter((item) => item.value > 0)
    .map((item, index) => ({
      ...item,
      color: resolveColor(item, index),
    }))
})

const total = computed(() =>
  normalizedItems.value.reduce((sum, item) => sum + item.value, 0),
)

const chartBackground = computed(() => {
  if (!normalizedItems.value.length || total.value <= 0) {
    return '#e2e8f0'
  }

  let current = 0
  const segments = normalizedItems.value.map((item) => {
    const start = current
    current += (item.value / total.value) * 100
    return `${item.color} ${start.toFixed(2)}% ${current.toFixed(2)}%`
  })
  return `conic-gradient(${segments.join(', ')})`
})

function percent(value: number) {
  if (!total.value) return '0.0'
  return ((value / total.value) * 100).toFixed(1)
}
</script>

<template>
  <div class="space-y-4">
    <div class="mx-auto flex items-center justify-center">
      <div
        class="relative rounded-full border border-slate-200"
        :style="{ width: `${size}px`, height: `${size}px`, background: chartBackground }"
      >
        <div class="absolute inset-0 flex items-center justify-center text-sm font-semibold text-slate-700">
          {{ total.toLocaleString() }}
        </div>
      </div>
    </div>

    <div class="space-y-2">
      <div
        v-for="(item, index) in normalizedItems"
        :key="`${item.label}-${index}`"
        class="flex items-center justify-between text-sm"
      >
        <div class="flex items-center gap-2 text-slate-600">
          <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: item.color }" />
          <span>{{ item.label }}</span>
        </div>
        <div class="text-slate-700">
          {{ item.value.toLocaleString() }} ({{ percent(item.value) }}%)
        </div>
      </div>

      <p v-if="!normalizedItems.length" class="text-sm text-slate-500">
        No data available.
      </p>
    </div>
  </div>
</template>
