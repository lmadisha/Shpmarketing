<script setup lang="ts">
import { Camera, MapPin, ScanLine, Upload } from 'lucide-vue-next'
import Card from '~/components/ui/Card.vue'
import Input from '~/components/ui/Input.vue'
import Button from '~/components/ui/Button.vue'
import ModalDialog from '~/components/ui/ModalDialog.vue'
import AccessDeniedCard from '~/components/auth/AccessDeniedCard.vue'
import { cleanCNumber, cleanHex12 } from '~/utils/adminAssets'
import { normalizeSerialCandidate } from '~/utils/serialLookup'
import { decodeSerialFromImageFile, startCameraSerialScan, type CameraScannerSession } from '~/utils/serialScanner'

type PlacementForm = {
  serial_number: string
  mac_address: string
  c_number: string
}

type PlacementSuccess = {
  result: 'PLACED'
  serial_number: string
  image_count: number
}

type BluetoothDeviceRequest = {
  name?: string | null
}

type BluetoothNavigator = Navigator & {
  bluetooth?: {
    requestDevice: (options: { filters: Array<{ namePrefix: string }> }) => Promise<BluetoothDeviceRequest>
  }
}

function parsePenguinMacAddress(deviceName: string | null | undefined): string | null {
  const name = String(deviceName || '').trim()
  if (!name.startsWith('Penguin+')) return null
  const parsedMac = cleanHex12(name.slice('Penguin+'.length))
  return parsedMac.length === 12 ? parsedMac : null
}

const store = useAdminAssetsStore()
const bluetoothNavigator = typeof navigator !== 'undefined' ? (navigator as BluetoothNavigator) : null
const isSecureContextNow = typeof window !== 'undefined' && window.isSecureContext
const browserUserAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
const isIosChrome = /CriOS/i.test(browserUserAgent)
const bluetoothSupported = isSecureContextNow && Boolean(bluetoothNavigator?.bluetooth)
const bluetoothUnavailableReason = !isSecureContextNow
  ? 'Bluetooth scan requires HTTPS or localhost.'
  : isIosChrome && !bluetoothNavigator?.bluetooth
    ? 'Bluetooth scan is not available in Chrome on iPhone. Use Safari, or paste the Penguin+ device name below.'
  : !bluetoothNavigator?.bluetooth
    ? 'Bluetooth scan is not available in this browser. Paste the Penguin+ device name below.'
    : ''

const form = reactive<PlacementForm>({
  serial_number: '',
  mac_address: '',
  c_number: '',
})
const placementImages = ref<File[]>([])
const imagePreviews = ref<string[]>([])
const imageInputRef = ref<HTMLInputElement | null>(null)
const submitting = ref(false)
const error = ref<string | null>(null)
const success = ref<PlacementSuccess | null>(null)

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

const bluetoothBusy = ref(false)
const bluetoothMessage = ref<string | null>(null)
const bluetoothConfirm = ref<{ open: boolean; deviceName: string; macAddress: string }>({
  open: false,
  deviceName: '',
  macAddress: '',
})
const bluetoothManualEntry = ref<{ open: boolean; deviceName: string; error: string | null }>({
  open: false,
  deviceName: '',
  error: null,
})

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

async function requestBluetoothMacAddress() {
  error.value = null
  success.value = null
  bluetoothMessage.value = null
  if (!bluetoothSupported || !bluetoothNavigator?.bluetooth) {
    bluetoothMessage.value = bluetoothUnavailableReason || 'Bluetooth is not available in this browser.'
    return
  }
  bluetoothBusy.value = true
  try {
    const device = await bluetoothNavigator.bluetooth.requestDevice({ filters: [{ namePrefix: 'Penguin+' }] })
    const deviceName = String(device.name || '').trim()
    const parsedMac = parsePenguinMacAddress(deviceName)
    if (!deviceName || !parsedMac) {
      bluetoothMessage.value = 'Selected device name does not contain a valid Penguin+ MAC address.'
      return
    }
    bluetoothConfirm.value = { open: true, deviceName, macAddress: parsedMac }
  } catch (requestError) {
    bluetoothMessage.value = requestError instanceof Error ? requestError.message : 'Bluetooth device request failed.'
  } finally {
    bluetoothBusy.value = false
  }
}

function openBluetoothManualEntry() {
  bluetoothManualEntry.value = { open: true, deviceName: '', error: null }
}

function applyBluetoothDeviceName(deviceNameInput: string) {
  const deviceName = String(deviceNameInput || '').trim()
  const parsedMac = parsePenguinMacAddress(deviceName)
  if (!deviceName || !parsedMac) {
    bluetoothManualEntry.value.error = 'Enter a valid Penguin+ device name, for example Penguin+001122AABBCC.'
    return
  }
  form.mac_address = parsedMac
  bluetoothMessage.value = `Loaded MAC address from ${deviceName}.`
  bluetoothManualEntry.value = { open: false, deviceName: '', error: null }
}

