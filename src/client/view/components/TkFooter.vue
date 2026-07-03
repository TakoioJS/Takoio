<template>
  <footer class="tk-footer">
    <span class="tk-footer-text">
      Powered by <a
        href="https://github.com/takoioJS/takoio"
        target="_blank"
        rel="noopener noreferrer"
      >Takoio</a> v{{ version }}
    </span>
  </footer>
</template>

<script setup lang="ts">
import { version } from '../../utils'
</script>

<style scoped>
.tk-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px 12px;
  font-size: 12px;
  color: var(--tk-text-tertiary);
  line-height: 1;
}
.tk-footer-text { display: inline-flex; align-items: center; gap: 4px; }
.tk-footer-text a { color: inherit; text-decoration: none; opacity: .7; transition: opacity .15s, color .15s; }
.tk-footer-text a:hover { opacity: 1; color: var(--tk-brand); }
</style>
