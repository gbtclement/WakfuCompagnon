<template>
  <button v-if="updateInfo" class="update-badge" @click="openRelease">
    <span class="update-dot"></span>
    Mise à jour disponible ({{ updateInfo.version }})
  </button>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { UpdateInfo } from '../../main/updateCheck'

const updateInfo = ref<UpdateInfo | null>(null)

onMounted(async () => {
  updateInfo.value = await window.wakfuApi.checkForUpdate()
})

function openRelease(): void {
  if (updateInfo.value) {
    window.wakfuApi.openExternal(updateInfo.value.releaseUrl)
  }
}
</script>

<style scoped>
.update-badge {
  position: fixed;
  top: 14px;
  right: 18px;
  z-index: 90;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--gold-soft);
  color: var(--gold);
  border: 1px solid color-mix(in srgb, var(--gold) 45%, transparent);
  border-radius: 20px;
  padding: 7px 14px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 0 10px color-mix(in srgb, var(--gold) 25%, transparent);
}

.update-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--gold);
  box-shadow: 0 0 8px var(--gold);
  flex-shrink: 0;
}
</style>
