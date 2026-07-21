<template>
  <div>
    <h1>Timers d'archimonstres</h1>
    <form @submit.prevent="submit">
      <input v-model="name" placeholder="Nom (ex: Boss X)" required />
      <input v-model.number="minutes" type="number" min="1" placeholder="Minutes" required />
      <button type="submit">Créer le timer</button>
    </form>
    <ul>
      <li v-for="timer in store.config.timers" :key="timer.id">
        {{ timer.name }} — {{ remaining(timer.endsAt) }}
        <button @click="store.cancelTimer(timer.id)">Annuler</button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from '../stores/appState'

const store = useAppStore()
const name = ref('')
const minutes = ref(1)

function submit(): void {
  store.createTimer(name.value, minutes.value * 60_000)
  name.value = ''
  minutes.value = 1
}

function remaining(endsAt: number): string {
  const ms = Math.max(0, endsAt - Date.now())
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}m ${s}s`
}
</script>
