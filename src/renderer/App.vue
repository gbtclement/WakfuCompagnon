<template>
  <div class="app-root">
    <NavBar />
    <main class="app-main">
      <div class="app-content">
        <RouterView />
      </div>
    </main>
    <ToastStack />
    <UpdateBadge />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import NavBar from './components/NavBar.vue'
import ToastStack from './components/ToastStack.vue'
import UpdateBadge from './components/UpdateBadge.vue'
import { useAppStore } from './stores/appState'
import { useAdminStore } from './stores/admin'

const store = useAppStore()
const adminStore = useAdminStore()
onMounted(() => {
  store.load()
  adminStore.load()
})
</script>

<style scoped>
.app-root {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.app-main {
  flex: 1;
  overflow-y: auto;
  padding: 34px 42px;
}

.app-content {
  max-width: 960px;
  min-width: 0;
}
</style>
