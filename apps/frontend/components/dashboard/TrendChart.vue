<script setup lang="ts">
type Point = {
  label: string
  value: number
}

const props = withDefaults(defineProps<{
  points: Point[]
  color?: string
  height?: number
  yLabel?: string
  unit?: string
}>(), {
  color: '#2563eb',
  height: 220,
  yLabel: '',
  unit: '',
})

const width = 700
const padLeft = 56
const padRight = 24
const padTop = 20
const padBottom = 40

const hoveredIndex = ref<number | null>(null)

const bounds = computed(() => {
  const values = props.points.map((p) => p.value)
  let min = Math.min(...values)
  let max = Math.max(...values)
  const margin = (max - min) * 0.1 || 1
  min = min - margin
  max = max + margin
  return { min, max }
})

const yTicks = computed(() => {
  const { min, max } = bounds.value
  const count = 5
  const step = (max - min) / (count - 1)
  return Array.from({ length: count }, (_, i) => {
    const val = max - i * step
    return {
      value: val,
      y: padTop + (i * (props.height - padTop - padBottom)) / (count - 1),
      label: Number.isInteger(val) ? String(val) : val.toFixed(1),
    }
  })
})

const pointCoords = computed(() =>
  props.points.map((point, index) => {
    const x = padLeft + (index * (width - padLeft - padRight)) / Math.max(props.points.length - 1, 1)
    const normalized = (point.value - bounds.value.min) / (bounds.value.max - bounds.value.min)
    const y = props.height - padBottom - normalized * (props.height - padTop - padBottom)
    return { x, y, point }
  }),
)

const polylinePoints = computed(() =>
  pointCoords.value.map((c) => `${c.x},${c.y}`).join(' '),
)

const areaPath = computed(() => {
  if (!pointCoords.value.length) return ''
  const coords = pointCoords.value
  const bottom = props.height - padBottom
  return `M${coords[0].x},${bottom} ${coords.map((c) => `L${c.x},${c.y}`).join(' ')} L${coords[coords.length - 1].x},${bottom} Z`
})

const xLabels = computed(() => {
  const pts = props.points
  if (pts.length <= 7) return pts.map((_, i) => i)
  const step = Math.ceil(pts.length / 6)
  const indices: number[] = [0]
  for (let i = step; i < pts.length - 1; i += step) {
    indices.push(i)
  }
  indices.push(pts.length - 1)
  return indices
})
</script>

<template>
  <div class="relative">
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      class="h-56 w-full"
      @mouseleave="hoveredIndex = null"
    >
      <!-- Y-axis grid lines + labels -->
      <template v-for="tick in yTicks" :key="tick.value">
        <line
          :x1="padLeft"
          :y1="tick.y"
          :x2="width - padRight"
          :y2="tick.y"
          stroke="#e2e8f0"
          stroke-dasharray="3 5"
        />
        <text
          :x="padLeft - 8"
          :y="tick.y + 4"
          text-anchor="end"
          class="fill-slate-400"
          style="font-size: 11px;"
        >{{ tick.label }}</text>
      </template>

      <!-- Y-axis label -->
      <text
        v-if="yLabel"
        :x="12"
        :y="height / 2"
        text-anchor="middle"
        :transform="`rotate(-90, 12, ${height / 2})`"
        class="fill-slate-500"
        style="font-size: 11px; font-weight: 500;"
      >{{ yLabel }}</text>

      <!-- Area fill -->
      <path
        :d="areaPath"
        :fill="color"
        fill-opacity="0.08"
      />

      <!-- Line -->
      <polyline
        fill="none"
        :stroke="color"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        :points="polylinePoints"
      />

      <!-- Data points -->
      <template v-for="(coord, i) in pointCoords" :key="i">
        <circle
          :cx="coord.x"
          :cy="coord.y"
          :r="hoveredIndex === i ? 6 : 4"
          :fill="hoveredIndex === i ? 'white' : color"
          :stroke="color"
          :stroke-width="hoveredIndex === i ? 2.5 : 0"
          class="transition-all duration-150 cursor-pointer"
        />
        <!-- Invisible hit area for hover -->
        <rect
          :x="coord.x - (width / props.points.length) / 2"
          :y="padTop"
          :width="width / props.points.length"
          :height="height - padTop - padBottom"
          fill="transparent"
          @mouseenter="hoveredIndex = i"
        />
      </template>

      <!-- Hover vertical line -->
      <line
        v-if="hoveredIndex != null && pointCoords[hoveredIndex]"
        :x1="pointCoords[hoveredIndex].x"
        :y1="padTop"
        :x2="pointCoords[hoveredIndex].x"
        :y2="height - padBottom"
        :stroke="color"
        stroke-opacity="0.3"
        stroke-dasharray="4 3"
      />

      <!-- X-axis labels -->
      <text
        v-for="i in xLabels"
        :key="'x' + i"
        :x="pointCoords[i]?.x ?? 0"
        :y="height - 8"
        text-anchor="middle"
        class="fill-slate-400"
        style="font-size: 11px;"
      >{{ props.points[i]?.label }}</text>
    </svg>

    <!-- Tooltip -->
    <div
      v-if="hoveredIndex != null && pointCoords[hoveredIndex]"
      class="pointer-events-none absolute z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg"
      :style="{
        left: `${(pointCoords[hoveredIndex].x / width) * 100}%`,
        top: `${(pointCoords[hoveredIndex].y / height) * 100 - 16}%`,
        transform: 'translate(-50%, -100%)',
      }"
    >
      <p class="text-xs font-medium text-slate-900">{{ props.points[hoveredIndex].value }}{{ unit ? ` ${unit}` : '' }}</p>
      <p class="text-xs text-slate-500">{{ props.points[hoveredIndex].label }}</p>
    </div>
  </div>
</template>
