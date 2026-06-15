<script setup lang="ts">
import { computed } from 'vue'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from 'radix-vue'
import { ChevronDown, Users, Settings, LogOut } from 'lucide-vue-next'
import Avatar from '~/components/ui/Avatar.vue'
import { useAuth } from '~/composables/useAuth'
import { hasPermission } from '~/utils/permissionPolicy'

const auth = useAuth()

const user = computed(() => auth.session?.user ?? null)
const displayName = computed(() => user.value?.full_name || user.value?.username || 'User')
const permissionLevel = computed(() => user.value?.permissions)

const canAccessWorkspace = computed(() =>
  permissionLevel.value ? hasPermission(permissionLevel.value, 'workspace.view') : false,
)

const itemClass =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100 hover:text-slate-900 data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900'

function handleLogout() {
  auth.logout()
  navigateTo('/login')
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      class="flex items-center gap-2 rounded-lg p-1 pr-2 text-left transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 data-[state=open]:bg-slate-100"
      aria-label="Account menu"
    >
      <Avatar :name="displayName" size="md" />
      <span class="hidden min-w-0 flex-col leading-tight sm:flex">
        <span class="truncate text-sm font-medium text-slate-900">{{ displayName }}</span>
        <span class="truncate text-xs text-slate-500">{{ permissionLevel }}</span>
      </span>
      <ChevronDown class="h-4 w-4 shrink-0 text-slate-400" />
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="8"
        class="z-50 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 motion-reduce:animate-none"
      >
        <div class="flex items-center gap-3 border-b border-slate-200 p-3">
          <Avatar :name="displayName" size="lg" />
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-slate-900">{{ displayName }}</p>
            <p class="truncate text-xs text-slate-500">{{ user?.username }}</p>
          </div>
        </div>

        <div class="p-1.5">
          <DropdownMenuItem v-if="canAccessWorkspace" as-child>
            <NuxtLink to="/workspace" :class="itemClass">
              <Users class="h-4 w-4 shrink-0 text-slate-400" />
              Workspace
            </NuxtLink>
          </DropdownMenuItem>
          <DropdownMenuItem as-child>
            <NuxtLink to="/settings" :class="itemClass">
              <Settings class="h-4 w-4 shrink-0 text-slate-400" />
              Settings
            </NuxtLink>
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator class="h-px bg-slate-200" />

        <div class="p-1.5">
          <DropdownMenuItem
            class="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 outline-none transition-colors hover:bg-red-50 hover:text-red-700 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700"
            @select="handleLogout"
          >
            <LogOut class="h-4 w-4 shrink-0" />
            Sign out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
