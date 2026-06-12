<script setup lang="ts">
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-vue-next'
import Card from '~/components/ui/Card.vue'
import Badge from '~/components/ui/Badge.vue'
import Select from '~/components/ui/Select.vue'
import Button from '~/components/ui/Button.vue'
import Input from '~/components/ui/Input.vue'
import MetricCard from '~/components/dashboard/MetricCard.vue'
import PieChart from '~/components/dashboard/PieChart.vue'
import StatusBadge from '~/components/dashboard/StatusBadge.vue'
import { compareValues, downloadExcel } from '~/utils/adminAssets'

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
type StatusValue = 'ok' | 'med' | 'high' | 'warn' | 'bad' | 'no-data'
type SortKey =
  | 'mac_address'
  | 'c_code'
  | 'district'
  | 'temp_flag'
  | 'powered_flag'
  | 'voltage_risk'
  | 'door_opens'
  | 'avg_case_temp'

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

const unitSearch = ref('')
const tempFlagFilter = ref('ALL')
const powerFlagFilter = ref('ALL')
const voltageFlagFilter = ref('ALL')
const sortKey = ref<SortKey>('mac_address')
const sortDirection = ref<'asc' | 'desc'>('asc')

const PAGE_SIZE = 25
const currentPage = ref(1)

const flagFilterOptions = [
  { value: 'ALL', label: 'All' },
  { value: 'ok', label: 'OK' },
  { value: 'warn', label: 'Warn' },
  { value: 'bad', label: 'Bad' },
  { value: 'no-data', label: 'No Data' },
]

const tenantOptions = computed(() => [
  { value: 'ALL', label: 'All Tenants' },
  ...tenants.value.map((t) => ({ value: t, label: t })),
])

const fleetHealthItems = computed(() => summary.value?.health_segments ?? [])
const tempFlagPieItems = computed(() =>
  (distributions.value?.temp_flags ?? []).map((item) => ({ label: item.label, value: item.value })),
)
const voltageFlagPieItems = computed(() =>
  (distributions.value?.voltage_flags ?? []).map((item) => ({ label: item.label, value: item.value })),
)
const poweredFlagPieItems = computed(() =>
  (distributions.value?.powered_flags ?? []).map((item) => ({ label: item.label, value: item.value })),
)

const filteredUnits = computed(() => {
  const query = unitSearch.value.trim().toLowerCase()
  return units.value.filter((unit) => {
    const matchesQuery = !query
      || [
          unit.mac_address,
          unit.c_code,
          unit.fridge_serial,
          unit.district,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))

    return matchesQuery
      && matchesFlagFilter(unit.temp_flag, tempFlagFilter.value)
      && matchesFlagFilter(unit.powered_flag, powerFlagFilter.value)
      && matchesFlagFilter(unit.voltage_risk, voltageFlagFilter.value)
  })
})

const sortedUnits = computed(() => {
  const sorted = [...filteredUnits.value]
  sorted.sort((left, right) => {
    const delta = compareValues(left[sortKey.value], right[sortKey.value])
    return sortDirection.value === 'asc' ? delta : -delta
  })
  return sorted
})

const totalPages = computed(() => Math.max(1, Math.ceil(sortedUnits.value.length / PAGE_SIZE)))
const safePage = computed(() => Math.min(currentPage.value, totalPages.value))
const paginatedUnits = computed(() => {
  const start = (safePage.value - 1) * PAGE_SIZE
  return sortedUnits.value.slice(start, start + PAGE_SIZE)
})

const exportHeaders = ['MAC', 'C-Code', 'District', 'Temp Flag', 'Power Flag', 'Voltage Flag', 'Door Opens', 'Avg Temp (C)']
const exportRows = computed(() =>
  sortedUnits.value.map((unit) => [
    unit.mac_address || '-',
    unit.c_code || '-',
    unit.district || '-',
    unit.temp_flag || '-',
    unit.powered_flag || '-',
    unit.voltage_risk || '-',
    unit.door_opens ?? '-',
    unit.avg_case_temp ?? '-',
  ]),
)

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

