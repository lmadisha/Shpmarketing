<script setup lang="ts">
import { Download, Plus, Upload } from "lucide-vue-next";
import Card from "~/components/ui/Card.vue";
import Input from "~/components/ui/Input.vue";
import Button from "~/components/ui/Button.vue";
import AccessDeniedCard from "~/components/auth/AccessDeniedCard.vue";
import ModalDialog from "~/components/ui/ModalDialog.vue";
import { validateAssetIdentifiers } from "~/utils/organisationAssetValidation";
import {
  downloadExcel,
  normalizeCNumber,
  normalizeHexIdentifier,
} from "~/utils/adminAssets";

type BulkSkippedRow = {
  rowNumber: number;
  reason: string;
  message: string;
  serial?: string;
  upload_mac_address?: string | null;
  upload_c_number?: string | null;
  db_serial?: string | null;
  db_mac_address?: string | null;
  db_c_number?: string | null;
};

type BulkPreviewRow = {
  rowNumber: number;
  fridge_serial_number: string;
  mac_address: string | null;
  c_number: string | null;
};

const store = useAdminAssetsStore();

const createForm = reactive({
  fridge_serial_number: "",
  mac_address: "",
  c_number: "",
});
const createErrors = ref<{ serial?: string; mac?: string; cNumber?: string }>(
  {},
);
const creating = ref(false);
const createResult = ref("");

const bulkFile = ref<File | null>(null);
const bulkSubmitting = ref(false);
const bulkPreviewLoading = ref(false);
const bulkMessage = ref("");
const bulkErrors = ref<
  Array<{ rowNumber: number; reason: string; message: string; serial?: string }>
>([]);
const bulkSkippedRows = ref<BulkSkippedRow[]>([]);
const bulkPreviewRows = ref<BulkPreviewRow[]>([]);
const bulkPreviewSummary = ref<{
  totalRows: number;
  previewRows: number;
  excludedRows: number;
} | null>(null);
const skippedModalOpen = ref(false);
const bulkUpdating = ref(false);
const bulkUpdateResult = ref("");

definePageMeta({ middleware: "auth" });

async function validateCreate() {
  const serial = normalizeHexIdentifier(createForm.fridge_serial_number);
  const mac = createForm.mac_address
    ? normalizeHexIdentifier(createForm.mac_address)
    : "";
  const cNumber = createForm.c_number
    ? normalizeCNumber(createForm.c_number)
    : "";

  const organisationId = store.effectiveOrganisationIdForMutations;
  if (!organisationId) {
    createErrors.value = {
      serial: "Could not resolve organisation from current selection.",
    };
    return { isValid: false, serial, mac, cNumber };
  }
  let rules: Awaited<ReturnType<typeof store.getOrganisationValidationRules>>;
  try {
    rules = await store.getOrganisationValidationRules(organisationId);
  } catch (error) {
    createErrors.value = {
      serial:
        error instanceof Error
          ? error.message
          : "Could not load organisation validation rules.",
    };
    return { isValid: false, serial, mac, cNumber };
  }

  const validationErrors = validateAssetIdentifiers(
    {
      fridge_serial_number: serial,
      mac_address: mac,
      c_number: cNumber,
    },
    rules,
    { requireSerial: true },
  );

  createErrors.value = {
    serial: validationErrors.fridge_serial_number,
    mac: validationErrors.mac_address,
    cNumber: validationErrors.c_number,
  };

  return {
    isValid: Object.values(createErrors.value).every((value) => !value),
    serial,
    mac,
    cNumber,
  };
}

async function submitCreate() {
  const { isValid, serial, mac, cNumber } = await validateCreate();
  if (!isValid) return;
  const scopeValue = store.mutationOrganisationScopeValue;
  if (!scopeValue) {
    createResult.value =
      "Could not add fridge. Your account has no organisation assigned.";
    return;
  }

  creating.value = true;
  createResult.value = "";
  try {
    await store.adminRequest("createFridge", "/newDevice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fridge_serial_number: serial,
        mac_address: mac,
        c_number: cNumber,
        organisation_id: scopeValue,
      }),
    });
    createForm.fridge_serial_number = "";
    createForm.mac_address = "";
    createForm.c_number = "";
    createErrors.value = {};
    createResult.value = "Fridge added successfully.";
    if (store.canViewAssets) await store.loadFridges(store.searchTerm);
    if (store.canViewHistory) await store.loadAllHistory();
  } catch {
    createResult.value =
      "Could not add fridge. Check duplicates and try again.";
  } finally {
    creating.value = false;
  }
}

