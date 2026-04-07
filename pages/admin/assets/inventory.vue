<script setup lang="ts">
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Pencil,
  Refrigerator,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from "lucide-vue-next";
import Card from "~/components/ui/Card.vue";
import Input from "~/components/ui/Input.vue";
import Button from "~/components/ui/Button.vue";
import Badge from "~/components/ui/Badge.vue";
import ModalDialog from "~/components/ui/ModalDialog.vue";
import AccessDeniedCard from "~/components/auth/AccessDeniedCard.vue";
import {
  downloadExcel,
  normalizeCNumber,
  normalizeHexIdentifier,
} from "~/utils/adminAssets";

const store = useAdminAssetsStore();
const deleteConfirmSerial = ref<string | null>(null);
const deleteReason = ref("");

definePageMeta({ middleware: "auth" });

onMounted(async () => {
  if (store.canViewAssets && store.sortedFridgeRows.length === 0) {
    await store.loadFridges(store.searchTerm);
  }
});
</script>

<template>
  <AccessDeniedCard
    v-if="!store.canViewAssets"
    title="Inventory access denied"
    description="You do not have permission to view fridge inventory."
  />

  <Card v-else>
    <div class="border-b border-slate-200 p-5">
      <div class="flex items-center gap-2">
        <Refrigerator class="h-4 w-4 text-[#006aea]" />
        <h2 class="text-lg font-semibold text-slate-900">Fridge Inventory</h2>
      </div>
      <p class="mt-1 text-sm text-slate-600">
        Search, update, delete, and inspect per-device history.
      </p>
    </div>
    <div class="space-y-4 p-5">
      <div class="flex flex-col gap-3 lg:flex-row">
        <div class="relative flex-1">
          <Search
            class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <Input
            v-model="store.searchTerm"
            placeholder="Search by serial, MAC, or C-number"
            class="pl-9"
          />
        </div>
        <Button
          :disabled="store.fridgeLoading"
          @click="store.loadFridges(store.searchTerm)"
        >
          <Search class="h-4 w-4" />
          Search
        </Button>
        <Button
          variant="outline"
          :disabled="store.fridgeLoading"
          @click="
            store.searchTerm = '';
            store.loadFridges('');
          "
        >
          <RefreshCw class="h-4 w-4" />
          Reset
        </Button>
        <Button
          variant="outline"
          @click="
            downloadExcel(
              `fridges_${new Date().toISOString().slice(0, 10)}.xls`,
              'Inventory',
              ['Serial Number', 'MAC Address', 'C-Number', 'Verified'],
              store.inventoryExportRows,
            )
          "
        >
          <Download class="h-4 w-4" />
          Download Excel
        </Button>
      </div>

      <p v-if="store.fridgeError" class="text-sm text-red-600">
        {{ store.fridgeError }}
      </p>

      <div class="overflow-x-auto rounded-xl border border-slate-200">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="bg-slate-50">
            <tr
              class="text-left text-sm font-semibold tracking-wide text-slate-500"
            >
              <th class="px-4 py-3">
                <button
                  class="inline-flex items-center gap-1 hover:text-slate-700 transition-colors"
                  @click="store.toggleInventorySort('fridge_serial_number')"
                >
                  Serial <ArrowUpDown class="h-4 w-4" />
                </button>
              </th>
              <th class="px-4 py-3">
                <button
                  class="inline-flex items-center gap-1 hover:text-slate-700 transition-colors"
                  @click="store.toggleInventorySort('iot_mac_address')"
                >
                  MAC <ArrowUpDown class="h-4 w-4" />
                </button>
              </th>
              <th class="px-4 py-3">
                <button
                  class="inline-flex items-center gap-1 hover:text-slate-700 transition-colors"
                  @click="store.toggleInventorySort('c_number')"
                >
                  C-Number <ArrowUpDown class="h-4 w-4" />
                </button>
              </th>
              <th class="px-4 py-3">
                <button
                  class="inline-flex items-center gap-1 hover:text-slate-700 transition-colors"
                  @click="store.toggleInventorySort('verified')"
                >
                  Verified <ArrowUpDown class="h-4 w-4" />
                </button>
              </th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody
            class="divide-y divide-slate-200 bg-white text-sm text-slate-700"
          >
            <tr
              v-for="row in store.paginatedFridgeRows"
              :key="row.fridge_serial_number"
            >
              <td class="px-4 py-3 font-medium">
                {{ row.fridge_serial_number }}
              </td>
              <td class="px-4 py-3">
                <template
                  v-if="store.editingSerial === row.fridge_serial_number"
                >
                  <Input
                    :model-value="store.editForm.mac_address"
                    @update:model-value="
                      (value) =>
                        store.setEditForm({
                          ...store.editForm,
                          mac_address: normalizeHexIdentifier(
                            String(value || ''),
                          ),
                        })
                    "
                    placeholder="MAC"
                  />
                  <p
                    v-if="store.editFormErrors.mac_address"
                    class="mt-1 text-xs text-red-600"
                  >
                    {{ store.editFormErrors.mac_address }}
                  </p>
                </template>
                <template v-else>{{ row.iot_mac_address || "-" }}</template>
              </td>
              <td class="px-4 py-3">
                <template
                  v-if="store.editingSerial === row.fridge_serial_number"
                >
                  <Input
                    :model-value="store.editForm.c_number"
                    @update:model-value="
                      (value) =>
                        store.setEditForm({
                          ...store.editForm,
                          c_number: normalizeCNumber(String(value || '')),
                        })
                    "
                    placeholder="C-number"
                  />
                  <p
                    v-if="store.editFormErrors.c_number"
                    class="mt-1 text-xs text-red-600"
                  >
                    {{ store.editFormErrors.c_number }}
                  </p>
                </template>
                <template v-else>{{ row.c_number || "-" }}</template>
              </td>
              <td class="px-4 py-3">
                <Badge :variant="row.verified ? 'success' : 'outline'">{{
                  row.verified ? "Verified" : "Not Verified"
                }}</Badge>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex flex-wrap justify-end gap-2">
                  <Button
                    v-if="store.canViewHistory"
                    size="sm"
                    variant="outline"
                    :disabled="
                      store.deviceHistoryLoading &&
                      store.deviceHistorySerial === row.fridge_serial_number
                    "
                    @click="store.loadDeviceHistory(row.fridge_serial_number)"
                  >
                    <Clock3 class="h-4 w-4" />
                    History
                  </Button>
                  <template v-if="store.canEditAssets">
                    <template
                      v-if="store.editingSerial === row.fridge_serial_number"
                    >
                      <Button
                        size="sm"
                        variant="success"
                        :disabled="store.savingEdit"
                        @click="store.submitEdit(row.fridge_serial_number)"
                      >
                        <Save class="h-4 w-4" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        @click="store.cancelEdit"
                        >Cancel</Button
                      >
                    </template>
                    <div v-else class="flex items-center gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        class="h-8 w-8"
                        :title="`Edit ${row.fridge_serial_number}`"
                        @click="store.startEdit(row)"
                        ><Pencil class="h-4 w-4"
                      /></Button>
                      <Button
                        v-if="store.canDeleteAssets"
                        size="icon"
                        variant="ghost"
                        class="h-8 w-8"
                        :disabled="
                          store.deletingSerial === row.fridge_serial_number
                        "
                        :title="`Delete ${row.fridge_serial_number}`"
                        @click="deleteConfirmSerial = row.fridge_serial_number"
                      >
                        <Trash2 class="h-4 w-4" />
                      </Button>
                    </div>
                  </template>
                  <Button
                    v-if="store.canDeleteAssets && !store.canEditAssets"
                    size="icon"
                    variant="ghost"
                    class="h-8 w-8"
                    :disabled="
                      store.deletingSerial === row.fridge_serial_number
                    "
                    :title="`Delete ${row.fridge_serial_number}`"
                    @click="deleteConfirmSerial = row.fridge_serial_number"
                  >
                    <Trash2 class="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
            <tr
              v-if="!store.fridgeLoading && store.sortedFridgeRows.length === 0"
            >
              <td
                colspan="5"
                class="px-4 py-10 text-center text-sm text-slate-500"
              >
                No fridge rows found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          :disabled="store.safeInventoryPage <= 1"
          @click="store.inventoryPage = Math.max(1, store.inventoryPage - 1)"
        >
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <span class="text-sm text-slate-500"
          >Page {{ store.safeInventoryPage }} of
          {{ store.inventoryTotalPages }}</span
        >
        <Button
          variant="outline"
          size="sm"
          :disabled="store.safeInventoryPage >= store.inventoryTotalPages"
          @click="
            store.inventoryPage = Math.min(
              store.inventoryTotalPages,
              store.inventoryPage + 1,
            )
          "
        >
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
    </div>
  </Card>

  <ModalDialog
    :open="Boolean(deleteConfirmSerial)"
    title="Delete Fridge"
    description="Delete this fridge from inventory?"
    @close="deleteConfirmSerial = null; deleteReason = ''"
  >
    <p class="text-sm text-slate-600">
      Fridge:
      <span class="font-medium text-slate-900">{{ deleteConfirmSerial }}</span>
    </p>
    <div class="mt-3">
      <label for="delete-reason" class="block text-sm font-medium text-slate-700">
        Reason for deletion
        <span class="text-slate-400 font-normal">(optional)</span>
      </label>
      <textarea
        id="delete-reason"
        v-model="deleteReason"
        rows="2"
        placeholder="e.g. Device decommissioned, duplicate entry..."
        class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
    <template #footer>
      <Button variant="outline" @click="deleteConfirmSerial = null; deleteReason = ''"
        >Cancel</Button
      >
      <Button
        variant="destructive"
        :disabled="store.deletingSerial === deleteConfirmSerial"
        @click="
          if (deleteConfirmSerial) {
            store.deleteFridge(deleteConfirmSerial, deleteReason.trim() || undefined);
            deleteConfirmSerial = null;
            deleteReason = '';
          }
        "
      >
        {{
          store.deletingSerial === deleteConfirmSerial
            ? "Deleting..."
            : "Delete Fridge"
        }}
      </Button>
    </template>
  </ModalDialog>
</template>
