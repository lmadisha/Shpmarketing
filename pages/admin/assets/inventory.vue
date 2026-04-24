<script setup lang="ts">
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  MoveRight,
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
import Select from "~/components/ui/Select.vue";
import Textarea from "~/components/ui/Textarea.vue";
import ModalDialog from "~/components/ui/ModalDialog.vue";
import AccessDeniedCard from "~/components/auth/AccessDeniedCard.vue";
import {
  downloadExcel,
  normalizeCNumber,
  normalizeHexIdentifier,
} from "~/utils/adminAssets";
import type { BulkOperationResult } from "~/types/adminAssets";

const store = useAdminAssetsStore();
const deleteConfirmSerial = ref<string | null>(null);
const deleteReason = ref("");
const exportingInventory = ref(false);

const canUseBulkSelection = computed(
  () => store.canBulkDeleteAssets || (store.canManageOrganisations && store.isOrganisationFilterEnabled),
);

const inventoryStats = computed(() => ({
  total: store.fridges.length,
  verified: store.fridges.filter((f) => f.verified).length,
  unverified: store.fridges.filter((f) => !f.verified).length,
}));

async function exportInventory() {
  if (!store.canDownloadAssets) return;
  exportingInventory.value = true;
  try {
    const params = new URLSearchParams();
    if (store.searchTerm.trim()) params.set("searchTerm", store.searchTerm.trim());
    if (store.inventoryVerifiedFilter !== "all") params.set("verified", store.inventoryVerifiedFilter);
    const basePath = `/exports/fridges${params.toString() ? `?${params.toString()}` : ""}`;
    const payload = await store.adminRequest<{
      sheet: string;
      columns: string[];
      rows: Array<Array<string | number | null>>;
    }>("exportInventory", store.withOrganisationFilter(basePath));

    downloadExcel(
      `fridges_${new Date().toISOString().slice(0, 10)}.xls`,
      payload.sheet || "Inventory",
      payload.columns || ["Serial Number", "MAC Address", "C-Number", "Verified"],
      Array.isArray(payload.rows) ? payload.rows : [],
    );
  } catch (error) {
    store.fridgeError = error instanceof Error ? error.message : "Could not export inventory.";
  } finally {
    exportingInventory.value = false;
  }
}

// ── Bulk delete modal ───────────────────────────────────────────────────────
const bulkDeleteOpen = ref(false);
const bulkDeleteReason = ref("");
const bulkDeleteResult = ref<BulkOperationResult | null>(null);

function openBulkDelete() {
  bulkDeleteReason.value = "";
  bulkDeleteResult.value = null;
  bulkDeleteOpen.value = true;
}

function closeBulkDelete() {
  bulkDeleteOpen.value = false;
  bulkDeleteReason.value = "";
  bulkDeleteResult.value = null;
}

async function submitBulkDelete() {
  const serials = Array.from(store.selectedSerials);
  const result = await store.bulkDeleteFridges(
    serials,
    bulkDeleteReason.value.trim() || undefined,
  );
  bulkDeleteResult.value = result;
  if (result.errors.length === 0) {
    closeBulkDelete();
  }
}

// ── Bulk move modal ─────────────────────────────────────────────────────────
const bulkMoveOpen = ref(false);
const bulkMoveTargetOrgId = ref("");
const bulkMoveResult = ref<BulkOperationResult | null>(null);

const orgSelectOptions = computed(() =>
  store.organisationOptions.map((o) => ({ value: String(o.id), label: o.name })),
);

function openBulkMove() {
  bulkMoveTargetOrgId.value = "";
  bulkMoveResult.value = null;
  bulkMoveOpen.value = true;
}

function closeBulkMove() {
  bulkMoveOpen.value = false;
  bulkMoveTargetOrgId.value = "";
  bulkMoveResult.value = null;
}

async function submitBulkMove() {
  const targetId = Number(bulkMoveTargetOrgId.value);
  if (!targetId) return;
  const serials = Array.from(store.selectedSerials);
  const result = await store.bulkMoveFridges(serials, targetId);
  bulkMoveResult.value = result;
  if (result.errors.length === 0) {
    closeBulkMove();
  }
}

