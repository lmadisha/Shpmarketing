<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

if (import.meta.client) {
  navigateTo('/admin/assets/inventory', { replace: true })
}
</script>
