<script setup lang="ts">
import Card from '~/components/ui/Card.vue'
import Badge from '~/components/ui/Badge.vue'
import FilterBar from '~/components/layout/FilterBar.vue'
import InsightCard from '~/components/dashboard/InsightCard.vue'
import TierBadge from '~/components/dashboard/TierBadge.vue'
import StatusBadge from '~/components/dashboard/StatusBadge.vue'
import TrendChart from '~/components/dashboard/TrendChart.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const unitId = computed(() => String(route.params.unitId || 'Unknown'))

const metrics = reactive({
  doorOpens: true,
  temperature: true,
  powered: true,
  condenser: true,
})

const doorOpensData = [
  { label: 'Feb 3', value: 95 },
  { label: 'Feb 9', value: 110 },
  { label: 'Feb 15', value: 120 },
  { label: 'Feb 21', value: 130 },
  { label: 'Mar 1', value: 145 },
]

const tempData = [
  { label: 'Feb 3', value: 4.5 },
  { label: 'Feb 9', value: 4.2 },
  { label: 'Feb 15', value: 4.0 },
  { label: 'Feb 21', value: 4.1 },
  { label: 'Mar 1', value: 4.2 },
]

const poweredData = [
  { label: 'Feb 3', value: 99.5 },
  { label: 'Feb 9', value: 99.7 },
  { label: 'Feb 15', value: 99.9 },
  { label: 'Feb 21', value: 99.9 },
  { label: 'Mar 1', value: 99.8 },
]

const condenserData = [
  { label: 'Feb 3', value: 38.2 },
  { label: 'Feb 9', value: 37.5 },
  { label: 'Feb 15', value: 37.0 },
  { label: 'Feb 21', value: 37.2 },
  { label: 'Mar 1', value: 37.5 },
]
</script>

<template>
  <div>
    <FilterBar />
    <div class="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6 lg:p-8">
      <Card>
        <div class="flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between">
          <div>
            <p class="text-sm text-slate-500"><NuxtLink to="/fleet-ranking" class="text-blue-600 hover:underline">Fleet Ranking</NuxtLink> / {{ unitId }}</p>
            <h1 class="mt-2 text-3xl font-semibold text-slate-900">Unit {{ unitId }}</h1>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <TierBadge tier="gold" />
              <Badge variant="outline">Western Cape - Cape Town</Badge>
              <StatusBadge status="ok" label="Temp OK" />
              <StatusBadge status="ok" label="Power OK" />
              <StatusBadge status="ok" label="Voltage OK" />
            </div>
          </div>
          <div class="text-left md:text-right">
            <p class="text-sm text-slate-500">Current Rank</p>
            <p class="text-3xl font-semibold text-slate-900">#1</p>
            <p class="mt-1 text-sm font-medium text-emerald-600">+1 from last period</p>
          </div>
        </div>
      </Card>

      <InsightCard
        tone="positive"
        title="Why this unit moved into Gold"
        description="Door activity increased 32% over the last 30 days while temperature compliance stayed above 99% and uptime remained stable."
      />

      <Card>
        <div class="border-b border-slate-200 p-5">
          <h2 class="text-lg font-semibold text-slate-900">Visible Metrics</h2>
        </div>
        <div class="grid gap-3 p-5 md:grid-cols-4">
          <label class="flex items-center gap-2 text-sm text-slate-700"><input v-model="metrics.doorOpens" type="checkbox" class="h-4 w-4" />Door Opens</label>
          <label class="flex items-center gap-2 text-sm text-slate-700"><input v-model="metrics.temperature" type="checkbox" class="h-4 w-4" />Temperature</label>
          <label class="flex items-center gap-2 text-sm text-slate-700"><input v-model="metrics.powered" type="checkbox" class="h-4 w-4" />Power Status</label>
          <label class="flex items-center gap-2 text-sm text-slate-700"><input v-model="metrics.condenser" type="checkbox" class="h-4 w-4" />Condenser Temp</label>
        </div>
      </Card>

      <div class="grid gap-6">
        <Card v-if="metrics.doorOpens">
          <div class="border-b border-slate-200 p-5"><h2 class="text-lg font-semibold text-slate-900">Door Opens Per Day</h2></div>
          <div class="p-5"><TrendChart :points="doorOpensData" color="#2563eb" /></div>
        </Card>
        <Card v-if="metrics.temperature">
          <div class="border-b border-slate-200 p-5"><h2 class="text-lg font-semibold text-slate-900">Average Temperature</h2></div>
          <div class="p-5"><TrendChart :points="tempData" color="#10b981" /></div>
        </Card>
        <Card v-if="metrics.powered">
          <div class="border-b border-slate-200 p-5"><h2 class="text-lg font-semibold text-slate-900">Powered Percentage</h2></div>
          <div class="p-5"><TrendChart :points="poweredData" color="#8b5cf6" /></div>
        </Card>
        <Card v-if="metrics.condenser">
          <div class="border-b border-slate-200 p-5"><h2 class="text-lg font-semibold text-slate-900">Condenser Temperature</h2></div>
          <div class="p-5"><TrendChart :points="condenserData" color="#ea580c" /></div>
        </Card>
      </div>
    </div>
  </div>
</template>
