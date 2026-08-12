<template>
  <div>
    <div class="page-header">
      <h1 class="h1">Amis</h1>
      <p class="subtitle">
        Ton code ami : <span class="friend-code">{{ authStore.user?.friendCode }}</span>
      </p>
    </div>

    <div class="panel">
      <h2 class="h2">Ajouter un ami</h2>
      <form class="add-friend-row" @submit.prevent="sendRequest">
        <input v-model="friendCodeInput" class="field full-input" type="text" placeholder="WC-XXXXXX" />
        <button class="primary-btn" type="submit">Envoyer</button>
      </form>
      <p v-if="sendError" class="error-text">{{ sendError }}</p>
    </div>

    <div class="panel" v-if="friendsStore.pendingRequests.length > 0">
      <h2 class="h2">Demandes reçues</h2>
      <div v-for="req in friendsStore.pendingRequests" :key="req.id" class="request-row">
        <span>{{ req.fromUsername }}</span>
        <div class="request-actions">
          <button class="secondary-btn" @click="friendsStore.accept(req.id)">Accepter</button>
          <button class="secondary-btn" @click="friendsStore.reject(req.id)">Refuser</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <h2 class="h2">Mes métiers</h2>
      <h3 class="category-label">Récolte</h3>
      <div v-for="job in myRecolteJobs" :key="job.jobName" class="job-row">
        <div class="job-name">
          <img :src="JOB_ICONS[job.jobName]" :alt="job.jobName" class="job-icon" />
          <span class="job-label">{{ job.jobName }}</span>
        </div>
        <input
          class="field job-input"
          type="number"
          min="0"
          max="155"
          :value="job.level"
          @change="onManualJobChange(job.jobName, $event)"
        />
      </div>
      <h3 class="category-label">Artisanat</h3>
      <div v-for="job in myArtisanatJobs" :key="job.jobName" class="job-row">
        <div class="job-name">
          <img :src="JOB_ICONS[job.jobName]" :alt="job.jobName" class="job-icon" />
          <span class="job-label">{{ job.jobName }}</span>
        </div>
        <input
          class="field job-input"
          type="number"
          min="0"
          max="155"
          :value="job.level"
          @change="onManualJobChange(job.jobName, $event)"
        />
      </div>
    </div>

    <div class="panel">
      <h2 class="h2">Liste d'amis</h2>
      <p v-if="friendsStore.friends.length === 0" class="subtitle">Aucun ami pour le moment.</p>
      <div v-for="friend in friendsStore.friends" :key="friend.username" class="friend-block">
        <h3 class="friend-name">{{ friend.username }}</h3>
        <h4 class="category-label">Récolte</h4>
        <div v-for="job in jobsByCategory(friend.jobs, 'recolte')" :key="job.jobName" class="job-row">
          <div class="job-name">
            <img :src="JOB_ICONS[job.jobName]" :alt="job.jobName" class="job-icon" />
            <span class="job-label">{{ job.jobName }}</span>
          </div>
          <span class="job-value">{{ job.level }}</span>
        </div>
        <h4 class="category-label">Artisanat</h4>
        <div v-for="job in jobsByCategory(friend.jobs, 'artisanat')" :key="job.jobName" class="job-row">
          <div class="job-name">
            <img :src="JOB_ICONS[job.jobName]" :alt="job.jobName" class="job-icon" />
            <span class="job-label">{{ job.jobName }}</span>
          </div>
          <span class="job-value">{{ job.level }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useFriendsStore } from '../stores/friends'
import { JOBS, type JobCategory } from '../../main/jobs'
import { JOB_ICONS } from '../jobIcons'

const authStore = useAuthStore()
const friendsStore = useFriendsStore()

const friendCodeInput = ref('')
const sendError = ref<string | null>(null)

function jobsByCategory(
  jobs: { jobName: string; level: number }[],
  category: JobCategory
): { jobName: string; level: number }[] {
  const levelByName = new Map(jobs.map((j) => [j.jobName, j.level]))
  return JOBS.filter((job) => job.category === category).map((job) => ({
    jobName: job.name,
    level: levelByName.get(job.name) ?? 0
  }))
}

const myRecolteJobs = computed(() => jobsByCategory(friendsStore.myJobs, 'recolte'))
const myArtisanatJobs = computed(() => jobsByCategory(friendsStore.myJobs, 'artisanat'))

onMounted(() => {
  friendsStore.refresh()
})

async function sendRequest(): Promise<void> {
  sendError.value = null
  try {
    await friendsStore.sendRequest(friendCodeInput.value)
    friendCodeInput.value = ''
    await friendsStore.refresh()
  } catch {
    sendError.value = "Impossible d'envoyer la demande (code invalide ?)"
  }
}

function onManualJobChange(jobName: string, event: Event): void {
  const level = Number((event.target as HTMLInputElement).value)
  friendsStore.updateJobManual(jobName, level)
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

.friend-code {
  font-weight: 700;
  color: var(--gold);
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

.add-friend-row {
  display: flex;
  gap: 10px;
}

.full-input {
  flex: 1;
}

.error-text {
  color: var(--danger, #d9534f);
  font-size: 13px;
  margin: 10px 0 0 0;
}

.primary-btn {
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: 7px;
  padding: 10px 16px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.secondary-btn {
  background: transparent;
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  border-radius: 7px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.request-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.request-row:last-child {
  border-bottom: none;
}

.request-actions {
  display: flex;
  gap: 8px;
}

.category-label {
  font-family: 'Cinzel', serif;
  font-weight: 600;
  font-size: 13px;
  color: var(--gold);
  margin: 14px 0 8px 0;
}

.job-icon {
  width: 50px;
  height: 50px;
  border-radius: 6px;
  flex-shrink: 0;
}

.job-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
}

.job-name {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.job-label {
  font-size: 13.5px;
  color: var(--text-primary);
}

.job-value {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-secondary);
}

.job-input {
  width: 80px;
  text-align: right;
}

.friend-block {
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.friend-block:last-child {
  border-bottom: none;
}

.friend-name {
  font-family: 'Cinzel', serif;
  font-size: 15px;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}
</style>
