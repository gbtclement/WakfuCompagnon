<template>
  <div>
    <div class="page-header">
      <h1 class="h1">Historique de la session</h1>
      <p class="subtitle">Événements détectés depuis le lancement de l'application</p>
    </div>

    <div class="panel">
      <div v-if="store.liveEvents.length === 0" class="empty-text">Aucun événement pour l'instant.</div>
      <div v-for="(event, index) in store.liveEvents" :key="index" class="history-row">
        <span class="history-time">{{ event.timestamp }}</span>
        <span class="type-badge" :class="badgeClass(event)">{{ typeLabel(event) }}</span>
        <span class="history-text">{{ describe(event) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '../stores/appState'
import type { WakfuEvent } from '../../main/parsers/types'

const store = useAppStore()

function typeLabel(event: WakfuEvent): string {
  switch (event.type) {
    case 'server-connection':
      return 'Serveur'
    case 'environmental-quest':
      return 'Challenge'
    case 'quest-completed':
      return 'Quête'
    case 'quest-failed':
      return 'Quête'
    case 'achievement':
      return 'Haut fait'
  }
}

function badgeClass(event: WakfuEvent): string {
  if (event.type === 'quest-completed' || event.type === 'achievement') return 'type-badge-gold'
  if (event.type === 'quest-failed') return 'type-badge-danger'
  return 'type-badge-accent'
}

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

<style scoped>
.page-header {
  margin-bottom: 24px;
}

.h1 {
  font-family: 'Cinzel', serif;
  font-weight: 700;
  font-size: 28px;
  color: var(--text-primary);
  letter-spacing: 0.3px;
}

.subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 6px 0 0 0;
}

.panel {
  background: var(--panel-bg);
  border: 2px solid var(--border);
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--border-strong) 20%, transparent);
  padding: 20px 22px;
  margin-bottom: 18px;
}

.empty-text {
  font-size: 13.5px;
  color: var(--text-secondary);
}

.history-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 9px 4px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 33%, transparent);
}

.history-row:last-child {
  border-bottom: none;
}

.history-time {
  font-size: 12px;
  color: var(--text-secondary);
  width: 74px;
  flex-shrink: 0;
}

.type-badge {
  font-size: 11.5px;
  font-weight: 700;
  border-radius: 6px;
  padding: 3px 9px;
  width: 70px;
  text-align: center;
  flex-shrink: 0;
}

.type-badge-gold {
  color: var(--gold);
  background: var(--gold-soft);
}

.type-badge-accent {
  color: var(--accent);
  background: var(--accent-soft);
}

.type-badge-danger {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 16%, transparent);
}

.history-text {
  color: var(--text-primary);
  font-size: 13.5px;
  flex: 1;
}
</style>
