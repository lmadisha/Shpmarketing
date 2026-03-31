<script setup lang="ts">
import FilterBar from '~/components/layout/FilterBar.vue'
import Card from '~/components/ui/Card.vue'
import Badge from '~/components/ui/Badge.vue'
import MetricCard from '~/components/dashboard/MetricCard.vue'
import DistributionBars from '~/components/dashboard/DistributionBars.vue'
import TierBadge from '~/components/dashboard/TierBadge.vue'
import StatusBadge from '~/components/dashboard/StatusBadge.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const healthSegments = [
  { label: 'Active & Powered On', value: 1176, color: '#10b981' },
  { label: 'Active but Powered Off', value: 45, color: '#f59e0b' },
  { label: 'Inactive', value: 27, color: '#ef4444' },
]

const units = [
  { mac: 'MAC001', cCode: 'CC001', district: 'Cape Town CBD', tier: 'gold', tempStatus: 'ok', powerStatus: 'ok', voltageStatus: 'ok', avgCaseTemp: 3.2, doorOpens: 847, lastSeen: '2 min ago' },
  { mac: 'MAC002', cCode: 'CC002', district: 'Johannesburg', tier: 'silver', tempStatus: 'bad', powerStatus: 'warn', voltageStatus: 'med', avgCaseTemp: 8.7, doorOpens: 1247, lastSeen: '5 min ago' },
  { mac: 'MAC003', cCode: 'CC003', district: 'Durban', tier: 'gold', tempStatus: 'ok', powerStatus: 'ok', voltageStatus: 'high', avgCaseTemp: 2.9, doorOpens: 654, lastSeen: '1 min ago' },
  { mac: 'MAC004', cCode: 'CC004', district: 'Pretoria', tier: 'bronze', tempStatus: 'ok', powerStatus: 'ok', voltageStatus: 'ok', avgCaseTemp: 4.1, doorOpens: 923, lastSeen: '3 min ago' },
] as const
</script>

<template>
  <div>
    <FilterBar />
    <div class="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6 lg:p-8">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900">Performance Report</h1>
          <p class="mt-1 text-sm text-slate-600">Fleet health and operational metrics.</p>
        </div>
        <Badge variant="outline">Coverage 98.3%</Badge>
      </div>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard title="Total Units" value="1,248" />
        <MetricCard title="Active & Powered ON" value="94.2%" :change="1.2" />
        <MetricCard title="Temp OK Rate" value="87.5%" :change="-2.3" />
        <MetricCard title="High Voltage Risk" value="23" :change="4" />
        <MetricCard title="Avg Case Temp" value="3.8°C" />
        <MetricCard title="Avg Door Opens" value="847" />
      </div>

      <div class="grid gap-4 xl:grid-cols-3">
        <Card class="xl:col-span-1">
          <div class="border-b border-slate-200 p-5">
            <h2 class="text-lg font-semibold text-slate-900">Fleet Health Snapshot</h2>
          </div>
          <div class="p-5">
            <DistributionBars :items="healthSegments" />
          </div>
        </Card>
        <Card class="xl:col-span-2">
          <div class="border-b border-slate-200 p-5">
            <h2 class="text-lg font-semibold text-slate-900">Critical Focus Areas</h2>
          </div>
          <div class="grid gap-4 p-5 md:grid-cols-3">
            <div class="rounded-xl border border-red-200 bg-red-50 p-4">
              <p class="text-sm font-medium text-red-800">Top Temp Offenders</p>
              <p class="mt-2 text-2xl font-semibold text-red-900">5 units</p>
              <p class="mt-2 text-sm text-red-700">Cape Town CBD and Johannesburg clusters need priority review.</p>
            </div>
            <div class="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p class="text-sm font-medium text-blue-800">Highest Door Opens</p>
              <p class="mt-2 text-2xl font-semibold text-blue-900">2,847</p>
              <p class="mt-2 text-sm text-blue-700">Coastal outlets continue to carry the strongest throughput.</p>
            </div>
            <div class="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p class="text-sm font-medium text-amber-800">Newly Degraded</p>
              <p class="mt-2 text-2xl font-semibold text-amber-900">3 units</p>
              <p class="mt-2 text-sm text-amber-700">Recent temperature and voltage drift is concentrated in the Cape Winelands.</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div class="flex items-center justify-between border-b border-slate-200 p-5">
          <h2 class="text-lg font-semibold text-slate-900">Unit Performance Details</h2>
          <Badge variant="secondary">{{ units.length }} units shown</Badge>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th class="px-4 py-3">MAC</th>
                <th class="px-4 py-3">C-Code</th>
                <th class="px-4 py-3">District</th>
                <th class="px-4 py-3">Tier</th>
                <th class="px-4 py-3">Temp</th>
                <th class="px-4 py-3">Power</th>
                <th class="px-4 py-3">Voltage</th>
                <th class="px-4 py-3 text-right">Door Opens</th>
                <th class="px-4 py-3">Last Seen</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 bg-white text-sm text-slate-700">
              <tr v-for="unit in units" :key="unit.mac">
                <td class="px-4 py-3 font-mono">{{ unit.mac }}</td>
                <td class="px-4 py-3 font-mono">{{ unit.cCode }}</td>
                <td class="px-4 py-3">{{ unit.district }}</td>
                <td class="px-4 py-3"><TierBadge :tier="unit.tier" /></td>
                <td class="px-4 py-3"><StatusBadge :status="unit.tempStatus" /></td>
                <td class="px-4 py-3"><StatusBadge :status="unit.powerStatus" /></td>
                <td class="px-4 py-3"><StatusBadge :status="unit.voltageStatus" /></td>
                <td class="px-4 py-3 text-right font-medium">{{ unit.doorOpens.toLocaleString() }}</td>
                <td class="px-4 py-3">{{ unit.lastSeen }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  </div>
</template>
