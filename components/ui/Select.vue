<script setup lang="ts">
import { Check, ChevronDown, Search } from "lucide-vue-next";
import { onClickOutside } from "@vueuse/core";
import type { ClassValue } from "clsx";
import { cn } from "~/utils/cn";

type Option = {
  value: string;
  label: string;
  disabled?: boolean;
};

const model = defineModel<string>();

const props = withDefaults(
  defineProps<{
    options: Option[];
    placeholder?: string;
    disabled?: boolean;
    searchable?: boolean;
    searchPlaceholder?: string;
    class?: ClassValue;
  }>(),
  {
    placeholder: "Select...",
    searchPlaceholder: "Search...",
  },
);

const emit = defineEmits<{
  search: [query: string];
}>();

const isOpen = ref(false);
const searchQuery = ref("");
const searchInputRef = ref<HTMLInputElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);

const selectedOption = computed(() =>
  props.options.find((o) => o.value === model.value),
);
const displayLabel = computed(
  () => selectedOption.value?.label ?? props.placeholder,
);
const hasValue = computed(() => selectedOption.value !== undefined);

// For non-searchable mode, filter client-side. For searchable, parent drives the list.
const visibleOptions = computed(() =>
  props.searchable
    ? props.options
    : props.options.filter(
        (o) =>
          !searchQuery.value ||
          o.label.toLowerCase().includes(searchQuery.value.toLowerCase()),
      ),
);

onClickOutside(containerRef, () => close());

function open() {
  if (props.disabled) return;
  isOpen.value = true;
  searchQuery.value = "";
  nextTick(() => searchInputRef.value?.focus());
}

function close() {
  isOpen.value = false;
  searchQuery.value = "";
}

function toggle() {
  isOpen.value ? close() : open();
}

function select(option: Option) {
  if (option.disabled) return;
  model.value = option.value;
  close();
}

function onSearchInput(e: Event) {
  const q = (e.target as HTMLInputElement).value;
  searchQuery.value = q;
  emit("search", q);
}
</script>

<template>
  <div ref="containerRef" class="relative w-full">
    <button
      type="button"
      :disabled="disabled"
      :class="
        cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm transition focus:border-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
          hasValue ? 'text-slate-900' : 'text-slate-400',
          props.class,
        )
      "
      @click="toggle"
    >
      <span class="truncate">{{ displayLabel }}</span>
      <ChevronDown
        :class="
          cn(
            'h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150',
            isOpen && 'rotate-180',
          )
        "
      />
    </button>

    <Transition
      enter-active-class="transition ease-out duration-100 origin-top"
      enter-from-class="opacity-0 scale-y-95"
      enter-to-class="opacity-100 scale-y-100"
      leave-active-class="transition ease-in duration-75 origin-top"
      leave-from-class="opacity-100 scale-y-100"
      leave-to-class="opacity-0 scale-y-95"
    >
      <div
        v-if="isOpen"
        class="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
      >
        <!-- Search input -->
        <div v-if="searchable" class="border-b border-slate-100 px-2 py-2">
          <div class="relative">
            <Search
              class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              ref="searchInputRef"
              :value="searchQuery"
              type="text"
              :placeholder="searchPlaceholder"
              class="h-8 w-full rounded border border-slate-200 bg-white pl-7 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
              @input="onSearchInput"
              @keydown.escape="close"
            />
          </div>
        </div>

        <!-- Options list -->
        <div class="max-h-52 overflow-y-auto py-1">
          <button
            v-for="option in visibleOptions"
            :key="option.value"
            type="button"
            :disabled="option.disabled"
            :class="
              cn(
                'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                model === option.value
                  ? 'bg-[#006aea]/10 text-[#006aea] font-medium'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
                option.disabled && 'cursor-not-allowed opacity-40',
              )
            "
            @click="select(option)"
          >
            <Check
              :class="
                cn(
                  'h-3.5 w-3.5 shrink-0',
                  model === option.value
                    ? 'opacity-100 text-[#006aea]'
                    : 'opacity-0',
                )
              "
            />
            <span class="truncate">{{ option.label }}</span>
          </button>
          <p
            v-if="visibleOptions.length === 0"
            class="px-3 py-2 text-sm text-slate-400"
          >
            {{ searchQuery ? "No results found." : "No options available." }}
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>
