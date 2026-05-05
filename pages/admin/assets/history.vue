<script setup lang="ts">
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  RefreshCw,
  X,
  FileText,
} from 'lucide-vue-next'
import Card from '~/components/ui/Card.vue'
import Input from '~/components/ui/Input.vue'
import Select from '~/components/ui/Select.vue'
import Button from '~/components/ui/Button.vue'
import ModalDialog from '~/components/ui/ModalDialog.vue'
import AccessDeniedCard from '~/components/auth/AccessDeniedCard.vue'
import { downloadExcel } from '~/utils/adminAssets'
import type { AuditLogRow, HistorySortKey } from '~/types/adminAssets'

const store = useAdminAssetsStore()
const exportingHistory = ref(false)

definePageMeta({ middleware: 'auth' })

async function exportHistory() {
  if (!store.canDownloadHistory) return
  exportingHistory.value = true
  try {
    const params = new URLSearchParams()
    if (store.historyFilters.action_type && store.historyFilters.action_type !== 'all') {
      params.set('action_type', store.historyFilters.action_type)
    }
    if (store.historyFilters.serial.trim()) params.set('serial', store.historyFilters.serial.trim())
    if (store.historyFilters.from) params.set('from', store.historyFilters.from)
    if (store.historyFilters.to) params.set('to', store.historyFilters.to)
    const basePath = `/exports/history${params.toString() ? `?${params.toString()}` : ''}`
    const payload = await store.adminRequest<{
      sheet: string
      columns: string[]
      rows: Array<Array<string | number | null>>
    }>('exportHistory', store.withOrganisationFilter(basePath))

    downloadExcel(
      `history_${new Date().toISOString().slice(0, 10)}.xls`,
      payload.sheet || 'History',
      payload.columns || ['Changed At', 'Action', 'Serial', 'Old MAC', 'New MAC', 'Old C-Number', 'New C-Number', 'User', 'Reason'],
      Array.isArray(payload.rows) ? payload.rows : [],
    )
  } catch (error) {
    store.historyError = error instanceof Error ? error.message : 'Could not export history.'
  } finally {
    exportingHistory.value = false
  }
}

// ── Reason detail modal ────────────────────────────────────────────────────
const reasonModal = ref<{ open: boolean; entry: AuditLogRow | null }>({ open: false, entry: null })

function openReason(entry: AuditLogRow) {
  reasonModal.value = { open: true, entry }
}

function closeReason() {
  reasonModal.value = { open: false, entry: null }
}

function shouldShowReason(entry: AuditLogRow): boolean {
  if (entry.deletion_reason) return true
  return entry.action_type === 'MISMATCH_RESOLVE' || entry.action_type === 'MISMATCH_DELETE'
}

function getEntryReason(entry: AuditLogRow): string | null {
  if (!shouldShowReason(entry)) return null
  return entry.deletion_reason || entry.resolution_note || null
}

function reasonLabel(entry: AuditLogRow): string {
  if (entry.deletion_reason) return 'Deletion Reason'
  if (entry.action_type === 'MISMATCH_RESOLVE' || entry.action_type === 'MISMATCH_DELETE') {
    return 'Resolution Note'
  }
  return 'Note'
}

// ── Sort direction indicator ───────────────────────────────────────────────
function renderSortIcon(key: HistorySortKey) {
  if (store.historySort.key !== key) return ArrowUpDown
  return store.historySort.direction === 'asc' ? ArrowUp : ArrowDown
}

// ── Action labels & styling ────────────────────────────────────────────────
function actionLabel(actionType: AuditLogRow['action_type']) {
  switch (actionType) {
    case 'INSERT': return 'Added'
    case 'UPDATE': return 'Updated'
    case 'VERIFY': return 'Verified'
    case 'UNVERIFY': return 'Unverified'
    case 'DELETE': return 'Deleted'
    case 'MISMATCH_INSERT': return 'Mismatch'
    case 'MISMATCH_UPDATE': return 'Mismatch Updated'
    case 'MISMATCH_RESOLVE': return 'Mismatch Resolved'
    case 'MISMATCH_DELETE': return 'Mismatch Deleted'
  }
}

