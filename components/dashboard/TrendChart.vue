<script setup lang="ts">
import { computed } from 'vue'

type Point = {
  label: string
  value: number
}

const props = withDefaults(defineProps<{
  points: Point[]
  color?: string
  height?: number
}>(), {
  color: '#2563eb',
  height: 180,
})

const width = 640
const padding = 24

const bounds = computed(() => {
  const values = props.points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  return { min, max: max === min ? max + 1 : max }
})

const polylinePoints = computed(() =>
  props.points
    .map((point, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(props.points.length - 1, 1)
      const normalized = (point.value - bounds.value.min) / (bounds.value.max - bounds.value.min)
      const y = props.height - padding - normalized * (props.height - padding * 2)
      return `${x},${y}`
    })
    .join(' ')
)
</script>

<template>
  <div class="space-y-3">
    <svg :viewBox="`0 0 ${width} ${height}`" class="h-48 w-full overflow-visible">
      <line
        v-for="index in 4"
        :key="index"
        :x1="padding"
        :y1="padding + ((height - padding * 2) / 4) * (index - 1)"
        :x2="width - padding"
        :y2="padding + ((height - padding * 2) / 4) * (index - 1)"
        stroke="#e2e8f0"
        stroke-dasharray="3 5"
      />
      <polyline
        fill="none"
        :stroke="color"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        :points="polylinePoints"
      />
      <circle
        v-for="point in polylinePoints.split(' ')"
        :key="point"
        :cx="point.split(',')[0]"
        :cy="point.split(',')[1]"
        r="4"
        :fill="color"
      />
    </svg>
    <div class="grid grid-cols-5 gap-2 text-xs text-slate-500">
      <span v-for="point in props.points" :key="point.label" class="truncate">{{ point.label }}</span>
    </div>
  </div>
</template>
