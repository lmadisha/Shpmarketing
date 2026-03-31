<script setup lang="ts">
import { ArrowUpDown, ChevronLeft, ChevronRight, Clock3, Download, RefreshCw, Save, Search, Trash2 } from 'lucide-vue-next'
import Card from '~/components/ui/Card.vue'
import Input from '~/components/ui/Input.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import ModalDialog from '~/components/ui/ModalDialog.vue'
import AccessDeniedCard from '~/components/auth/AccessDeniedCard.vue'
import { downloadExcel, normalizeCNumber, normalizeHexIdentifier } from '~/utils/adminAssets'

const store = useAdminAssetsStore()
const deleteConfirmSerial = ref<string | null>(null)

definePageMeta({ middleware: 'auth' })

onMounted(async () => {
  if (store.canViewAssets && store.sortedFridgeRows.length === 0) {
    await store.loadFridges(store.searchTerm)
  }
})
</script>

<template>
  <AccessDeniedCard
    v-if="!store.canViewAssets"
    title="Inventory access denied"
    description="You do not have permission to view fridge inventory."
  />

  <Card v-else>
    <div class="border-b border-slate-200 p-5">
      <h2 class="text-lg font-semibold text-slate-900">Fridge Inventory</h2>
      <p class="mt-1 text-sm text-slate-600">Search, update, delete, and inspect per-device history.</p>
    </div>
    <div class="space-y-4 p-5">
      <div class="flex flex-col gap-3 lg:flex-row">
        <div class="relative flex-1">
          <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input v-model="store.searchTerm" placeholder="Search by serial, MAC, or C-number" class="pl-9" />
        </div>
        <Button variant="outline" :disabled="store.fridgeLoading" @click="store.loadFridges(store.searchTerm)">
          <Search class="h-4 w-4" />
          Apply Search
        </Button>
        <Button variant="outline" :disabled="store.fridgeLoading" @click="store.searchTerm = ''; store.loadFridges('')">
          <RefreshCw class="h-4 w-4" />
          Reset
        </Button>
        <Button
          variant="outline"
          @click="downloadExcel(`fridges_${new Date().toISOString().slice(0, 10)}.xls`, 'Inventory', ['Serial Number', 'MAC Address', 'C-Number', 'Verified'], store.inventoryExportRows)"
        >
          <Download class="h-4 w-4" />
          Download Excel
        </Button>
      </div>

      <p v-if="store.fridgeError" class="text-sm text-red-600">{{ store.fridgeError }}</p>

      <div class="overflow-x-auto rounded-xl border border-slate-200">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="bg-slate-50">
            <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th class="px-4 py-3">
                <button class="inline-flex items-center gap-1" @click="store.toggleInventorySort('fridge_serial_number')">Serial <ArrowUpDown class="h-4 w-4" /></button>
              </th>
              <th class="px-4 py-3">
                <button class="inline-flex items-center gap-1" @click="store.toggleInventorySort('iot_mac_address')">MAC <ArrowUpDown class="h-4 w-4" /></button>
              </th>
              <th class="px-4 py-3">
                <button class="inline-flex items-center gap-1" @click="store.toggleInventorySort('c_number')">C-Number <ArrowUpDown class="h-4 w-4" /></button>
              </th>
              <th class="px-4 py-3">
                <button class="inline-flex items-center gap-1" @click="store.toggleInventorySort('verified')">Verified <ArrowUpDown class="h-4 w-4" /></button>
              </th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 bg-white text-sm text-slate-700">
            <tr v-for="row in store.paginatedFridgeRows" :key="row.fridge_serial_number">
              <td class="px-4 py-3 font-medium">{{ row.fridge_serial_number }}</td>
              <td class="px-4 py-3">
                <template v-if="store.editingSerial === row.fridge_serial_number">
                  <Input
                    :model-value="store.editForm.mac_address"
                    @update:model-value="(value) => store.setEditForm({ ...store.editForm, mac_address: normalizeHexIdentifier(String(value || '')) })"
                    placeholder="MAC"
                  />
                  <p v-if="store.editFormErrors.mac_address" class="mt-1 text-xs text-red-600">{{ store.editFormErrors.mac_address }}</p>
                </template>
                <template v-else>{{ row.iot_mac_address || '-' }}</template>
              </td>
              <td class="px-4 py-3">
                <template v-if="store.editingSerial === row.fridge_serial_number">
                  <Input
                    :model-value="store.editForm.c_number"
                    @update:model-value="(value) => store.setEditForm({ ...store.editForm, c_number: normalizeCNumber(String(value || '')) })"
                    placeholder="C-number"
                  />
                  <p v-if="store.editFormErrors.c_number" class="mt-1 text-xs text-red-600">{{ store.editFormErrors.c_number }}</p>
                </template>
                <template v-else>{{ row.c_number || '-' }}</template>
              </td>
              <td class="px-4 py-3">
                <Badge :variant="row.verified ? 'success' : 'outline'">{{ row.verified ? 'Verified' : 'Not Verified' }}</Badge>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex flex-wrap justify-end gap-2">
                  <template v-if="store.canEditAssets">
                    <template v-if="store.editingSerial === row.fridge_serial_number">
                      <Button size="sm" :disabled="store.savingEdit" @click="store.submitEdit(row.fridge_serial_number)">
                        <Save class="h-4 w-4" />
                        Save
                      </Button>
                      <Button size="sm" variant="outline" @click="store.cancelEdit">Cancel</Button>
                    </template>
                    <Button v-else size="sm" variant="outline" @click="store.startEdit(row)">Edit</Button>
                  </template>
                  <Button
                    v-if="store.canViewHistory"
                    size="sm"
                    variant="outline"
                    :disabled="store.deviceHistoryLoading && store.deviceHistorySerial === row.fridge_serial_number"
                    @click="store.loadDeviceHistory(row.fridge_serial_number)"
                  >
                    <Clock3 class="h-4 w-4" />
                    History
                  </Button>
                  <Button
                    v-if="store.canDeleteAssets"
                    size="sm"
                    variant="outline"
                    :disabled="store.deletingSerial === row.fridge_serial_number"
                    @click="deleteConfirmSerial = row.fridge_serial_number"
                  >
                    <Trash2 class="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
            <tr v-if="!store.fridgeLoading && store.sortedFridgeRows.length === 0">
              <td colspan="5" class="px-4 py-10 text-center text-sm text-slate-500">No fridge rows found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" :disabled="store.safeInventoryPage <= 1" @click="store.inventoryPage = Math.max(1, store.inventoryPage - 1)">
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <span class="text-sm text-slate-500">Page {{ store.safeInventoryPage }} of {{ store.inventoryTotalPages }}</span>
        <Button variant="outline" size="sm" :disabled="store.safeInventoryPage >= store.inventoryTotalPages" @click="store.inventoryPage = Math.min(store.inventoryTotalPages, store.inventoryPage + 1)">
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
    </div>
  </Card>

  <ModalDialog :open="Boolean(deleteConfirmSerial)" title="Delete Fridge" description="Delete this fridge from inventory?" @close="deleteConfirmSerial = null">
    <p class="text-sm text-slate-600">Fridge: <span class="font-medium text-slate-900">{{ deleteConfirmSerial }}</span></p>
    <template #footer>
      <Button variant="outline" @click="deleteConfirmSerial = null">Cancel</Button>
      <Button
        variant="destructive"
        :disabled="store.deletingSerial === deleteConfirmSerial"
        @click="if (deleteConfirmSerial) { store.deleteFridge(deleteConfirmSerial); deleteConfirmSerial = null }"
      >
        {{ store.deletingSerial === deleteConfirmSerial ? 'Deleting...' : 'Delete Fridge' }}
      </Button>
    </template>
  </ModalDialog>
</template>
