<script setup lang="ts">
import FilterBar from '~/components/layout/FilterBar.vue'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import MetricCard from '~/components/dashboard/MetricCard.vue'
import TrendChart from '~/components/dashboard/TrendChart.vue'
import TierBadge from '~/components/dashboard/TierBadge.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const regionName = computed(() =>
  String(route.params.regionId || 'Region')
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' '),
)

const doorOpensData = [
  { label: 'Feb 3', value: 156000 },
  { label: 'Feb 10', value: 162000 },
  { label: 'Feb 17', value: 171000 },
  { label: 'Feb 24', value: 183000 },
  { label: 'Mar 2', value: 195000 },
]

const complianceData = [
  { label: 'Feb 3', value: 92.5 },
  { label: 'Feb 10', value: 93.2 },
  { label: 'Feb 17', value: 94.1 },
  { label: 'Feb 24', value: 93.8 },
  { label: 'Mar 2', value: 94.5 },
]

const topUnits = [
  { mac: 'MAC001', opens: 3456, tier: 'gold' },
  { mac: 'MAC123', opens: 3187, tier: 'gold' },
  { mac: 'MAC456', opens: 2654, tier: 'silver' },
] as const
</script>

<template>
  <div>
    <FilterBar />
    <div class="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6 lg:p-8">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="text-sm text-slate-500"><NuxtLink to="/regional-map" class="text-blue-600 hover:underline">Regional Map</NuxtLink> / {{ regionName }}</p>
          <h1 class="text-2xl font-semibold text-slate-900">{{ regionName }}</h1>
          <p class="mt-1 text-sm text-slate-600">Regional performance overview and redistribution context.</p>
        </div>
        <Button>Generate Redistribution Recommendations</Button>
      </div>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Units" value="187" :change="3.2" />
        <MetricCard title="Door Opens (30d)" value="589.2K" :change="15.8" />
        <MetricCard title="Temp Compliance" value="94.5%" :change="2.0" />
        <MetricCard title="Gold Tier Units" value="45" :change="11.1" />
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <Card>
          <div class="border-b border-slate-200 p-5">
            <h2 class="text-lg font-semibold text-slate-900">Door Opens Trend</h2>
          </div>
          <div class="p-5">
            <TrendChart :points="doorOpensData" color="#2563eb" />
          </div>
        </Card>
        <Card>
          <div class="border-b border-slate-200 p-5">
            <h2 class="text-lg font-semibold text-slate-900">Compliance Trend</h2>
          </div>
          <div class="p-5">
            <TrendChart :points="complianceData" color="#10b981" />
          </div>
        </Card>
      </div>

      <Card>
        <div class="border-b border-slate-200 p-5">
          <h2 class="text-lg font-semibold text-slate-900">Top Performing Units</h2>
        </div>
        <div class="divide-y divide-slate-200">
          <div v-for="unit in topUnits" :key="unit.mac" class="flex items-center justify-between p-5">
            <div>
              <NuxtLink :to="`/unit/${unit.mac}`" class="font-medium text-blue-600 hover:underline">{{ unit.mac }}</NuxtLink>
              <p class="text-sm text-slate-500">{{ unit.opens.toLocaleString() }} opens</p>
            </div>
            <TierBadge :tier="unit.tier" />
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>
