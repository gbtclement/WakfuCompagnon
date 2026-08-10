<template>
  <button
    v-if="state !== 'idle'"
    class="update-badge"
    :class="{ 'update-badge-error': state === 'error' }"
    :disabled="state === 'downloading' || state === 'ready'"
    @click="onClick"
  >
    <span class="update-dot"></span>
    <span v-if="state === 'available'">Mise à jour disponible ({{ version }})</span>
    <span v-else-if="state === 'downloading'">Téléchargement... {{ Math.round(percent) }}%</span>
    <span v-else-if="state === 'ready'">Redémarrage en cours...</span>
    <span v-else-if="state === 'error'">Échec de la mise à jour — réessayer ({{ version }})</span>
  </button>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

type UpdateState = 'idle' | 'available' | 'downloading' | 'ready' | 'error'

const state = ref<UpdateState>('idle')
const version = ref('')
const percent = ref(0)

onMounted(() => {
  window.wakfuApi.onUpdateAvailable((info) => {
    version.value = info.version
    state.value = 'available'
  })
  window.wakfuApi.onUpdateDownloadProgress((info) => {
    percent.value = info.percent
    state.value = 'downloading'
  })
  window.wakfuApi.onUpdateDownloaded(() => {
    state.value = 'ready'
  })
  window.wakfuApi.onUpdateError(() => {
    state.value = 'error'
  })
})

function onClick(): void {
  if (state.value !== 'available' && state.value !== 'error') return
  state.value = 'downloading'
  percent.value = 0
  window.wakfuApi.downloadUpdate()
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

.update-badge:disabled {
  cursor: default;
  opacity: 0.85;
}

.update-badge-error {
  background: color-mix(in srgb, var(--danger, #d9534f) 18%, transparent);
  color: var(--danger, #d9534f);
  border-color: color-mix(in srgb, var(--danger, #d9534f) 45%, transparent);
}

.update-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 8px currentColor;
  flex-shrink: 0;
}
</style>