function actionBadgeClass(actionType: AuditLogRow['action_type']) {
  switch (actionType) {
    case 'INSERT': return 'border border-slate-200 bg-slate-50 text-slate-700'
    case 'UPDATE': return 'border border-blue-100 bg-blue-50/70 text-blue-700'
    case 'VERIFY': return 'border border-emerald-100 bg-emerald-50/70 text-emerald-700'
    case 'UNVERIFY': return 'border border-amber-100 bg-amber-50/70 text-amber-700'
    case 'DELETE': return 'border border-rose-100 bg-rose-50/70 text-rose-700'
    case 'MISMATCH_INSERT': return 'border border-orange-100 bg-orange-50/70 text-orange-700'
    case 'MISMATCH_UPDATE': return 'border border-orange-100 bg-orange-50/70 text-orange-700'
    case 'MISMATCH_RESOLVE': return 'border border-emerald-100 bg-emerald-50/70 text-emerald-700'
    case 'MISMATCH_DELETE': return 'border border-rose-100 bg-rose-50/70 text-rose-700'
  }
}

function actionDotClass(actionType: AuditLogRow['action_type']) {
  switch (actionType) {
    case 'INSERT': return 'bg-slate-400'
    case 'UPDATE': return 'bg-blue-500'
    case 'VERIFY': return 'bg-emerald-500'
    case 'UNVERIFY': return 'bg-amber-500'
    case 'DELETE': return 'bg-rose-500'
    case 'MISMATCH_INSERT': return 'bg-orange-400'
    case 'MISMATCH_UPDATE': return 'bg-orange-400'
    case 'MISMATCH_RESOLVE': return 'bg-emerald-500'
    case 'MISMATCH_DELETE': return 'bg-red-500'
  }
}

const ACTION_TYPE_OPTIONS = [
  { value: 'all', label: 'All actions' },
  { value: 'INSERT', label: 'Added' },
  { value: 'UPDATE', label: 'Updated' },
  { value: 'VERIFY', label: 'Verified' },
  { value: 'UNVERIFY', label: 'Unverified' },
  { value: 'DELETE', label: 'Deleted' },
  { value: 'MISMATCH_INSERT', label: 'Mismatch' },
  { value: 'MISMATCH_UPDATE', label: 'Mismatch Updated' },
  { value: 'MISMATCH_RESOLVE', label: 'Mismatch Resolved' },
  { value: 'MISMATCH_DELETE', label: 'Mismatch Deleted' },
]

function clearFilters() {
  store.historyFilters.action_type = 'all'
  store.historyFilters.serial = ''
  store.historyFilters.from = ''
  store.historyFilters.to = ''
}

const hasActiveFilters = computed(() =>
  store.historyFilters.action_type !== 'all'
  || store.historyFilters.serial.trim() !== ''
  || store.historyFilters.from !== ''
  || store.historyFilters.to !== '',
)

onMounted(async () => {
  if (store.canViewHistory && store.sortedHistory.length === 0) {
    await store.loadAllHistory()
  }
})
</script>