async function previewBulkUpload() {
  if (!store.canBulkAddAssets) {
    bulkMessage.value = "You do not have permission to bulk add devices.";
    return;
  }
  if (!bulkFile.value) {
    bulkMessage.value = "Please choose a CSV or Excel file first.";
    return;
  }
  bulkPreviewLoading.value = true;
  bulkMessage.value = "";
  bulkErrors.value = [];
  bulkSkippedRows.value = [];
  bulkPreviewRows.value = [];
  bulkPreviewSummary.value = null;
  try {
    const formData = new FormData();
    formData.append("file", bulkFile.value);
    if (store.mutationOrganisationScopeValue)
      formData.append("organisation_id", store.mutationOrganisationScopeValue);
    const response = await store.adminRequest<{
      summary: { totalRows: number; previewRows: number; excludedRows: number };
      rows: BulkPreviewRow[];
    }>("bulkPreview", "/newDevice/bulk/preview", {
      method: "POST",
      body: formData,
    });
    bulkPreviewRows.value = Array.isArray(response.rows) ? response.rows : [];
    bulkPreviewSummary.value = response.summary;
    bulkMessage.value = `Preview ready. Total: ${response.summary.totalRows}, Included: ${response.summary.previewRows}, Excluded(no serial): ${response.summary.excludedRows}`;
  } catch (error) {
    bulkMessage.value =
      error instanceof Error ? error.message : "Bulk preview failed.";
  } finally {
    bulkPreviewLoading.value = false;
  }
}

async function submitBulkUpload() {
  if (!store.canBulkAddAssets) {
    bulkMessage.value = "You do not have permission to bulk add devices.";
    return;
  }
  if (!bulkFile.value) {
    bulkMessage.value = "Please choose a CSV or Excel file first.";
    return;
  }
  bulkSubmitting.value = true;
  bulkMessage.value = "";
  bulkErrors.value = [];
  bulkSkippedRows.value = [];
  bulkUpdateResult.value = "";
  skippedModalOpen.value = false;
  try {
    const formData = new FormData();
    formData.append("file", bulkFile.value);
    if (store.mutationOrganisationScopeValue)
      formData.append("organisation_id", store.mutationOrganisationScopeValue);
    const response = await store.adminRequest<{
      summary: {
        totalRows: number;
        excludedRows?: number;
        validRows: number;
        insertedRows: number;
        skippedRows?: number;
        failedRows: number;
      };
      skippedRows?: BulkSkippedRow[];
      errors?: Array<{
        rowNumber: number;
        reason: string;
        message: string;
        serial?: string;
      }>;
    }>("bulkUpload", "/newDevice/bulk", { method: "POST", body: formData });
    const summary = response.summary;
    bulkMessage.value = `Upload complete. Total: ${summary.totalRows}, Excluded: ${summary.excludedRows || 0}, Ready: ${summary.validRows}, Inserted: ${summary.insertedRows}, Skipped: ${summary.skippedRows || 0}, Failed: ${summary.failedRows}`;
    bulkSkippedRows.value = response.skippedRows || [];
    bulkErrors.value = response.errors || [];
    skippedModalOpen.value = bulkSkippedRows.value.length > 0;
    if (store.canViewAssets) await store.loadFridges(store.searchTerm);
    if (store.canViewHistory) await store.loadAllHistory();
  } catch (error) {
    bulkMessage.value =
      error instanceof Error ? error.message : "Bulk upload failed.";
  } finally {
    bulkSubmitting.value = false;
  }
}

async function submitBulkUpdate() {
  if (!store.canBulkAddAssets) {
    bulkUpdateResult.value = "You do not have permission to bulk add devices.";
    return;
  }
  if (!bulkSkippedRows.value.length) return;
  bulkUpdating.value = true;
  bulkUpdateResult.value = "";
  try {
    const response = await store.adminRequest<{
      summary: {
        totalRows: number;
        updatedRows: number;
        skippedRows: number;
        failedRows: number;
      };
      skipped?: Array<{ serial: string; reason: string; message: string }>;
      errors?: Array<{ serial: string; reason: string; message: string }>;
    }>("bulkUpdate", "/newDevice/bulk/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: bulkSkippedRows.value,
        organisation_id: store.mutationOrganisationScopeValue,
      }),
    });
    const summary = response.summary;
    bulkUpdateResult.value = `Bulk update complete. Updated: ${summary.updatedRows}, Skipped: ${summary.skippedRows}, Failed: ${summary.failedRows}`;
    if (summary.updatedRows > 0) {
      bulkSkippedRows.value = [];
      skippedModalOpen.value = false;
      if (store.canViewAssets) await store.loadFridges(store.searchTerm);
      if (store.canViewHistory) await store.loadAllHistory();
    }
  } catch (error) {
    bulkUpdateResult.value =
      error instanceof Error ? error.message : "Bulk update failed.";
  } finally {
    bulkUpdating.value = false;
  }
}
</script>

