<template>
  <div>
    <h1>Quêtes environnementales suivies</h1>
    <ul>
      <li v-for="(name, id) in quests" :key="id">
        {{ name }} (#{{ id }})
        <button v-if="!isFollowed(Number(id))" @click="store.followQuest(Number(id))">Suivre</button>
        <button v-else @click="store.unfollowQuest(Number(id))">Ne plus suivre</button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '../stores/appState'
import quests from '../../main/data/environmentalQuests.json'

const store = useAppStore()

function isFollowed(id: number): boolean {
  return store.config.followedQuestIds.includes(id)
}
</script>