async function submitPlacement() {
  error.value = null
  success.value = null
  submitting.value = true
  try {
    const formData = new FormData()
    formData.append('serial_number', form.serial_number)
    formData.append('mac_address', form.mac_address)
    formData.append('c_number', form.c_number)
    formData.append('organisation_id', String(store.mutationOrganisationScopeValue))
    if (locationLatitude.value != null) formData.append('latitude', String(locationLatitude.value))
    if (locationLongitude.value != null) formData.append('longitude', String(locationLongitude.value))
    for (const img of placementImages.value) {
      formData.append('images', img)
    }
    const result = await store.adminRequest<PlacementSuccess>(
      'placement:submit',
      store.withMutationOrganisationScope('/placements'),
      { method: 'POST', body: formData },
    )
    success.value = result
    form.serial_number = ''
    form.mac_address = ''
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
    v-if="!store.canSubmitPlacement"
    title="Placement access denied"
    description="You do not have permission to submit placements."
  />

  <Card v-else class="max-w-2xl">
    <div class="border-b border-slate-200 p-5">
      <div class="flex items-center gap-2">
        <MapPin class="h-4 w-4 text-[#006aea]" />
        <h2 class="text-lg font-semibold text-slate-900">Placement</h2>
      </div>
      <p class="mt-1 text-sm text-slate-600">Record a new unit placement with serial number, MAC address, and images.</p>
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
          placeholder="Serial number"
          @update:model-value="(value) => { form.serial_number = String(value || '').trim().toUpperCase() }"
        />
      </div>

      <div class="space-y-1">
        <label class="text-sm font-medium text-slate-700">MAC Address</label>
        <div class="flex gap-2">
          <Input :model-value="form.mac_address" placeholder="MAC Address (12 hex chars)" @update:model-value="(value) => { bluetoothMessage = null; form.mac_address = cleanHex12(String(value || '')) }" />
          <Button
            type="button"
            variant="outline"
            :disabled="submitting || bluetoothBusy"
            @click="bluetoothSupported ? requestBluetoothMacAddress() : openBluetoothManualEntry()"
          >
            {{ bluetoothSupported ? (bluetoothBusy ? 'Scanning...' : 'Scan via Bluetooth') : 'Paste Penguin+ Name' }}
          </Button>
        </div>
        <p class="text-xs text-slate-500">{{ bluetoothSupported ? 'Bluetooth scan only matches devices whose name starts with Penguin+.' : bluetoothUnavailableReason }}</p>
        <p v-if="bluetoothMessage" class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">{{ bluetoothMessage }}</p>
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

      <Button :disabled="submitting || !form.serial_number" @click="submitPlacement">
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

  <ModalDialog :open="bluetoothConfirm.open" title="Confirm Bluetooth Device" description="Use the MAC address parsed from the selected Penguin+ device?" @close="bluetoothConfirm = { open: false, deviceName: '', macAddress: '' }">
    <div class="space-y-3 text-sm">
      <div>
        <p class="font-medium">Device</p>
        <p class="text-slate-500">{{ bluetoothConfirm.deviceName }}</p>
      </div>
      <div>
        <p class="font-medium">MAC Address</p>
        <p class="font-mono text-slate-500">{{ bluetoothConfirm.macAddress }}</p>
      </div>
    </div>
    <template #footer>
      <Button variant="outline" @click="bluetoothConfirm = { open: false, deviceName: '', macAddress: '' }">Cancel</Button>
      <Button @click="form.mac_address = bluetoothConfirm.macAddress; bluetoothMessage = `Loaded MAC address from ${bluetoothConfirm.deviceName}.`; bluetoothConfirm = { open: false, deviceName: '', macAddress: '' }">Use MAC Address</Button>
    </template>
  </ModalDialog>

  <ModalDialog :open="bluetoothManualEntry.open" title="Paste Penguin+ Device Name" description="Paste the Bluetooth device name shown in iPhone Bluetooth settings." @close="bluetoothManualEntry = { open: false, deviceName: '', error: null }">
    <div class="space-y-3">
      <Input
        :model-value="bluetoothManualEntry.deviceName"
        placeholder="Penguin+001122AABBCC"
        @update:model-value="(value) => { bluetoothManualEntry.error = null; bluetoothManualEntry.deviceName = String(value || '').trim() }"
      />
      <p class="text-xs text-slate-500">Expected format: <span class="font-mono">Penguin+001122AABBCC</span></p>
      <p v-if="bluetoothManualEntry.error" class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{{ bluetoothManualEntry.error }}</p>
    </div>
    <template #footer>
      <Button variant="outline" @click="bluetoothManualEntry = { open: false, deviceName: '', error: null }">Cancel</Button>
      <Button @click="applyBluetoothDeviceName(bluetoothManualEntry.deviceName)">Use MAC Address</Button>
    </template>
  </ModalDialog>
</template>
