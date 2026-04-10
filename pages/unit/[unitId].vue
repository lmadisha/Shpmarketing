<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next'
import Card from '~/components/ui/Card.vue'
import Badge from '~/components/ui/Badge.vue'
import Select from '~/components/ui/Select.vue'
import Button from '~/components/ui/Button.vue'
import StatusBadge from '~/components/dashboard/StatusBadge.vue'
import TrendChart from '~/components/dashboard/TrendChart.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

type TrendPoint = { label: string; value: number }
type UnitInfo = {
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
  is_active: boolean
  last_active_date: string | null
}
type Trends = {
  door_opens: TrendPoint[]
  temperature: TrendPoint[]
  powered: TrendPoint[]
  voltage: TrendPoint[]
}
type StatusValue = 'ok' | 'med' | 'high' | 'warn' | 'bad' | 'no-data'
type UnitLookupRow = {
  mac_address: string
}

const route = useRoute()
const unitId = computed(() => String(route.params.unitId || ''))
const { request } = useAnalyticsClient()

const dates = ref<string[]>([])
const tenants = ref<string[]>([])
const selectedDate = ref('')
const selectedTenant = ref('ALL')
const selectedMacAddress = ref('')
const loading = ref(false)
const error = ref('')

const unitInfo = ref<UnitInfo | null>(null)
const trends = ref<Trends | null>(null)
const availableMacAddresses = ref<string[]>([])

const metrics = reactive({
  doorOpens: true,
  temperature: true,
  powered: true,
  voltage: true,
})

const tenantOptions = computed(() => [
  { value: 'ALL', label: 'All Tenants' },
  ...tenants.value.map((t) => ({ value: t, label: t })),
])

