<template>
  <div>
    <div class="page-header">
      <h1 class="h1">Timers d'archimonstres</h1>
      <p class="subtitle">Suivi des respawns en temps réel</p>
    </div>

    <div class="timer-grid">
      <div v-for="timer in displayTimers" :key="timer.id" class="card timer-card">
        <div class="ring-outer">
          <div class="ring" :style="ringStyle(timer)">
            <div class="ring-inner">{{ timer.display }}</div>
          </div>
        </div>
        <span class="timer-name">{{ timer.name }}</span>
        <button class="delete-btn" @click="store.cancelTimer(timer.id)">Supprimer</button>
      </div>
    </div>

    <div class="panel">
      <h2 class="h2">Créer un timer</h2>
      <form class="timer-form" @submit.prevent="submit">
        <input v-model="name" class="field" placeholder="Nom de l'archimonstre" required />
        <input v-model.number="minutes" type="number" min="1" placeholder="min" class="minutes-field" required />
        <button type="submit" class="primary-btn">Lancer</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '../stores/appState'
import type { TimerRecord } from '../../main/store'

const store = useAppStore()
const name = ref('')
const minutes = ref(1)

function submit(): void {
  store.createTimer(name.value, minutes.value * 60_000)
  name.value = ''
  minutes.value = 1
}

function remainingMs(timer: TimerRecord): number {
  return Math.max(0, timer.endsAt - Date.now())
}

function format(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const displayTimers = computed(() =>
  store.config.timers.map((timer) => ({
    ...timer,
    display: format(remainingMs(timer)),
    remainingMs: remainingMs(timer)
  }))
)

function ringStyle(timer: { remainingMs: number; durationMs: number }): Record<string, string> {
  const pct = timer.durationMs > 0 ? Math.max(0, Math.min(100, (timer.remainingMs / timer.durationMs) * 100)) : 0
  const isLow = timer.remainingMs < 60_000 && timer.remainingMs > 0
  const ringColor = isLow ? 'var(--danger)' : 'var(--accent)'
  return {
    background: `conic-gradient(${ringColor} ${pct}%, var(--card-bg-alt) ${pct}%)`,
    boxShadow: isLow ? `0 0 16px ${ringColor}` : 'none'
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

.timer-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 22px;
}

.card {
  background: var(--card-bg);
  border: 1.5px solid var(--border);
  border-radius: 9px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.timer-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px 14px;
}

.ring-outer {
  width: 96px;
  height: 96px;
}

.ring {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ring-inner {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: var(--card-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Cinzel', serif;
  font-weight: 700;
  font-size: 16px;
  color: var(--text-primary);
}

.timer-name {
  font-weight: 700;
  color: var(--text-primary);
  font-size: 14.5px;
  text-align: center;
}

.delete-btn {
  background: transparent;
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 33%, transparent);
  border-radius: 7px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
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

.timer-form {
  display: flex;
  gap: 10px;
  align-items: center;
}

.field {
  flex: 1;
}

.minutes-field {
  width: 80px;
}

.primary-btn {
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: 7px;
  padding: 10px 18px;
  font-weight: 700;
  font-size: 13.5px;
  cursor: pointer;
  white-space: nowrap;
}
</style>
