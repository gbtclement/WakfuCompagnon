<template>
  <div>
    <h1>Réglages</h1>
    <p>Chemin du fichier de log : {{ store.config.logPath ?? 'non configuré' }}</p>
    <button @click="store.browseLogFile()">Parcourir...</button>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '../stores/appState'

const store = useAppStore()
</script>
