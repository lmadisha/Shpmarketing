<script setup lang="ts">
import Card from '~/components/ui/Card.vue'
import Badge from '~/components/ui/Badge.vue'
import Button from '~/components/ui/Button.vue'
import ModalDialog from '~/components/ui/ModalDialog.vue'
import FilterBar from '~/components/layout/FilterBar.vue'
import MetricCard from '~/components/dashboard/MetricCard.vue'
import DistributionBars from '~/components/dashboard/DistributionBars.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const selectedUnit = ref<string | null>(null)

const severityDistribution = [
  { label: 'Normal', value: 640, color: '#10b981' },
  { label: 'Normal (Not Meeting Temp)', value: 148, color: '#86efac' },
  { label: 'Power/Voltage Issue', value: 96, color: '#3b82f6' },
  { label: 'Blocked Condenser Warning', value: 110, color: '#f59e0b' },
  { label: 'Gas Leakage Critical', value: 36, color: '#7f1d1d' },
]

const maintenanceQueue = [
  { mac: 'MAC5001', district: 'Cape Town CBD', severity: 'Blocked Condenser Critical', diffCon: 28.4, priority: 95 },
  { mac: 'MAC5002', district: 'Johannesburg', severity: 'Gas Leakage Critical', diffCon: 26.8, priority: 92 },
  { mac: 'MAC5003', district: 'Durban', severity: 'Gas Leakage Warning', diffCon: 22.1, priority: 87 },
  { mac: 'MAC5004', district: 'Pretoria', severity: 'Blocked Condenser Warning', diffCon: 20.5, priority: 84 },
] as const
</script>

<template>
  <div>
    <FilterBar />
    <div class="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6 lg:p-8">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900">Maintenance Report</h1>
          <p class="mt-1 text-sm text-slate-600">Refrigeration diagnostics and maintenance prioritisation.</p>
        </div>
        <Badge variant="outline">Coverage 96.0%</Badge>
      </div>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Units Measured" value="1,248" />
        <MetricCard title="Not Measured" value="52" :change="8" />
        <MetricCard title="Critical Count" value="18" :change="3" />
        <MetricCard title="Avg Diff Con" value="7.2°C" :change="0.8" />
        <MetricCard title="New Critical" value="3" subtitle="Since last report" />
      </div>

      <div class="grid gap-4 xl:grid-cols-3">
        <Card class="xl:col-span-1">
          <div class="border-b border-slate-200 p-5">
            <h2 class="text-lg font-semibold text-slate-900">Severity Distribution</h2>
          </div>
          <div class="p-5">
            <DistributionBars :items="severityDistribution" />
          </div>
        </Card>
        <Card class="xl:col-span-2">
          <div class="border-b border-slate-200 p-5">
            <h2 class="text-lg font-semibold text-slate-900">Priority Queue</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200">
              <thead class="bg-slate-50">
                <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th class="px-4 py-3">MAC</th>
                  <th class="px-4 py-3">District</th>
                  <th class="px-4 py-3">Severity</th>
                  <th class="px-4 py-3 text-right">Diff Con</th>
                  <th class="px-4 py-3 text-right">Priority</th>
                  <th class="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 bg-white text-sm text-slate-700">
                <tr v-for="unit in maintenanceQueue" :key="unit.mac">
                  <td class="px-4 py-3 font-mono">{{ unit.mac }}</td>
                  <td class="px-4 py-3">{{ unit.district }}</td>
                  <td class="px-4 py-3">
                    <Badge :variant="unit.priority >= 90 ? 'destructive' : 'outline'">{{ unit.severity }}</Badge>
                  </td>
                  <td class="px-4 py-3 text-right">{{ unit.diffCon.toFixed(1) }}°C</td>
                  <td class="px-4 py-3 text-right font-semibold">{{ unit.priority }}</td>
                  <td class="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" @click="selectedUnit = unit.mac">Review</Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <ModalDialog
        :open="Boolean(selectedUnit)"
        title="Unit Maintenance Details"
        description="Operational review and next recommended action."
        @close="selectedUnit = null"
      >
        <div class="space-y-4">
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-sm text-slate-500">Selected unit</p>
            <p class="mt-1 font-mono text-lg font-semibold text-slate-900">{{ selectedUnit }}</p>
          </div>
          <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            High condenser temperature and elevated diffCon suggest a compressor efficiency or refrigerant charge issue.
          </div>
        </div>
        <template #footer>
          <Button variant="outline" @click="selectedUnit = null">Close</Button>
          <Button @click="selectedUnit = null">Mark Reviewed</Button>
        </template>
      </ModalDialog>
    </div>
  </div>
</template>
