<script setup lang="ts">
import { Ruler } from 'lucide-vue-next'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Input from '~/components/ui/Input.vue'
import Select from '~/components/ui/Select.vue'
import Label from '~/components/ui/Label.vue'
import { useAuthStore } from '~/stores/auth'
import {
  validateOrganisationAssetValidationForm,
  type OrganisationAssetValidationRules,
} from '~/utils/organisationAssetValidation'

type OrganisationOption = {
  id: number
  name: string
  domin: string | null
}

type RulesFormState = {
  serial_min_length: string
  serial_max_length: string
  mac_min_length: string
  mac_max_length: string
  c_number_min_length: string
  c_number_max_length: string
}

const EMPTY_RULES_FORM: RulesFormState = {
  serial_min_length: '',
  serial_max_length: '',
  mac_min_length: '',
  mac_max_length: '',
  c_number_min_length: '',
  c_number_max_length: '',
}

function toFormState(rules: OrganisationAssetValidationRules): RulesFormState {
  return {
    serial_min_length: String(rules.serial_min_length),
    serial_max_length: String(rules.serial_max_length),
    mac_min_length: String(rules.mac_min_length),
    mac_max_length: String(rules.mac_max_length),
    c_number_min_length: String(rules.c_number_min_length),
    c_number_max_length: String(rules.c_number_max_length),
  }
}

const { request } = useApiClient()
const authStore = useAuthStore()

const isAdmin = computed(() => authStore.session?.user.permissions === 'Admin')
const isAdvanced = computed(() => authStore.session?.user.permissions === 'Advanced')
const canManageRules = computed(() => isAdmin.value || isAdvanced.value)

const organisationOptions = ref<OrganisationOption[]>([])
const organisationsLoading = ref(false)
const selectedOrganisationId = ref('')
const rulesLoading = ref(false)
const rulesSaving = ref(false)
const rulesError = ref('')
const rulesSuccess = ref('')
const rulesForm = ref<RulesFormState>({ ...EMPTY_RULES_FORM })
const fieldErrors = ref<Record<string, string>>({})

const effectiveOrganisationId = computed(() => {
  if (isAdmin.value) {
    return selectedOrganisationId.value ? Number(selectedOrganisationId.value) : null
  }
  return authStore.session?.user.organisation_id ?? null
})

async function loadRules(organisationId?: number | null) {
  if (!canManageRules.value) {
    return
  }

  const params = new URLSearchParams()
  if (isAdmin.value && organisationId) {
    params.set('organisation_id', String(organisationId))
  }

  rulesLoading.value = true
  rulesError.value = ''
  rulesSuccess.value = ''

  try {
    const path = params.toString()
      ? `/organisation-asset-validation?${params.toString()}`
      : '/organisation-asset-validation'
    const rules = await request<OrganisationAssetValidationRules>(path)
    rulesForm.value = toFormState(rules)
    fieldErrors.value = {}
  } catch (error) {
    rulesError.value = error instanceof Error ? error.message : 'Could not load asset validation rules.'
  } finally {
    rulesLoading.value = false
  }
}

async function loadOrganisations() {
  if (!isAdmin.value) {
    return
  }

  organisationsLoading.value = true
  try {
    const data = await request<OrganisationOption[]>('/organisations')
    organisationOptions.value = Array.isArray(data) ? data : []
    selectedOrganisationId.value = authStore.session?.user.organisation_id
      ? String(authStore.session.user.organisation_id)
      : organisationOptions.value[0]
        ? String(organisationOptions.value[0].id)
        : ''
  } catch (error) {
    rulesError.value = error instanceof Error ? error.message : 'Could not load organisations.'
    organisationOptions.value = []
    selectedOrganisationId.value = ''
  } finally {
    organisationsLoading.value = false
  }
}

function handleFieldChange(field: keyof RulesFormState, value: string) {
  rulesSuccess.value = ''
  rulesError.value = ''
  rulesForm.value = { ...rulesForm.value, [field]: value }
  const nextErrors = { ...fieldErrors.value }
  delete nextErrors[field]
  fieldErrors.value = nextErrors
}

async function saveRules() {
  if (!effectiveOrganisationId.value) {
    rulesError.value = 'Select an organisation first.'
    return
  }

  const validation = validateOrganisationAssetValidationForm(rulesForm.value)
  if (!validation.isValid) {
    fieldErrors.value = validation.errors
    rulesError.value = Object.values(validation.errors)[0] || 'Validation failed.'
    rulesSuccess.value = ''
    return
  }

  rulesSaving.value = true
  rulesError.value = ''
  rulesSuccess.value = ''
  try {
    const rules = await request<OrganisationAssetValidationRules>('/organisation-asset-validation', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organisation_id: effectiveOrganisationId.value,
        ...validation.values,
      }),
    })
    rulesForm.value = toFormState(rules)
    fieldErrors.value = {}
    rulesSuccess.value = 'Organisation asset validation rules updated.'
  } catch (error) {
    rulesError.value = error instanceof Error ? error.message : 'Could not update asset validation rules.'
  } finally {
    rulesSaving.value = false
  }
}

