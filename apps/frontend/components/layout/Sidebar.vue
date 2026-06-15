<script setup lang="ts">
import {
  FileBarChart,
  Server,
  Refrigerator,
  X,
  ChevronLeft,
} from "lucide-vue-next";
import { cn } from "~/utils/cn";
import { useAuth } from "~/composables/useAuth";
import { useSidebar } from "~/composables/useSidebar";
import { hasPermission } from "~/utils/permissionPolicy";

type NavigationItem = {
  name: string;
  href: string;
  icon: Component;
  disabled?: boolean;
  hidden?: boolean;
};

// Operational sections only. Account/admin destinations (Workspace, Settings)
// now live in the top-bar user menu, not here.
const navigation: NavigationItem[] = [
  { name: "Performance", href: "/performance-report", icon: FileBarChart },
  { name: "Unit Detail", href: "/unit", icon: Server },
  { name: "Asset Manager", href: "/admin/assets", icon: Refrigerator },
];

const route = useRoute();
const auth = useAuth();
const { isOpen, isCollapsed, close, toggleCollapsed } = useSidebar();

const permissionLevel = computed(() => auth.session?.user.permissions);

const canAccessAssetManager = computed(() =>
  permissionLevel.value
    ? (
        [
          "assets.create",
          "assets.view",
          "mismatches.view",
          "device_checker.view",
          "device_checker.submit",
          "placement.view",
          "placement.submit",
          "history.view",
        ] as const
      ).some((flag) => hasPermission(permissionLevel.value!, flag))
    : false,
);

function isActive(href: string) {
  if (href === "/") return route.path === "/";
  return route.path === href || route.path.startsWith(href);
}
</script>

<template>
  <!-- Overlay for mobile -->
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/50 z-30 lg:hidden"
    @click="close"
  />

  <!-- Sidebar -->
  <aside
    :class="
      cn(
        'bg-white border-r border-slate-200 flex flex-col max-lg:fixed inset-y-0 left-0 z-40 transition-all duration-300 ease-in-out shrink-0',
        !isOpen && 'max-lg:-translate-x-full',
        isCollapsed ? 'w-20' : 'w-64',
      )
    "
  >
    <div
      :class="
        cn(
          'h-16 flex items-center border-b border-slate-200',
          isCollapsed ? 'justify-center px-3' : 'px-4 justify-between',
        )
      "
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <img
          src="~/assets/css/img/FrostLinkLogoSymbol.svg"
          alt="Frostlink"
          :class="
            cn('h-10 w-10 shrink-0 rounded-sm', isCollapsed && 'cursor-pointer')
          "
          @click="isCollapsed ? toggleCollapsed() : undefined"
        />
        <span
          v-if="!isCollapsed"
          class="text-xl font-semibold text-slate-900 truncate"
          >Frostlink</span
        >
      </div>
      <!-- Mobile: close drawer. Desktop: collapse. -->
      <button
        class="shrink-0 h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors flex lg:hidden"
        @click="close"
        title="Close"
      >
        <X class="w-4 h-4" />
      </button>
      <button
        v-if="!isCollapsed"
        class="hidden lg:flex shrink-0 h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        @click="toggleCollapsed"
        title="Collapse Sidebar"
      >
        <ChevronLeft class="w-4 h-4" />
      </button>
    </div>

    <nav class="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
      <template v-for="item in navigation" :key="item.name">
        <template v-if="!item.hidden">
          <template
            v-if="!(item.href === '/admin/assets' && !canAccessAssetManager)"
          >
            <!-- Disabled item -->
            <div
              v-if="item.disabled"
              :class="
                cn(
                  'flex items-center rounded-lg text-sm text-slate-400 cursor-not-allowed opacity-60',
                  isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5',
                )
              "
              :title="isCollapsed ? item.name : undefined"
            >
              <component
                :is="item.icon"
                :class="cn('shrink-0', isCollapsed ? 'w-6 h-6' : 'w-5 h-5')"
              />
              <span v-if="!isCollapsed" class="truncate">{{ item.name }}</span>
            </div>

            <!-- Active nav link -->
            <NuxtLink
              v-else
              :to="item.href"
              :class="
                cn(
                  'flex items-center rounded-lg transition-colors text-sm font-medium',
                  isActive(item.href)
                    ? 'bg-[#006aea]/10 text-[#006aea]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5',
                )
              "
              :title="isCollapsed ? item.name : undefined"
              @click="close"
            >
              <component :is="item.icon" class="w-5 h-5 shrink-0" />
              <span v-if="!isCollapsed" class="truncate">{{ item.name }}</span>
            </NuxtLink>
          </template>
        </template>
      </template>
    </nav>
  </aside>
</template>
