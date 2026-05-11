<script setup lang="ts">
import { Camera, MapPin, ScanLine, Upload } from 'lucide-vue-next'
import Card from '~/components/ui/Card.vue'
import Input from '~/components/ui/Input.vue'
import Button from '~/components/ui/Button.vue'
import ModalDialog from '~/components/ui/ModalDialog.vue'
import AccessDeniedCard from '~/components/auth/AccessDeniedCard.vue'
import { cleanCNumber } from '~/utils/adminAssets'
import { findExactSerialMatch, normalizeSerialCandidate } from '~/utils/serialLookup'
import { decodeSerialFromImageFile, startCameraSerialScan, type CameraScannerSession } from '~/utils/serialScanner'
import type { Fridge } from '~/types/adminAssets'

type PlacementForm = {
  serial_number: string
  c_number: string
}

type PlacementSuccess = {
  result: 'PLACED'
  serial_number: string
  image_count: number
}

type ReassignmentConfirmState = {
  open: boolean
  existingSerial: string
  existingCNumber: string
  requestedCNumber: string
  clearing: boolean
}

const store = useAdminAssetsStore()

const form = reactive<PlacementForm>({
  serial_number: '',
  c_number: '',
})
const placementImages = ref<File[]>([])
const imagePreviews = ref<string[]>([])
const imageInputRef = ref<HTMLInputElement | null>(null)
const submitting = ref(false)
const error = ref<string | null>(null)
const success = ref<PlacementSuccess | null>(null)
const reassignmentConfirm = ref<ReassignmentConfirmState>({
  open: false,
  existingSerial: '',
  existingCNumber: '',
  requestedCNumber: '',
  clearing: false,
})

const locationLatitude = ref<number | null>(null)
const locationLongitude = ref<number | null>(null)
const locationStatus = ref<'pending' | 'granted' | 'denied' | 'unavailable'>('pending')

const scannerOpen = ref(false)
const scannerMode = ref<'camera' | 'upload'>('camera')
const scannerError = ref<string | null>(null)
const scannerInfo = ref('Use Start Scan to read the serial barcode from camera.')
const scannerMatching = ref(false)
const scannerDecodingImage = ref(false)
const cameraScanning = ref(false)
const cameraRestartKey = ref(0)
const cameraVideoRef = ref<HTMLVideoElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const cameraSession = ref<CameraScannerSession | null>(null)

definePageMeta({ middleware: 'auth' })

function requestLocation() {
  if (!navigator.geolocation) {
    locationStatus.value = 'unavailable'
    return
  }
  navigator.geolocation.getCurrentPosition(
      (position) => {
        locationLatitude.value = position.coords.latitude
        locationLongitude.value = position.coords.longitude
        locationStatus.value = 'granted'
      },
      () => {
        locationStatus.value = 'denied'
      },
      { enableHighAccuracy: true, timeout: 10000 },
  )
}

onMounted(() => {
  requestLocation()
})

async function handleScannedSerial(candidate: string) {
  const normalized = normalizeSerialCandidate(candidate)
  if (!normalized) {
    scannerError.value = 'Could not read a valid serial number from barcode.'
    scannerInfo.value = 'Try scanning again or use image upload.'
    return
  }
  scannerMatching.value = true
  scannerError.value = null
  scannerInfo.value = `Detected ${normalized}. Applying...`
  try {
    error.value = null
    success.value = null
    form.serial_number = normalized
    scannerInfo.value = `Serial ${normalized} set.`
    scannerOpen.value = false
  } finally {
    scannerMatching.value = false
  }
}

watch([scannerOpen, scannerMode, cameraScanning, cameraRestartKey], () => {
  if (!scannerOpen.value || scannerMode.value !== 'camera' || !cameraScanning.value) {
    cameraSession.value?.stop()
    cameraSession.value = null
    return
  }
  if (!cameraVideoRef.value) return
  scannerError.value = null
  scannerInfo.value = 'Scanning live camera for barcode...'
  cameraSession.value = startCameraSerialScan(cameraVideoRef.value, {
    onDecode: (value) => {
      void handleScannedSerial(value)
    },
    onError: (message) => {
      scannerError.value = message
    },
  })
})

function resetScannerState() {
  scannerError.value = null
  scannerInfo.value = 'Use Start Scan to read the serial barcode from camera.'
  scannerMode.value = 'camera'
  scannerDecodingImage.value = false
  scannerMatching.value = false
  cameraScanning.value = false
  cameraRestartKey.value += 1
}

