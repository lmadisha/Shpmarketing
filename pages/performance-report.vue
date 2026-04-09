<script setup lang="ts">
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-vue-next'
import Card from '~/components/ui/Card.vue'
import Badge from '~/components/ui/Badge.vue'
import Select from '~/components/ui/Select.vue'
import Button from '~/components/ui/Button.vue'
import MetricCard from '~/components/dashboard/MetricCard.vue'
import DistributionBars from '~/components/dashboard/DistributionBars.vue'
import StatusBadge from '~/components/dashboard/StatusBadge.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

type HealthSegment = { label: string; value: number; color: string }
type UnitRow = {
  mac_address: string
  c_code: string
  fridge_serial: string
  district: string
  powered_pct: number | null
  powered_flag: string
  avg_case_temp: number | null
  temp_flag: string
  door_opens: number | null
  voltage_avg: number | null
  voltage_risk: string
  last_active_date: string | null
}
type Summary = {
  total_units: number
  active_powered_pct: number
  avg_case_temp: number | null
  avg_door_opens: number | null
  avg_powered_pct: number | null
  health_segments: HealthSegment[]
}
type Distributions = {
  temp_flags: { label: string; value: number }[]
  voltage_flags: { label: string; value: number }[]
  powered_flags: { label: string; value: number }[]
}

const { request } = useAnalyticsClient()

const dates = ref<string[]>([])
const tenants = ref<string[]>([])
const selectedDate = ref('')
const selectedTenant = ref('ALL')
const loading = ref(false)
const error = ref('')

const summary = ref<Summary | null>(null)
const distributions = ref<Distributions | null>(null)
const units = ref<UnitRow[]>([])

const PAGE_SIZE = 25
const currentPage = ref(1)

const totalPages = computed(() => Math.max(1, Math.ceil(units.value.length / PAGE_SIZE)))
const safePage = computed(() => Math.min(currentPage.value, totalPages.value))
const paginatedUnits = computed(() => {
  const start = (safePage.value - 1) * PAGE_SIZE
  return units.value.slice(start, start + PAGE_SIZE)
})

const tenantOptions = computed(() => [
  { value: 'ALL', label: 'All Tenants' },
  ...tenants.value.map((t) => ({ value: t, label: t })),
])

async function loadFilters() {
  try {
    const [d, t] = await Promise.all([
      request<string[]>('/filters/dates'),
      request<string[]>('/filters/tenants'),
    ])
    dates.value = d
    tenants.value = t
    if (d.length) selectedDate.value = d[0]
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load filters'
  }
}

async function loadReport() {
  if (!selectedDate.value || !selectedTenant.value) return
  loading.value = true
  error.value = ''
  currentPage.value = 1
  try {
    const qs = `?date=${encodeURIComponent(selectedDate.value)}&tenant=${encodeURIComponent(selectedTenant.value)}`
    const [s, d, u] = await Promise.all([
      request<Summary>(`/performance/summary${qs}`),
      request<Distributions>(`/performance/distributions${qs}`),
      request<UnitRow[]>(`/performance/units${qs}`),
    ])
    summary.value = s
    distributions.value = d
    units.value = u
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load report'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadFilters()
  if (selectedDate.value && selectedTenant.value) {
    await loadReport()
  }
})

function flagToStatus(flag: string | null): string {
  if (!flag || flag === 'N/A') return 'ok'
  const map: Record<string, string> = { ok: 'ok', warn: 'warn', bad: 'bad' }
  return map[flag] || 'ok'
}

const tempOkCount = computed(() => {
  if (!distributions.value) return 0
  const ok = distributions.value.temp_flags.find((f) => f.label === 'ok')
  return ok?.value ?? 0
})

const tempTotal = computed(() => {
  if (!distributions.value) return 0
  return distributions.value.temp_flags.reduce((sum, f) => sum + f.value, 0)
})

const tempOkRate = computed(() =>
  tempTotal.value > 0 ? ((tempOkCount.value / tempTotal.value) * 100).toFixed(1) : '0',
)

const highVoltageCount = computed(() => {
  if (!distributions.value) return 0
  return distributions.value.voltage_flags
    .filter((f) => f.label !== 'ok')
    .reduce((sum, f) => sum + f.value, 0)
})
</script>