function normalizeFlag(flag: string | null | undefined): { status: StatusValue, label: string } {
  const raw = String(flag ?? '').trim()
  const normalized = raw.toLowerCase()

  if (!raw || normalized === 'n/a' || normalized === 'na' || normalized === 'null' || normalized === '-') {
    return { status: 'no-data', label: 'N/A' }
  }

  const map: Record<string, StatusValue> = {
    ok: 'ok',
    good: 'ok',
    pass: 'ok',
    normal: 'ok',
    green: 'ok',
    warn: 'warn',
    warning: 'warn',
    med: 'med',
    medium: 'med',
    yellow: 'warn',
    amber: 'warn',
    orange: 'warn',
    bad: 'bad',
    fail: 'bad',
    high: 'high',
    critical: 'high',
    red: 'bad',
    'no-data': 'no-data',
  }

  const direct = map[normalized]
  if (direct) return { status: direct, label: raw }

  if (
    normalized.includes('ok')
    || normalized.includes('good')
    || normalized.includes('normal')
    || normalized.includes('green')
  ) {
    return { status: 'ok', label: raw }
  }
  if (
    normalized.includes('warn')
    || normalized.includes('medium')
    || normalized.includes('yellow')
    || normalized.includes('amber')
    || normalized.includes('orange')
  ) {
    return { status: 'warn', label: raw }
  }
  if (
    normalized.includes('high')
    || normalized.includes('critical')
    || normalized.includes('bad')
    || normalized.includes('red')
  ) {
    return { status: 'bad', label: raw }
  }

  return { status: 'no-data', label: raw }
}

function matchesFlagFilter(flag: string | null, selectedFilter: string): boolean {
  if (selectedFilter === 'ALL') return true
  return normalizeFlag(flag).status === selectedFilter
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

function sortBy(key: SortKey) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    return
  }
  sortKey.value = key
  sortDirection.value = 'asc'
}

function iconFor(key: SortKey) {
  if (sortKey.value !== key) return ArrowUpDown
  return sortDirection.value === 'asc' ? ArrowUp : ArrowDown
}

function fileSafeDate() {
  return (selectedDate.value || 'report').replace(/[^A-Za-z0-9_-]/g, '-')
}