const macAddressOptions = computed(() =>
  availableMacAddresses.value.map((mac) => ({ value: mac, label: mac })),
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

async function loadMacAddressOptions() {
  if (!selectedDate.value || !selectedTenant.value) return

  try {
    const qs = `?date=${encodeURIComponent(selectedDate.value)}&tenant=${encodeURIComponent(selectedTenant.value)}`
    const rows = await request<UnitLookupRow[]>(`/performance/units${qs}`)
    availableMacAddresses.value = [...new Set(
      rows.map((row) => row.mac_address).filter(Boolean),
    )].sort((left, right) => left.localeCompare(right))
  } catch (e) {
    console.warn('[unit] Failed to load MAC address filter options', e)
  }
}

async function loadUnit() {
  if (!unitId.value || !selectedDate.value || !selectedTenant.value) return
  loading.value = true
  error.value = ''
  try {
    const mac = encodeURIComponent(unitId.value)
    const qs = `?date=${encodeURIComponent(selectedDate.value)}&tenant=${encodeURIComponent(selectedTenant.value)}`
    const [info, trendData] = await Promise.all([
      request<UnitInfo>(`/unit/${mac}${qs}`),
      request<Trends>(`/unit/${mac}/trends?tenant=${encodeURIComponent(selectedTenant.value)}&days=30`),
    ])
    unitInfo.value = info
    trends.value = trendData
    selectedMacAddress.value = info.mac_address || unitId.value
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load unit detail'
  } finally {
    loading.value = false
  }
}

async function goToSelectedMacAddress() {
  const targetMac = selectedMacAddress.value.trim()
  if (!targetMac || targetMac === unitId.value) return
  await navigateTo(`/unit/${encodeURIComponent(targetMac)}`)
}

onMounted(async () => {
  selectedMacAddress.value = unitId.value
  await loadFilters()
  if (selectedDate.value && selectedTenant.value) {
    await Promise.all([loadMacAddressOptions(), loadUnit()])
  }
})

watch(unitId, async (nextUnitId) => {
  selectedMacAddress.value = String(nextUnitId || '')
  if (selectedDate.value && selectedTenant.value) {
    await loadUnit()
  }
})

watch([selectedDate, selectedTenant], async () => {
  if (!selectedDate.value || !selectedTenant.value) return
  await loadMacAddressOptions()
})

function flagToStatus(flag: string | null): StatusValue {
  if (!flag || flag === 'N/A') return 'no-data'
  const map: Record<string, StatusValue> = {
    ok: 'ok',
    warn: 'warn',
    bad: 'bad',
    med: 'med',
    high: 'high',
    'no-data': 'no-data',
  }
  return map[String(flag).toLowerCase()] || 'no-data'
}
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
        <Select
          v-model="selectedMacAddress"
          :options="macAddressOptions"
          class="w-64"
          searchable
          search-placeholder="Search MAC address"
          placeholder="Filter by MAC address"
        />
        <Button variant="outline" :disabled="!selectedMacAddress || selectedMacAddress === unitId" @click="goToSelectedMacAddress">
          View Unit
        </Button>
        <Button :disabled="loading" @click="loadUnit">
          <RefreshCw class="h-4 w-4" />
          {{ loading ? 'Loading...' : 'Refresh' }}
        </Button>
      </div>
    </div>

    <div class="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6 lg:p-8">
      <p v-if="error" class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{{ error }}</p>

      <Card v-if="unitInfo">
        <div class="flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between">
          <div>
            <p class="text-sm text-slate-500">
              <NuxtLink to="/performance-report" class="text-[#006aea] hover:underline">Performance Report</NuxtLink>
              / {{ unitId }}
            </p>
            <h1 class="mt-2 text-3xl font-semibold text-slate-900">Unit {{ unitInfo.mac_address }}</h1>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{{ unitInfo.district || 'Unknown' }}</Badge>
              <Badge variant="secondary">{{ unitInfo.c_code || '-' }}</Badge>
              <Badge variant="secondary">Serial: {{ unitInfo.fridge_serial || '-' }}</Badge>
              <StatusBadge :status="flagToStatus(unitInfo.temp_flag)" label="Temp" />
              <StatusBadge :status="flagToStatus(unitInfo.powered_flag)" label="Power" />
              <StatusBadge :status="flagToStatus(unitInfo.voltage_risk)" label="Voltage" />
            </div>
          </div>
          <div class="space-y-1 text-left md:text-right">
            <p class="text-sm text-slate-500">Powered</p>
            <p class="text-2xl font-semibold text-slate-900">{{ unitInfo.powered_pct != null ? `${unitInfo.powered_pct}%` : '-' }}</p>
            <p class="text-sm text-slate-500">Door Opens: <span class="font-medium text-slate-900">{{ unitInfo.door_opens != null ? unitInfo.door_opens.toLocaleString() : '-' }}</span></p>
          </div>
        </div>
      </Card>

      <Card v-if="trends">
        <div class="border-b border-slate-200 p-5">
          <h2 class="text-lg font-semibold text-slate-900">Visible Metrics</h2>
        </div>
        <div class="grid gap-3 p-5 md:grid-cols-4">
          <label class="flex items-center gap-2 text-sm text-slate-700"><input v-model="metrics.doorOpens" type="checkbox" class="h-4 w-4" />Door Opens</label>
          <label class="flex items-center gap-2 text-sm text-slate-700"><input v-model="metrics.temperature" type="checkbox" class="h-4 w-4" />Temperature</label>
          <label class="flex items-center gap-2 text-sm text-slate-700"><input v-model="metrics.powered" type="checkbox" class="h-4 w-4" />Powered %</label>
          <label class="flex items-center gap-2 text-sm text-slate-700"><input v-model="metrics.voltage" type="checkbox" class="h-4 w-4" />Voltage</label>
        </div>
      </Card>

      <div v-if="trends" class="grid gap-6">
        <Card v-if="metrics.doorOpens && trends.door_opens.length">
          <div class="border-b border-slate-200 p-5"><h2 class="text-lg font-semibold text-slate-900">Door Opens Per Day</h2></div>
          <div class="p-5"><TrendChart :points="trends.door_opens" color="#2563eb" y-label="Count" unit="opens" /></div>
        </Card>
        <Card v-if="metrics.temperature && trends.temperature.length">
          <div class="border-b border-slate-200 p-5"><h2 class="text-lg font-semibold text-slate-900">Average Temperature</h2></div>
          <div class="p-5"><TrendChart :points="trends.temperature" color="#10b981" y-label="Temp (C)" unit="C" /></div>
        </Card>
        <Card v-if="metrics.powered && trends.powered.length">
          <div class="border-b border-slate-200 p-5"><h2 class="text-lg font-semibold text-slate-900">Powered Percentage</h2></div>
          <div class="p-5"><TrendChart :points="trends.powered" color="#8b5cf6" y-label="Powered (%)" unit="%" /></div>
        </Card>
        <Card v-if="metrics.voltage && trends.voltage.length">
          <div class="border-b border-slate-200 p-5"><h2 class="text-lg font-semibold text-slate-900">Average Voltage</h2></div>
          <div class="p-5"><TrendChart :points="trends.voltage" color="#ea580c" y-label="Voltage (V)" unit="V" /></div>
        </Card>
      </div>

      <p v-if="!loading && !error && !unitInfo" class="py-10 text-center text-sm text-slate-500">
        Select a date and tenant to load unit details.
      </p>
    </div>
  </div>
</template>
