<template>
  <!-- Switch -->
  <n-switch
    v-if="field.type === 'switch'"
    :value="modelValue"
    size="small"
    @update:value="emit('update:modelValue', $event)"
  />

  <!-- Select / Tag-Select -->
  <n-select
    v-else-if="field.type === 'select' || field.type === 'tag-select'"
    :value="modelValue"
    :options="field.options"
    :clearable="!!field.clearable"
    :filterable="field.filterable || field.type === 'tag-select'"
    :tag="field.tag || field.type === 'tag-select'"
    size="small"
    @update:value="emit('update:modelValue', $event)"
  />

  <!-- Number -->
  <n-input-number
    v-else-if="field.type === 'number'"
    :value="modelValue"
    :min="field.min"
    :max="field.max"
    size="small"
    style="width: 100%"
    @update:value="emit('update:modelValue', $event)"
  />

  <!-- Color -->
  <div
    v-else-if="field.type === 'color'"
    class="color-row"
  >
    <n-input
      :value="modelValue"
      :placeholder="field.placeholder"
      size="small"
      @update:value="emit('update:modelValue', $event)"
    />
    <div class="color-picker-wrap">
      <n-color-picker
        :value="modelValue"
        :show-alpha="false"
        :swatches="colorSwatches"
        size="small"
        @update:value="emit('update:modelValue', $event)"
      />
    </div>
  </div>

  <!-- Slider -->
  <div
    v-else-if="field.type === 'slider'"
    class="slider-row"
  >
    <n-slider
      :value="modelValue"
      :min="field.min"
      :max="field.max"
      :step="field.step"
      :disabled="field.disabled?.(config)"
      size="small"
      @update:value="emit('update:modelValue', $event)"
    />
    <span class="slider-value">{{ modelValue }}</span>
  </div>

  <!-- Textarea -->
  <n-input
    v-else-if="field.type === 'textarea'"
    :value="modelValue"
    type="textarea"
    :rows="field.rows || 4"
    :placeholder="field.placeholder"
    size="small"
    @update:value="emit('update:modelValue', $event)"
  />

  <!-- Checkbox group -->
  <n-checkbox-group
    v-else-if="field.type === 'checkbox-group'"
    :value="modelValue"
    @update:value="emit('update:modelValue', $event)"
  >
    <n-space>
      <n-checkbox
        v-for="opt in field.options"
        :key="opt.value"
        :value="opt.value"
      >
        {{ opt.label }}
      </n-checkbox>
    </n-space>
  </n-checkbox-group>

  <!-- Sensitive input -->
  <SensitiveInput
    v-else-if="field.type === 'sensitive'"
    :model-value="modelValue"
    :has-value="!!hasSavedValue"
    :placeholder="field.placeholder"
    @update:model-value="emit('update:modelValue', $event)"
  />

  <!-- Input (default) -->
  <n-input
    v-else
    :value="modelValue"
    :placeholder="field.placeholder"
    size="small"
    @update:value="emit('update:modelValue', $event)"
  />
</template>

<script setup lang="ts">
import type { ConfigField } from '../schema'
import SensitiveInput from '../../../components/SensitiveInput.vue'

defineProps<{
  field: ConfigField
  modelValue: any
  hasSavedValue?: boolean
  config: Record<string, any>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

const colorSwatches = ['#5E8C6A', '#8A7C5E', '#8A5E5E', '#5E6E8A', '#B98A4B', '#B0524F', '#5E8A7C', '#8A5E7C', '#6B655A', '#8A8478', '#2B2825', '#1A1815']
</script>

<style scoped>
.color-row {
  display: flex;
  gap: 8px;
  align-items: center;
  max-width: 300px;
}
.color-row .n-input {
  flex: 1;
  min-width: 0;
}
.color-picker-wrap {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  overflow: hidden;
  border-radius: 4px;
}
.color-picker-wrap :deep(.n-color-picker) {
  width: 100%;
  height: 100%;
}
.color-picker-wrap :deep(.n-color-picker-trigger__value) {
  display: none;
}
.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.slider-row :deep(.n-slider) { flex: 1; }
.slider-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
  min-width: 30px;
  text-align: right;
}
</style>