async function handleImageScanFile(event: Event) {
  const file = ((event.target as HTMLInputElement).files || [])[0]
  if (!file) return
  scannerDecodingImage.value = true
  scannerError.value = null
  scannerInfo.value = `Decoding barcode from ${file.name}...`
  try {
    const decoded = await decodeSerialFromImageFile(file)
    await handleScannedSerial(decoded)
  } catch (decodeError) {
    scannerError.value = decodeError instanceof Error ? decodeError.message : 'Could not decode barcode image.'
    scannerInfo.value = 'Upload a clearer barcode image and try again.'
  } finally {
    scannerDecodingImage.value = false
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}

function handleImagesSelect(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files || [])
  if (!files.length) return
  for (const file of files) {
    placementImages.value.push(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      imagePreviews.value.push(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }
  if (imageInputRef.value) imageInputRef.value.value = ''
}

function removeImage(index: number) {
  placementImages.value.splice(index, 1)
  imagePreviews.value.splice(index, 1)
}

function resetReassignmentConfirm() {
  reassignmentConfirm.value = {
    open: false,
    existingSerial: '',
    existingCNumber: '',
    requestedCNumber: '',
    clearing: false,
  }
}

async function findExistingFridge(serial: string) {
  const normalizedSerial = normalizeSerialCandidate(serial)
  if (!normalizedSerial) return null

  const data = await store.adminRequest<Fridge[]>(
      'placement:lookupFridge',
      store.withOrganisationFilter(`/searchFridges?searchTerm=${encodeURIComponent(normalizedSerial)}`),
  )
  const rows = Array.isArray(data) ? data : []
  const matchedSerial = findExactSerialMatch(normalizedSerial, rows)
  if (!matchedSerial) return null

  return (
      rows.find((row) => normalizeSerialCandidate(row.fridge_serial_number) === matchedSerial) ||
      null
  )
}

function queueReassignmentConfirmation(existingFridge: Fridge, requestedCNumber: string) {
  reassignmentConfirm.value = {
    open: true,
    existingSerial: existingFridge.fridge_serial_number,
    existingCNumber: cleanCNumber(String(existingFridge.c_number || '')),
    requestedCNumber,
    clearing: !requestedCNumber,
  }
}

function buildPlacementFormData(confirmReassignment: boolean) {
  const formData = new FormData()
  formData.append('serial_number', form.serial_number)
  formData.append('c_number', form.c_number)
  formData.append('organisation_id', String(store.mutationOrganisationScopeValue))
  if (confirmReassignment) formData.append('confirm_reassignment', 'true')
  if (locationLatitude.value != null) formData.append('latitude', String(locationLatitude.value))
  if (locationLongitude.value != null) formData.append('longitude', String(locationLongitude.value))
  for (const img of placementImages.value) {
    formData.append('images', img)
  }
  return formData
}

async function submitPlacement(confirmReassignment = false) {
  error.value = null
  success.value = null
  try {
    form.serial_number = normalizeSerialCandidate(form.serial_number)
    form.c_number = cleanCNumber(form.c_number)

    if (!form.serial_number) {
      error.value = 'Serial number is required.'
      return
    }

    if (!confirmReassignment) {
      const existingFridge = await findExistingFridge(form.serial_number)
      const existingCNumber = cleanCNumber(String(existingFridge?.c_number || ''))
      const requestedCNumber = cleanCNumber(form.c_number)

      if (existingFridge && existingCNumber && existingCNumber !== requestedCNumber) {
        queueReassignmentConfirmation(existingFridge, requestedCNumber)
        return
      }
    }

    submitting.value = true
    const result = await store.adminRequest<PlacementSuccess>(
        'placement:submit',
        store.withMutationOrganisationScope('/placements'),
        { method: 'POST', body: buildPlacementFormData(confirmReassignment) },
    )
    resetReassignmentConfirm()
    success.value = result
    form.serial_number = ''
    form.c_number = ''
    placementImages.value = []
    imagePreviews.value = []
  } catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : 'Submission failed.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AccessDeniedCard
      v-if="!store.canViewPlacement"
      title="Placement access denied"
      description="You do not have permission to view the Placement tab."
  />

  <Card v-else-if="!store.canSubmitPlacement && !store.canSubmitPlacementScanOnly" class="max-w-2xl">
    <div class="border-b border-slate-200 p-5">
      <div class="flex items-center gap-2">
        <MapPin class="h-4 w-4 text-[#006aea]" />
        <h2 class="text-lg font-semibold text-slate-900">Placement</h2>
      </div>
    </div>
    <div class="space-y-2 p-5">
      <p class="text-sm text-slate-700">
        You have view-only access to this tab.
      </p>
      <p class="text-sm text-slate-500">
        Manual entry and placement submission are available for Intermediate, Advanced, and Admin roles.
      </p>
    </div>
  </Card>

  <Card v-else class="max-w-2xl">
    <div class="border-b border-slate-200 p-5">
      <div class="flex items-center gap-2">
        <MapPin class="h-4 w-4 text-[#006aea]" />
        <h2 class="text-lg font-semibold text-slate-900">Placement</h2>
      </div>
      <p class="mt-1 text-sm text-slate-600">Record a new unit placement with serial number and images. MAC address is not captured on this screen.</p>
    </div>
    <div class="space-y-4 p-5">
      <div class="space-y-1">
        <div class="flex items-center justify-between gap-2">
          <label class="text-sm font-medium text-slate-700">Serial Number</label>
          <Button type="button" variant="outline" size="sm" class="gap-1" @click="scannerOpen = true; scannerError = null; scannerInfo = 'Use Start Scan to read the serial barcode from camera.'">
            <ScanLine class="h-4 w-4" />
            Scan Serial
          </Button>
        </div>
        <Input
            :model-value="form.serial_number"
            :placeholder="store.canSubmitPlacementScanOnly ? (form.serial_number || 'Scan a barcode to set serial') : 'Serial number'"
            :disabled="store.canSubmitPlacementScanOnly"
            @update:model-value="(value) => { form.serial_number = String(value || '').trim().toUpperCase() }"
        />
        <p v-if="store.canSubmitPlacementScanOnly" class="text-xs text-amber-600">Serial number must be set via barcode scan. This screen does not capture a MAC address.</p>
      </div>

      <div class="space-y-1">
        <label class="text-sm font-medium text-slate-700">C-Code / C-Number</label>
        <Input :model-value="form.c_number" placeholder="C-Code / C-Number" @update:model-value="(value) => form.c_number = cleanCNumber(String(value || ''))" />
      </div>

      <div class="space-y-1">
        <label class="text-sm font-medium text-slate-700">Device Images (Optional)</label>
        <input
            ref="imageInputRef"
            type="file"
            accept="image/*"
            multiple
            class="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 file:mr-3 file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            @change="handleImagesSelect"
        />
        <p class="text-xs text-slate-500">Select one or more images of the device. You can add more after each selection.</p>
        <div v-if="imagePreviews.length" class="flex flex-wrap gap-2 pt-1">
          <div v-for="(preview, i) in imagePreviews" :key="i" class="relative">
            <img :src="preview" alt="Preview" class="h-20 w-20 rounded-md border border-slate-200 object-cover" />
            <button
                type="button"
                class="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-white hover:bg-red-600"
                @click="removeImage(i)"
            >
              <span class="text-xs leading-none">✕</span>
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 text-sm">
        <span v-if="locationStatus === 'granted'" class="flex items-center gap-1.5 text-green-600">
          <span class="h-2 w-2 rounded-full bg-green-500" />
          Location enabled ({{ locationLatitude?.toFixed(4) }}, {{ locationLongitude?.toFixed(4) }})
        </span>
        <span v-else-if="locationStatus === 'denied'" class="flex items-center gap-1.5 text-amber-600">
          <span class="h-2 w-2 rounded-full bg-amber-500" />
          Location denied — coordinates won't be recorded
          <Button type="button" variant="link" size="sm" class="h-auto p-0 text-amber-700 underline" @click="requestLocation">Retry</Button>
        </span>
        <span v-else-if="locationStatus === 'unavailable'" class="flex items-center gap-1.5 text-slate-500">
          <span class="h-2 w-2 rounded-full bg-slate-400" />
          Geolocation not available in this browser
        </span>
        <span v-else class="flex items-center gap-1.5 text-slate-500">
          <span class="h-2 w-2 rounded-full bg-slate-400 animate-pulse" />
          Requesting location...
        </span>
      </div>

      <p v-if="error" class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{{ error }}</p>
      <p v-if="success" class="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
        Placement recorded for {{ success.serial_number }}{{ success.image_count ? ` with ${success.image_count} image${success.image_count !== 1 ? 's' : ''}` : '' }}.
      </p>

      <Button :disabled="submitting || !form.serial_number" @click="submitPlacement()">
        {{ submitting ? 'Submitting...' : `Submit Placement${form.serial_number ? ` for ${form.serial_number}` : ''}` }}
      </Button>
    </div>
  </Card>

  <ModalDialog :open="scannerOpen" title="Scan Serial Number" description="Use camera scan or upload a barcode image." max-width-class="max-w-2xl" @close="scannerOpen = false; resetScannerState()">
    <div class="space-y-4">
      <div class="flex gap-2">
        <Button :variant="scannerMode === 'camera' ? 'default' : 'outline'" @click="scannerMode = 'camera'; scannerInfo = 'Use Start Scan to read the serial barcode from camera.'">
          <Camera class="h-4 w-4" />
          Camera
        </Button>
        <Button :variant="scannerMode === 'upload' ? 'default' : 'outline'" @click="scannerMode = 'upload'; scannerInfo = 'Upload a barcode image to detect the serial.'">
          <Upload class="h-4 w-4" />
          Upload Image
        </Button>
      </div>

      <div v-if="scannerMode === 'camera'" class="space-y-3">
        <div class="relative overflow-hidden rounded-md border bg-black">
          <video ref="cameraVideoRef" class="h-64 w-full object-cover" autoplay muted playsinline />
          <div class="pointer-events-none absolute inset-0">
            <div class="absolute inset-4 rounded-xl border border-white/30" />
            <div v-if="cameraScanning" class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-cyan-200">Scanning barcode...</div>
          </div>
        </div>
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs text-slate-500">Position the barcode inside the frame, then start scanning.</p>
          <Button v-if="!cameraScanning" variant="outline" size="sm" @click="cameraScanning = true; cameraRestartKey += 1; scannerInfo = 'Scanning live camera for barcode...'">Start Scan</Button>
          <Button v-else variant="outline" size="sm" @click="cameraScanning = false; scannerInfo = 'Camera scan stopped. Start scan again or upload an image.'">Stop Scan</Button>
        </div>
      </div>

      <div v-else class="space-y-3">
        <input ref="fileInputRef" type="file" accept="image/*" capture="environment" class="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 file:mr-3 file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200" @change="handleImageScanFile">
        <p class="text-xs text-slate-500">Upload a clear image where the barcode is visible.</p>
      </div>

      <p class="text-sm text-slate-500">{{ scannerInfo }}</p>
      <p v-if="scannerError" class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{{ scannerError }}</p>
      <p v-if="scannerMatching || scannerDecodingImage" class="text-sm text-blue-700">{{ scannerDecodingImage ? 'Decoding image...' : 'Applying scanned serial...' }}</p>
    </div>
  </ModalDialog>

  <ModalDialog
      :open="reassignmentConfirm.open"
      title="Confirm Fridge Reassignment"
      :description="reassignmentConfirm.clearing ? 'This will remove the current customer assignment from the fridge.' : 'This will move the fridge to a different customer.'"
      @close="resetReassignmentConfirm()"
  >
    <div class="space-y-3 text-sm text-slate-700">
      <p>
        Fridge <span class="font-mono font-medium">{{ reassignmentConfirm.existingSerial }}</span>
        belongs to customer <span class="font-medium">{{ reassignmentConfirm.existingCNumber }}</span>.
      </p>
      <p v-if="reassignmentConfirm.clearing">
        Are you sure you want to remove the customer assignment from this fridge?
      </p>
      <p v-else>
        Are you sure you want to move it to customer <span class="font-medium">{{ reassignmentConfirm.requestedCNumber }}</span>?
      </p>
      <p class="text-xs text-slate-500">
        If the C-number changes, the fridge will be marked unverified.
      </p>
    </div>
    <template #footer>
      <Button variant="outline" :disabled="submitting" @click="resetReassignmentConfirm()">No</Button>
      <Button
          :disabled="submitting"
          @click="resetReassignmentConfirm(); submitPlacement(true)"
      >
        {{ submitting ? 'Submitting...' : 'Yes' }}
      </Button>
    </template>
  </ModalDialog>
</template>
