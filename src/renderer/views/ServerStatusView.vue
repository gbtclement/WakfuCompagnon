<template>
  <div>
    <div class="page-header">
      <h1 class="h1">Tableau de bord</h1>
      <p class="subtitle">Vue d'ensemble de l'activité détectée en jeu</p>
    </div>

    <div class="stat-grid">
      <div class="card stat-card">
        <span class="stat-label">Serveur</span>
        <span class="stat-value">{{ currentServer ?? 'Non détecté' }}</span>
        <span class="stat-sub" :class="currentServer ? 'stat-sub-success' : ''">
          {{ currentServer ? '● En ligne' : 'En attente de connexion' }}
        </span>
      </div>
      <div class="card stat-card">
        <span class="stat-label">Connexion aux logs</span>
        <span class="stat-value">{{ store.config.logPath ? 'Active' : 'Non configurée' }}</span>
        <span class="stat-sub">{{ store.config.logPath ?? 'Configure le chemin dans Paramètres' }}</span>
      </div>
      <div class="card stat-card">
        <span class="stat-label">Timers actifs</span>
        <span class="stat-value">{{ store.config.timers.length }}</span>
        <span class="stat-sub">archimonstres en cours</span>
      </div>
    </div>

    <div class="panel">
      <h2 class="h2">Derniers événements</h2>
      <div v-if="recentEvents.length === 0" class="empty-text">Rien à signaler pour l'instant.</div>
      <div v-for="(event, index) in recentEvents" :key="index" class="event-row">
        <span class="event-dot" :class="dotClass(event)"></span>
        <span class="event-text">{{ describe(event) }}</span>
        <span class="event-time">{{ event.timestamp }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/appState'
import type { WakfuEvent } from '../../main/parsers/types'

const store = useAppStore()

const currentServer = computed(() => {
  const event = store.liveEvents.find((e) => e.type === 'server-connection')
  return event && event.type === 'server-connection' ? event.server : null
})

const recentEvents = computed(() => store.liveEvents.slice(0, 5))

function dotClass(event: WakfuEvent): string {
  if (event.type === 'quest-completed' || event.type === 'achievement') return 'event-dot-gold'
  if (event.type === 'quest-failed') return 'event-dot-danger'
  return 'event-dot-accent'
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

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-bottom: 22px;
}

.card {
  background: var(--card-bg);
  border: 1.5px solid var(--border);
  border-radius: 9px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 16px 18px;
  min-width: 0;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-family: 'Cinzel', serif;
  font-size: 19px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-sub {
  font-size: 12.5px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-sub-success {
  color: var(--success);
}

.panel {
  background: var(--panel-bg);
  border: 2px solid var(--border);
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--border-strong) 20%, transparent);
  padding: 20px 22px;
  margin-bottom: 18px;
}

.h2 {
  font-family: 'Cinzel', serif;
  font-weight: 600;
  font-size: 16px;
  color: var(--gold);
  margin: 0 0 14px 0;
}

.empty-text {
  font-size: 13.5px;
  color: var(--text-secondary);
}

.event-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 33%, transparent);
}

.event-row:last-child {
  border-bottom: none;
}

.event-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.event-dot-accent {
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.event-dot-gold {
  background: var(--gold);
  box-shadow: 0 0 8px var(--gold);
}

.event-dot-danger {
  background: var(--danger);
  box-shadow: 0 0 8px var(--danger);
}

.event-text {
  flex: 1;
  color: var(--text-primary);
  font-size: 14px;
}

.event-time {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
