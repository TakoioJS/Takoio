<template>
  <div class="tk-footer">
    <span class="tk-footer-text">
      Powered by <a href="https://github.com/takoio/takoio" target="_blank">Takoio</a> v{{ version }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { version } from '../../utils'
</script>

<style scoped>
.tk-footer {
  margin-top: 24px;
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: inherit;
  opacity: .6;
}
.tk-footer-text a {
  color: inherit;
  opacity: .8;
}
</style>