<template>
  <AccessDeniedCard
    v-if="!store.canViewHistory"
    title="History access denied"
    description="You do not have permission to view change history."
  />

  <Card v-else>
    <!-- Header -->
    <div class="border-b border-slate-200 p-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div class="flex items-center gap-2">
            <Clock3 class="h-4 w-4 text-[#006aea]" />
            <h2 class="text-lg font-semibold text-slate-900">Global Change History</h2>
          </div>
          <p class="mt-1 text-sm text-slate-600">
            Showing {{ store.filteredHistory.length }} of {{ store.allHistory.length }} entries.
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <Button
            v-if="store.canDownloadHistory"
            variant="outline"
            :disabled="exportingHistory"
            @click="exportHistory"
          >
            <Download class="h-4 w-4" />
            {{ exportingHistory ? "Exporting..." : "Download Excel" }}
          </Button>
          <Button variant="outline" :disabled="store.historyLoading" @click="store.loadAllHistory()">
            <RefreshCw class="h-4 w-4" :class="store.historyLoading ? 'animate-spin' : ''" />
            Refresh
          </Button>
        </div>
      </div>
    </div>

    <div class="space-y-4 p-5">
      <!-- Filters -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select
          v-model="store.historyFilters.action_type"
          :options="ACTION_TYPE_OPTIONS"
        />
        <Input
          v-model="store.historyFilters.serial"
          placeholder="Serial contains"
        />
        <Input v-model="store.historyFilters.from" type="date" />
        <Input v-model="store.historyFilters.to" type="date" />
        <Button
          variant="outline"
          :disabled="!hasActiveFilters"
          @click="clearFilters"
        >
          <X class="h-4 w-4" />
          Clear filters
        </Button>
      </div>

      <!-- Active filter badge -->
      <div v-if="hasActiveFilters" class="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
        <span class="text-sm text-blue-700">
          Showing <strong>{{ store.filteredHistory.length }}</strong> matching
          {{ store.filteredHistory.length === 1 ? 'entry' : 'entries' }}
        </span>
      </div>

      <p v-if="store.historyError" class="text-sm text-red-600">{{ store.historyError }}</p>

      <!-- Table -->
      <div class="overflow-x-auto rounded-xl border border-slate-200">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="bg-slate-50">
            <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th class="px-4 py-3">
                <button
                  class="inline-flex items-center gap-1 hover:text-slate-700 transition-colors"
                  @click="store.toggleHistorySort('changed_at')"
                >
                  Time <component :is="renderSortIcon('changed_at')" class="h-3.5 w-3.5" />
                </button>
              </th>
              <th class="px-4 py-3">
                <button
                  class="inline-flex items-center gap-1 hover:text-slate-700 transition-colors"
                  @click="store.toggleHistorySort('action_type')"
                >
                  Action <component :is="renderSortIcon('action_type')" class="h-3.5 w-3.5" />
                </button>
              </th>
              <th class="px-4 py-3">
                <button
                  class="inline-flex items-center gap-1 hover:text-slate-700 transition-colors"
                  @click="store.toggleHistorySort('fridge_serial_number')"
                >
                  Serial <component :is="renderSortIcon('fridge_serial_number')" class="h-3.5 w-3.5" />
                </button>
              </th>
              <th class="px-4 py-3 whitespace-nowrap">Old → New MAC</th>
              <th class="px-4 py-3 whitespace-nowrap">Old → New C</th>
              <th class="px-4 py-3">
                <button
                  class="inline-flex items-center gap-1 hover:text-slate-700 transition-colors"
                  @click="store.toggleHistorySort('changed_by_username')"
                >
                  User <component :is="renderSortIcon('changed_by_username')" class="h-3.5 w-3.5" />
                </button>
              </th>
              <th class="px-4 py-3">Reason</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 bg-white text-sm text-slate-700">
            <tr
              v-for="entry in store.paginatedHistory"
              :key="entry.log_id"
              class="hover:bg-slate-50/60 transition-colors"
            >
              <td class="px-4 py-3 whitespace-nowrap text-slate-500 text-xs">
                {{ new Date(entry.changed_at).toLocaleString() }}
              </td>
              <td class="px-4 py-3">
                <span
                  :class="[
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap',
                    actionBadgeClass(entry.action_type),
                  ]"
                >
                  <span :class="['h-1.5 w-1.5 rounded-full shrink-0', actionDotClass(entry.action_type)]" />
                  {{ actionLabel(entry.action_type) }}
                </span>
              </td>
              <td class="px-4 py-3 font-medium font-mono text-xs">{{ entry.fridge_serial_number }}</td>
              <td class="px-4 py-3 text-xs">
                <span v-if="entry.old_mac || entry.new_mac">
                  <span class="text-slate-400">{{ entry.old_mac || '—' }}</span>
                  <span class="mx-1 text-slate-300">→</span>
                  <span>{{ entry.new_mac || '—' }}</span>
                </span>
                <span v-else class="text-slate-300">—</span>
              </td>
              <td class="px-4 py-3 text-xs">
                <span v-if="entry.old_c_num || entry.new_c_num">
                  <span class="text-slate-400">{{ entry.old_c_num || '—' }}</span>
                  <span class="mx-1 text-slate-300">→</span>
                  <span>{{ entry.new_c_num || '—' }}</span>
                </span>
                <span v-else class="text-slate-300">—</span>
              </td>
              <td class="px-4 py-3 text-xs text-slate-600">{{ entry.changed_by_username || 'system' }}</td>
              <td class="px-4 py-3">
                <template v-if="getEntryReason(entry)">
                  <button
                    class="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors max-w-[160px]"
                    :title="getEntryReason(entry) ?? ''"
                    @click="openReason(entry)"
                  >
                    <FileText class="h-3 w-3 shrink-0" />
                    <span class="truncate">{{ getEntryReason(entry) }}</span>
                  </button>
                </template>
                <span v-else class="text-slate-300 text-xs">—</span>
              </td>
            </tr>
            <tr v-if="!store.historyLoading && store.sortedHistory.length === 0">
              <td colspan="7" class="px-4 py-10 text-center text-sm text-slate-500">
                <template v-if="hasActiveFilters">
                  No entries match the current filters.
                  <button class="ml-1 text-[#006aea] underline" @click="clearFilters">Clear filters</button>
                </template>
                <template v-else>No history entries found.</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center justify-between">
        <span class="text-xs text-slate-400">
          {{ store.filteredHistory.length }} total entries
        </span>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="store.safeHistoryPage <= 1"
            @click="store.historyPage = Math.max(1, store.historyPage - 1)"
          >
            <ChevronLeft class="h-4 w-4" />
          </Button>
          <span class="text-sm text-slate-500">
            Page {{ store.safeHistoryPage }} of {{ store.historyTotalPages }}
          </span>
          <Button
            variant="outline"
            size="sm"
            :disabled="store.safeHistoryPage >= store.historyTotalPages"
            @click="store.historyPage = Math.min(store.historyTotalPages, store.historyPage + 1)"
          >
            <ChevronRight class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  </Card>

  <!-- Reason detail modal -->
  <ModalDialog
    :open="reasonModal.open"
    :title="reasonModal.entry ? reasonLabel(reasonModal.entry) : 'Note'"
    max-width-class="max-w-md"
    @close="closeReason"
  >
    <div v-if="reasonModal.entry" class="space-y-3">
      <div class="flex items-center gap-2">
        <span
          v-if="reasonModal.entry"
          :class="[
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]',
            actionBadgeClass(reasonModal.entry.action_type),
          ]"
        >
          <span :class="['h-1.5 w-1.5 rounded-full shrink-0', actionDotClass(reasonModal.entry.action_type)]" />
          {{ actionLabel(reasonModal.entry.action_type) }}
        </span>
        <span class="text-xs text-slate-500 font-mono">{{ reasonModal.entry.fridge_serial_number }}</span>
      </div>
      <p class="text-sm text-slate-500">{{ new Date(reasonModal.entry.changed_at).toLocaleString() }}</p>
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p class="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{{ getEntryReason(reasonModal.entry) }}</p>
      </div>
    </div>
    <template #footer>
      <Button variant="outline" @click="closeReason">Close</Button>
    </template>
  </ModalDialog>
</template>
