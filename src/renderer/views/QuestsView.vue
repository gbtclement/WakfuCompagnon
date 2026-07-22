<template>
  <div>
    <div class="page-header">
      <h1 class="h1">Quêtes environnementales</h1>
      <p class="subtitle">Suis les quêtes en cours et repère leur statut</p>
    </div>

    <input v-model="filter" class="search-input" placeholder="Rechercher une quête…" />

    <div class="quest-list">
      <div v-for="quest in filteredQuests" :key="quest.id" class="card quest-card">
        <div class="quest-name-col">
          <span class="quest-name">{{ quest.name }}</span>
          <span class="quest-id">#{{ quest.id }}</span>
        </div>
        <span class="badge" :class="quest.followed ? 'badge-following' : 'badge-pending'">
          {{ quest.followed ? 'Suivie' : 'Non suivie' }}
        </span>
        <button
          class="follow-btn"
          :class="quest.followed ? 'follow-btn-active' : ''"
          @click="quest.followed ? store.unfollowQuest(quest.id) : store.followQuest(quest.id)"
        >
          {{ quest.followed ? 'Ne plus suivre' : 'Suivre' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '../stores/appState'
import quests from '../../main/data/environmentalQuests.json'

const store = useAppStore()
const filter = ref('')

const filteredQuests = computed(() =>
  Object.entries(quests)
    .map(([id, name]) => ({
      id: Number(id),
      name,
      followed: store.config.followedQuestIds.includes(Number(id))
    }))
    .filter((q) => q.name.toLowerCase().includes(filter.value.toLowerCase()))
)
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

.search-input {
  width: 100%;
}

.quest-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.card {
  background: var(--card-bg);
  border: 1.5px solid var(--border);
  border-radius: 9px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.quest-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
}

.quest-name-col {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}

.quest-name {
  font-weight: 700;
  color: var(--text-primary);
  font-size: 15px;
}

.quest-id {
  font-size: 12.5px;
  color: var(--text-secondary);
}

.badge {
  font-size: 12px;
  font-weight: 700;
  border-radius: 20px;
  padding: 4px 12px;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid transparent;
}

.badge-following {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 33%, transparent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 40%, transparent);
}

.badge-pending {
  color: var(--text-secondary);
  background: transparent;
  border-color: var(--border);
}

.follow-btn {
  font-size: 12.5px;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
  color: var(--on-accent);
  background: var(--accent);
  border: none;
  border-radius: 7px;
  padding: 8px 14px;
  cursor: pointer;
}

.follow-btn-active {
  color: #fff;
  background: var(--danger);
}
</style>
