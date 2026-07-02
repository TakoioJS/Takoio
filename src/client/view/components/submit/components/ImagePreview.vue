<template>
  <div
    v-if="images.length"
    class="tk-image-previews"
  >
    <div
      v-for="(img, idx) in images"
      :key="idx"
      class="tk-image-thumb"
    >
      <img
        :src="img"
        :alt="altText"
        loading="lazy"
        decoding="async"
      >
      <button
        class="tk-image-remove"
        :title="removeLabel"
        @click="$emit('remove', idx)"
      >
        &times;
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  images: string[]
  altText?: string
  removeLabel?: string
}
defineProps<Props>()
defineEmits<{ (e: 'remove', idx: number): void }>()
</script>

<style scoped>
.tk-image-previews { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.tk-image-thumb { position: relative; width: 64px; height: 64px; border-radius: var(--tk-r-input); overflow: hidden; border: 1px solid var(--tk-border); }
.tk-image-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.tk-image-remove { position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; border-radius: 50%; border: none; background: color-mix(in srgb,var(--tk-text) 60%,transparent); color: #fff; font-size: 13px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
.tk-image-remove:hover { background: var(--tk-danger); }
</style>
