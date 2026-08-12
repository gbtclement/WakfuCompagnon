<template>
  <div class="panel">
    <h2 class="h2">Comptes</h2>

    <div v-if="editingUser === null">
      <div v-for="user in store.users" :key="user.id" class="row user-row">
        <div class="user-info">
          <span class="row-name">{{ user.username }}</span>
          <span class="row-meta">{{ user.email }} — {{ user.role }} — inscrit le {{ formatDate(user.createdAt) }}</span>
        </div>
        <button class="secondary-btn" @click="startEdit(user)">Éditer</button>
        <button class="delete-btn" @click="confirmDelete(user)">Supprimer</button>
      </div>
      <p v-if="store.users.length === 0" class="subtitle">Aucun compte inscrit.</p>
    </div>

    <form v-else class="edit-form" @submit.prevent="submitEdit">
      <label class="field-label">Pseudo</label>
      <input v-model="editUsername" class="field full-input" type="text" required minlength="3" />

      <label class="field-label">Email</label>
      <input v-model="editEmail" class="field full-input" type="email" required />

      <h3 class="category-label">Récolte</h3>
      <div v-for="job in recolteJobs" :key="job.name" class="job-row">
        <img :src="JOB_ICONS[job.name]" :alt="job.name" class="job-icon" />
        <label class="job-label">{{ job.name }}</label>
        <input
          v-model.number="editJobLevels[job.name]"
          class="field job-input"
          type="number"
          min="0"
          max="155"
        />
      </div>

      <h3 class="category-label">Artisanat</h3>
      <div v-for="job in artisanatJobs" :key="job.name" class="job-row">
        <img :src="JOB_ICONS[job.name]" :alt="job.name" class="job-icon" />
        <label class="job-label">{{ job.name }}</label>
        <input
          v-model.number="editJobLevels[job.name]"
          class="field job-input"
          type="number"
          min="0"
          max="155"
        />
      </div>

      <div class="button-row">
        <button class="secondary-btn" type="button" @click="cancelEdit">Annuler</button>
        <button class="primary-btn" type="submit">Enregistrer</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useAdminUsersStore, type AdminUserView } from '../stores/adminUsers'
import { JOBS } from '../../main/jobs'
import { JOB_ICONS } from '../jobIcons'

const recolteJobs = computed(() => JOBS.filter((j) => j.category === 'recolte'))
const artisanatJobs = computed(() => JOBS.filter((j) => j.category === 'artisanat'))

const store = useAdminUsersStore()

const editingUser = ref<AdminUserView | null>(null)
const editUsername = ref('')
const editEmail = ref('')
const editJobLevels = reactive<Record<string, number>>({})

onMounted(() => {
  store.refresh()
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR')
}

function startEdit(user: AdminUserView): void {
  editingUser.value = user
  editUsername.value = user.username
  editEmail.value = user.email
  for (const job of JOBS) {
    const existing = user.jobs.find((j) => j.jobName === job.name)
    editJobLevels[job.name] = existing?.level ?? 0
  }
}

function cancelEdit(): void {
  editingUser.value = null
}

async function submitEdit(): Promise<void> {
  if (!editingUser.value) return
  await store.updateUser(editingUser.value.id, {
    username: editUsername.value,
    email: editEmail.value,
    jobs: { ...editJobLevels }
  })
  editingUser.value = null
}

function confirmDelete(user: AdminUserView): void {
  if (window.confirm(`Supprimer définitivement le compte "${user.username}" ?`)) {
    store.deleteUser(user.id)
  }
}
</script>

<style scoped>
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

.subtitle {
  font-size: 14px;
  color: var(--text-secondary);
}

.row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 9px 4px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 33%, transparent);
}

.user-row {
  justify-content: space-between;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.row-name {
  color: var(--text-primary);
  font-size: 13.5px;
  font-weight: 600;
}

.row-meta {
  font-size: 12px;
  color: var(--text-secondary);
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
  white-space: nowrap;
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
  flex-shrink: 0;
}

.edit-form {
  display: flex;
  flex-direction: column;
}

.field-label {
  display: block;
  font-size: 12.5px;
  color: var(--text-secondary);
  font-weight: 600;
  margin: 14px 0 6px 0;
}

.full-input {
  width: 100%;
  box-sizing: border-box;
}

.category-label {
  font-family: 'Cinzel', serif;
  font-weight: 600;
  font-size: 13px;
  color: var(--gold);
  margin: 18px 0 8px 0;
}

.job-icon {
  width: 26px;
  height: 26px;
  border-radius: 4px;
  flex-shrink: 0;
}

.job-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
}

.job-label {
  font-size: 13.5px;
  color: var(--text-primary);
}

.job-input {
  width: 80px;
  text-align: right;
}

.button-row {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.primary-btn {
  flex: 1;
  background: var(--accent);
  color: var(--on-accent);
  border: none;
  border-radius: 7px;
  padding: 11px 16px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
</style>
