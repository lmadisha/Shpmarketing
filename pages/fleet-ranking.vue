<script setup lang="ts">
import { Trophy } from 'lucide-vue-next'
import FilterBar from '~/components/layout/FilterBar.vue'
import Card from '~/components/ui/Card.vue'
import Badge from '~/components/ui/Badge.vue'
import MetricCard from '~/components/dashboard/MetricCard.vue'
import TierBadge from '~/components/dashboard/TierBadge.vue'
import StatusBadge from '~/components/dashboard/StatusBadge.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const compareMode = ref(false)

const fleetData = [
  { rank: 1, mac: 'MAC001', region: 'Western Cape', doorOpens: 3456, avgTemp: 4.2, poweredPct: 99.8, voltageRisk: 'ok', tier: 'gold', previousRank: 2 },
  { rank: 2, mac: 'MAC045', region: 'Gauteng', doorOpens: 3298, avgTemp: 4.5, poweredPct: 99.5, voltageRisk: 'ok', tier: 'gold', previousRank: 5 },
  { rank: 3, mac: 'MAC123', region: 'Western Cape', doorOpens: 3187, avgTemp: 4.1, poweredPct: 99.9, voltageRisk: 'ok', tier: 'gold', previousRank: 3 },
  { rank: 4, mac: 'MAC089', region: 'KwaZulu-Natal', doorOpens: 2945, avgTemp: 5.8, poweredPct: 98.2, voltageRisk: 'med', tier: 'silver', previousRank: 1 },
  { rank: 5, mac: 'MAC234', region: 'Gauteng', doorOpens: 2876, avgTemp: 4.3, poweredPct: 99.7, voltageRisk: 'ok', tier: 'silver', previousRank: 8 },
  { rank: 6, mac: 'MAC567', region: 'Eastern Cape', doorOpens: 1987, avgTemp: 6.2, poweredPct: 97.5, voltageRisk: 'high', tier: 'bronze', previousRank: 4 },
] as const
</script>

<template>
  <div>
    <FilterBar />
    <div class="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6 lg:p-8">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 class="flex items-center gap-2 text-2xl font-semibold text-slate-900 md:text-3xl">
            <Trophy class="h-7 w-7 text-amber-500" />
            Fleet Ranking
          </h1>
          <p class="mt-1 text-sm text-slate-600">Units ranked by door opens over the last 30 days.</p>
        </div>
        <label class="flex items-center gap-2 text-sm text-slate-600">
          <input v-model="compareMode" type="checkbox" class="h-4 w-4 rounded border-slate-300" />
          Compare to previous period
        </label>
      </div>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Gold Tier" :value="fleetData.filter((unit) => unit.tier === 'gold').length" subtitle="Top performers" />
        <MetricCard title="Silver Tier" :value="fleetData.filter((unit) => unit.tier === 'silver').length" subtitle="Above average" />
        <MetricCard title="Bronze Tier" :value="fleetData.filter((unit) => unit.tier === 'bronze').length" subtitle="Needs attention" />
        <MetricCard title="Insufficient Data" value="45" subtitle="Monitoring" />
      </div>

      <Card>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th class="px-4 py-3">Rank</th>
                <th class="px-4 py-3">Unit</th>
                <th class="px-4 py-3">Region</th>
                <th class="px-4 py-3 text-right">Door Opens</th>
                <th class="px-4 py-3 text-right">Avg Temp</th>
                <th class="px-4 py-3 text-right">Powered %</th>
                <th class="px-4 py-3">Voltage</th>
                <th class="px-4 py-3">Tier</th>
                <th v-if="compareMode" class="px-4 py-3 text-right">Rank Delta</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 bg-white">
              <tr v-for="unit in fleetData" :key="unit.mac" class="text-sm text-slate-700">
                <td class="px-4 py-3 font-semibold text-slate-900">#{{ unit.rank }}</td>
                <td class="px-4 py-3">
                  <NuxtLink :to="`/unit/${unit.mac}`" class="font-medium text-blue-600 hover:underline">{{ unit.mac }}</NuxtLink>
                </td>
                <td class="px-4 py-3">{{ unit.region }}</td>
                <td class="px-4 py-3 text-right font-medium">{{ unit.doorOpens.toLocaleString() }}</td>
                <td class="px-4 py-3 text-right">{{ unit.avgTemp.toFixed(1) }}°C</td>
                <td class="px-4 py-3 text-right">{{ unit.poweredPct }}%</td>
                <td class="px-4 py-3"><StatusBadge :status="unit.voltageRisk" :label="unit.voltageRisk.toUpperCase()" /></td>
                <td class="px-4 py-3"><TierBadge :tier="unit.tier" /></td>
                <td v-if="compareMode" class="px-4 py-3 text-right">
                  <Badge :variant="unit.previousRank > unit.rank ? 'success' : unit.previousRank < unit.rank ? 'destructive' : 'outline'">
                    {{ unit.previousRank > unit.rank ? '+' : unit.previousRank < unit.rank ? '-' : '' }}{{ Math.abs(unit.previousRank - unit.rank) || '0' }}
                  </Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  </div>
</template>