// ── Header checkbox indeterminate state ─────────────────────────────────────
const headerCheckboxRef = ref<HTMLInputElement | null>(null);
watch(
  [() => store.isAllSelected, () => store.isPartialSelected],
  ([all, partial]) => {
    if (headerCheckboxRef.value) {
      headerCheckboxRef.value.indeterminate = partial && !all;
    }
  },
);

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
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div class="flex items-center gap-2">
            <Refrigerator class="h-4 w-4 text-[#006aea]" />
            <h2 class="text-lg font-semibold text-slate-900">Fridge Inventory</h2>
          </div>
          <p class="mt-1 text-sm text-slate-600">
            Search, update, delete, and inspect per-device history.
          </p>
        </div>
        <div class="flex shrink-0 items-stretch divide-x divide-slate-200">
          <div class="pr-5 text-right">
            <p class="text-2xl font-semibold leading-none tabular-nums text-[#006aea]">
              {{ store.fridgeLoading && inventoryStats.total === 0 ? "—" : inventoryStats.total }}
            </p>
            <p class="mt-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total</p>
          </div>
          <div class="px-5 text-right">
            <p class="text-2xl font-semibold leading-none tabular-nums text-emerald-600">
              {{ store.fridgeLoading && inventoryStats.total === 0 ? "—" : inventoryStats.verified }}
            </p>
            <p class="mt-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Verified</p>
          </div>
          <div class="pl-5 text-right">
            <p class="text-2xl font-semibold leading-none tabular-nums text-slate-400">
              {{ store.fridgeLoading && inventoryStats.total === 0 ? "—" : inventoryStats.unverified }}
            </p>
            <p class="mt-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Unverified</p>
          </div>
        </div>
      </div>
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
        <!-- Verified filter toggle -->
        <div class="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
          <button
            v-for="opt in [
              { value: 'all', label: 'All' },
              { value: 'verified', label: 'Verified' },
              { value: 'unverified', label: 'Not Verified' },
            ]"
            :key="opt.value"
            :class="[
              'rounded px-3 py-1.5 text-xs font-medium transition-colors',
              store.inventoryVerifiedFilter === opt.value
                ? opt.value === 'verified'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : opt.value === 'unverified'
                    ? 'bg-slate-400 text-white shadow-sm'
                    : 'bg-white text-slate-800 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-700',
            ]"
            @click="store.inventoryVerifiedFilter = opt.value as 'all' | 'verified' | 'unverified'"
          >
            {{ opt.label }}
          </button>
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
            store.inventoryVerifiedFilter = 'all';
            store.loadFridges('');
          "
        >
          <RefreshCw class="h-4 w-4" />
          Reset
        </Button>
        <Button
          v-if="store.canDownloadAssets"
          variant="outline"
          :disabled="exportingInventory"
          @click="exportInventory"
        >
          <Download class="h-4 w-4" />
          {{ exportingInventory ? "Exporting..." : "Download Excel" }}
        </Button>
      </div>

      <p v-if="store.fridgeError" class="text-sm text-red-600">
        {{ store.fridgeError }}
      </p>

      <!-- Bulk action bar -->
      <div
        v-if="store.selectedCount > 0"
        class="flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5"
      >
        <span class="text-sm font-medium text-blue-800">
          {{ store.selectedCount }}
          {{ store.selectedCount === 1 ? "fridge" : "fridges" }} selected
        </span>
        <div class="flex flex-wrap gap-2">
          <Button
            v-if="store.canBulkDeleteAssets"
            size="sm"
            variant="destructive"
            :disabled="store.bulkDeleting"
            @click="openBulkDelete"
          >
            <Trash2 class="h-4 w-4" />
            Delete Selected
          </Button>
          <Button
            v-if="store.canManageOrganisations && store.isOrganisationFilterEnabled"
            size="sm"
            variant="outline"
            :disabled="store.bulkMoving"
            @click="openBulkMove"
          >
            <MoveRight class="h-4 w-4" />
            Move to Org
          </Button>
          <Button
            size="sm"
            variant="outline"
            @click="store.clearSelection"
          >
            Clear
          </Button>
        </div>
        <p v-if="store.bulkError" class="w-full text-xs text-red-600">
          {{ store.bulkError }}
        </p>
      </div>

      <div class="overflow-x-auto rounded-xl border border-slate-200">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="bg-slate-50">
            <tr
              class="text-left text-sm font-semibold tracking-wide text-slate-500"
            >
              <th
                v-if="canUseBulkSelection"
                class="w-10 px-4 py-3"
              >
                <input
                  ref="headerCheckboxRef"
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 text-[#006aea] accent-[#006aea] cursor-pointer"
                  :checked="store.isAllSelected"
                  @change="store.toggleSelectAll"
                />
              </th>
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
              :class="
                store.selectedSerials.has(row.fridge_serial_number)
                  ? 'bg-blue-50/60'
                  : ''
              "
            >
              <td
                v-if="canUseBulkSelection"
                class="px-4 py-3"
              >
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 text-[#006aea] accent-[#006aea] cursor-pointer"
                  :checked="store.selectedSerials.has(row.fridge_serial_number)"
                  @change="store.toggleSelectSerial(row.fridge_serial_number)"
                />
              </td>
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
                :colspan="canUseBulkSelection ? 6 : 5"
                class="px-4 py-10 text-center text-sm text-slate-500"
              >
                <template v-if="store.inventoryVerifiedFilter !== 'all'">
                  No {{ store.inventoryVerifiedFilter === 'verified' ? 'verified' : 'unverified' }} fridges found.
                  <button class="ml-1 text-[#006aea] underline" @click="store.inventoryVerifiedFilter = 'all'">Show all</button>
                </template>
                <template v-else>No fridge rows found.</template>
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

  <!-- Single delete confirm -->
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

  <!-- Bulk delete modal -->
  <ModalDialog
    :open="bulkDeleteOpen"
    title="Delete Fridges"
    max-width-class="max-w-md"
    @close="closeBulkDelete"
  >
    <p class="text-sm text-slate-600">
      Delete
      <span class="font-medium text-slate-900">{{ store.selectedCount }}</span>
      {{ store.selectedCount === 1 ? "fridge" : "fridges" }} from inventory?
    </p>
    <div
      class="max-h-36 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
    >
      <p
        v-for="serial in Array.from(store.selectedSerials)"
        :key="serial"
        class="text-xs font-mono text-slate-700"
      >
        {{ serial }}
      </p>
    </div>
    <div>
      <label class="block text-sm font-medium text-slate-700">
        Reason for deletion
        <span class="text-slate-400 font-normal">(optional)</span>
      </label>
      <Textarea
        v-model="bulkDeleteReason"
        :rows="2"
        placeholder="e.g. Batch decommission..."
        class="mt-1"
      />
    </div>
    <div v-if="bulkDeleteResult && bulkDeleteResult.errors.length > 0" class="rounded-md border border-red-200 bg-red-50 p-3">
      <p class="text-xs font-medium text-red-700">
        {{ bulkDeleteResult.succeeded.length }} deleted,
        {{ bulkDeleteResult.errors.length }} failed:
      </p>
      <ul class="mt-1 space-y-0.5">
        <li
          v-for="err in bulkDeleteResult.errors"
          :key="err.serial"
          class="text-xs text-red-600"
        >
          {{ err.serial }}: {{ err.message }}
        </li>
      </ul>
    </div>
    <template #footer>
      <Button variant="outline" @click="closeBulkDelete">Cancel</Button>
      <Button
        variant="destructive"
        :disabled="store.bulkDeleting"
        @click="submitBulkDelete"
      >
        {{
          store.bulkDeleting
            ? "Deleting..."
            : `Delete ${store.selectedCount} ${store.selectedCount === 1 ? "Fridge" : "Fridges"}`
        }}
      </Button>
    </template>
  </ModalDialog>

  <!-- Bulk move modal -->
  <ModalDialog
    :open="bulkMoveOpen"
    title="Move Fridges to Organisation"
    max-width-class="max-w-md"
    @close="closeBulkMove"
  >
    <p class="text-sm text-slate-600">
      Move
      <span class="font-medium text-slate-900">{{ store.selectedCount }}</span>
      {{ store.selectedCount === 1 ? "fridge" : "fridges" }} to a different organisation.
    </p>
    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">
        Target organisation
      </label>
      <Select
        v-model="bulkMoveTargetOrgId"
        :options="orgSelectOptions"
        placeholder="Select organisation..."
        :searchable="true"
        :disabled="store.organisationsLoading"
      />
    </div>
    <div v-if="bulkMoveResult && bulkMoveResult.errors.length > 0" class="rounded-md border border-red-200 bg-red-50 p-3">
      <p class="text-xs font-medium text-red-700">
        {{ bulkMoveResult.succeeded.length }} moved,
        {{ bulkMoveResult.errors.length }} failed:
      </p>
      <ul class="mt-1 space-y-0.5">
        <li
          v-for="err in bulkMoveResult.errors"
          :key="err.serial"
          class="text-xs text-red-600"
        >
          {{ err.serial }}: {{ err.message }}
        </li>
      </ul>
    </div>
    <template #footer>
      <Button variant="outline" @click="closeBulkMove">Cancel</Button>
      <Button
        :disabled="!bulkMoveTargetOrgId || store.bulkMoving"
        @click="submitBulkMove"
      >
        {{
          store.bulkMoving
            ? "Moving..."
            : `Move ${store.selectedCount} ${store.selectedCount === 1 ? "Fridge" : "Fridges"}`
        }}
      </Button>
    </template>
  </ModalDialog>
</template>