<template>
  <AccessDeniedCard
    v-if="!store.canCreateAssets"
    title="Add Fridge access denied"
    description="You do not have permission to create fridge records."
  />

  <div v-else class="max-w-4xl space-y-6">
    <Card>
      <div class="border-b border-slate-200 p-5">
        <div class="flex items-center gap-2">
          <Plus class="h-4 w-4 text-[#006aea]" />
          <h2 class="text-lg font-semibold text-slate-900">Add New Fridge</h2>
        </div>
        <p class="mt-1 text-sm text-slate-600">
          Register a new device identity.
        </p>
      </div>
      <div class="space-y-3 p-5">
        <div class="grid gap-3 md:grid-cols-4">
          <div class="space-y-1">
            <Input
              :model-value="createForm.fridge_serial_number"
              placeholder="Serial"
              @update:model-value="
                (value) => {
                  createErrors.serial = undefined;
                  createForm.fridge_serial_number = normalizeHexIdentifier(
                    String(value || ''),
                  );
                }
              "
            />
            <p v-if="createErrors.serial" class="text-xs text-red-600">
              {{ createErrors.serial }}
            </p>
          </div>
          <div class="space-y-1">
            <Input
              :model-value="createForm.mac_address"
              placeholder="MAC (optional)"
              @update:model-value="
                (value) => {
                  createErrors.mac = undefined;
                  createForm.mac_address = normalizeHexIdentifier(
                    String(value || ''),
                  );
                }
              "
            />
            <p v-if="createErrors.mac" class="text-xs text-red-600">
              {{ createErrors.mac }}
            </p>
          </div>
          <div class="space-y-1">
            <Input
              :model-value="createForm.c_number"
              placeholder="C-Number (optional)"
              @update:model-value="
                (value) => {
                  createErrors.cNumber = undefined;
                  createForm.c_number = normalizeCNumber(String(value || ''));
                }
              "
            />
            <p v-if="createErrors.cNumber" class="text-xs text-red-600">
              {{ createErrors.cNumber }}
            </p>
          </div>
          <Button
            :disabled="creating"
            @click="submitCreate"
            >{{ creating ? "Adding..." : "Add Fridge" }}</Button
          >
        </div>
        <p v-if="createResult" class="text-sm text-slate-600">
          {{ createResult }}
        </p>
      </div>
    </Card>

    <Card>
      <div class="border-b border-slate-200 p-5">
        <div class="flex items-center gap-2">
          <Upload class="h-4 w-4 text-[#006aea]" />
          <h2 class="text-lg font-semibold text-slate-900">Bulk Upload</h2>
        </div>
        <p class="mt-1 text-sm text-slate-600">
          Upload CSV or Excel files with serial, optional MAC, and optional
          C-number columns.
        </p>
      </div>
      <div class="space-y-4 p-5">
        <p v-if="!store.canBulkAddAssets" class="text-sm text-amber-700">
          Bulk add and bulk update are available for Advanced and Admin roles.
        </p>

        <div v-else class="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            type="file"
            accept=".csv,.xls,.xlsx"
            class="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 file:mr-3 file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            @change="
              bulkFile =
                (($event.target as HTMLInputElement).files || [])[0] || null
            "
          />
          <Button
            variant="outline"
            :disabled="bulkPreviewLoading || !bulkFile"
            @click="previewBulkUpload"
            >{{ bulkPreviewLoading ? "Previewing..." : "Preview File" }}</Button
          >
          <Button
            :disabled="bulkSubmitting || !bulkFile"
            @click="submitBulkUpload"
            >{{ bulkSubmitting ? "Uploading..." : "Upload File" }}</Button
          >
          <Button
            variant="outline"
            @click="
              downloadExcel(
                'fridge_bulk_template.xls',
                'Template',
                ['fridge_serial_number', 'mac_address', 'c_number'],
                [['A1B2C3D4E5F6', '001122AABBCC', 'C10001']],
              )
            "
          >
            <Download class="h-4 w-4" />
            Template
          </Button>
        </div>

        <p v-if="bulkMessage" class="text-sm text-slate-600">
          {{ bulkMessage }}
        </p>

        <div
          v-if="bulkErrors.length"
          class="max-h-40 overflow-auto rounded-md border border-red-200 p-3"
        >
          <p
            v-for="(item, index) in bulkErrors.slice(0, 20)"
            :key="`${item.rowNumber}-${index}`"
            class="text-xs text-red-600"
          >
            Row {{ item.rowNumber }}: {{ item.reason }}
            {{ item.serial ? `(${item.serial})` : "" }} - {{ item.message }}
          </p>
        </div>

        <div v-if="bulkPreviewSummary" class="text-xs text-slate-500">
          Preview rows included: {{ bulkPreviewSummary.previewRows }} /
          {{ bulkPreviewSummary.totalRows }} (excluded without serial:
          {{ bulkPreviewSummary.excludedRows }})
        </div>

        <div
          v-if="bulkPreviewRows.length"
          class="max-h-60 overflow-auto rounded-xl border border-slate-200"
        >
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr
                class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                <th class="px-4 py-3">Row</th>
                <th class="px-4 py-3">Serial Number</th>
                <th class="px-4 py-3">MAC Address</th>
                <th class="px-4 py-3">C-Number</th>
              </tr>
            </thead>
            <tbody
              class="divide-y divide-slate-200 bg-white text-sm text-slate-700"
            >
              <tr
                v-for="row in bulkPreviewRows.slice(0, 100)"
                :key="`${row.rowNumber}-${row.fridge_serial_number}`"
              >
                <td class="px-4 py-3">{{ row.rowNumber }}</td>
                <td class="px-4 py-3 font-medium">
                  {{ row.fridge_serial_number }}
                </td>
                <td class="px-4 py-3">{{ row.mac_address || "" }}</td>
                <td class="px-4 py-3">{{ row.c_number || "" }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Card>

    <ModalDialog
      :open="skippedModalOpen"
      title="Skipped Rows Report"
      description="These rows already exist in the database."
      max-width-class="max-w-6xl"
      @close="skippedModalOpen = false"
    >
      <div
        class="max-h-[420px] overflow-auto rounded-xl border border-slate-200"
      >
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="bg-slate-50">
            <tr
              class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              <th class="px-4 py-3">Row</th>
              <th class="px-4 py-3">Upload Serial</th>
              <th class="px-4 py-3">Upload MAC</th>
              <th class="px-4 py-3">Upload C-Number</th>
              <th class="px-4 py-3">DB Serial</th>
              <th class="px-4 py-3">DB MAC</th>
              <th class="px-4 py-3">DB C-Number</th>
              <th class="px-4 py-3">Reason</th>
            </tr>
          </thead>
          <tbody
            class="divide-y divide-slate-200 bg-white text-sm text-slate-700"
          >
            <tr
              v-for="(item, index) in bulkSkippedRows"
              :key="`${item.rowNumber}-${index}`"
            >
              <td class="px-4 py-3">{{ item.rowNumber }}</td>
              <td class="px-4 py-3">{{ item.serial || "-" }}</td>
              <td class="px-4 py-3">{{ item.upload_mac_address || "-" }}</td>
              <td class="px-4 py-3">{{ item.upload_c_number || "-" }}</td>
              <td class="px-4 py-3">{{ item.db_serial || "-" }}</td>
              <td class="px-4 py-3">{{ item.db_mac_address || "-" }}</td>
              <td class="px-4 py-3">{{ item.db_c_number || "-" }}</td>
              <td class="px-4 py-3">{{ item.message }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="bulkUpdateResult" class="px-1 text-sm text-slate-600">
        {{ bulkUpdateResult }}
      </p>
      <template #footer>
        <Button
          variant="outline"
          @click="
            downloadExcel(
              `fridge_bulk_skipped_rows_${new Date().toISOString().slice(0, 10)}.xls`,
              'Skipped Rows',
              [
                'Upload Row',
                'Upload Serial',
                'Upload MAC Address',
                'Upload C-Number',
                'Database Serial',
                'Database MAC Address',
                'Database C-Number',
                'Reason',
                'Message',
              ],
              bulkSkippedRows.map((row) => [
                row.rowNumber,
                row.serial || '',
                row.upload_mac_address || '',
                row.upload_c_number || '',
                row.db_serial || '',
                row.db_mac_address || '',
                row.db_c_number || '',
                row.reason,
                row.message,
              ]),
            )
          "
        >
          <Download class="h-4 w-4" />
          Download Report
        </Button>
        <Button
          :disabled="bulkUpdating || !bulkSkippedRows.length"
          @click="submitBulkUpdate"
        >
          <Upload class="h-4 w-4" />
          {{
            bulkUpdating
              ? "Updating..."
              : `Update All (${bulkSkippedRows.length})`
          }}
        </Button>
        <Button variant="outline" @click="skippedModalOpen = false"
          >Close</Button
        >
      </template>
    </ModalDialog>
  </div>
</template>
