<template>
  <div>
    <div class="page-header">
      <h1 class="h1">Admin</h1>
      <p class="subtitle">Gestion des quêtes environnementales, archimonstres et exploits</p>
    </div>

    <div class="panel">
      <h2 class="h2">Quêtes environnementales</h2>
      <div v-for="quest in admin.config.environmentalQuests" :key="quest.id" class="row">
        <span class="row-id">#{{ quest.id }}</span>
        <span class="row-name">{{ quest.name }}</span>
        <button class="delete-btn" @click="admin.removeQuest(quest.id)">Retirer</button>
      </div>
      <form class="create-form" @submit.prevent="submitQuest">
        <input v-model.number="newQuestId" type="number" placeholder="ID (ex: -1123)" class="id-field" required />
        <input v-model="newQuestName" placeholder="Nom de la quête" class="field" required />
        <button type="submit" class="primary-btn">Ajouter</button>
      </form>
    </div>

    <div class="panel">
      <h2 class="h2">Archimonstres</h2>
      <div v-for="mob in admin.config.archimonsters" :key="mob.id" class="row">
        <span class="row-name">{{ mob.name }}</span>
        <span class="row-meta">{{ mob.respawnMinutes }} min</span>
        <button class="delete-btn" @click="admin.removeArchimonster(mob.id)">Retirer</button>
      </div>
      <form class="create-form" @submit.prevent="submitArchimonster">
        <input v-model="newMobName" placeholder="Nom de l'archimonstre" class="field" required />
        <input v-model.number="newMobRespawn" type="number" min="1" placeholder="Respawn (min)" class="id-field" required />
        <button type="submit" class="primary-btn">Ajouter</button>
      </form>
    </div>

    <div class="panel">
      <h2 class="h2">Exploits</h2>
      <div v-for="exploit in admin.config.exploits" :key="exploit.id" class="row exploit-row">
        <span class="row-name">{{ exploit.name }}</span>
        <span class="row-meta">{{ exploit.questIds.length }} quête(s), {{ exploit.archimonsterIds.length }} archi(s)</span>
        <button class="delete-btn" @click="admin.removeExploit(exploit.id)">Retirer</button>
      </div>
      <form class="create-form exploit-form" @submit.prevent="submitExploit">
        <input v-model="newExploitName" placeholder="Nom de l'exploit" class="field" required />

        <div class="checkbox-group">
          <span class="checkbox-group-label">Quêtes environnementales</span>
          <label v-for="quest in admin.config.environmentalQuests" :key="quest.id" class="checkbox-item">
            <input type="checkbox" :value="quest.id" v-model="newExploitQuestIds" />
            {{ quest.name }}
          </label>
        </div>

        <div class="checkbox-group">
          <span class="checkbox-group-label">Archimonstres</span>
          <label v-for="mob in admin.config.archimonsters" :key="mob.id" class="checkbox-item">
            <input type="checkbox" :value="mob.id" v-model="newExploitArchimonsterIds" />
            {{ mob.name }}
          </label>
        </div>

        <button type="submit" class="primary-btn">Créer l'exploit</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAdminStore } from '../stores/admin'

const admin = useAdminStore()

const newQuestId = ref<number | null>(null)
const newQuestName = ref('')

function submitQuest(): void {
  if (newQuestId.value === null) return
  admin.addQuest(newQuestId.value, newQuestName.value)
  newQuestId.value = null
  newQuestName.value = ''
}

const newMobName = ref('')
const newMobRespawn = ref(30)

function submitArchimonster(): void {
  admin.addArchimonster(newMobName.value, newMobRespawn.value)
  newMobName.value = ''
  newMobRespawn.value = 30
}

const newExploitName = ref('')
const newExploitQuestIds = ref<number[]>([])
const newExploitArchimonsterIds = ref<string[]>([])

function submitExploit(): void {
  admin.addExploit(newExploitName.value, newExploitQuestIds.value, newExploitArchimonsterIds.value)
  newExploitName.value = ''
  newExploitQuestIds.value = []
  newExploitArchimonsterIds.value = []
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

.h2 {
  font-family: 'Cinzel', serif;
  font-weight: 600;
  font-size: 16px;
  color: var(--gold);
  margin: 0 0 14px 0;
}

.row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 9px 4px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 33%, transparent);
}

.row-id {
  font-size: 12px;
  color: var(--text-secondary);
  width: 64px;
  flex-shrink: 0;
}

.row-name {
  flex: 1;
  color: var(--text-primary);
  font-size: 13.5px;
  font-weight: 600;
}

.row-meta {
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
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

.create-form {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  align-items: center;
}

.exploit-form {
  flex-direction: column;
  align-items: stretch;
}

.field {
  flex: 1;
}

.id-field {
  width: 140px;
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

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 10px 12px;
  max-height: 160px;
  overflow-y: auto;
}

.checkbox-group-label {
  font-size: 11.5px;
  color: var(--text-secondary);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
}
</style>