<template>
  <div>
    <div class="border-b border-slate-200 bg-white px-4 py-3 md:px-6">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Select
          v-model="selectedDate"
          :options="dates.map((d) => ({ value: d, label: d }))"
          class="w-48"
        />
        <Select
          v-model="selectedTenant"
          :options="tenantOptions"
          class="w-48"
        />
        <Button :disabled="loading" @click="loadReport">
          <RefreshCw class="h-4 w-4" />
          {{ loading ? 'Loading...' : 'Load Report' }}
        </Button>
      </div>
    </div>

    <div class="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6 lg:p-8">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900">Performance Report</h1>
          <p class="mt-1 text-sm text-slate-600">Fleet health and operational metrics.</p>
        </div>
      </div>

      <p v-if="error" class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{{ error }}</p>

      <template v-if="summary">
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="Total Units" :value="String(summary.total_units)" />
          <MetricCard title="Active & Powered ON" :value="`${summary.active_powered_pct}%`" />
          <MetricCard title="Temp OK Rate" :value="`${tempOkRate}%`" />
          <MetricCard title="Avg Case Temp" :value="summary.avg_case_temp != null ? `${summary.avg_case_temp}°C` : '-'" />
          <MetricCard title="Avg Door Opens" :value="summary.avg_door_opens != null ? String(summary.avg_door_opens) : '-'" />
        </div>

        <div class="grid gap-4 xl:grid-cols-3">
          <Card class="xl:col-span-1">
            <div class="border-b border-slate-200 p-5">
              <h2 class="text-lg font-semibold text-slate-900">Fleet Health Snapshot</h2>
            </div>
            <div class="p-5">
              <DistributionBars :items="summary.health_segments" />
            </div>
          </Card>
          <Card v-if="distributions" class="xl:col-span-2">
            <div class="border-b border-slate-200 p-5">
              <h2 class="text-lg font-semibold text-slate-900">Flag Distributions</h2>
            </div>
            <div class="grid gap-4 p-5 md:grid-cols-3">
              <div>
                <p class="mb-2 text-sm font-medium text-slate-700">Temperature</p>
                <div v-for="f in distributions.temp_flags" :key="f.label" class="flex items-center justify-between py-1 text-sm">
                  <span class="text-slate-600">{{ f.label }}</span>
                  <Badge :variant="f.label === 'ok' ? 'success' : f.label === 'warn' ? 'outline' : 'destructive'">{{ f.value }}</Badge>
                </div>
              </div>
              <div>
                <p class="mb-2 text-sm font-medium text-slate-700">Voltage Risk</p>
                <div v-for="f in distributions.voltage_flags" :key="f.label" class="flex items-center justify-between py-1 text-sm">
                  <span class="text-slate-600">{{ f.label }}</span>
                  <Badge :variant="f.label === 'ok' ? 'success' : f.label === 'warn' ? 'outline' : 'destructive'">{{ f.value }}</Badge>
                </div>
              </div>
              <div>
                <p class="mb-2 text-sm font-medium text-slate-700">Powered</p>
                <div v-for="f in distributions.powered_flags" :key="f.label" class="flex items-center justify-between py-1 text-sm">
                  <span class="text-slate-600">{{ f.label }}</span>
                  <Badge :variant="f.label === 'ok' ? 'success' : f.label === 'warn' ? 'outline' : 'destructive'">{{ f.value }}</Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </template>

      <Card v-if="units.length">
        <div class="flex items-center justify-between border-b border-slate-200 p-5">
          <h2 class="text-lg font-semibold text-slate-900">Unit Performance Details</h2>
          <Badge variant="secondary">{{ units.length }} units</Badge>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th class="px-4 py-3">MAC</th>
                <th class="px-4 py-3">C-Code</th>
                <th class="px-4 py-3">District</th>
                <th class="px-4 py-3">Temp</th>
                <th class="px-4 py-3">Power</th>
                <th class="px-4 py-3">Voltage</th>
                <th class="px-4 py-3 text-right">Door Opens</th>
                <th class="px-4 py-3 text-right">Avg Temp</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 bg-white text-sm text-slate-700">
              <tr v-for="unit in paginatedUnits" :key="unit.mac_address">
                <td class="px-4 py-3">
                  <NuxtLink :to="`/unit/${encodeURIComponent(unit.mac_address)}`" class="font-mono text-[#006aea] hover:underline">
                    {{ unit.mac_address }}
                  </NuxtLink>
                </td>
                <td class="px-4 py-3 font-mono">{{ unit.c_code || '-' }}</td>
                <td class="px-4 py-3">{{ unit.district || '-' }}</td>
                <td class="px-4 py-3"><StatusBadge :status="flagToStatus(unit.temp_flag)" /></td>
                <td class="px-4 py-3"><StatusBadge :status="flagToStatus(unit.powered_flag)" /></td>
                <td class="px-4 py-3"><StatusBadge :status="flagToStatus(unit.voltage_risk)" /></td>
                <td class="px-4 py-3 text-right font-medium">{{ unit.door_opens != null ? unit.door_opens.toLocaleString() : '-' }}</td>
                <td class="px-4 py-3 text-right">{{ unit.avg_case_temp != null ? `${unit.avg_case_temp}°C` : '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-end gap-2 border-t border-slate-200 p-4">
          <Button
            variant="outline"
            size="sm"
            :disabled="safePage <= 1"
            @click="currentPage = Math.max(1, currentPage - 1)"
          >
            <ChevronLeft class="h-4 w-4" />
          </Button>
          <span class="text-sm text-slate-500">Page {{ safePage }} of {{ totalPages }}</span>
          <Button
            variant="outline"
            size="sm"
            :disabled="safePage >= totalPages"
            @click="currentPage = Math.min(totalPages, currentPage + 1)"
          >
            <ChevronRight class="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <p v-if="!loading && !error && !summary" class="py-10 text-center text-sm text-slate-500">
        Select a date and tenant to load the performance report.
      </p>
    </div>
  </div>
</template>
