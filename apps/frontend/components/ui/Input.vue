<script setup lang="ts">
import type { ClassValue } from "clsx";
import { ref } from "vue";
import { cn } from "~/utils/cn";

const model = defineModel<string | number | undefined>();

const props = withDefaults(
  defineProps<{
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    readonly?: boolean;
    autocomplete?: string;
    accept?: string;
    capture?: boolean | "user" | "environment";
    min?: string | number;
    max?: string | number;
    maxLength?: number;
    class?: ClassValue;
  }>(),
  {
    type: "text",
  },
);

const emit = defineEmits<{
  change: [event: Event];
}>();

const inputEl = ref<HTMLInputElement | null>(null);

function focus() {
  inputEl.value?.focus();
}

defineExpose({ focus, el: inputEl });
</script>

<template>
  <input
    ref="inputEl"
    :value="model"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :required="required"
    :readonly="readonly"
    :autocomplete="autocomplete"
    :accept="accept"
    :capture="capture"
    :min="min"
    :max="max"
    :maxlength="maxLength"
    :class="
      cn(
        'flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
        props.class,
      )
    "
    @input="model = ($event.target as HTMLInputElement).value as string"
    @change="emit('change', $event)"
  />
</template>