function csvCell(value: unknown) {
  const text = String(value ?? '')
  if (!/[",\n]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

function downloadCsv() {
  const rows = [exportHeaders, ...exportRows.value]
  const content = rows.map((row) => row.map((cell) => csvCell(cell)).join(',')).join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `unit-performance-${fileSafeDate()}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function downloadXls() {
  downloadExcel(
    `unit-performance-${fileSafeDate()}.xls`,
    'Unit Performance',
    exportHeaders,
    exportRows.value,
  )
}

watch([unitSearch, tempFlagFilter, powerFlagFilter, voltageFlagFilter, sortKey, sortDirection], () => {
  currentPage.value = 1
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
          <MetricCard title="Avg Case Temp" :value="summary.avg_case_temp != null ? `${summary.avg_case_temp} C` : '-'" />
          <MetricCard title="Avg Door Opens" :value="summary.avg_door_opens != null ? String(summary.avg_door_opens) : '-'" />
        </div>

        <div class="grid gap-4 xl:grid-cols-3">
          <Card class="xl:col-span-1">
            <div class="border-b border-slate-200 p-5">
              <h2 class="text-lg font-semibold text-slate-900">Fleet Health Snapshot</h2>
            </div>
            <div class="p-5">
              <PieChart :items="fleetHealthItems" :size="170" />
            </div>
          </Card>
          <Card v-if="distributions" class="xl:col-span-2">
            <div class="border-b border-slate-200 p-5">
              <h2 class="text-lg font-semibold text-slate-900">Flag Distributions</h2>
            </div>
            <div class="grid gap-4 p-5 md:grid-cols-3">
              <div class="rounded-lg border border-slate-200 p-4">
                <p class="mb-3 text-sm font-medium text-slate-700">Temperature</p>
                <PieChart :items="tempFlagPieItems" :size="140" />
              </div>
              <div class="rounded-lg border border-slate-200 p-4">
                <p class="mb-3 text-sm font-medium text-slate-700">Voltage Risk</p>
                <PieChart :items="voltageFlagPieItems" :size="140" />
              </div>
              <div class="rounded-lg border border-slate-200 p-4">
                <p class="mb-3 text-sm font-medium text-slate-700">Powered</p>
                <PieChart :items="poweredFlagPieItems" :size="140" />
              </div>
            </div>
          </Card>
        </div>
      </template>

      <Card v-if="units.length">
        <div class="flex flex-col gap-3 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
          <h2 class="text-lg font-semibold text-slate-900">Unit Performance Details</h2>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" @click="downloadCsv">
              <Download class="h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" size="sm" @click="downloadXls">
              <Download class="h-4 w-4" />
              Excel
            </Button>
            <Badge variant="secondary">{{ sortedUnits.length }} of {{ units.length }} units</Badge>
          </div>
        </div>
        <div class="grid gap-3 border-b border-slate-200 p-5 md:grid-cols-2 xl:grid-cols-4">
          <Input
            v-model="unitSearch"
            placeholder="Filter by MAC, C-Code, serial, district"
          />
          <Select v-model="tempFlagFilter" :options="flagFilterOptions" class="w-full" />
          <Select v-model="powerFlagFilter" :options="flagFilterOptions" class="w-full" />
          <Select v-model="voltageFlagFilter" :options="flagFilterOptions" class="w-full" />
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th class="px-4 py-3">
                  <button class="inline-flex items-center gap-1" @click="sortBy('mac_address')">MAC <component :is="iconFor('mac_address')" class="h-3.5 w-3.5" /></button>
                </th>
                <th class="px-4 py-3">
                  <button class="inline-flex items-center gap-1" @click="sortBy('c_code')">C-Code <component :is="iconFor('c_code')" class="h-3.5 w-3.5" /></button>
                </th>
                <th class="px-4 py-3">
                  <button class="inline-flex items-center gap-1" @click="sortBy('district')">District <component :is="iconFor('district')" class="h-3.5 w-3.5" /></button>
                </th>
                <th class="px-4 py-3">
                  <button class="inline-flex items-center gap-1" @click="sortBy('temp_flag')">Temp <component :is="iconFor('temp_flag')" class="h-3.5 w-3.5" /></button>
                </th>
                <th class="px-4 py-3">
                  <button class="inline-flex items-center gap-1" @click="sortBy('powered_flag')">Power <component :is="iconFor('powered_flag')" class="h-3.5 w-3.5" /></button>
                </th>
                <th class="px-4 py-3">
                  <button class="inline-flex items-center gap-1" @click="sortBy('voltage_risk')">Voltage <component :is="iconFor('voltage_risk')" class="h-3.5 w-3.5" /></button>
                </th>
                <th class="px-4 py-3 text-right">
                  <button class="inline-flex items-center gap-1" @click="sortBy('door_opens')">Door Opens <component :is="iconFor('door_opens')" class="h-3.5 w-3.5" /></button>
                </th>
                <th class="px-4 py-3 text-right">
                  <button class="inline-flex items-center gap-1" @click="sortBy('avg_case_temp')">Avg Temp <component :is="iconFor('avg_case_temp')" class="h-3.5 w-3.5" /></button>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 bg-white text-sm text-slate-700">
              <template v-if="paginatedUnits.length">
                <tr v-for="unit in paginatedUnits" :key="unit.mac_address">
                  <td class="px-4 py-3">
                    <NuxtLink :to="`/unit/${encodeURIComponent(unit.mac_address)}`" class="font-mono text-[#006aea] hover:underline">
                      {{ unit.mac_address }}
                    </NuxtLink>
                  </td>
                  <td class="px-4 py-3 font-mono">{{ unit.c_code || '-' }}</td>
                  <td class="px-4 py-3">{{ unit.district || '-' }}</td>
                  <td class="px-4 py-3"><StatusBadge :status="normalizeFlag(unit.temp_flag).status" :label="normalizeFlag(unit.temp_flag).label" /></td>
                  <td class="px-4 py-3"><StatusBadge :status="normalizeFlag(unit.powered_flag).status" :label="normalizeFlag(unit.powered_flag).label" /></td>
                  <td class="px-4 py-3"><StatusBadge :status="normalizeFlag(unit.voltage_risk).status" :label="normalizeFlag(unit.voltage_risk).label" /></td>
                  <td class="px-4 py-3 text-right font-medium">{{ unit.door_opens != null ? unit.door_opens.toLocaleString() : '-' }}</td>
                  <td class="px-4 py-3 text-right">{{ unit.avg_case_temp != null ? `${unit.avg_case_temp} C` : '-' }}</td>
                </tr>
              </template>
              <tr v-else>
                <td colspan="8" class="px-4 py-6 text-center text-sm text-slate-500">
                  No units match the current filters.
                </td>
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
