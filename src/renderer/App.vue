<template>
  <NavBar />
  <RouterView />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import NavBar from './components/NavBar.vue'
import { useAppStore } from './stores/appState'

const store = useAppStore()
onMounted(() => store.load())
</script>