watch(
  isAdmin,
  (value) => {
    if (value) {
      void loadOrganisations()
    }
  },
  { immediate: true },
)

watch(
  effectiveOrganisationId,
  (value) => {
    if (value) {
      void loadRules(value)
    }
  },
  { immediate: true },
)
</script>

<template>
  <Card v-if="canManageRules">
    <div class="border-b border-slate-200 p-6">
      <div class="flex items-center gap-2">
        <Ruler class="h-5 w-5 text-blue-600" />
        <h2 class="text-lg font-semibold text-slate-900">Organisation Asset Validation</h2>
      </div>
      <p class="mt-2 text-sm text-slate-600">
        Configure allowed identifier lengths for each organisation.
      </p>
    </div>
    <div class="space-y-4 p-6">
      <div v-if="isAdmin" class="space-y-2">
        <Label for="asset-validation-organisation">Organisation</Label>
        <Select
          id="asset-validation-organisation"
          v-model="selectedOrganisationId"
          :disabled="organisationsLoading || rulesSaving"
          :options="[
            { value: '', label: organisationsLoading ? 'Loading organisations...' : 'Select organisation' },
            ...organisationOptions.map(o => ({ value: String(o.id), label: o.name })),
          ]"
        />
      </div>

      <p v-if="rulesError" class="text-sm text-red-600">{{ rulesError }}</p>
      <p v-if="rulesSuccess" class="text-sm text-emerald-600">{{ rulesSuccess }}</p>

      <div class="grid gap-4 md:grid-cols-3">
        <div class="space-y-3">
          <div class="space-y-1">
            <Label for="serial-min-length">Serial Minimum Length</Label>
            <Input id="serial-min-length" v-model="rulesForm.serial_min_length" type="number" @update:model-value="(value) => handleFieldChange('serial_min_length', String(value || ''))" />
            <p v-if="fieldErrors.serial_min_length" class="text-xs text-red-600">{{ fieldErrors.serial_min_length }}</p>
          </div>
          <div class="space-y-1">
            <Label for="serial-max-length">Serial Maximum Length</Label>
            <Input id="serial-max-length" v-model="rulesForm.serial_max_length" type="number" @update:model-value="(value) => handleFieldChange('serial_max_length', String(value || ''))" />
            <p v-if="fieldErrors.serial_max_length" class="text-xs text-red-600">{{ fieldErrors.serial_max_length }}</p>
          </div>
        </div>

        <div class="space-y-3">
          <div class="space-y-1">
            <Label for="mac-min-length">MAC Minimum Length</Label>
            <Input id="mac-min-length" v-model="rulesForm.mac_min_length" type="number" @update:model-value="(value) => handleFieldChange('mac_min_length', String(value || ''))" />
            <p v-if="fieldErrors.mac_min_length" class="text-xs text-red-600">{{ fieldErrors.mac_min_length }}</p>
          </div>
          <div class="space-y-1">
            <Label for="mac-max-length">MAC Maximum Length</Label>
            <Input id="mac-max-length" v-model="rulesForm.mac_max_length" type="number" @update:model-value="(value) => handleFieldChange('mac_max_length', String(value || ''))" />
            <p v-if="fieldErrors.mac_max_length" class="text-xs text-red-600">{{ fieldErrors.mac_max_length }}</p>
          </div>
        </div>

        <div class="space-y-3">
          <div class="space-y-1">
            <Label for="c-min-length">C-Number Minimum Length</Label>
            <Input id="c-min-length" v-model="rulesForm.c_number_min_length" type="number" @update:model-value="(value) => handleFieldChange('c_number_min_length', String(value || ''))" />
            <p v-if="fieldErrors.c_number_min_length" class="text-xs text-red-600">{{ fieldErrors.c_number_min_length }}</p>
          </div>
          <div class="space-y-1">
            <Label for="c-max-length">C-Number Maximum Length</Label>
            <Input id="c-max-length" v-model="rulesForm.c_number_max_length" type="number" @update:model-value="(value) => handleFieldChange('c_number_max_length', String(value || ''))" />
            <p v-if="fieldErrors.c_number_max_length" class="text-xs text-red-600">{{ fieldErrors.c_number_max_length }}</p>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button :disabled="rulesLoading || rulesSaving || !effectiveOrganisationId" @click="saveRules">
          {{ rulesSaving ? 'Saving...' : 'Save Validation Rules' }}
        </Button>
        <Button variant="outline" :disabled="rulesLoading || rulesSaving || !effectiveOrganisationId" @click="loadRules(effectiveOrganisationId)">
          {{ rulesLoading ? 'Refreshing...' : 'Refresh Rules' }}
        </Button>
      </div>
    </div>
  </Card>
</template>
