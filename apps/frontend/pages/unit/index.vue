<script setup lang="ts">
import { Server, ArrowRight } from 'lucide-vue-next'
import Card from '~/components/ui/Card.vue'
import Select from '~/components/ui/Select.vue'
import Button from '~/components/ui/Button.vue'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

type UnitLookupRow = { mac_address: string }

const { request } = useAnalyticsClient()

const dates = ref<string[]>([])
const tenants = ref<string[]>([])
const selectedDate = ref('')
const selectedTenant = ref('ALL')
const selectedMacAddress = ref('')
const availableMacAddresses = ref<string[]>([])
const error = ref('')

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
    if (d.length) selectedDate.value = d[0] ?? ''
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
    console.warn('[unit-index] Failed to load MAC address options', e)
  }
}

function viewUnit() {
  const mac = selectedMacAddress.value.trim()
  if (!mac) return
  navigateTo(`/unit/${encodeURIComponent(mac)}`)
}

onMounted(async () => {
  await loadFilters()
  await loadMacAddressOptions()
})

watch([selectedDate, selectedTenant], loadMacAddressOptions)
</script>

<template>
  <div class="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6 lg:p-8">
    <div>
      <h1 class="text-2xl font-semibold text-slate-900">Unit Detail</h1>
      <p class="mt-1 text-sm text-slate-600">Select a unit to view its metrics and trends.</p>
    </div>

    <p v-if="error" class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{{ error }}</p>

    <Card>
      <div class="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-slate-500">Date</label>
          <Select v-model="selectedDate" :options="dates.map((d) => ({ value: d, label: d }))" class="w-full" />
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-slate-500">Tenant</label>
          <Select v-model="selectedTenant" :options="tenantOptions" class="w-full" />
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-slate-500">Unit (MAC)</label>
          <Select
            v-model="selectedMacAddress"
            :options="macAddressOptions"
            class="w-full"
            searchable
            search-placeholder="Search MAC address"
            placeholder="Select a unit"
          />
        </div>
        <div class="flex items-end">
          <Button class="w-full" :disabled="!selectedMacAddress" @click="viewUnit">
            View Unit
            <ArrowRight class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>

    <div v-if="!availableMacAddresses.length && !error" class="flex flex-col items-center gap-2 py-10 text-center text-sm text-slate-500">
      <Server class="h-8 w-8 text-slate-300" />
      No units available for the selected date and tenant.
    </div>
  </div>
</template>
