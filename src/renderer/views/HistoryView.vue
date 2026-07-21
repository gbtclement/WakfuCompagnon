<template>
  <div>
    <h1>Historique de la session</h1>
    <ul>
      <li v-for="(event, index) in store.liveEvents" :key="index">
        {{ event.timestamp }} — {{ describe(event) }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '../stores/appState'
import type { WakfuEvent } from '../../main/parsers/types'

const store = useAppStore()

function describe(event: WakfuEvent): string {
  switch (event.type) {
    case 'server-connection':
      return `Connexion au serveur ${event.server}`
    case 'environmental-quest':
      return event.challengeId === -1
        ? 'Aucun challenge actif'
        : `Challenge actif : #${event.challengeId}`
    case 'quest-completed':
      return `Quête remportée : ${event.questName}`
    case 'quest-failed':
      return `Quête échouée : ${event.questName}`
    case 'achievement':
      return `Haut fait débloqué : #${event.achievementId}`
  }
}
</script>
