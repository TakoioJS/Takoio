<template>
  <div class="sensitive-input">
    <template v-if="hasValue && !editing">
      <div class="sensitive-set">
        <n-tag type="success" size="small" round>✓ 已配置</n-tag>
        <n-input
          :value="''"
          placeholder="输入新值替换"
          type="password"
          show-password-on="click"
          @focus="onFocus"
          @update:value="$emit('update:modelValue', $event)"
        />
        <n-button size="small" quaternary @click="onClear" title="清除">
          <template #icon><n-icon size="14"><CloseOutline /></n-icon></template>
        </n-button>
      </div>
    </template>
    <template v-else>
      <n-input
        :value="modelValue"
        type="password"
        show-password-on="click"
        :placeholder="placeholder"
        clearable
        @update:value="$emit('update:modelValue', $event)"
        @blur="onBlur"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NTag, NInput, NButton, NIcon } from 'naive-ui'
import { CloseOutline } from '@vicons/ionicons5'

interface Props {
  modelValue: string
  hasValue?: boolean
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  hasValue: false,
  placeholder: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editing = ref(false)

const onFocus = () => {
  if (props.hasValue) {
    editing.value = true
  }
}

const onBlur = () => {
  if (!props.modelValue) {
    editing.value = false
  }
}

const onClear = () => {
  emit('update:modelValue', '')
  editing.value = false
}
</script>

<style scoped>
.sensitive-input { width: 100%; }
.sensitive-set {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sensitive-set .n-input { flex: 1; }
</style>
