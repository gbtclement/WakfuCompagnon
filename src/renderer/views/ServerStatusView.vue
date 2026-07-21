<template>
  <div>
    <h1>Serveur</h1>
    <p v-if="currentServer">Connecté à : {{ currentServer }}</p>
    <p v-else>Aucun serveur détecté pour le moment.</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/appState'

const store = useAppStore()

const currentServer = computed(() => {
  const event = store.liveEvents.find((e) => e.type === 'server-connection')
  return event && event.type === 'server-connection' ? event.server : null
})
</script>
